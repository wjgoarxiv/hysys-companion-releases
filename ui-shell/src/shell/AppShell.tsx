import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { hashFor, type RouteId } from "../router";
import { AgentPanel } from "../agent/AgentPanel";
import { HysysLaunch } from "../connection/LaunchAction";
import { useT, type MessageKey } from "../i18n";
import { CaseHome } from "../screens/CaseHome";
import { NewCase } from "../screens/NewCase";
import { Placeholder } from "../screens/Placeholder";
import { Problems } from "../screens/Problems";
import { SettingsScreen } from "../screens/Settings";
import { Studies } from "../screens/Studies";
import { Versions } from "../screens/Versions";
import { AGENT_W_MAX, AGENT_W_MIN, agentWidthStore, clampAgentWidth, useAgentWidth, type Layout } from "../state/prefs";
import { AgentSplitter } from "./AgentSplitter";
import { CaseHeader, type CaseInfo, type HysysDialogInfo } from "./CaseHeader";
import { CommandBar } from "./CommandBar";
import { TutorialButton } from "../tutorial/TutorialCoach";
import { HeaderActions, useHeaderCollapsed } from "./headerCollapse";
import { NewCaseBeacon } from "./NewCaseBeacon";

export type AppShellProps = {
  layout: Layout;
  route: RouteId;
  caseInfo: CaseInfo | null;
  hysysDialog?: HysysDialogInfo | null;
  onSubmit: (text: string) => void;
  onToggleLayout: () => void;
  agentOpen?: boolean;
  onToggleAgent?: () => void;
  focusSignal?: number;
  notice?: ReactNode;
  banner?: ReactNode;
};

export const NAV_ROUTES: readonly RouteId[] = ["case", "problems", "versions", "studies", "new"];
export const NAV_FOOT_ROUTES: readonly RouteId[] = ["settings"];
export const PANEL_TAB_ROUTES: readonly RouteId[] = [...NAV_ROUTES, ...NAV_FOOT_ROUTES];
const NAV_LABEL: Record<RouteId, MessageKey> = {
  case: "nav.case", problems: "nav.problems", versions: "nav.versions", new: "nav.new",
  studies: "nav.studies", deliverables: "nav.deliverables", settings: "nav.settings",
};

function Screen({ route, layout }: { route: RouteId; layout: Layout }) {
  switch (route) {
    case "case": return <CaseHome />;
    case "problems": return <Problems />;
    case "versions": return <Versions layout={layout} />;
    case "new": return <NewCase />;
    case "settings": return <SettingsScreen />;
    case "studies": return <Studies />;
    case "deliverables": return <Placeholder kind="deliverables" />;
  }
}

function NavLinks({ routes, current, compact = false }: { routes: readonly RouteId[]; current: RouteId; compact?: boolean }) {
  const t = useT();
  return (
    <>
      {routes.map((id) => (
        <li key={id}>
          <a href={hashFor(id)} aria-current={id === current ? "page" : undefined}>
            {t(NAV_LABEL[id])}
            {id === "new" && <NewCaseBeacon compact={compact} />}
          </a>
        </li>
      ))}
    </>
  );
}

function LayoutToggle({ layout, onToggle }: { layout: Layout; onToggle: () => void }) {
  const t = useT();
  return (
    <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={onToggle} data-wb-layout-toggle>
      {layout === "wide" ? t("layout.toPanel") : t("layout.toWide")}
    </button>
  );
}

function Brand() {
  const t = useT();
  return (
    <a className="ui-brand tc-brand wb-brand" href={hashFor("case")} aria-label={t("app.name")}>
      <span className="tc-brand__prompt" aria-hidden="true">~/</span>hysys-companion<span className="tc-brand__cursor" aria-hidden="true" />
    </a>
  );
}

function StatusLine({ info }: { info: CaseInfo | null }) {
  const t = useT();
  if (!info?.hysys) return null;
  const { pid, owned } = info.hysys;
  const provider = info.provider;
  return (
    <footer className="tc-status wb-status" data-wb-status aria-label={t("casehome.status.label")}>
      <div className="tc-status__inner">
        <span>
          <span className="tc-status__dot" data-ok={pid !== null ? "true" : "false"} aria-hidden="true" />{" "}
          {pid !== null ? <>{t("casehome.status.pid")} <span className="ui-num">{pid}</span> · {t(owned ? "casehome.status.owned" : "casehome.status.notOwned")}</> : t("casehome.status.noHysys")}
        </span>
        <span>
          {provider?.name ? t(provider.signedIn ? "casehome.status.signedIn" : "casehome.status.signedOut", { name: provider.name }) : t("casehome.status.noProvider")}
        </span>
      </div>
    </footer>
  );
}

function useBodyWidth(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const measure = () => setWidth(el.clientWidth || Number.POSITIVE_INFINITY);
    measure();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);
  return { ref, width };
}

function WideShell(props: AppShellProps) {
  const t = useT();
  const collapsed = useHeaderCollapsed();
  const { route, agentOpen = false } = props;
  const stored = useAgentWidth();
  const body = useBodyWidth(agentOpen);
  const agentWidth = clampAgentWidth(stored, body.width);
  const agentMax = clampAgentWidth(AGENT_W_MAX, body.width);
  const bodyStyle = agentOpen ? ({ "--wb-agent-w": `${agentWidth}px` } as CSSProperties) : undefined;
  return (
    <div className="ui-app wb-shell wb-shell--wide" data-wb-layout="wide">
      <a className="ui-skip" href="#main">{t("app.skip")}</a>
      <aside className="ui-app__nav" data-wb-region="rail" aria-label={t("app.name")}>
        <Brand />
        <nav aria-label={t("nav.label")}>
          <ul className="ui-navlist"><NavLinks routes={NAV_ROUTES} current={route} /></ul>
        </nav>
        <ul className="ui-navlist wb-rail__foot">
          <li><TutorialButton className="wb-rail__tutorial" /></li>
          <NavLinks routes={NAV_FOOT_ROUTES} current={route} />
        </ul>
      </aside>
      <div className="ui-app__main">
        <header className="ui-topbar wb-topbar" data-wb-region="topbar">
          <CaseHeader info={props.caseInfo} dialog={props.hysysDialog} noCaseAction={<HysysLaunch compact />} />
          <div className="ui-cluster">
            <HeaderActions collapsed={collapsed}>
              <button type="button" className="ui-btn ui-btn--sm" aria-pressed={agentOpen} onClick={props.onToggleAgent} data-wb-agent-toggle>
                {agentOpen ? t("agent.close") : t("agent.open")}
              </button>
              <LayoutToggle layout="wide" onToggle={props.onToggleLayout} />
            </HeaderActions>
          </div>
        </header>
        {props.banner}
        <div ref={body.ref} className={`wb-body${agentOpen ? " wb-body--agent" : ""}`} style={bodyStyle}>
          <main className="ui-page" id="main"><Screen route={route} layout="wide" /></main>
          {agentOpen && (
            <aside className="wb-agent-column ui-panel ui-panel--flush" data-wb-region="agent-column" aria-label={t("agent.title")}>
              <AgentSplitter width={agentWidth} min={AGENT_W_MIN} max={agentMax} onChange={(width) => agentWidthStore.set(width)} onReset={() => agentWidthStore.reset()} />
              <div className="ui-panel__head"><h2 className="ui-panel__title">{t("agent.title")}</h2></div>
              <div className="wb-agent-column__body"><AgentPanel mode="column" /></div>
              <div className="wb-agent-column__input"><CommandBar onSubmit={props.onSubmit} focusSignal={props.focusSignal} /></div>
            </aside>
          )}
        </div>
        <StatusLine info={props.caseInfo} />
      </div>
    </div>
  );
}

function PanelShell(props: AppShellProps) {
  const t = useT();
  const collapsed = useHeaderCollapsed();
  const { route } = props;
  return (
    <div className="wb-shell wb-shell--panel" data-wb-layout="panel">
      <a className="ui-skip" href="#main">{t("app.skip")}</a>
      <header className="wb-panelbar" data-wb-region="topbar">
        <CaseHeader info={props.caseInfo} dialog={props.hysysDialog} noCaseAction={<HysysLaunch compact />} />
        <HeaderActions collapsed={collapsed}>
          <LayoutToggle layout="panel" onToggle={props.onToggleLayout} />
        </HeaderActions>
      </header>
      {props.notice}
      {props.banner}
      <nav className="wb-tabnav" aria-label={t("nav.label")}>
        <ul className="ui-navlist">
          <NavLinks routes={PANEL_TAB_ROUTES} current={route} compact />
        </ul>
      </nav>
      <main className="ui-page wb-panelbody" id="main"><Screen route={route} layout="panel" /></main>
      <div className="wb-pinned" data-wb-region="agent-pinned">
        <AgentPanel mode="sheet" />
        <CommandBar onSubmit={props.onSubmit} focusSignal={props.focusSignal} />
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return props.layout === "wide" ? <WideShell {...props} /> : <PanelShell {...props} />;
}
