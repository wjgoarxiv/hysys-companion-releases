import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useT, type MessageKey, type Translate, type UiLocale } from "../i18n";
import { hashFor } from "../router";
import { hysysDialogOf, useCase } from "../state/case";
import { HysysDialogLine, type HysysDialogInfo } from "../shell/CaseHeader";
import "./agent.css";
import { ANSWER_STEPS, awaitsRoundTripNotice, canApprove, checkParts, clockText, deltaText, errorText, failureTitleKey, fileNameOf, formatNumber, needsPending, paramsFromForm, pick, repairText, snapshotTime, specParamsFromForm, unitText, valueLabel } from "./logic";
import { Markdown } from "./markdown";
import { useNow } from "../studies/RunProgress";
import { clockText as runClock } from "../studies/model";
import { agentRunActive, agentStore, useAgent, type AgentStore, type CrBusy, type HistoryState } from "./store";
import { caseSuggestions, fillCommand, followUps, noCaseSuggestions, type Suggestion } from "./suggest";
import type { AnswerState, AnswerStep, ChangeRequest, ChooseRoute, CrDiff, CrNeed, CrState, ErrorInfo } from "./types";

const STATE_TONE: Record<CrState, string> = {
  draft: "", trial: " ui-tag--info", ready: " ui-tag--accent", needs_confirm: " ui-tag--warning", approved: " ui-tag--info", applied: " ui-tag--positive",
  reverting: " ui-tag--info", reverted: "", failed: " ui-tag--negative", discarded: "",
};

export function StateTag({ state }: { state: CrState }) {
  const t = useT();
  return <span className={`ui-tag${STATE_TONE[state]}`} data-wb-cr-state={state}>{t(`agent.cr.state.${state}` as MessageKey)}</span>;
}

function BackButton({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={onBack} data-wb-agent-back>
      <span aria-hidden="true">←</span> {t("agent.back")}
    </button>
  );
}


function DiffView({ diff, locale, t }: { diff: CrDiff; locale: UiLocale; t: Translate }) {
  const dir = (d: string) => t(d === "in" ? "agent.diff.in" : "agent.diff.out");
  const structure: Array<{ key: string; tone: string; label: string; text: string }> = [
    ...diff.units.added.map((u) => ({ key: `ua-${u.name}`, tone: "positive", label: t("agent.diff.unitAdded"), text: unitText(u.name, u.type, locale) })),
    ...diff.units.removed.map((u) => ({ key: `ur-${u.name}`, tone: "negative", label: t("agent.diff.unitRemoved"), text: unitText(u.name, u.type, locale) })),
    ...diff.streams.added.map((s) => ({ key: `sa-${s}`, tone: "positive", label: t("agent.diff.streamAdded"), text: s })),
    ...diff.streams.removed.map((s) => ({ key: `sr-${s}`, tone: "negative", label: t("agent.diff.streamRemoved"), text: s })),
    ...diff.connections.added.map((c, i) => ({ key: `ca-${i}`, tone: "positive", label: t("agent.diff.connAdded"), text: `${c.unit} ${dir(c.direction)} ← ${c.stream}` })),
    ...diff.connections.removed.map((c, i) => ({ key: `cr-${i}`, tone: "negative", label: t("agent.diff.connRemoved"), text: `${c.unit} ${dir(c.direction)} ✕ ${c.stream}` })),
    ...diff.connections.moved.map((c, i) => ({ key: `cm-${i}`, tone: "warning", label: t("agent.diff.connMoved"), text: `${c.unit} ${dir(c.direction)}: ${c.from} → ${c.to}` })),
  ];
  if (!structure.length && !diff.specs.length && !diff.values.length) return <p className="ui-meta">{t("agent.diff.none")}</p>;
  return (
    <div className="wb-diff" data-wb-diff>
      {structure.length > 0 && (
        <section>
          <h4 className="wb-diff__title">{t("agent.diff.structure")}</h4>
          <ul className="wb-diff__list">
            {structure.map((row) => (
              <li key={row.key}>
                <span className={`ui-tag ui-tag--${row.tone}`}>{row.label}</span>
                <span className="wb-diff__text">{row.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {diff.specs.length > 0 && (
        <section>
          <h4 className="wb-diff__title">{t("agent.diff.specs")}</h4>
          <div className="ui-table-wrap">
            <table className="ui-table ui-table--compact">
              <thead><tr><th scope="col">{t("agent.diff.item")}</th><th scope="col">{t("agent.diff.beforeAfter")}</th></tr></thead>
              <tbody>
                {diff.specs.map((row) => (
                  <tr key={row.key}>
                    <td className="wb-diff__key">{valueLabel(row.key, locale)}</td>
                    <td className="ui-num wb-diff__change">{formatNumber(row.a, row.unit)} → {formatNumber(row.b, row.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {diff.values.length > 0 && (
        <section>
          <h4 className="wb-diff__title">{t("agent.diff.values")}</h4>
          <div className="ui-table-wrap">
            <table className="ui-table ui-table--compact">
              <thead><tr><th scope="col">{t("agent.diff.item")}</th><th scope="col">{t("agent.diff.beforeAfter")}</th></tr></thead>
              <tbody>
                {diff.values.map((row) => (
                  <tr key={`${row.scope}-${row.key}`}>
                    <td className="wb-diff__key">
                      {valueLabel(row.key, locale)}
                      {row.scope === "engine" && <span className="ui-tag ui-tag--warning" data-wb-engine-value>{t("agent.diff.engineValue")}</span>}
                    </td>
                    <td className="ui-num wb-diff__change">
                      {row.a === null || row.a === undefined ? formatNumber(row.b, row.unit) : (
                        <>
                          {formatNumber(row.a, row.unit)} → {formatNumber(row.b, row.unit)}
                          <span className="wb-diff__rel">{deltaText(row)}</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}


export type CardProps = {
  cr: ChangeRequest;
  busy: CrBusy | null;
  error: ErrorInfo | null;
  onTrial: () => void;
  onConfirm: () => void;
  onParams: (params: Record<string, unknown>) => void;
  onApprove: () => void;
  onDiscard: () => void;
  onRevert: () => void;
  onRevertSnapshot?: () => void;
  onBack: () => void;
};

function snapshotText(cr: ChangeRequest, t: Translate): string {
  const applied = [...cr.history].reverse().find((h) => h.state === "applied" && !h.note);
  const at = snapshotTime(cr.snapshot_id) ?? (applied && !Number.isNaN(Date.parse(applied.time)) ? new Date(applied.time) : null);
  return at ? t("agent.cr.snapshot", { time: clockText(at) }) : t("agent.cr.snapshotNoTime");
}

function restoredCopyText(revert: NonNullable<ChangeRequest["revert"]>, locale: UiLocale, t: Translate): string {
  const own = pick({ ko: revert.message_ko ?? "", en: revert.message_en ?? "" }, locale);
  return own || t("agent.cr.revertedCopy", { file: fileNameOf(revert.path ?? null) });
}

function SpecNeedsForm({ needs, busy, error, onSubmit }: { needs: readonly CrNeed[]; busy: boolean; error: string | null; onSubmit: (params: Record<string, unknown>) => void }) {
  const t = useT();
  const locale = useLocale();
  const [values, setValues] = useState<Record<string, { value?: string; unit?: string }>>({});
  const params = specParamsFromForm(needs, values);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (params && !busy) onSubmit(params);
  };
  const set = (name: string, patch: { value?: string; unit?: string }) => setValues((v) => ({ ...v, [name]: { ...v[name], ...patch } }));
  return (
    <form className="wb-needs" data-wb-spec-form onSubmit={submit} aria-labelledby="wb-spec-title">
      <h4 className="wb-diff__title" id="wb-spec-title">{needs[0] && (locale === "en" ? needs[0].title_en : needs[0].title_ko) || t("agent.spec.title")}</h4>
      {needs.map((need) => {
        const id = `wb-spec-${need.name}`;
        const unit = values[need.name]?.unit ?? need.unit_options?.[0] ?? need.unit_hint ?? "";
        return (
          <div className="ui-field" key={need.name}>
            <label className="ui-field__label" htmlFor={id}>{pick({ ko: need.label_ko, en: need.label_en }, locale)}</label>
            <div className="wb-needs__row">
              <input id={id} data-wb-spec={need.name} className="ui-input ui-num" type="number" inputMode="decimal" step="any"
                value={values[need.name]?.value ?? ""} disabled={busy} onChange={(e) => set(need.name, { value: e.target.value })} />
              {need.unit_options?.length ? (
                <select data-wb-spec-unit={need.name} className="ui-select" aria-label={t("agent.spec.unit")} value={unit} disabled={busy} onChange={(e) => set(need.name, { unit: e.target.value })}>
                  {need.unit_options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : need.unit_hint ? <span className="ui-meta">{need.unit_hint}</span> : null}
            </div>
            {typeof need.inlet_p_kpa === "number" && <p className="ui-meta ui-num">{t("agent.spec.inlet", { value: formatNumber(need.inlet_p_kpa) })}</p>}
          </div>
        );
      })}
      {error && <p className="ui-field__error" role="alert" data-wb-step-error>{error}</p>}
      <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" data-wb-spec-submit disabled={!params || busy}>
        {busy ? t("agent.need.submitting") : t("agent.spec.submit")}
      </button>
    </form>
  );
}

function NeedsForm({ needs, busy, error, onSubmit }: { needs: readonly CrNeed[]; busy: boolean; error: string | null; onSubmit: (params: Record<string, unknown>) => void }) {
  const t = useT();
  const locale = useLocale();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(needs.map((n) => [n.name, n.name === "unit" ? n.unit_hint ?? "" : ""])));
  const params = paramsFromForm(needs, values);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (params && !busy) onSubmit(params);
  };
  const field = (need: CrNeed) => {
    const id = `wb-need-${need.name}`;
    const label = pick({ ko: need.label_ko, en: need.label_en }, locale);
    const set = (value: string) => setValues((v) => ({ ...v, [need.name]: value }));
    return (
      <div className={`ui-field wb-needs__${need.name}`} key={need.name}>
        <label className="ui-field__label" htmlFor={id}>{label}{need.required ? "" : ` ${t("agent.need.optional")}`}</label>
        {need.options?.length ? (
          <select data-wb-need={need.name} id={id} className="ui-select" value={values[need.name] ?? ""} disabled={busy} onChange={(e) => set(e.target.value)}>
            <option value="">{t("agent.need.choose")}</option>
            {need.options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : (
          <input data-wb-need={need.name} id={id} className="ui-input" type={need.kind === "number" ? "number" : "text"} value={values[need.name] ?? ""}
            {...(need.kind === "number" ? { inputMode: "decimal" as const, step: "any" } : { maxLength: 60 })}
            placeholder={need.unit_hint && need.name !== "property" ? need.unit_hint : undefined} disabled={busy} onChange={(e) => set(e.target.value)} />
        )}
      </div>
    );
  };
  const byName = (name: string) => needs.find((n) => n.name === name);
  return (
    <form className="wb-needs" data-wb-needs onSubmit={submit} aria-labelledby="wb-needs-title">
      <h4 className="wb-diff__title" id="wb-needs-title">{t("agent.need.title")}</h4>
      {byName("property") && field(byName("property")!)}
      <div className="wb-needs__row">
        {byName("value") && field(byName("value")!)}
        {byName("unit") && field(byName("unit")!)}
      </div>
      {error && <p className="ui-field__error" role="alert" data-wb-step-error>{error}</p>}
      <button type="submit" className="ui-btn ui-btn--primary ui-btn--sm" data-wb-needs-submit disabled={!params || busy}>
        {busy ? t("agent.need.submitting") : t("agent.need.submit")}
      </button>
    </form>
  );
}

const HAS_RESULT: readonly CrState[] = ["ready", "approved", "applied", "reverting", "reverted"];

export function ChangeRequestCard({ cr, busy, error, onTrial, onConfirm, onParams, onApprove, onDiscard, onRevert, onRevertSnapshot, onBack }: CardProps) {
  const t = useT();
  const locale = useLocale();
  const trial = cr.trial;
  const converged = trial?.converged === true;
  const preview = trial?.kind === "preview";
  const tempCopy = trial?.kind === "temp_copy";
  const check = checkParts(trial?.check);
  const checkLine = [
    check.iterations !== null ? t("agent.cr.trial.checkIterations", { count: check.iterations }) : null,
    check.seconds !== null ? t("agent.cr.trial.checkSeconds", { seconds: check.seconds }) : null,
  ].filter(Boolean).join(" · ");
  const formShown = (cr.state === "draft" || cr.state === "failed") && needsPending(cr);
  const checked = converged || preview;
  const showApprove = cr.state === "draft" || cr.state === "trial" || cr.state === "ready";
  const approveEnabled = canApprove(cr) && busy === null;
  const repair = cr.state === "failed" ? repairText(trial?.repair, locale) : null;
  const failTitle = cr.state === "failed" ? t(failureTitleKey(cr)) : null;
  const diffBlock = cr.diff && (HAS_RESULT.includes(cr.state) || (cr.state === "failed" && checked)) && (
    <section aria-label={t("agent.diff.title")}>
      <DiffView diff={cr.diff} locale={locale} t={t} />
    </section>
  );
  const diffLast = cr.state === "applied" || cr.state === "reverted";
  const stepError = error ? errorText(error, locale) ?? t("agent.cr.stepError") : null;

  return (
    <article className="wb-cr" data-wb-cr data-wb-cr-id={cr.id}>
      <header className="wb-cr__head">
        <BackButton onBack={onBack} />
        <span className="wb-cr__tags">
          <StateTag state={cr.state} />
        </span>
      </header>

      <section aria-labelledby={`wb-cr-what-${cr.id}`}>
        <h3 className="ui-visually-hidden" id={`wb-cr-what-${cr.id}`}>{t("agent.cr.what")}</h3>
        <p className="wb-cr__what">{pick(cr.what, locale)}</p>
      </section>

      {(cr.assumptions ?? []).length > 0 && (
        <div className="ui-callout ui-callout--warning" data-wb-assumptions>
          <p><strong>{t("agent.cr.assumptions.title")}</strong></p>
          <ul>{(cr.assumptions ?? []).map((line, index) => <li key={index}>{pick(line, locale)}</li>)}</ul>
          <p className="ui-meta">{t("agent.cr.assumptions.hint")}</p>
        </div>
      )}

      {cr.state === "trial" && (
        <div role="status" className="wb-cr__progress" data-wb-progress>
          <span className="wb-progress" aria-hidden="true" />
          <p className="ui-meta">{t("agent.cr.trying")}</p>
        </div>
      )}
      {cr.state === "approved" && (
        <div role="status" className="wb-cr__progress" data-wb-progress>
          <span className="wb-progress" aria-hidden="true" />
          <p className="ui-meta">{t("agent.cr.applying")}</p>
        </div>
      )}
      {cr.state === "reverting" && (
        <div role="status" className="wb-cr__progress" data-wb-progress>
          <span className="wb-progress" aria-hidden="true" />
          <p className="ui-meta">{t("agent.cr.reverting")}</p>
        </div>
      )}

      {checked && HAS_RESULT.includes(cr.state) && !diffLast && (
        <div className="ui-callout ui-callout--positive" data-wb-trial-result data-wb-trial-kind={preview ? "preview" : tempCopy ? "temp_copy" : "copy"}>
          <p className="wb-cr__verdict">{preview ? t("agent.cr.trial.preview") : tempCopy ? t("agent.cr.trial.tempCopy") : t("agent.cr.trial.converged")}</p>
          {tempCopy && checkLine && <p className="ui-meta ui-num" data-wb-check>{checkLine}</p>}
        </div>
      )}

      {cr.state === "needs_confirm" && (
        <div className="ui-callout ui-callout--warning" role="group" aria-label={t("agent.cr.confirm.title")} data-wb-confirm>
          <p className="wb-cr__reason">{cr.confirm?.reason || t("agent.cr.confirm.fallback")}</p>
          <div className="wb-cr__actions">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" data-wb-confirm-go disabled={busy !== null} onClick={onConfirm}>{t("agent.cr.confirm.go")}</button>
            <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" data-wb-confirm-cancel disabled={busy !== null} onClick={onDiscard}>{t("agent.cr.confirm.cancel")}</button>
          </div>
        </div>
      )}

      {cr.state === "ready" && cr.kind === "structural" && cr.round_trip && (
        <div className="ui-callout ui-callout--warning" role="group" aria-label={t("agent.cr.roundTrip.title")} data-wb-round-trip>
          <p className="wb-cr__verdict">{t("agent.cr.roundTrip.title")}</p>
          <p>{t("agent.cr.roundTrip.body", { file: cr.round_trip.new_file, min: cr.round_trip.seconds_min, max: cr.round_trip.seconds_max })}</p>
          {cr.round_trip.unsaved_changes > 0 && <p>{t("agent.cr.roundTrip.unsaved", { count: cr.round_trip.unsaved_changes })}</p>}
          <p className="ui-meta">{t("agent.cr.roundTrip.snapshot")}</p>
        </div>
      )}
      {cr.state === "ready" && awaitsRoundTripNotice(cr) && <p className="ui-callout ui-callout--warning" role="status" data-wb-round-trip-missing>{t("agent.cr.roundTrip.missing")}</p>}

      {cr.state === "failed" && (
        <div className="ui-callout ui-callout--negative" role="alert" data-wb-failed>
          {!(cr.error ?? trial?.reason ?? "").startsWith(failTitle ?? "\0") && <p className="wb-cr__verdict">{failTitle}</p>}
          {(cr.error || trial?.reason) && <p className="wb-cr__reason">{cr.error ?? trial?.reason}</p>}
          {repair && (
            <>
              <p className="ui-meta">{t("agent.cr.trial.repair")}</p>
              <p className="wb-cr__repair" data-wb-repair>{repair}</p>
            </>
          )}
        </div>
      )}


      {!diffLast && diffBlock}

      {cr.state === "applied" && (
        <div className="ui-callout ui-callout--positive" data-wb-applied>
          <p className="wb-cr__verdict">{t("agent.cr.applied")}</p>
          {cr.snapshot_id && <p className="ui-meta" title={cr.snapshot_id} data-wb-snapshot>{snapshotText(cr, t)}</p>}
          <p>{cr.kind === "structural" && cr.new_path ? t("agent.cr.newFile", { file: fileNameOf(cr.new_path) }) : t("agent.cr.saveHint")}</p>
          {cr.archived && <p className="ui-meta">{t("agent.cr.archived")}</p>}
        </div>
      )}
      {cr.state === "reverted" && (
        <p className="ui-callout" data-wb-was-reverted>
          {cr.revert?.method === "restored_copy"
            ? restoredCopyText(cr.revert, locale, t)
            : t("agent.cr.reverted")}
        </p>
      )}
      {cr.state === "discarded" && <p className="ui-callout" data-wb-discarded>{t("agent.cr.discarded")}</p>}

      {formShown && (cr.needs ?? []).some((n) => n.kind === "spec") && <SpecNeedsForm key={`${cr.id}-spec-${(cr.needs ?? []).map((n) => n.name).join()}`} needs={cr.needs ?? []} busy={busy === "params"} error={stepError} onSubmit={onParams} />}
      {formShown && !(cr.needs ?? []).some((n) => n.kind === "spec") && <NeedsForm key={`${cr.id}-${(cr.needs ?? []).map((n) => n.name).join()}`} needs={cr.needs ?? []} busy={busy === "params"} error={stepError} onSubmit={onParams} />}
      {!formShown && stepError && <p className="ui-field__error" role="alert" data-wb-step-error>{stepError}</p>}

      <div className="wb-cr__actions">
        {(cr.state === "draft" || cr.state === "failed") && (
          <button type="button" className={`ui-btn ui-btn--sm${cr.state === "draft" ? " ui-btn--primary" : ""}`} data-wb-trial disabled={busy !== null || needsPending(cr)} onClick={onTrial}>
            {cr.state === "draft" ? t("agent.cr.tryCopy") : t("agent.cr.tryAgain")}
          </button>
        )}
        {showApprove && (
          <button type="button" className={`ui-btn ui-btn--sm${cr.state === "ready" ? " ui-btn--primary" : ""}`} data-wb-approve disabled={!approveEnabled} aria-describedby={approveEnabled ? undefined : `wb-cr-wait-${cr.id}`} onClick={onApprove}>
            {cr.kind === "structural" && cr.round_trip ? t("agent.cr.approveStructural") : t("agent.cr.approve")}
          </button>
        )}
        {(cr.state === "draft" || cr.state === "ready" || cr.state === "failed") && (
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" data-wb-discard disabled={busy !== null} onClick={onDiscard}>{t("agent.cr.discard")}</button>
        )}
        {cr.state === "applied" && !cr.archived && (
          <button type="button" className="ui-btn ui-btn--sm" data-wb-revert disabled={busy !== null} onClick={onRevert}>{t("agent.cr.revert")}</button>
        )}
        {cr.state === "applied" && !cr.archived && error?.alternative === "restore_snapshot" && onRevertSnapshot && (
          <button type="button" className="ui-btn ui-btn--sm" data-wb-revert-snapshot disabled={busy !== null} onClick={onRevertSnapshot}>{t("agent.cr.revertSnapshot")}</button>
        )}
      </div>
      {formShown && <p className="ui-meta">{t("agent.need.waitTrial")}</p>}
      {showApprove && !approveEnabled && cr.state !== "ready" && <p className="ui-meta" id={`wb-cr-wait-${cr.id}`}>{t("agent.cr.approveWait")}</p>}
      {diffLast && diffBlock}
    </article>
  );
}


const TOOL_KINDS: [RegExp, MessageKey][] = [
  [/composition/, "agent.answer.tool.composition"],
  [/convergence|recycle|loop/, "agent.answer.tool.convergence"],
  [/column/, "agent.answer.tool.column"],
  [/spreadsheet/, "agent.answer.tool.spreadsheet"],
  [/fluid/, "agent.answer.tool.fluid"],
  [/stream/, "agent.answer.tool.stream"],
  [/equipment|operation|unit/, "agent.answer.tool.equipment"],
  [/topology|case/, "agent.answer.tool.layout"],
];
export const toolKind = (name: string): MessageKey => TOOL_KINDS.find(([pattern]) => pattern.test(name))?.[1] ?? "agent.answer.tool.case";

export function AnswerProgress({ steps, busy, streaming = false, startedAt, now }: { steps: AnswerStep[]; busy: boolean; streaming?: boolean; startedAt: number; now: number }) {
  const t = useT();
  const known = steps.filter((step) => !(ANSWER_STEPS as readonly string[]).includes(step.id));
  const track = [...ANSWER_STEPS.map((id) => steps.find((step) => step.id === id) ?? { id, state: "next" as const, tools: [] as string[] }), ...known];
  const current = !busy ? undefined
    : streaming ? track.find((step) => step.id === "write")
    : track.find((step) => step.state === "running") ?? track.find((step) => step.state === "next") ?? track[track.length - 1];
  const reads = steps.flatMap((step) => step.tools);
  const tools = [...new Set(reads.map(toolKind))];
  const stepName = (id: string) => (ANSWER_STEPS as readonly string[]).includes(id) ? t(`agent.answer.step.${id}` as MessageKey) : id;
  const seconds = Math.max(0, (now - startedAt) / 1000);
  if (!busy) {
    return <p className="ui-meta ui-num wb-ans-steps__done" data-wb-answer-summary>{t("agent.answer.took", { time: runClock(seconds), count: reads.length })}</p>;
  }
  return (
    <section className="wb-ans-steps" data-wb-answer-progress aria-label={t("agent.answer.progress")}>
      <p className="wb-ans-steps__now" role="status">
        <span key={current?.id ?? "start"} className="ui-status ui-status--info wb-step-in" data-live="">
          {current && !(ANSWER_STEPS as readonly string[]).includes(current.id) ? current.id : t(`agent.answer.now.${current?.id ?? "understand"}` as MessageKey)}
        </span>
        <span className="ui-meta ui-num wb-ans-steps__clock">{runClock(seconds)}</span>
      </p>
      <span className="wb-progress" aria-hidden="true" />
      <ol className="wb-ans-steps__track">
        {track.map((step, index) => {
          const state = step === current ? "now" : step.state === "done" ? "done" : "next";
          return (
            <li key={step.id} data-step-state={state} aria-current={state === "now" ? "step" : undefined}>
              <span className="wb-steps__mark" aria-hidden="true">{state === "done" ? "✓" : index + 1}</span>
              <span>{stepName(step.id)}</span>
              <span className="ui-visually-hidden">{t(`newcase.step.state.${state}` as MessageKey)}</span>
            </li>
          );
        })}
      </ol>
      {tools.length > 0 && (
        <ul className="wb-ans-steps__tools" aria-label={t("agent.answer.toolsRead")}>
          {tools.map((key) => <li key={key} className="ui-tag wb-pop">✓ {t(key)}</li>)}
        </ul>
      )}
    </section>
  );
}

const CR_STEPS = ["understand", "draft", "preview"] as const;
const CR_SLOW_SECONDS = 20;

export function CrProgress({ startedAt, now }: { startedAt: number; now: number }) {
  const t = useT();
  const seconds = Math.max(0, (now - startedAt) / 1000);
  return (
    <section className="wb-ans-steps" data-wb-cr-progress aria-label={t("agent.crProgress.label")}>
      <p className="wb-ans-steps__now" role="status">
        <span className="ui-status ui-status--info" data-live="">{t("agent.crProgress.now")}</span>
        <span className="ui-meta ui-num wb-ans-steps__clock">{runClock(seconds)}</span>
      </p>
      <span className="wb-progress" aria-hidden="true" />
      <ol className="wb-ans-steps__track">
        {CR_STEPS.map((id, index) => {
          const state = index === 0 ? "now" : "next";
          return (
            <li key={id} data-step-state={state} aria-current={state === "now" ? "step" : undefined}>
              <span className="wb-steps__mark" aria-hidden="true">{index + 1}</span>
              <span>{t(`agent.crProgress.step.${id}` as MessageKey)}</span>
              <span className="ui-visually-hidden">{t(`newcase.step.state.${state}` as MessageKey)}</span>
            </li>
          );
        })}
      </ol>
      {seconds >= CR_SLOW_SECONDS && <p className="ui-meta" role="status" data-wb-cr-slow>{t("agent.crProgress.slow")}</p>}
    </section>
  );
}

const focusOnMount = (element: HTMLButtonElement | null) => element?.focus({ preventScroll: true });

export function AnswerView({ answer, onRetry, onBack, onChoose }: { answer: AnswerState; onRetry: () => void; onBack: () => void; onChoose?: (route: ChooseRoute) => void }) {
  const t = useT();
  const locale = useLocale();
  const busy = answer.status === "thinking" || answer.status === "streaming";
  const now = useNow();
  const clock = useRef<{ busy: boolean; start: number | null; end: number | null }>({ busy: false, start: null, end: null });
  if (busy && !clock.current.busy) clock.current = { busy, start: Date.now(), end: null };
  else if (!busy && clock.current.busy) clock.current = { ...clock.current, busy, end: Date.now() };
  const started = clock.current.start;
  const drafting = answer.status === "thinking" && started !== null;
  const showSteps = !drafting && started !== null && (busy || ((answer.steps?.length ?? 0) > 0 && answer.status === "done"));
  return (
    <article className="wb-answer" data-wb-answer data-wb-answer-status={answer.status}>
      <header className="wb-cr__head"><BackButton onBack={onBack} /></header>
      {answer.question && (
        <section>
          <p className="wb-answer__q"><span className="ui-meta">{t("agent.answer.you")}</span> {answer.question}</p>
        </section>
      )}
      {drafting && <CrProgress startedAt={started} now={now} />}
      {showSteps && <AnswerProgress steps={answer.steps ?? []} busy={busy} streaming={answer.status === "streaming" && answer.text.trim() !== ""} startedAt={started} now={busy ? now : clock.current.end ?? now} />}
      {(answer.status === "streaming" || answer.status === "done" || (answer.status === "error" && answer.text)) && (
        <div className="wb-answer__text" aria-live="polite" aria-busy={busy} data-wb-reply={answer.reply?.kind}><Markdown text={answer.reply ? pick(answer.reply, locale) : answer.text} /></div>
      )}
      {answer.status === "done" && <p className="ui-meta">{t(answer.reply?.kind === "question" ? "agent.reply.followUp" : "agent.answer.readOnly")}</p>}
      {answer.status === "empty" && (
        <div className="ui-callout"><p>{t("agent.answer.empty")}</p><button type="button" className="ui-btn ui-btn--sm" onClick={onRetry}>{t("agent.answer.retry")}</button></div>
      )}
      {answer.status === "error" && (
        <div className="ui-callout ui-callout--negative" role="alert">
          <p>{errorText(answer.error, locale) ?? t("agent.answer.error")}</p>
          <button type="button" className="ui-btn ui-btn--sm" data-wb-answer-retry onClick={onRetry}>{t("agent.answer.retry")}</button>
        </div>
      )}
      {answer.status === "choose" && (
        <div className="ui-callout ui-callout--info wb-choose" data-wb-choose-card role="group" aria-labelledby="wb-choose-title" aria-describedby="wb-choose-hint">
          <p className="wb-choose__title" id="wb-choose-title"><strong>{t("agent.choose.title")}</strong></p>
          <p className="ui-muted" id="wb-choose-hint">{t("agent.choose.hint")}</p>
          <div className="wb-choose__row">
            {(answer.choices ?? []).map((route, index) => (
              <button key={route} ref={index === 0 ? focusOnMount : undefined} type="button" className={`ui-btn ui-btn--sm${index === 0 ? " ui-btn--primary" : ""}`} data-wb-choose={route} onClick={() => onChoose?.(route)}>
                {t(`agent.choose.${route}` as MessageKey)}
              </button>
            ))}
          </div>
        </div>
      )}
      {answer.status === "nocase" && (
        <div className="ui-callout ui-callout--info" data-wb-nocase>
          <p>{t("agent.answer.noCase")}</p>
          <a className="ui-btn ui-btn--sm" href={hashFor("new")}>{t("agent.answer.newCase")}</a>
        </div>
      )}
    </article>
  );
}


export function HistoryList({ history, onOpen, onRetry }: { history: HistoryState; onOpen: (id: string) => void; onRetry: () => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <section className="wb-hist" aria-labelledby="wb-hist-title" data-wb-history>
      <h3 className="wb-subhead" id="wb-hist-title">{t("agent.hist.title")}</h3>
      {(history.status === "idle" || (history.status === "loading" && history.items.length === 0)) && <p className="ui-meta" role="status">{t("agent.hist.loading")}</p>}
      {history.status === "error" && (
        <div className="ui-callout ui-callout--negative" role="alert">
          <p>{errorText(history.error, locale) ?? t("agent.hist.error")}</p>
          <button type="button" className="ui-btn ui-btn--sm" data-wb-history-retry onClick={onRetry}>{t("agent.hist.retry")}</button>
        </div>
      )}
      {history.status === "ready" && history.items.length === 0 && <p className="ui-meta">{t("agent.hist.empty")}</p>}
      {history.items.length > 0 && (
        <ul className="wb-hist__list">
          {[...history.items].reverse().map((cr) => (
            <li key={cr.id}>
              <button type="button" className="wb-hist__item" data-wb-history-item onClick={() => onOpen(cr.id)}>
                <span className="wb-hist__what">{pick(cr.what, locale) || cr.text}</span>
                <StateTag state={cr.state} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


const SUGGEST_GLYPH = { ask: "?", change: "Δ", create: "+" } as const;

export function SuggestionChips({ chips, title }: { chips: Suggestion[]; title?: string }) {
  const t = useT();
  if (chips.length === 0) return null;
  const groups = (["ask", "change", "create"] as const).filter((group) => chips.some((chip) => chip.group === group));
  return (
    <section className="wb-suggest" data-wb-suggest aria-label={title ?? t("agent.suggest.title")}>
      {title && <h3 className="wb-subhead">{title}</h3>}
      {groups.map((group) => (
        <div key={group} className="wb-suggest__group" data-group={group}>
          <span className="wb-suggest__label">{t(`agent.suggest.${group}` as MessageKey)}</span>
          <ul className="wb-suggest__list">
            {chips.filter((chip) => chip.group === group).map((chip) => (
              <li key={chip.text}>
                <button type="button" className="wb-suggest__chip" data-wb-suggest-chip title={t("agent.suggest.fill")} onClick={() => fillCommand(chip.text)}>
                  <span className="wb-suggest__glyph" aria-hidden="true">{SUGGEST_GLYPH[group]}</span>
                  <span className="wb-suggest__text">{chip.text}</span>
                  <span className="wb-suggest__go" aria-hidden="true">↵</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}


export function AgentPanel({ mode, store = agentStore, dialog }: { mode: "column" | "sheet"; store?: AgentStore; dialog?: HysysDialogInfo | null }) {
  const t = useT();
  const locale = useLocale();
  const state = useAgent(store);
  const { summary } = useCase();
  const sid = summary && summary.attached ? summary.file_session_id : null;
  const topology = summary && summary.attached ? summary.topology : null;
  const lastText = state.view === "card" && state.cr ? state.cr.text : state.view === "answer" && state.answer?.status === "done" ? state.answer.question : "";
  const next = topology && lastText ? followUps(lastText, topology, locale) : [];

  useEffect(() => { store.adopt(sid); }, [store, sid]);
  const sheetOpen = mode === "sheet" && state.sheetOpen;
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") store.closeSheet(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, store]);

  if (mode === "sheet" && !state.sheetOpen) {
    return (
      <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm wb-agent-opener" data-wb-agent-open onClick={store.openSheet}>
        <span>{t("agent.opener")}</span>
        <span className="ui-tag ui-num">{state.history.items.length}</span>
      </button>
    );
  }

  const main = state.view === "card" && state.cr ? (
    <ChangeRequestCard
      cr={state.cr} busy={state.crBusy} error={state.crError}
      onTrial={() => void store.runTrial()} onConfirm={() => void store.confirm()} onParams={(p) => void store.setParams(p)} onApprove={() => void store.approve()}
      onDiscard={() => void store.discard()} onRevert={() => void store.revert()} onRevertSnapshot={() => void store.revertViaSnapshot()} onBack={store.back}
    />
  ) : state.view === "answer" && state.answer ? (
    <AnswerView answer={state.answer} onRetry={() => void store.retry()} onBack={store.back} onChoose={(route) => void store.choose(route)} />
  ) : (
    <div className="wb-agent__idle">
      {sid ? (
        <>
          {topology && <SuggestionChips chips={caseSuggestions(topology, locale)} title={t("agent.suggest.title")} />}
          <HistoryList history={state.history} onOpen={(id) => void store.openCr(id)} onRetry={() => void store.loadHistory()} />
        </>
      ) : (
        <>
          <div className="ui-callout ui-callout--info" data-wb-nocase>
            <p>{t("agent.hist.noCase")}</p>
            <a className="ui-btn ui-btn--sm" href={hashFor("new")}>{t("agent.answer.newCase")}</a>
          </div>
          <SuggestionChips chips={noCaseSuggestions(locale)} title={t("agent.suggest.title")} />
        </>
      )}
    </div>
  );
  const waitingOn = agentRunActive(state) ? (dialog === undefined ? hysysDialogOf(summary) : dialog) : null;
  const withMain = next.length > 0 ? <>{main}<SuggestionChips chips={next} title={t("agent.suggest.next")} /></> : main;
  const body = waitingOn ? <><HysysDialogLine dialog={waitingOn} className="ui-callout ui-callout--info" live={false} />{withMain}</> : withMain;

  if (mode === "sheet") {
    return (
      <div className="wb-agent-sheet" role="region" aria-label={t("agent.sheet.title")} data-wb-agent-sheet>
        <div className="wb-agent-sheet__bar">
          <h2 className="ui-panel__title">{t("agent.sheet.title")}</h2>
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" aria-label={t("agent.sheet.close")} onClick={store.closeSheet}><span aria-hidden="true">×</span></button>
        </div>
        <div className="wb-agent-sheet__body" data-wb-agent>{body}</div>
      </div>
    );
  }
  return <div className="wb-agent wb-agent--column" data-wb-agent>{body}</div>;
}
