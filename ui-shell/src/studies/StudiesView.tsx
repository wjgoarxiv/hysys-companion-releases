import type { CSSProperties, ReactNode } from "react";
import { useT, type MessageKey } from "../i18n";
import { staggerStyle } from "../motion";
import { SkeletonRows } from "../screens/Screen";
import { ResultsGrid } from "./ResultsGrid";
import { RunProgress } from "./RunProgress";
import { StudyEditor, type StudyEditorProps } from "./StudyEditor";
import { canResume, isLive, type Study } from "./model";

export type StudiesViewProps = {
  caseStatus: "loading" | "detached" | "error" | "ready";
  caseMessage?: string | null;
  listStatus: "loading" | "error" | "ready";
  studies: Study[];
  selectedId: string | null;
  confirmDiscardId: string | null;
  actionError?: string | null;
  editor: (Omit<StudyEditorProps, "catalog"> & { catalog: StudyEditorProps["catalog"] | null; catalogStatus: "loading" | "error" | "ready" }) | null;
  copy?: (text: string) => Promise<void>;
  figure?: (runId: string) => Promise<string>;
  onRetryCase: () => void;
  onRetry: () => void;
  onRetryCatalog: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onAction: (id: string, action: "start" | "resume" | "cancel") => void;
  onAskDiscard: (id: string | null) => void;
  onDiscard: (id: string) => void;
};

const STATE_STATUS: Record<Study["state"], string> = {
  draft: "", queued: "info", running: "info", done: "positive", cancelled: "warning", interrupted: "warning", failed: "negative",
};

function Alert({ children, onRetry, retryLabel }: { children: ReactNode; onRetry?: () => void; retryLabel: string }) {
  return (
    <div className="ui-callout ui-callout--negative" role="alert">
      <p>{children}</p>
      {onRetry && <button type="button" className="ui-btn ui-btn--sm" onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}

function StudyRow({ study, index, props }: { study: Study; index: number; props: StudiesViewProps }) {
  const t = useT();
  const live = isLive(study);
  const selected = props.selectedId === study.id;
  const confirming = props.confirmDiscardId === study.id;
  const status = STATE_STATUS[study.state];
  return (
    <li style={staggerStyle(index)} data-study-id={study.id} data-study-state={study.state} aria-current={selected ? "true" : undefined}>
      <div className="wb-studies__row">
        <div className="wb-studies__head">
          <strong>{study.name}</strong>
          <span className="ui-tag">{t(`studies.kind.${study.kind}` as MessageKey)}</span>
          <span key={study.state} className={`ui-status${status ? ` ui-status--${status}` : ""} wb-pop`} data-live={live ? "" : undefined}>{t(`studies.state.${study.state}` as MessageKey)}</span>
          <span key={`n-${study.finished}`} className="ui-meta ui-num wb-pop">{t("studies.progress", { done: study.finished, total: study.total })}</span>
          {study.failed > 0 && <span className="ui-meta ui-num">{t("studies.progress.failed", { count: study.failed })}</span>}
          {study.cancelRequested && live && <span className="ui-meta">{t("studies.cancelling")}</span>}
        </div>
        {live && study.kind !== "dynamics" && (
          <span className="wb-meter" role="progressbar" aria-label={study.name} aria-valuemin={0} aria-valuemax={study.total} aria-valuenow={study.finished}>
            <span style={{ "--fill": study.total ? study.finished / study.total : 0 } as CSSProperties} />
          </span>
        )}
        {live && <RunProgress study={study} />}
        <div className="ui-cluster">
          {!selected && study.finished > 0 && <button type="button" className="ui-btn ui-btn--sm" onClick={() => props.onSelect(study.id)}>{t("studies.open")}</button>}
          {study.state === "draft" && <button type="button" className="ui-btn ui-btn--sm ui-btn--primary" onClick={() => props.onAction(study.id, "start")}>{t("studies.start")}</button>}
          {live && !study.cancelRequested && <button type="button" className="ui-btn ui-btn--sm" data-action="study-cancel" onClick={() => props.onAction(study.id, "cancel")}>{t("studies.cancel")}</button>}
          {canResume(study) && (
            <button type="button" className="ui-btn ui-btn--sm" data-action="study-resume" onClick={() => props.onAction(study.id, "resume")}>{t("studies.resume")}</button>
          )}
          {!live && !confirming && <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => props.onAskDiscard(study.id)}>{t("studies.discard")}</button>}
        </div>
        {study.state === "failed" && <p className="ui-meta">{t("studies.failed.hint")}</p>}
        {confirming && (
          <div className="ui-callout ui-callout--warning" role="alertdialog" aria-label={t("studies.discard")}>
            <p>{t("studies.discard.confirm")}</p>
            <div className="ui-cluster">
              <button type="button" className="ui-btn ui-btn--sm ui-btn--danger" data-action="study-discard" onClick={() => props.onDiscard(study.id)}>{t("studies.discard.yes")}</button>
              <button type="button" className="ui-btn ui-btn--sm" onClick={() => props.onAskDiscard(null)}>{t("studies.discard.no")}</button>
            </div>
          </div>
        )}
      </div>
      {selected && <ResultsGrid study={study} copy={props.copy} figure={props.figure} />}
    </li>
  );
}

export function StudiesView(props: StudiesViewProps) {
  const t = useT();
  if (props.caseStatus === "loading") return <p className="ui-meta" role="status">{t("studies.caseLoading")}</p>;
  if (props.caseStatus === "error") return <Alert onRetry={props.onRetryCase} retryLabel={t("studies.retry")}>{t("studies.caseError")}</Alert>;
  if (props.caseStatus === "detached") return <p className="wb-empty">{props.caseMessage || t("studies.noCase")}</p>;
  const editor = props.editor;
  return (
    <div className="wb-studies" data-wb-studies>
      <div className="wb-studies__bar">
        <p className="ui-meta">{t("studies.intro")}</p>
        {!editor && <button type="button" className="ui-btn ui-btn--sm ui-btn--primary" data-action="study-new" onClick={props.onNew}>{t("studies.new")}</button>}
      </div>
      {editor && editor.catalogStatus === "loading" && <SkeletonRows count={4} />}
      {editor && editor.catalogStatus === "error" && <Alert onRetry={props.onRetryCatalog} retryLabel={t("studies.retry")}>{t("studies.catalogError")}</Alert>}
      {editor && editor.catalogStatus === "ready" && editor.catalog && <StudyEditor {...editor} catalog={editor.catalog} />}
      {props.actionError && <Alert retryLabel={t("studies.retry")}>{props.actionError}</Alert>}
      <section aria-label={t("studies.list")}>
        {props.listStatus === "loading" && <SkeletonRows count={3} />}
        {props.listStatus === "error" && <Alert onRetry={props.onRetry} retryLabel={t("studies.retry")}>{t("studies.listError")}</Alert>}
        {props.listStatus === "ready" && !props.studies.length && !editor && <p className="wb-empty">{t("studies.empty")}</p>}
        {props.listStatus === "ready" && props.studies.length > 0 && (
          <ol className="ui-list wb-studies__list wb-stagger">
            {props.studies.map((study, index) => <StudyRow key={study.id} study={study} index={index} props={props} />)}
          </ol>
        )}
      </section>
    </div>
  );
}
