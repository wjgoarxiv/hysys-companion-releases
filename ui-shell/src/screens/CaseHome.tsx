import { useState } from "react";
import { hashFor } from "../router";
import { useLocale, useT } from "../i18n";
import { highlightStore, useHighlight, type HighlightState } from "../pfd/highlight";
import { ItemCard } from "../pfd/ItemCard";
import { PfdView } from "../pfd/PfdView";
import { useProblems, type ProblemsState } from "../problems/controller";
import { goTo, locateProblem, requestChange, SEVERITIES, type ProblemItem } from "../problems/model";
import { NoCase, ProblemRows } from "../problems/ProblemsView";
import { detachedReason, useCase, type CaseState } from "../state/case";
import type { PfdFlag } from "../pfd/graph";
import { ScreenFrame, SkeletonRows } from "./Screen";

const TOP_PROBLEMS = 3;

function TopProblems({ problems, onLocate, onFix, onRefresh }: {
  problems: ProblemsState; onLocate: (item: ProblemItem) => void; onFix: (item: ProblemItem) => void; onRefresh: () => void;
}) {
  const t = useT();
  if (problems.status === "error") {
    return (
      <div className="ui-callout ui-callout--negative wb-pad" role="alert">
        <p>{t("casehome.problems.retry")}</p>
        <button type="button" className="ui-btn ui-btn--sm" data-wb-retry-problems onClick={onRefresh}>{t("problems.retry")}</button>
      </div>
    );
  }
  if (!problems.data) return <><p className="ui-meta wb-pad" role="status">{t("problems.loading")}</p><SkeletonRows count={2} /></>;
  const items = problems.data.items;
  if (items.length === 0) return <p className="ui-status ui-status--positive wb-pad">{t("casehome.problems.none")}</p>;
  return (
    <>
      <ProblemRows items={items} limit={TOP_PROBLEMS} onLocate={onLocate} onFix={onFix} />
      <a className="wb-casehome__all" href={hashFor("problems")}>{t("casehome.problems.seeAll")} (<span className="ui-num">{items.length}</span>)</a>
    </>
  );
}

export type CaseHomeViewProps = {
  state: Pick<CaseState, "summary" | "loading" | "error"> & { switching?: boolean };
  problems: ProblemsState;
  highlight: HighlightState;
  onRetry: () => void;
  onLocate: (item: ProblemItem) => void;
  onFix: (item: ProblemItem) => void;
  onRefreshProblems: () => void;
  onReconnect?: () => void;
  inspected?: string | null;
  onInspect?: (name: string | null) => void;
};

export function flagsOf(problems: ProblemsState): Record<string, PfdFlag> {
  const rank = new Map(SEVERITIES.map((severity, index) => [severity, index]));
  const flags: Record<string, PfdFlag> = {};
  for (const item of problems.data?.items ?? []) {
    const name = item.locate?.name;
    if (!name) continue;
    const current = flags[name];
    if (!current || (rank.get(item.severity) ?? 9) < (rank.get(current) ?? 9)) flags[name] = item.severity;
  }
  return flags;
}

export function CaseHomeView({ state, problems, highlight, onRetry, onLocate, onFix, onRefreshProblems, onReconnect, inspected = null, onInspect }: CaseHomeViewProps) {
  const t = useT();
  const locale = useLocale();
  const { summary, loading, error } = state;
  const switching = state.switching === true;
  const retry = <button type="button" className="ui-btn ui-btn--sm" data-wb-retry onClick={onRetry}>{t("casehome.retry")}</button>;
  let body;
  if (!summary && error && !loading) {
    body = <div className="ui-callout ui-callout--negative" role="alert"><p>{t("casehome.error")}</p>{retry}</div>;
  } else if (!summary) {
    body = <><p className="ui-meta" role="status">{t("casehome.loading")}</p><SkeletonRows count={4} /></>;
  } else if (!summary.attached) {
    body = <NoCase reason={detachedReason(summary, locale, switching, t("casehome.switching"))} onReconnect={summary.reconnectable ? onReconnect : undefined} />;
  } else {
    body = (
      <>
        {error && <div className="ui-callout ui-callout--warning" role="alert"><p>{t("casehome.error")}</p>{retry}</div>}
        <div className="wb-casehome__body">
          <section className="ui-panel ui-panel--flush wb-casehome__pfd" data-wb-pfd aria-label={t("casehome.pfd.title")}>
            <div className="ui-panel__head"><h2 className="ui-panel__title">{t("casehome.pfd.title")}</h2></div>
            <PfdView topology={summary.topology} caseName={summary.case_name} highlight={highlight.name} focusNonce={highlight.nonce} flags={flagsOf(problems)}
              onInspect={onInspect ? (name) => onInspect(name) : undefined} />
            {onInspect && (inspected && summary.file_session_id
              ? <ItemCard key={inspected} fileSessionId={summary.file_session_id} name={inspected} onClose={() => onInspect(null)} onPick={(name) => onInspect(name)} />
              : <p className="ui-meta wb-pad" data-wb-pfd-click-hint>{t("pfd.clickHint")}</p>)}
          </section>
          <section className="ui-panel ui-panel--flush wb-casehome__problems" aria-label={t("casehome.problems.title")}>
            <div className="ui-panel__head"><h2 className="ui-panel__title">{t("casehome.problems.title")}</h2></div>
            <TopProblems problems={problems} onLocate={onLocate} onFix={onFix} onRefresh={onRefreshProblems} />
          </section>
        </div>
      </>
    );
  }
  return <div className="wb-casehome">{body}</div>;
}

export function CaseHome() {
  const t = useT();
  const locale = useLocale();
  const { summary, loading, error, switching, refresh } = useCase();
  const highlight = useHighlight();
  const fileSessionId = summary?.attached ? summary.file_session_id : null;
  const { state: problems, reload } = useProblems(fileSessionId);
  const [inspected, setInspected] = useState<string | null>(null);
  return (
    <ScreenFrame title={t("screen.case.title")}>
      <CaseHomeView
        state={{ summary, loading, error, switching }}
        problems={problems}
        highlight={highlight}
        onRetry={() => void refresh()}
        onLocate={(item) => locateProblem(item, { highlight: highlightStore, navigate: goTo })}
        onFix={(item) => { if (fileSessionId) requestChange(item, fileSessionId, locale); }}
        onRefreshProblems={reload}
        onReconnect={() => void refresh({ reconnect: true })}
        inspected={inspected}
        onInspect={setInspected}
      />
    </ScreenFrame>
  );
}
