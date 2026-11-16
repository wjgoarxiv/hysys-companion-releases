import { HysysLaunch } from "../connection/LaunchAction";
import { hashFor } from "../router";
import { useLocale, useT, type MessageKey } from "../i18n";
import type { ProblemsState } from "./controller";
import { staggerStyle } from "../motion";
import { SkeletonRows } from "../screens/Screen";
import { canLocate, groupBySeverity, titleOf, type ProblemItem, type ProblemsResponse, type Severity } from "./model";

const STATUS: Record<Severity, string> = { error: "ui-status--negative", warning: "ui-status--warning", info: "ui-status--info" };
const GROUP_LABEL: Record<Severity, MessageKey> = { error: "problems.sev.error", warning: "problems.sev.warning", info: "problems.sev.info" };
const ONE_LABEL: Record<Severity, MessageKey> = { error: "problems.sevOne.error", warning: "problems.sevOne.warning", info: "problems.sevOne.info" };
const KNOWN_SOURCES = ["solver", "convergence", "dof", "recycle", "hx", "streams", "property_package", "live_evidence"] as const;

export function sourceKey(source: string): MessageKey {
  const base = source.split(":")[0];
  return (KNOWN_SOURCES as readonly string[]).includes(base) ? (`problems.source.${base}` as MessageKey) : "problems.source.other";
}

export type RowActions = { onLocate: (item: ProblemItem) => void; onFix: (item: ProblemItem) => void };

export function ProblemRow({ item, index = 0, showSeverity = false, showDetail = true, onLocate, onFix }: RowActions & { item: ProblemItem; index?: number; showSeverity?: boolean; showDetail?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const title = titleOf(item, locale);
  const fixHint = item.fix ? (locale === "en" ? item.fix.summary_en : item.fix.summary_ko) : "";
  return (
    <li className={`wb-problem wb-problem--${item.severity}`} data-wb-problem-row data-severity={item.severity} style={staggerStyle(index)}>
      <div className="wb-problem__body">
        {showSeverity && <span className={`ui-status ${STATUS[item.severity] ?? ""}`.trim()}>{t(ONE_LABEL[item.severity] ?? ONE_LABEL.info)}</span>}
        <strong className="wb-problem__title">{title}</strong>
        {showDetail && item.detail && <p className="ui-meta wb-problem__detail">{item.detail}</p>}
        {showDetail && fixHint && <p className="wb-problem__fix">{t("problems.fixHint", { hint: fixHint })}</p>}
        {showDetail && <p className="ui-meta wb-problem__source">{t("problems.source", { source: t(sourceKey(item.source)) })}</p>}
      </div>
      {(canLocate(item) || item.fix) && (
        <div className="wb-problem__actions">
          {canLocate(item) && (
            <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" data-wb-locate aria-label={t("problems.locate.aria", { title })} onClick={() => onLocate(item)}>
              {t("problems.locate")}
            </button>
          )}
          {item.fix && (
            <button type="button" className="ui-btn ui-btn--sm" data-wb-fix aria-label={t("problems.fix.aria", { title })} onClick={() => onFix(item)}>
              {t("problems.fix")}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function ProblemRows({ items, limit, ...actions }: RowActions & { items: readonly ProblemItem[]; limit: number }) {
  return (
    <ul className="ui-list wb-problems__list wb-problems__list--compact wb-stagger">
      {items.slice(0, limit).map((item, index) => <ProblemRow key={item.id} item={item} index={index} showSeverity showDetail={false} {...actions} />)}
    </ul>
  );
}

export function SourcesFailedNote({ failed }: { failed: ProblemsResponse["sources_failed"] }) {
  const t = useT();
  if (failed.length === 0) return null;
  return (
    <div className="wb-failed" data-wb-sources-failed>
      <p className="ui-meta">{t("problems.failed.line")}</p>
      <details>
        <summary className="ui-meta">{t("problems.failed.why")}</summary>
        <ul className="wb-failed__list">
          {failed.map((f, i) => (
            <li key={`${f.source}-${i}`} className="ui-meta"><strong>{t(sourceKey(f.source))}</strong> · <span className="ui-code">{f.reason}</span></li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function NoCase({ reason, onReconnect }: { reason: string; onReconnect?: () => void }) {
  const t = useT();
  return (
    <div className="wb-nocase" data-wb-nocase>
      <p className="wb-nocase__title"><strong>{reason}</strong></p>
      <p className="ui-muted">{t("casehome.noCase.hint")}</p>
      <HysysLaunch />
      <div className="ui-cluster">
        {onReconnect && <button type="button" className="ui-btn ui-btn--sm ui-btn--primary" data-wb-reconnect onClick={onReconnect}>{t("casehome.noCase.reconnect")}</button>}
        <a className="ui-btn ui-btn--sm ui-btn--primary" href={hashFor("new")}>{t("casehome.noCase.new")}</a>
        <a className="ui-btn ui-btn--sm ui-btn--quiet" href={hashFor("settings")}>{t("casehome.noCase.settings")}</a>
      </div>
    </div>
  );
}

export type ProblemsViewProps = RowActions & {
  state: ProblemsState;
  onRefresh: () => void;
  noCase?: { reason: string };
};

export function ProblemsView({ state, onRefresh, onLocate, onFix, noCase }: ProblemsViewProps) {
  const t = useT();
  if (noCase) return <NoCase reason={noCase.reason} />;
  const busy = state.status === "loading" || state.refreshing;
  const retry = (
    <button type="button" className="ui-btn ui-btn--sm" data-wb-retry onClick={onRefresh}>{t("problems.retry")}</button>
  );
  if (state.status === "error") {
    return (
      <div className="ui-callout ui-callout--negative" role="alert">
        <p>{t("problems.error")}</p>
        {retry}
      </div>
    );
  }
  if (state.status === "idle" || state.status === "loading" || !state.data) {
    return <><p className="ui-meta" role="status">{t("problems.loading")}</p><SkeletonRows count={4} /></>;
  }
  const groups = groupBySeverity(state.data.items);
  return (
    <div className="ui-panel ui-panel--flush wb-problems" data-wb-problems>
      <div className="wb-problems__bar">
        <span className="ui-meta" role="status">{state.refreshing ? t("problems.refreshing") : ""}</span>
        <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" data-wb-refresh disabled={busy} onClick={onRefresh}>{t("problems.refresh")}</button>
      </div>
      {groups.length === 0 ? (
        <p className="ui-status ui-status--positive wb-pad">{t("problems.none")}</p>
      ) : groups.map((group) => (
        <section key={group.severity} className="wb-problems__group" data-wb-problem-group data-severity={group.severity}>
          <h2 className="wb-problems__head">
            <span className={`ui-status ${STATUS[group.severity]}`}>{t(GROUP_LABEL[group.severity])} <span className="ui-num">{group.items.length}</span></span>
          </h2>
          <ul className="ui-list wb-problems__list wb-stagger">
            {group.items.map((item, index) => <ProblemRow key={item.id} item={item} index={index} onLocate={onLocate} onFix={onFix} />)}
          </ul>
        </section>
      ))}
      <SourcesFailedNote failed={state.data.sources_failed ?? []} />
    </div>
  );
}
