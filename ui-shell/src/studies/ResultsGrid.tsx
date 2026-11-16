import { useState } from "react";
import { useLocale, useT, type MessageKey } from "../i18n";
import { formatValue, resultsTsv, runLabel, targetLabel, valueKey, type Run, type Study } from "./model";

const RUN_STATE_KEY: Record<Run["state"], MessageKey> = {
  pending: "studies.run.pending", running: "studies.run.running", done: "studies.run.done",
  failed: "studies.run.failed", timed_out: "studies.run.timed_out",
};
const RUN_STATUS: Record<Run["state"], string> = {
  pending: "", running: "info", done: "positive", failed: "negative", timed_out: "warning",
};
const GATE_KEY: Record<string, MessageKey> = {
  unknown_values: "studies.gate.unknown_values", write_failed: "studies.gate.write_failed", timed_out: "studies.gate.timed_out",
  hysys_question: "studies.gate.hysys_question", hysys_ended: "studies.gate.hysys_ended", dynamics_failed: "studies.gate.dynamics_failed",
};

export function gateKey(run: Run): MessageKey | null {
  if (run.state !== "failed" && run.state !== "timed_out") return null;
  return (run.gate && GATE_KEY[run.gate]) || "studies.gate.other";
}

function DynamicsFigure({ runId, figure }: { runId: string; figure: (runId: string) => Promise<string> }) {
  const t = useT();
  const [state, setState] = useState<{ status: "idle" | "loading" | "failed" } | { status: "ready"; src: string }>({ status: "idle" });
  if (state.status === "ready") return <img className="wb-studies__figure wb-pop" src={state.src} alt={t("studies.results.figure")} />;
  return (
    <span>
      <button type="button" className="ui-btn ui-btn--sm" data-action="study-figure" disabled={state.status === "loading"} aria-busy={state.status === "loading"}
        onClick={() => { setState({ status: "loading" }); figure(runId).then((src) => setState({ status: "ready", src }), () => setState({ status: "failed" })); }}>
        {t("studies.results.figure")}
      </button>
      {state.status === "failed" && <span className="ui-meta" role="status"> {t("studies.results.figureFailed")}</span>}
    </span>
  );
}

export function ResultsGrid({ study, copy, figure }: { study: Study; copy?: (text: string) => Promise<void>; figure?: (runId: string) => Promise<string> }) {
  const t = useT();
  const locale = useLocale();
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const stateLabel = (run: Run) => t(study.kind === "dynamics" && run.state === "done" ? "studies.run.doneDynamics" : RUN_STATE_KEY[run.state]);
  const stateText = (run: Run) => {
    const gate = gateKey(run);
    return gate ? `${stateLabel(run)} · ${t(gate)}` : stateLabel(run);
  };
  const onCopy = () => {
    const text = resultsTsv(study, locale, stateText, t("studies.results.run"), t("studies.results.state"));
    const write = copy ?? ((value: string) => navigator.clipboard.writeText(value));
    write(text).then(() => setCopied("ok"), () => setCopied("failed"));
  };
  return (
    <section className="wb-studies__results" data-wb-study-results={study.id} aria-label={t("studies.results")}>
      <div className="wb-studies__results-head">
        <h3 className="ui-h">{t("studies.results")} · {study.name}</h3>
        <button type="button" className="ui-btn ui-btn--sm" data-action="study-copy" onClick={onCopy}>{t("studies.results.copy")}</button>
        {copied && <span className="ui-meta" role="status">{t(copied === "ok" ? "studies.results.copied" : "studies.results.copyFailed")}</span>}
      </div>
      <div className="ui-table-wrap">
        <table className="ui-table ui-table--compact">
          <thead>
            <tr>
              <th scope="col">{t("studies.results.run")}</th>
              {study.monitors.map((m) => <th key={valueKey(m)} scope="col" className="is-num">{targetLabel(m)}</th>)}
              <th scope="col">{t("studies.results.state")}</th>
            </tr>
          </thead>
          <tbody>
            {study.runs.map((run) => {
              const gate = gateKey(run);
              return (
                <tr key={`${run.id}-${run.state}`} data-run-id={run.id} data-run-state={run.state}
                  className={run.state === "pending" ? undefined : `wb-flash wb-flash--${RUN_STATUS[run.state] || "info"}`}>
                  <th scope="row">{runLabel(run, locale)}</th>
                  {study.monitors.map((m) => (
                    <td key={valueKey(m)} className="is-num ui-num">{formatValue(run.values[valueKey(m)]?.value ?? null)}</td>
                  ))}
                  <td>
                    <span className={`ui-status${RUN_STATUS[run.state] ? ` ui-status--${RUN_STATUS[run.state]}` : ""}${run.state === "pending" ? "" : " wb-pop"}`} data-live={run.state === "running" ? "" : undefined}>{stateLabel(run)}</span>
                    {run.seconds !== null && run.state !== "pending" && <span className="ui-meta ui-num"> {t("studies.results.seconds", { s: run.seconds.toFixed(0) })}</span>}
                    {gate && <div className="ui-meta">{t(gate)}</div>}
                    {run.errors.length > 0 && study.kind === "dynamics" && <div className="ui-meta">{run.errors[0]}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {figure && study.runs.filter((run) => run.dynamicsRunId).map((run) => <DynamicsFigure key={run.id} runId={run.dynamicsRunId as string} figure={figure} />)}
    </section>
  );
}
