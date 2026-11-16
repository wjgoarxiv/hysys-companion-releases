import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { demoClient, type DemoClient } from "../api/client";
import { catalog, useLocale, useT, type MessageKey, type Translate, type UiLocale } from "../i18n";
import { hashFor } from "../router";
import {
  answerNewCase,
  approveNewCase,
  cancelNewCase,
  repairNewCase,
  resumeNewCase,
  recheckNewCase,
  confirmNewCase,
  listNewCaseTemplates,
  openNewCaseFolder,
  startImage,
  startTemplate,
  startWords,
  reviseNewCase,
} from "./client";
import { AwaySummary } from "./AwaySummary";
import { RevisePanel } from "./RevisePanel";
import { PdfPagePicker } from "./PdfPagePicker";
import { fetchPdfPages, isPdfUpload, PDF_MIME, type PdfPages } from "./pdfClient";
import { applyEdits, beginRevise, canRevise, emptyRevision, revisionReady, touchedNames } from "./revise";
import { useNow } from "../studies/RunProgress";
import { clockText } from "../studies/model";
import { subscribeNewCaseSeed, takeNewCaseSeed } from "../agent/newCaseSeed";
import { DraftTopology } from "./DraftTopology";
import { AssumptionList } from "./AssumptionList";
import { WordsExamples } from "./WordsExamples";
import {
  beginAnswer, beginConfirm, beginRepair, canApprove, canContinueRepair, canOfferRepair, canRecheck, canRepairBlocked, canResume, canResumeLost, canWaitForConfirm, cannotStop, endAnswer, initialFlowState, isAnswering, isApplyInProgress, isUnconverged, jobActive,
  toggleConfirmation, type ClarifyState, type FlowStage, type FlowState, type LiveInfo,
} from "./flow";
import { PfdDemos } from "./PfdDemos";
import { PfdSheetView } from "../pfdsheet/PfdSheetView";
import { sheetModelFromDraft } from "../pfdsheet/model";
import { HysysLaunch } from "../connection/LaunchAction";
import { createNewCaseRunStore, newCaseRun, type NewCaseEntry, type NewCaseRun, type Update } from "./runStore";
import { changedParams, questionSuggestion, stripDataUrlPrefix, validateImageFile, type DofAnswer, type QuestionOption, type TemplateDef, type UnappliedItem } from "./types";

export type NewCaseViewProps = {
  client?: Pick<DemoClient, "getJson" | "postJson" | "postSse">;
  initialState?: FlowState;
  initialEntry?: "words" | "template" | "image";
  onOpened?: (path: string) => void;
};

type EntryMode = NewCaseEntry;

const STAGE_MESSAGE_KEYS: Record<string, MessageKey> = {
  clarify: "newcase.stage.clarify",
  research: "newcase.stage.research",
  intent: "newcase.stage.intent",
  draft: "newcase.stage.draft",
  refine: "newcase.stage.refine",
  design: "newcase.stage.design",
  repair: "newcase.stage.repair",
  preview: "newcase.stage.preview",
  verify: "newcase.stage.verify",
  template: "newcase.stage.template",
  observe: "newcase.stage.observe",
  apply: "newcase.stage.apply",
  open: "newcase.stage.open",
  revise: "newcase.stage.revise",
};

export function resolveStageLabel(stage: FlowStage, locale: UiLocale, lookup: (key: MessageKey) => string): string {
  if (locale === "ko") return stage.ko ?? lookup(STAGE_MESSAGE_KEYS[stage.id] ?? "newcase.stageUnknown");
  return stage.en ?? lookup(STAGE_MESSAGE_KEYS[stage.id] ?? "newcase.stageUnknown");
}

export const stagesFinished = (state: FlowState): boolean => state.phase === "awaiting_approval";

const STEP_PLAN: Record<string, string[]> = {
  words: ["intent", "draft", "refine", "design", "preview", "verify", "approve"],
  image: ["observe", "draft", "refine", "design", "preview", "verify", "approve"],
  template: ["template", "preview", "verify", "approve"],
};
export const SLOW_STEP_S = 90;

export type TrackStep = { id: string; state: "done" | "now" | "next"; extra?: boolean };

export function stepTrack(mode: string | null, stages: FlowStage[], finished: boolean): TrackStep[] {
  const seen: string[] = [];
  for (const stage of stages) if (seen[seen.length - 1] !== stage.id) seen.push(stage.id);
  const named = STEP_PLAN[mode ?? ""] ?? [];
  const plan = named.length ? [...named, "apply", "open"] : [];
  const track = [...plan];
  let after = -1;
  for (const id of seen) {
    const at = track.indexOf(id);
    if (at >= 0) after = at;
    else track.splice(++after, 0, id);
  }
  const current = finished ? "approve" : seen[seen.length - 1];
  const now = current ? track.lastIndexOf(current) : -1;
  return track.map((id, index) => ({
    id, state: index === now ? "now" : index < now || (!plan.includes(id) && seen.includes(id)) ? "done" : "next",
    ...(plan.includes(id) ? {} : { extra: true }),
  }));
}

export function stepNumber(track: TrackStep[], index: number): { n: number; total: number } {
  const total = track.filter((step) => !step.extra).length;
  const n = track.slice(0, index + 1).filter((step) => !step.extra).length;
  return { n: Math.max(1, n), total };
}

const stepName = (id: string, t: (key: MessageKey) => string): string =>
  id === "approve" ? t("newcase.step.approve") : t(STAGE_MESSAGE_KEYS[id] ?? "newcase.stageUnknown");

const APPROVAL_WARN_S = 120;

export function ApprovalActions({ approval, busy, canGo, onApprove, onRecheck, now, since: arrivedAt }: {
  approval: { approval_token: string; ttl_seconds: number | null } | null; busy: boolean; canGo: boolean;
  onApprove: () => void; onRecheck: () => void; now?: number;
  since?: number;
}) {
  const t = useT();
  const ticking = useNow();
  const at = now ?? ticking;
  const since = useRef<{ token: string; at: number } | null>(null);
  const token = approval?.approval_token ?? "";
  if (!since.current || since.current.token !== token) since.current = { token, at: arrivedAt ?? at };
  const ttl = approval?.ttl_seconds ?? null;
  const left = ttl === null ? null : Math.max(0, ttl - Math.floor((at - since.current.at) / 1000));
  const expired = left === 0;
  return (
    <>
      {expired ? (
        <button type="button" className="ui-btn ui-btn--primary" data-newcase-recheck disabled={busy} onClick={onRecheck}>{t("newcase.recheck")}</button>
      ) : (
        <button type="button" className="ui-btn ui-btn--primary" disabled={busy || !canGo} onClick={onApprove}>{t("newcase.approve")}</button>
      )}
      {left !== null && (
        <span role="timer" className={`ui-meta wb-approve__clock${left < APPROVAL_WARN_S ? " is-warn" : ""}`} data-newcase-approval-clock>
          {expired ? t("newcase.approvalExpired") : t("newcase.approvalLeft", { time: clockText(left) })}
        </span>
      )}
    </>
  );
}

const USUAL_S: Record<string, [number, number]> = {
  observe: [20, 60], draft: [30, 90], refine: [10, 60], design: [60, 180], preview: [10, 40],
  repair: [30, 120], verify: [30, 180], template: [5, 20], apply: [20, 60], open: [5, 20], revise: [1, 5],
};

const HEADS_UP: Record<string, MessageKey> = { refine: "newcase.headsup.refine", approve: "newcase.headsup.approve" };

const spanText = (s: number, t: Translate): string =>
  s < 60 ? t("newcase.unit.s", { n: s }) : s % 60 === 0 ? t("newcase.unit.m", { n: s / 60 }) : t("newcase.unit.ms", { m: Math.floor(s / 60), s: s % 60 });

export const NO_SIGNAL_S = 30;

function serverLine(live: LiveInfo | undefined, current: FlowStage | undefined, locale: UiLocale): string | null {
  const last = live?.lines[live.lines.length - 1];
  if (!last || !current || last.stage !== current.id) return null;
  return locale === "ko" ? last.ko : last.en;
}

function activityLine(stages: FlowStage[], locale: UiLocale, t: Translate, live?: LiveInfo): string | null {
  const current = stages[stages.length - 1];
  if (!current) return null;
  const said = serverLine(live, current, locale);
  if (said) return said;
  const agent = [...stages].reverse().find((stage) => stage.agent && stage.state === "running");
  if (agent && current.id === "design") return resolveStageLabel(agent, locale, t);
  const repairs = stages.filter((stage, i) => stage.id === "repair" && stages[i - 1]?.id !== "repair").length;
  if (current.id === "repair" && repairs > 1) return t("newcase.activity.repair", { n: repairs });
  const found = [...stages].reverse().find((stage) => stage.units !== undefined && stage.streams !== undefined);
  return found ? t("newcase.activity.found", { units: found.units ?? 0, streams: found.streams ?? 0 }) : null;
}

export function StageList({ stages, busy, finished = false, mode = null, phase, now, onCancel, waiting: dialogWait = null, since, live }: {
  stages: FlowStage[]; busy: boolean; finished?: boolean; mode?: string | null; phase?: FlowState["phase"]; now?: number;
  onCancel?: () => void; waiting?: { text: string } | null;
  since?: { run: number | null; step: number | null; signal?: number | null };
  live?: LiveInfo;
}) {
  const t = useT();
  const locale = useLocale();
  const ticking = useNow();
  const at = now ?? ticking;
  const clock = useRef<{ count: number; step: number; first: number } | null>(null);
  if (!clock.current || stages.length < clock.current.count) clock.current = { count: stages.length, step: since?.step ?? at, first: since?.run ?? at };
  else if (stages.length !== clock.current.count) clock.current = { ...clock.current, count: stages.length, step: at };
  if (stages.length === 0 && !busy) return null;
  const current = stages[stages.length - 1];
  const track = stepTrack(mode, stages, finished);
  const position = track.findIndex((step) => step.state === "now");
  const waiting = phase === "needs_input" || phase === "awaiting_verify_confirm";
  const stopped = phase === "error";
  const running = busy && !finished && !waiting && !stopped;
  const locked = cannotStop({ ...initialFlowState(), phase: phase ?? "idle", busy, stages });
  const tone = finished ? "positive" : stopped ? "warning" : "info";
  const label = finished ? t("newcase.stagesFinished")
    : waiting ? t(phase === "needs_input" ? "newcase.step.waitAnswer" : "newcase.step.waitConfirm")
    : current ? resolveStageLabel(current, locale, t) : t("newcase.loading");
  const stepStart = since?.step ?? clock.current.step;
  const stepS = Math.max(0, (at - stepStart) / 1000);
  const totalS = Math.max(0, (at - (since?.run ?? clock.current.first)) / 1000);
  const quietS = Math.max(0, (at - (since?.signal ?? stepStart)) / 1000);
  const what = current && running ? STEP_WHAT[current.id] : undefined;
  const agents = stages.filter((stage) => stage.agent);
  const activity = running ? activityLine(stages, locale, t, live) : null;
  const lines = [...(live?.lines ?? [])].reverse();
  const usual = current && running ? USUAL_S[current.id] : undefined;
  const meaning = (id: string): string | undefined => (id in STEP_WHAT || id === "approve" ? t(`newcase.mean.${id}` as MessageKey) : undefined);
  return (
    <section className="wb-steps" aria-label={t("newcase.stepsTitle")} data-step={finished ? "finished" : current?.id ?? ""} data-newcase="steps" data-running={running ? "" : undefined}>
      {running && <span className="wb-steps__sweep" data-newcase="progress-sweep" aria-hidden="true"><span /></span>}
      <p className="wb-steps__now" role="status">
        <span key={finished ? "finished" : `step-${stages.length}`} className={`ui-status ui-status--${tone} ${finished ? "wb-pop" : "wb-step-in"}`}
          data-live={running ? "" : undefined}>
          {position >= 0 && !finished && <span className="wb-steps__count ui-num">{t("newcase.step.of", stepNumber(track, position))} · </span>}
          {label}
        </span>
      </p>
      {what && <p className="ui-meta wb-steps__what">{t(what)}</p>}
      {activity && <p className="wb-steps__activity" data-newcase="activity">{activity}</p>}
      {running && (
        <p className="ui-meta ui-num wb-steps__clock">
          {t("newcase.step.time", { step: clockText(stepS), total: clockText(totalS) })}
          {usual && ` · ${t("newcase.usually", { range: t("newcase.range", { from: spanText(usual[0], t), to: spanText(usual[1], t) }) })}`}
        </p>
      )}
      {running && <p className="ui-meta ui-num wb-steps__signal" data-newcase="signal">{t("newcase.step.signal", { time: clockText(quietS) })}</p>}
      {running && quietS > NO_SIGNAL_S && <p className="ui-meta wb-steps__quiet" data-newcase="silent">{t("newcase.step.quiet", { time: clockText(quietS) })}</p>}
      {running && stepS >= SLOW_STEP_S && <p className="ui-callout ui-callout--info wb-steps__slow">{t("newcase.step.slow")}</p>}
      {running && dialogWait && <p className="ui-callout ui-callout--info wb-steps__wait" data-newcase="hysys-dialog-wait">{dialogWait.text ? t("newcase.waiting", { text: dialogWait.text }) : t("newcase.waitingGeneric")}</p>}
      {running && (
        <details className="wb-steps__live" data-newcase="live-details">
          <summary>{t("newcase.live.title")}</summary>
          <dl className="wb-steps__facts ui-num">
            <div><dt>{t("newcase.live.step")}</dt><dd>{position >= 0 ? `${t("newcase.step.of", stepNumber(track, position))} · ` : ""}{label}</dd></div>
            <div><dt>{t("newcase.live.doing")}</dt><dd data-live-now>{serverLine(live, current, locale) ?? t("newcase.live.doingNone")}</dd></div>
            <div><dt>{t("newcase.live.thisStep")}</dt><dd>{clockText(stepS)}</dd></div>
            <div><dt>{t("newcase.live.total")}</dt><dd>{clockText(totalS)}</dd></div>
            <div><dt>{t("newcase.live.signal")}</dt><dd>{t("newcase.live.ago", { time: clockText(quietS) })}</dd></div>
            {live?.elapsedS != null && <div><dt>{t("newcase.live.server")}</dt><dd>{clockText(live.elapsedS)}</dd></div>}
            {dialogWait && <div><dt>{t("newcase.live.dialog")}</dt><dd data-live-dialog>{dialogWait.text || t("newcase.waitingGeneric")}</dd></div>}
          </dl>
          <p className="ui-meta">{t("newcase.live.recent")}</p>
          {lines.length > 0 ? (
            <ol className="wb-steps__lines" data-newcase="live-lines">
              {lines.map((line, index) => <li key={`${lines.length - index}-${line.ko}`} data-live-line={line.sub ?? ""}>{locale === "ko" ? line.ko : line.en}</li>)}
            </ol>
          ) : <p className="ui-meta">{t("newcase.live.noLines")}</p>}
        </details>
      )}
      {running && onCancel && !locked && (
        <div className="ui-form-actions"><button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" data-newcase="cancel" onClick={onCancel}>{t("newcase.cancel")}</button></div>
      )}
      {running && onCancel && locked && <p className="ui-meta" data-newcase="cancel-locked">{t("newcase.cancelLocked")}</p>}
      {track.length > 0 && (
        <ol className="wb-steps__track" aria-label={t("newcase.step.path")}>
          {track.map((step, index) => (
            <li key={`${step.id}-${index}`} data-step-state={step.state} data-newcase-stage={step.id}
              aria-current={step.state === "now" ? "step" : undefined}
              title={step.id === "design" && step.state !== "now" && agents.length > 0 ? agents.map((stage) => resolveStageLabel(stage, locale, t)).join(" · ") : meaning(step.id)}>
              <span className="wb-steps__mark" aria-hidden="true">{step.state === "done" ? "✓" : step.extra ? "+" : stepNumber(track, index).n}</span>
              <span className="wb-steps__name">{stepName(step.id, t)}</span>
              <span className="ui-visually-hidden">{t(`newcase.step.state.${step.state}` as MessageKey)}</span>
              {HEADS_UP[step.id] && (
                <span className="wb-steps__heads" data-newcase-headsup><span aria-hidden="true">!</span><span className="ui-visually-hidden">{t(HEADS_UP[step.id])}</span></span>
              )}
              {step.id === "design" && step.state === "now" && agents.length > 0 && (
                <span className="ui-meta wb-steps__agents">({agents.map((stage) => resolveStageLabel(stage, locale, t)).join(" · ")})</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {track.length > 0 && (
        <details className="wb-steps__guide" data-newcase="step-guide">
          <summary>{t("newcase.guide")}</summary>
          <ul>
            {track.map((step, index) => (
              <li key={`${step.id}-${index}`} data-guide-step={step.id}>
                <strong>{stepName(step.id, t)}</strong> {meaning(step.id)}
                {HEADS_UP[step.id] && <span className="wb-steps__heads-text"> ({t(HEADS_UP[step.id])})</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const STEP_WHAT: Record<string, MessageKey> = {
  clarify: "newcase.what.clarify", intent: "newcase.what.intent", draft: "newcase.what.draft", refine: "newcase.what.refine", design: "newcase.what.design",
  preview: "newcase.what.preview", repair: "newcase.what.repair", verify: "newcase.what.verify", template: "newcase.what.template",
  observe: "newcase.what.observe", apply: "newcase.what.apply", open: "newcase.what.open", revise: "newcase.what.revise",
};

const CLARIFY_ASPECTS = ["equipment", "feed", "conditions", "goal"] as const;

export function ClarifyGauge({ clarify }: { clarify: ClarifyState }) {
  const t = useT();
  const rows = CLARIFY_ASPECTS.map((id) => clarify.aspects.find((a) => a.id === id) ?? { id, ok: false, found: [], missing: [] });
  const known = clarify.answered ? clarify.total : clarify.clear;
  return (
    <div className="wb-clarify__gauge" data-newcase="clarify-gauge">
      <p className="wb-clarify__score">
        <span className="ui-num wb-clarify__count">{known}/{clarify.total}</span>
        <span>{clarify.answered ? t("newcase.clarify.answered") : known === clarify.total ? t("newcase.clarify.allClear") : t("newcase.clarify.score")}</span>
      </p>
      <ol className="wb-clarify__bar" role="meter" aria-valuemin={0} aria-valuemax={clarify.total} aria-valuenow={known}
        aria-label={t("newcase.clarify.meter")}>
        {rows.map((row, index) => {
          const ok = clarify.answered || row.ok;
          return (
            <li key={row.id} data-ok={ok ? "" : undefined} style={{ "--i": index } as CSSProperties}>
              <span className="wb-clarify__seg" aria-hidden="true" />
              <span className="wb-clarify__name">
                <span aria-hidden="true">{ok ? "✓" : "?"}</span> {t(`newcase.clarify.aspect.${row.id}` as MessageKey)}
              </span>
              <span className="ui-visually-hidden">{t(ok ? "newcase.clarify.known" : "newcase.clarify.open")}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function useAnswers(kept?: Record<string, string>, onKept?: (change: Update<Record<string, string>>) => void) {
  const [own, setOwn] = useState<Record<string, string>>({});
  return onKept ? ([kept ?? {}, onKept] as const) : ([own, setOwn] as const);
}

export function ClarifyForm({ clarify, questions, busy, onSubmit, answers, onAnswers }: {
  clarify: ClarifyState;
  questions: { id: string; label: string; raw: unknown }[];
  busy: boolean;
  onSubmit: (answers: Record<string, string>) => void;
  answers?: Record<string, string>;
  onAnswers?: (change: Update<Record<string, string>>) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [values, setValues] = useAnswers(answers, onAnswers);
  const suggestion = (raw: unknown): string => {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const text = locale === "ko" ? row.suggestion_ko ?? row.suggestion_en : row.suggestion_en ?? row.suggestion_ko;
    return typeof text === "string" ? text : "";
  };
  return (
    <form className="wb-clarify" data-newcase="clarify" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
      <div className="wb-clarify__head">
        <p className="ui-h4">{t("newcase.clarify.title")}</p>
        <p className="ui-meta">{t("newcase.clarify.hint")}</p>
      </div>
      <ClarifyGauge clarify={clarify} />
      <ol className="wb-clarify__questions">
        {questions.map((question, index) => {
          const offer = suggestion(question.raw);
          const value = values[question.id] ?? "";
          const taken = offer !== "" && value === offer;
          return (
            <li key={question.id} className="wb-pop" style={{ animationDelay: `${index * 60}ms` }}>
              <label className="ui-field">
                <span className="ui-field__label">{question.label}</span>
                <textarea className="ui-textarea wb-clarify__answer" name={question.id} rows={2} value={value}
                  placeholder={offer ? t("newcase.clarify.blankTakes") : undefined}
                  onChange={(event) => setValues((prev) => ({ ...prev, [question.id]: event.target.value }))} />
              </label>
              {offer && (
                <button type="button" className="wb-clarify__offer" data-taken={taken ? "" : undefined} aria-pressed={taken}
                  onClick={() => setValues((prev) => ({ ...prev, [question.id]: taken ? "" : offer }))}>
                  <span className="ui-meta">{t(taken ? "newcase.clarify.taken" : "newcase.clarify.take")}</span>
                  <span>{offer}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="ui-form-actions">
        <button type="submit" className="ui-btn ui-btn--primary" disabled={busy} aria-busy={busy}>{t("newcase.clarify.go")}</button>
      </div>
    </form>
  );
}

export function QuestionsForm({
  questions,
  busy,
  onSubmit,
  answers,
  onAnswers,
}: {
  questions: { id: string; label: string; options: QuestionOption[]; raw?: unknown }[];
  busy: boolean;
  onSubmit: (answers: Record<string, string>) => void;
  answers?: Record<string, string>;
  onAnswers?: (change: Update<Record<string, string>>) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [values, setValues] = useAnswers(answers, onAnswers);
  if (questions.length === 0) return null;
  return (
    <form
      data-newcase="questions"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="ui-stack">
        <p className="ui-h4">{t("newcase.questionsTitle")} <span className="ui-meta">{t("newcase.questionsHint")}</span></p>
        {questions.map((question) => {
          const offer = question.options.length === 0 ? questionSuggestion(question.raw, locale) : null;
          const taken = offer !== null && values[question.id] === offer.text;
          const field = (
            <label className="ui-field">
              <span className="ui-field__label">{question.label}</span>
              {question.options.length > 0 ? (
                <select
                  className="ui-select"
                  name={question.id}
                  value={values[question.id] ?? ""}
                  onChange={(event) => setValues((prev) => ({ ...prev, [question.id]: event.target.value }))}
                >
                  <option value="">{t("newcase.answerChoose")}</option>
                  {question.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="ui-input"
                  name={question.id}
                  value={values[question.id] ?? ""}
                  onChange={(event) => setValues((prev) => ({ ...prev, [question.id]: event.target.value }))}
                />
              )}
            </label>
          );
          if (!offer) return <Fragment key={question.id}>{field}</Fragment>;
          return (
            <div className="wb-offer-field" key={question.id}>
              {field}
              <button type="button" className="wb-clarify__offer" data-taken={taken ? "" : undefined} aria-pressed={taken}
                onClick={() => setValues((prev) => ({ ...prev, [question.id]: taken ? "" : offer.text }))}>
                <span className="ui-meta">{t(taken ? "newcase.clarify.taken" : "newcase.clarify.take")}</span>
                <span>{offer.text}</span>
                {offer.why && <span className="ui-meta">{offer.why}</span>}
              </button>
            </div>
          );
        })}
        <button type="submit" className="ui-btn ui-btn--primary" disabled={busy} aria-busy={busy}>
          {t("newcase.answerSubmit")}
        </button>
      </div>
    </form>
  );
}

const TEMPLATE_GROUPS = ["process", "unit"] as const;

export const firstTemplateKind = (templates: TemplateDef[]): string =>
  (templates.find((row) => row.group === "process") ?? templates[0])?.kind ?? "";

export function TemplateForm({ templates, kind, edits, onKind, onEdit }: {
  templates: TemplateDef[];
  kind: string;
  edits: Record<string, string>;
  onKind: (kind: string) => void;
  onEdit: (name: string, value: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const pick = (ko: string, en: string): string => (locale === "ko" ? ko : en);
  const template = templates.find((row) => row.kind === kind);
  return (
    <>
      <label className="ui-field">
        <span className="ui-field__label">{t("newcase.templateKind")}</span>
        <select className="ui-select" value={kind} onChange={(event) => onKind(event.target.value)} aria-describedby="wb-template-about">
          {TEMPLATE_GROUPS.map((group) => {
            const rows = templates.filter((row) => row.group === group);
            return rows.length > 0 && (
              <optgroup key={group} label={t(`newcase.templateGroup.${group}` as MessageKey)}>
                {rows.map((row) => (
                  <option key={row.kind} value={row.kind}>
                    {pick(row.display_ko, row.display_en)}{row.group === "process" && row.units ? ` · ${t("newcase.templateUnits", { count: row.units })}` : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </label>
      {template && (
        <p className="ui-meta" id="wb-template-about" data-newcase="template-about">
          {pick(template.description_ko, template.description_en) || t(`newcase.templateGroupHint.${template.group}` as MessageKey)}
          {template.group === "process" && template.units ? ` ${t("newcase.templateUnitsLong", { count: template.units })}` : ""}
        </p>
      )}
      {template && template.params.length > 0 && (
        <fieldset className="wb-params" data-newcase="template-params">
          <legend className="ui-visually-hidden">{t("newcase.templateParams")}</legend>
          <p className="ui-meta">{t("newcase.templateParamsHint")}</p>
          <div className="wb-params__grid">
            {template.params.map((param) => (
              <label className="ui-field" key={`${template.kind}-${param.name}`}>
                <span className="ui-field__label">
                  {pick(param.label_ko, param.label_en)}
                  {param.unit ? <span className="ui-meta"> ({param.unit})</span> : null}
                </span>
                <input
                  className="ui-input ui-num"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  name={param.name}
                  min={param.min}
                  max={param.max}
                  value={edits[param.name] ?? String(param.default)}
                  onChange={(event) => onEdit(param.name, event.target.value)}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {template && template.fixed.length > 0 && (
        <dl className="wb-facts" data-newcase="template-fixed" aria-label={t("newcase.templateFixed")}>
          {template.fixed.map((row) => (
            <div key={row.name}>
              <dt className="ui-meta">{pick(row.label_ko, row.label_en)}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

export function UnappliedList({ items }: { items: UnappliedItem[] }) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <section className="ui-stack ui-stack--tight wb-unapplied" data-newcase="unapplied" aria-label={t("newcase.unapplied.title")}>
      <p className="ui-meta"><strong>{t("newcase.unapplied.title")}</strong> · {t("newcase.unapplied.hint")}</p>
      <ul className="ui-stack ui-stack--tight">
        {items.map((item, index) => {
          const propKey = `newcase.unapplied.prop.${item.property}`;
          const property = t((propKey in catalog ? propKey : "newcase.unapplied.prop.unknown") as MessageKey);
          return (
            <li key={`${item.target}-${item.property}-${index}`} data-newcase-unapplied>
              <span className="ui-num">{t("newcase.unapplied.row", { target: item.target, property, value: item.value })}</span>
              <span className="ui-meta"> — {t(`newcase.unapplied.reason.${item.reason}` as MessageKey)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function useTemplates(client: Pick<DemoClient, "getJson"> | undefined, active: boolean) {
  const [templates, setTemplates] = useState<TemplateDef[] | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!active || !client) return;
    let cancelled = false;
    setError(false);
    listNewCaseTemplates(client)
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active, client, reload]);
  return { templates, error, retry: () => { setTemplates(null); setReload((n) => n + 1); } };
}

export function NewCaseView(props: NewCaseViewProps) {
  const t = useT();
  const liveClient = useMemo(() => demoClient() as Pick<DemoClient, "getJson" | "postJson" | "postSse">, []);
  const client = props.client ?? liveClient;
  const [pdfPages, setPdfPages] = useState<PdfPages | null>(null);
  const [pdfPage, setPdfPage] = useState(0);
  const [store] = useState(() => (props.initialState || props.initialEntry
    ? createNewCaseRunStore({ ...(props.initialState ? { state: props.initialState } : {}), ...(props.initialEntry ? { entry: props.initialEntry } : {}) })
    : newCaseRun));
  const adoptSeed = (notify: boolean): void => {
    if (!store.takesSeed()) return;
    const seed = takeNewCaseSeed();
    if (seed) store.seed(seed, notify);
  };
  useState(() => adoptSeed(false));
  const ui = useSyncExternalStore(store.subscribe, store.get, store.get);
  const { entry, state, words, fromAgent, templateKind, edits, imageB64, imageMime, imagePreview, imageProblem, took, repairArmed } = ui;
  const setEntry = (value: Update<NewCaseRun["entry"]>) => store.set("entry", value);
  const setState = (value: Update<FlowState>) => store.set("state", value);
  const setWords = (value: Update<string>) => store.set("words", value);
  const setTemplateKind = (value: Update<string>) => store.set("templateKind", value);
  const setEdits = (value: Update<Record<string, string>>) => store.set("edits", value);
  const setImageB64 = (value: Update<string | null>) => store.set("imageB64", value);
  const setImageMime = (value: Update<string | null>) => store.set("imageMime", value);
  const setImagePreview = (value: Update<string | null>) => store.set("imagePreview", value);
  const setImageProblem = (value: Update<NewCaseRun["imageProblem"]>) => store.set("imageProblem", value);
  const setRepairArmed = (value: Update<boolean>) => store.set("repairArmed", value);
  useEffect(() => subscribeNewCaseSeed(() => adoptSeed(true)), [store]);
  useEffect(() => store.attach(), [store]);
  const [folderFailed, setFolderFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onOpened = props.onOpened;
  useEffect(() => {
    store.onOpened = (path) => { onOpened?.(path); };
    return () => { store.onOpened = undefined; };
  }, [store, onOpened]);
  const templates = useTemplates(entry === "template" ? client : undefined, entry === "template");

  const sse = (start: (signal: AbortSignal, onEvent: (name: string, data: unknown) => void) => Promise<void>, settle: () => void): Promise<void> =>
    store.drive(start, settle);

  const busy = state.busy;
  const running = jobActive(state);
  const pickedTemplate = (templates.templates ?? []).find((row) => row.kind === templateKind);

  useEffect(() => {
    if (!templateKind && templates.templates?.[0]) setTemplateKind(firstTemplateKind(templates.templates));
  }, [templates.templates, templateKind]);

  const resetAll = (): void => {
    store.reset();
  };

  const beginWords = async (text: string, armed = repairArmed, dofAnswers: DofAnswer[] = []): Promise<void> => {
    setState({ ...initialFlowState(), dofAnswers, mode: "words", phase: "starting", busy: true });
    await sse((signal, onEvent) => startWords(client, text, onEvent, { signal, ...(armed ? { repair: true, dofAnswers } : {}) }),
      () => setState((prev) => (prev.busy && prev.phase === "starting" ? { ...prev, busy: false } : prev)));
  };

  const beginTemplate = async (armed = repairArmed, dofAnswers: DofAnswer[] = []): Promise<void> => {
    if (!templateKind) return;
    setState({ ...initialFlowState(), dofAnswers, mode: "template", phase: "starting", busy: true });
    await sse((signal, onEvent) => startTemplate(client, templateKind, pickedTemplate ? changedParams(pickedTemplate, edits) : {}, onEvent, { signal, ...(armed ? { repair: true, dofAnswers } : {}) }),
      () => setState((prev) => (prev.busy && prev.phase === "starting" ? { ...prev, busy: false } : prev)));
  };

  const beginImage = async (armed = repairArmed, dofAnswers: DofAnswer[] = []): Promise<void> => {
    if (!imageB64) return;
    setState({ ...initialFlowState(), dofAnswers, mode: "image", phase: "starting", busy: true });
    await sse((signal, onEvent) => startImage(client, imageB64, onEvent, { signal, ...(imageMime ? { mime: imageMime } : {}), ...(imageMime === PDF_MIME ? { page: pdfPage } : {}), ...(armed ? { repair: true, dofAnswers } : {}) }),
      () => setState((prev) => (prev.busy && prev.phase === "starting" ? { ...prev, busy: false } : prev)));
  };

  const confirmVerify = async (): Promise<void> => {
    if (!state.jobId) return;
    setState((prev) => beginConfirm(prev));
    const jobId = state.jobId;
    await sse((signal, onEvent) => confirmNewCase(client, jobId, onEvent, { signal }),
      () => setState((prev) => (prev.phase === "verifying" ? { ...prev, busy: false } : prev)));
  };

  const toggleCheck = (target: string): void => {
    setState((prev) => toggleConfirmation(prev, target));
  };

  const submitAnswers = async (answers: Record<string, string>): Promise<void> => {
    if (!state.jobId) return;
    setState((prev) => beginAnswer(prev, answers));
    const jobId = state.jobId;
    await sse((signal, onEvent) => answerNewCase(client, jobId, answers, onEvent, { signal }),
      () => setState((prev) => endAnswer(prev)));
  };

  const approve = async (): Promise<void> => {
    if (!canApprove(state) || !state.approval) return;
    const { job_id, approval_token } = state.approval;
    setState((prev) => ({ ...prev, phase: "applying", busy: true }));
    await sse((signal, onEvent) => approveNewCase(client, job_id, approval_token, onEvent, { signal, confirmed: state.confirmed }),
      () => setState((prev) => (prev.phase === "applying" ? { ...prev, busy: false } : prev)));
  };

  const recheck = async (): Promise<void> => {
    if (!canRecheck(state) || !state.jobId) return;
    const jobId = state.jobId;
    setState((prev) => ({ ...prev, phase: "verifying", busy: true, error: null, approval: null }));
    await sse((signal, onEvent) => recheckNewCase(client, jobId, onEvent, { signal }),
      () => setState((prev) => (prev.busy && prev.phase === "verifying" ? { ...prev, busy: false } : prev)));
  };

  const revision = ui.revision ?? emptyRevision();
  const [reviseRequest, setReviseRequest] = useState(0);
  const reviseAnchor = useRef<HTMLDivElement | null>(null);
  const jumpToRevise = (): void => {
    setReviseRequest((n) => n + 1);
    window.setTimeout(() => {
      const el = reviseAnchor.current;
      if (!el) return;
      el.scrollIntoView({ block: "start" });
      el.focus({ preventScroll: true });
    }, 0);
  };
  const revise = async (): Promise<void> => {
    if (!canRevise(state) || !state.jobId || !revisionReady(revision)) return;
    const jobId = state.jobId;
    const sent = { text: revision.text, edits: revision.edits };
    setState((prev) => beginRevise(prev));
    store.set("revision", emptyRevision());
    await sse((signal, onEvent) => reviseNewCase(client, jobId, sent, onEvent, { signal }),
      () => setState((prev) => (prev.busy && prev.phase === "starting" ? { ...prev, busy: false } : prev)));
  };

  const cancel = async (): Promise<void> => {
    if (state.phase === "opened" || state.phase === "idle") return;
    if (state.jobId) {
      try {
        await cancelNewCase(client, state.jobId);
      } catch (error) {
        if (isApplyInProgress(error)) {
          setState((prev) => ({ ...prev, note: "locked" }));
          return;
        }
      }
    }
    store.cancelRun();
    setState({ ...initialFlowState(), note: "cancelled" });
  };

  const repairBlocked = async (): Promise<void> => {
    if (!canRepairBlocked(state) || !state.jobId) return;
    const jobId = state.jobId;
    setState((prev) => beginRepair(prev));
    await sse((signal, onEvent) => repairNewCase(client, jobId, onEvent, { signal }),
      () => setState((prev) => (prev.busy && prev.phase === "starting" ? { ...prev, busy: false } : prev)));
  };

  const resume = async (): Promise<void> => {
    const jobId = state.error?.job_id ?? state.jobId;
    if (!jobId || !(canResume(state) || canResumeLost(state))) return;
    setState((prev) => ({ ...beginRepair(prev), lost: null }));
    await sse((signal, onEvent) => resumeNewCase(client, jobId, onEvent, { signal }),
      () => setState((prev) => (prev.busy && prev.phase === "starting" ? { ...prev, busy: false } : prev)));
  };

  const repair = async (): Promise<void> => {
    if (canContinueRepair(state) && state.jobId) {
      const jobId = state.jobId;
      setState((prev) => beginRepair(prev));
      await sse((signal, onEvent) => repairNewCase(client, jobId, onEvent, { signal }),
        () => setState((prev) => (prev.busy && prev.phase === "starting" ? { ...prev, busy: false } : prev)));
      return;
    }
    const mode = state.mode;
    const answered = state.clarify?.answered ? state.clarify.text : undefined;
    const dofAnswers = state.dofAnswers; // the equipment values already typed: the restart does not ask them again
    setRepairArmed(true);
    setState(initialFlowState());
    if (mode === "words" && words.trim()) await beginWords(answered ?? words.trim(), true, dofAnswers);
    else if (mode === "template" && templateKind) await beginTemplate(true, dofAnswers);
    else if (mode === "image" && imageB64) await beginImage(true, dofAnswers);
    else {
      setEntry(null);
      setRepairArmed(false);
    }
  };

  const acceptFile = (file: File | undefined): void => {
    if (!file) return;
    const check = validateImageFile({ type: file.type, size: file.size, name: file.name });
    if (!check.ok) {
      setImageProblem(check.reason);
      return;
    }
    setImageProblem(null);
    const pdf = isPdfUpload(file);
    setPdfPages(null);
    setPdfPage(0);
    setImageMime(pdf ? PDF_MIME : file.type.toLowerCase() === "image/jpg" ? "image/jpeg" : file.type.toLowerCase());
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      const b64 = stripDataUrlPrefix(url);
      setImageB64(b64);
      if (!pdf) {
        setImagePreview(url);
        return;
      }
      setImagePreview(null);
      fetchPdfPages(client, b64).then(setPdfPages, () => {
        setImageB64(null);
        setImageProblem("type");
      });
    };
    reader.readAsDataURL(file);
  };

  const showForm = state.phase === "idle" || state.phase === "starting" || state.phase === "needs_input";
  const asking = state.phase === "needs_input" || isAnswering(state);
  const showApproveTail = state.phase === "awaiting_approval" || state.phase === "applying" || state.phase === "awaiting_verify_confirm" || state.phase === "verifying";
  const blockedStop = state.phase === "error" && state.error?.code === "PREVIEW_BLOCKED";
  const unconverged = isUnconverged(state);
  const waitConfirm = canWaitForConfirm(state);
  const checklistOpen = state.confirmations.length > 0;
  const revisable = canRevise(state);
  const changed = revisable ? touchedNames(revision.edits) : new Set<string>();
  const shownTopology = state.draft && revisable && revision.edits.length > 0 ? applyEdits(state.draft.topology, revision.edits) : state.draft?.topology;
  const [draftView, setDraftView] = useState<"working" | "sheet">("working");
  const viewLocale = useLocale();
  const errorMessage = state.error ? (viewLocale === "ko" ? state.error.message_ko : (state.error.message_en || state.error.message_ko)) : "";

  const startRow = (disabled: boolean, onStart: () => void) => (
    <div className="ui-form-actions">
      <button type="button" className="ui-btn ui-btn--primary" disabled={disabled} onClick={onStart}>{t("newcase.start")}</button>
      {state.jobId && state.phase !== "opened" && (
        <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => void cancel()}>{t("newcase.cancel")}</button>
      )}
    </div>
  );
  const entryButton = (mode: EntryMode, title: MessageKey, desc: MessageKey) => (
    <li key={mode}>
      <button type="button" className="wb-entry" data-newcase-entry={mode} onClick={() => setEntry(mode)}>
        <strong>{t(title)}</strong>
        <span className="ui-meta">{t(desc)}</span>
      </button>
    </li>
  );
  const approveRow = showApproveTail && (
    <div className="wb-draft__foot" data-newcase="approve">
      {unconverged && (
        <div className="ui-callout ui-callout--warning" role="alert" data-newcase="unconverged-warn">
          <p>{t("newcase.unconvergedWarn")}</p>
          {state.verify?.reason_ko && <p data-newcase="unconverged-reason">{viewLocale === "ko" ? state.verify.reason_ko : (state.verify.reason_en || state.verify.reason_ko)}</p>}
          {state.verify?.can_repair && (canContinueRepair(state)
            ? <p className="ui-meta" data-newcase="repair-note">{t("newcase.repairNote")}</p>
            : <p className="ui-meta" data-newcase="repair-tried">{t("newcase.repairTried")}</p>)}
        </div>
      )}
      <div className="ui-form-actions">
        <ApprovalActions approval={state.approval} busy={busy} canGo={canApprove(state)} onApprove={() => void approve()} onRecheck={() => void recheck()} since={ui.approvalSince?.at} />
        {unconverged && canContinueRepair(state) && (
          <button type="button" className="ui-btn" onClick={() => void repair()}>{t("newcase.repairOffer")}</button>
        )}
        {state.phase === "awaiting_approval" && (
          <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => void cancel()}>{t("newcase.cancel")}</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="wb-newcase" data-newcase="root">
      <AwaySummary />
      {state.note === "cancelled" && state.phase === "idle" && <p className="ui-meta" role="status" data-newcase="cancelled">{t("newcase.cancelled")}</p>}
      {state.note === "locked" && state.phase !== "opened" && !cannotStop(state) && <p className="ui-meta" role="status" data-newcase="cancel-locked">{t("newcase.cancelLocked")}</p>}
      {entry === null && state.phase === "idle" && (
        <ul className="wb-entries" data-newcase="entries">
          {entryButton("words", "newcase.wordsTitle", "newcase.wordsDesc")}
          {entryButton("template", "newcase.templateTitle", "newcase.templateDesc")}
          {entryButton("image", "newcase.imageTitle", "newcase.imageDesc")}
        </ul>
      )}

      {entry !== null && (
        <div className="ui-cluster">
          <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={resetAll}>
            <span aria-hidden="true">←</span> {t("newcase.back")}
          </button>
        </div>
      )}

      {entry === "words" && showForm && (
        <section className="ui-panel wb-form" data-newcase="words-form">
          <label className="ui-field">
            <span className="ui-field__label">{t("newcase.wordsLabel")}</span>
            <textarea
              className="ui-textarea wb-form__words"
              placeholder={t("newcase.wordsPlaceholder")}
              value={words}
              onChange={(event) => setWords(event.target.value)}
            />
          </label>
          {fromAgent && words.trim() !== "" && <p className="ui-meta" data-newcase="from-agent">{t("newcase.fromAgent")}</p>}
          {words.trim() === "" && <WordsExamples onPick={setWords} />}
          {startRow(running || !words.trim(), () => void beginWords(words.trim()))}
        </section>
      )}

      {entry === "template" && showForm && (
        <section className="ui-panel wb-form" data-newcase="template-form">
          {templates.error && (
            <div className="ui-callout ui-callout--negative" role="alert" data-newcase="template-error">
              <p>{t("newcase.templateLoadError")}</p>
              <button type="button" className="ui-btn ui-btn--sm" onClick={templates.retry}>{t("newcase.templateRetry")}</button>
            </div>
          )}
          {!templates.templates && !templates.error && <p className="ui-meta" role="status">{t("newcase.templateLoading")}</p>}
          {templates.templates && templates.templates.length === 0 && <p className="ui-meta">{t("newcase.templateEmpty")}</p>}
          {templates.templates && templates.templates.length > 0 && (
            <>
              <TemplateForm
                templates={templates.templates}
                kind={templateKind}
                edits={edits}
                onKind={(kind) => { setTemplateKind(kind); setEdits({}); }}
                onEdit={(name, value) => setEdits((prev) => ({ ...prev, [name]: value }))}
              />
              {startRow(running || !templateKind, () => void beginTemplate())}
            </>
          )}
        </section>
      )}

      {entry === "image" && showForm && !asking && (
        <section className="ui-panel wb-form" data-newcase="image-form">
          <div
            className="wb-drop"
            data-newcase="image-drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              acceptFile(event.dataTransfer.files?.[0]);
            }}
          >
            <label className="ui-field">
              <span className="ui-field__label">{t("newcase.imagePicker")}</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={(event) => acceptFile(event.target.files?.[0])}
              />
            </label>
            <span className="ui-meta">{t("newcase.imageDrop")}</span>
          </div>
          {imageProblem === "type" && <p className="ui-field__error" role="alert">{t("newcase.imageTypeError")}</p>}
          {imageProblem === "size" && <p className="ui-field__error" role="alert">{t("newcase.imageSizeError")}</p>}
          {imageMime === PDF_MIME && pdfPages && (
            <PdfPagePicker count={pdfPages.count} thumbs={pdfPages.thumbs} page={pdfPage} onPick={setPdfPage} />
          )}
          {imagePreview && (
            <figure className="wb-preview" data-newcase="image-preview">
              <img src={imagePreview} alt="" />
            </figure>
          )}
          {startRow(running || !imageB64, () => void beginImage())}
          <PfdDemos onUse={(url) => {
            if (running) return;
            if (fileRef.current) fileRef.current.value = "";
            setImageProblem(null);
            setPdfPages(null);
            setImageMime("image/png");
            setImagePreview(url);
            setImageB64(stripDataUrlPrefix(url));
          }} />
        </section>
      )}

      {(state.stages.length > 0 || busy) && state.phase !== "opened" && state.phase !== "lost" && (state.phase !== "error" || blockedStop) && (
        <StageList stages={state.stages} busy={busy} finished={stagesFinished(state)} mode={state.mode} phase={state.phase} onCancel={() => void cancel()} waiting={state.hysysDialog} since={{ run: ui.runStart, step: ui.stepAt, signal: ui.signalAt }} live={state.live} />
      )}

      {state.clarify && !asking && state.phase !== "idle" && state.phase !== "opened" && (
        <section className="ui-panel wb-form" aria-label={t("newcase.clarify.meter")}>
          <ClarifyGauge clarify={state.clarify} />
        </section>
      )}

      {asking && (
        <section className="ui-panel wb-form" data-newcase="refine">
          {state.clarify && !state.clarify.answered && state.questions.some((q) => q.id.startsWith("clarify:"))
            ? <ClarifyForm key={state.questionsSeq} clarify={state.clarify} questions={state.questions} busy={busy} onSubmit={(answers) => void submitAnswers(answers)} answers={ui.answers} onAnswers={(change) => store.set("answers", change)} />
            : <QuestionsForm key={state.questionsSeq} questions={state.questions} busy={busy} onSubmit={(answers) => void submitAnswers(answers)} answers={ui.answers} onAnswers={(change) => store.set("answers", change)} />}
          <div className="ui-form-actions">
            <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => void cancel()}>{t("newcase.cancel")}</button>
          </div>
        </section>
      )}

      {(showApproveTail || ((asking || blockedStop) && (state.draft || state.verify)) || (state.phase === "error" && revisable)) && (
        <section className="ui-panel ui-panel--flush wb-draft" aria-labelledby="wb-nc-draft" data-newcase="draft">
          <div className="ui-panel__head">
            <h2 className="ui-panel__title" id="wb-nc-draft">{entry === "image" ? t("newcase.imageConfirmTitle") : t("newcase.draftTitle")}</h2>
            {state.verify && (
              <span className={`ui-status ${state.verify.converged ? "ui-status--positive" : "ui-status--warning"}`} data-newcase="verify">
                {state.verify.converged ? t("newcase.verifyOk") : t("newcase.verifyBad")}
              </span>
            )}
            {state.draft && (revisable
              ? <button type="button" className="ui-btn ui-btn--sm" data-newcase-revise-jump onClick={jumpToRevise}>{t("newcase.revise.open")}</button>
              : <button type="button" className="ui-btn ui-btn--sm" data-newcase-revise-jump disabled
                  title={t("newcase.revise.wait")} aria-label={`${t("newcase.revise.open")} · ${t("newcase.revise.wait")}`}>{t("newcase.revise.open")}</button>)}
          </div>
          <div className="wb-draft__body">
            {state.draft && (
              <>
                {changed.size > 0 && <p className="ui-status ui-status--info wb-revise__badge" data-newcase="revise-preview">{t("newcase.revise.preview", { n: changed.size })}</p>}
                <div className="ui-segmented" role="group" aria-label={t("newcase.draft.viewSheet")} data-newcase="draft-view">
                  <button type="button" aria-pressed={draftView === "working"} onClick={() => setDraftView("working")}>{t("newcase.draft.viewWorking")}</button>
                  <button type="button" aria-pressed={draftView === "sheet"} onClick={() => setDraftView("sheet")}>{t("newcase.draft.viewSheet")}</button>
                </div>
                {draftView === "sheet"
                  ? <PfdSheetView model={sheetModelFromDraft(shownTopology ?? state.draft.topology, "", changed)} />
                  : <DraftTopology topology={shownTopology ?? state.draft.topology} details={state.draft.details} questions={state.questions} verify={state.verify} ledger={state.draft.ledger} changed={changed} />}
                {revisable && (
                  <div ref={reviseAnchor} id="wb-revise-panel" tabIndex={-1} data-newcase="revise-anchor">
                    <RevisePanel topology={state.draft.topology} draft={revision} busy={busy}
                      onChange={(next) => store.set("revision", next)} onSubmit={() => void revise()} openRequest={reviseRequest} />
                  </div>
                )}
                {state.draft.assumptions.length > 0 && (
                  <div className="wb-assume">
                    <p className="ui-meta">{t("newcase.assumptionsTitle")}</p>
                    <AssumptionList items={state.draft.assumptions} client={client} />
                  </div>
                )}
              </>
            )}
            {checklistOpen && (
              <fieldset className="wb-checks" data-newcase="confirmations">
                <legend className="ui-field__label">{t("newcase.checklistTitle")}</legend>
                <p className="ui-meta">{t("newcase.checklistHint")}</p>
                {state.confirmations.map((item) => (
                  <label className="ui-check" key={item.target} data-newcase-confirmation={item.target}>
                    <input
                      type="checkbox"
                      checked={state.confirmed.includes(item.target)}
                      onChange={() => toggleCheck(item.target)}
                    />
                    <span>
                      <strong>{item.target}</strong>
                      <span className="ui-meta"> · {item.reason}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {waitConfirm && state.error && (
              <div className="ui-callout ui-callout--info" role="alert" data-newcase="verify-confirm">
                <p>{viewLocale === "ko" ? state.error.message_ko : (state.error.message_en || state.error.message_ko)}</p>
                <div className="ui-form-actions">
                  <button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={() => void confirmVerify()}>
                    {t("newcase.confirmVerify")}
                  </button>
                  <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => void cancel()}>{t("newcase.cancel")}</button>
                </div>
              </div>
            )}
            {approveRow}
          </div>
        </section>
      )}

      {state.phase === "error" && state.error && (
        <section className="wb-failure" data-newcase="error">
          <div className="ui-callout ui-callout--negative" role="alert">
            <strong>{t("newcase.errorTitle")}</strong>
            <p>{errorMessage}</p>
            {state.error.blockers.length > 0 && (
              <ul className="ui-stack ui-stack--tight wb-blockers" data-newcase="blockers">
                {state.error.blockers.map((line, index) => (
                  <li key={index} data-newcase-blocker>{viewLocale === "ko" ? line.message_ko : line.message_en}</li>
                ))}
              </ul>
            )}
            {(state.error.code === "IMAGE_PROVIDER_UNSUPPORTED" || state.error.code === "IMAGE_PROVIDER_FAILED") && (
              <p><a href={hashFor("settings")}>{t("newcase.openSettings")}</a></p>
            )}
            {state.error.code === "VERIFY_SOLVE_LAUNCH_NEEDED" && (
              <div className="ui-stack ui-stack--tight" data-newcase="launch-needed">
                {state.error.reason === "no_owned_authority" && (
                  <p className="ui-meta">{t("newcase.launchNeeded.closeOwn")}</p>
                )}
                <HysysLaunch />
                <button type="button" className="ui-btn ui-btn--sm" data-newcase-launch-reprobe onClick={() => {}}>
                  {t("newcase.launchRecheck")}
                </button>
              </div>
            )}
          </div>
          {state.error.can_recheck && canRecheck(state) ? (
            <div className="ui-form-actions">
              <button type="button" className="ui-btn ui-btn--primary" data-newcase-recheck onClick={() => void recheck()}>{t("newcase.recheck")}</button>
              <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={resetAll}>{t("newcase.back")}</button>
            </div>
          ) : canResume(state) ? (
            <div className="ui-stack ui-stack--tight">
              <p className="ui-meta">{t("newcase.resumeNote")}</p>
              <div className="ui-form-actions">
                <button type="button" className="ui-btn ui-btn--primary" data-newcase-resume onClick={() => void resume()}>{t("newcase.resume")}</button>
                <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={resetAll}>{t("newcase.back")}</button>
              </div>
            </div>
          ) : canRepairBlocked(state) ? (
            <div className="ui-form-actions">
              <button type="button" className="ui-btn ui-btn--primary" data-newcase-repair-blocked onClick={() => void repairBlocked()}>{t("newcase.repairOffer")}</button>
              <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={resetAll}>{t("newcase.back")}</button>
            </div>
          ) : canContinueRepair(state) ? (
            <div className="ui-form-actions">
              <button type="button" className="ui-btn ui-btn--primary" data-newcase-continue-repair onClick={() => void repair()}>{t("newcase.repairOffer")}</button>
              <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={resetAll}>{t("newcase.back")}</button>
            </div>
          ) : canOfferRepair(state) ? (
            <div className="ui-form-actions">
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => void repair()}>{t("newcase.repairOffer")}</button>
              <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={resetAll}>{t("newcase.back")}</button>
            </div>
          ) : (
            <div className="ui-stack ui-stack--tight">
              {state.error.code !== "AUTHORITY_EPOCH_MISMATCH" && <p className="ui-meta">{t("newcase.noRepairNote")}</p>}
              <div className="ui-form-actions">
                <button type="button" className="ui-btn ui-btn--sm" onClick={resetAll}>{t("newcase.back")}</button>
              </div>
            </div>
          )}
        </section>
      )}

      {state.phase === "lost" && state.lost && (
        <section className="wb-failure" data-newcase="lost">
          <div className="ui-callout ui-callout--warning" role="alert">
            <strong>{t("newcase.lost.title")}</strong>
            <p>{t(state.lost.from === "applying" ? "newcase.lost.applying" : "newcase.lost.other")}</p>
          </div>
          {(state.lost.check === "none" || state.lost.check === "busy" || state.lost.check === "unreachable") && (
            <p className="ui-meta" role="status" data-newcase="lost-check">{t(`newcase.lost.${state.lost.check}` as MessageKey)}</p>
          )}
          <div className="ui-form-actions">
            {state.lost.from === "applying" && (
              <button type="button" className="ui-btn ui-btn--primary" data-newcase="lost-check-button" disabled={state.lost.check === "checking"} aria-busy={state.lost.check === "checking"}
                onClick={() => void store.recheckLost()}>
                {state.lost.check === "checking" ? t("newcase.lost.checking") : t("newcase.lost.check")}
              </button>
            )}
            {canResumeLost(state) && (
              <button type="button" className="ui-btn ui-btn--primary" data-newcase="lost-resume" onClick={() => void resume()}>{t("newcase.resume")}</button>
            )}
            <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" data-newcase="lost-restart" onClick={() => store.cancelRun()}>{t("newcase.lost.restart")}</button>
          </div>
        </section>
      )}

      {state.phase === "opened" && (
        <section className="wb-failure" data-newcase="opened">
          <p className="ui-status ui-status--positive" role="status">{t("newcase.opened")}</p>
          {state.draft && state.draft.topology.units.length > 0 && (
            <div className="ui-stack ui-stack--tight" data-newcase-summary>
              <p className="ui-num">
                {t("newcase.summary", { units: state.draft.topology.units.length, streams: state.draft.topology.streams.length })}
                {state.verify && <> · {state.verify.converged ? t("newcase.verifyOk") : t("newcase.verifyBad")}</>}
                {took !== null && <> · {t("newcase.took", { time: clockText(took) })}</>}
              </p>
              <ul className="ui-cluster wb-opened__units">
                {state.draft.topology.units.map((unit) => <li key={unit.name} className="ui-tag">{unit.name}</li>)}
              </ul>
            </div>
          )}
          <UnappliedList items={state.unapplied} />
          {state.openedNote && <p className="ui-meta" data-newcase-note>{viewLocale === "ko" ? state.openedNote.ko : state.openedNote.en}</p>}
          {state.savedPath && (
            <div className="ui-stack ui-stack--tight" data-newcase-saved>
              <p className="ui-num">{t("newcase.saved", { path: state.savedPath })}</p>
              <div className="ui-form-actions">
                <button type="button" className="ui-btn ui-btn--sm" data-newcase-open-folder onClick={() => {
                  setFolderFailed(false);
                  void openNewCaseFolder(client, state.savedPath ?? "").then((res) => {
                    if (!res || (res as { opened?: unknown }).opened !== true) setFolderFailed(true);
                  }).catch(() => setFolderFailed(true));
                }}>{t("newcase.openFolder")}</button>
              </div>
              {folderFailed && <p className="ui-field__error" role="alert">{t("newcase.openFolderFailed")}</p>}
            </div>
          )}
          {state.openedPath && <p className="ui-meta ui-num" data-newcase-opened-file>{t("newcase.openedFile", { path: state.openedPath })}</p>}
          <div className="ui-form-actions">
            <button type="button" className="ui-btn ui-btn--primary" onClick={resetAll}>{t("newcase.again")}</button>
          </div>
        </section>
      )}
    </div>
  );
}
