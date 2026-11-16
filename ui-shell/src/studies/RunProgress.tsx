import { useEffect, useState, type CSSProperties } from "react";
import { translate, useLocale, useT, type UiLocale } from "../i18n";
import { clockText, formatValue, runLabel, targetLabel, valueKey, type Run, type Study } from "./model";

const TICK_MS = 1000;

function currentRun(study: Study): Run | null {
  return study.runs.find((run) => run.state === "running") ?? null;
}

export function progressText(study: Study, locale: UiLocale): string {
  if (study.state === "queued") return translate(locale, "studies.live.queued");
  const run = currentRun(study);
  if (!run) return translate(locale, "studies.live.between");
  if (study.kind === "dynamics") {
    const phase = run.progress?.phase ?? "starting";
    return translate(locale, `studies.live.dyn.${phase}`);
  }
  const n = study.runs.indexOf(run) + 1;
  return translate(locale, "studies.live.run", { n, total: study.runs.length, label: runLabel(run, locale) });
}

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Clock({ study, now }: { study: Study; now: number }) {
  const t = useT();
  const run = currentRun(study);
  if (!run || run.startedAt === null) return null;
  const elapsed = Math.max(0, (now - run.startedAt) / 1000);
  const p = run.progress;
  const left = study.kind === "dynamics" && p?.phase === "running" && p.t && p.stopS && p.t < p.stopS
    ? (elapsed * (p.stopS - p.t)) / p.t : null;
  return (
    <span className="ui-meta ui-num">
      {t("studies.live.elapsed", { time: clockText(elapsed) })}
      {left !== null && ` · ${t("studies.live.left", { time: clockText(left) })}`}
      {study.kind !== "dynamics" && ` · ${t("studies.live.limit", { time: clockText(study.timeoutS) })}`}
    </span>
  );
}

function Simulated({ study, run }: { study: Study; run: Run }) {
  const t = useT();
  const p = run.progress;
  if (!p || p.t === null || p.stopS === null || p.stopS <= 0) return null;
  const done = Math.min(1, Math.max(0, p.t / p.stopS));
  const shown = Object.entries(p.values).filter(([, reading]) => reading.value !== null);
  return (
    <>
      <div className="wb-studies__sim">
        <span className="wb-meter" role="progressbar" aria-label={t("studies.live.simLabel")}
          aria-valuemin={0} aria-valuemax={p.stopS} aria-valuenow={Math.floor(p.t)}>
          <span style={{ "--fill": done } as CSSProperties} />
        </span>
        <span className="ui-meta ui-num">{t("studies.live.sim", { t: Math.floor(p.t), stop: p.stopS })} · {Math.round(done * 100)}%</span>
      </div>
      {shown.length > 0 && (
        <p className="ui-meta wb-studies__now">
          <span>{t("studies.live.now")}</span>
          {shown.map(([key, reading]) => {
            const monitor = study.monitors.find((m) => valueKey(m) === key);
            return (
              <span key={key} className="ui-num">
                {monitor ? targetLabel({ ...monitor, unit: null }) : key} <strong>{formatValue(reading.value)}</strong>{reading.unit ? ` ${reading.unit}` : ""}
              </span>
            );
          })}
        </p>
      )}
    </>
  );
}

export function RunProgress({ study, now }: { study: Study; now?: number }) {
  const locale = useLocale();
  const ticking = useNow();
  const at = now ?? ticking;
  const run = currentRun(study);
  return (
    <div className="wb-studies__live" data-wb-study-live={run?.progress?.phase ?? study.state}>
      <p className="wb-studies__say" aria-live="polite">
        <span className="ui-status ui-status--info" data-live="" aria-hidden="true" />
        {progressText(study, locale)}
      </p>
      {study.state === "running" && <Clock study={study} now={at} />}
      {run && study.kind === "dynamics" && <Simulated study={study} run={run} />}
    </div>
  );
}
