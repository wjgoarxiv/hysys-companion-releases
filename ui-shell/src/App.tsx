import { useCallback, useEffect, useState } from "react";
import { agentStore, installChangeRequestListener, useAgent } from "./agent/store";
import { useRoute } from "./router";
import { AppShell } from "./shell/AppShell";
import { installFocusShortcut } from "./shell/commandBarLogic";
import { caseInfoOf, hysysDialogOf, useCase } from "./state/case";
import { StudyNotice } from "./studies/StudyNotice";
import { studyWatch, useStudyWatch, useStudyWatchFor } from "./studies/useStudies";
import { useRunAttention } from "./newcase/attention";
import { TutorialCoach } from "./tutorial/TutorialCoach";
import { layoutStore, resolveLayout, toggledLayout, useLayoutPref } from "./state/prefs";

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

export function App({ onSubmit = (text) => void agentStore.submit(text) }: { onSubmit?: (text: string) => void }) {
  const route = useRoute();
  const { summary } = useCase();
  const width = useWindowWidth();
  const layoutPref = useLayoutPref();
  const layout = resolveLayout(layoutPref, width);
  const [agentOpen, setAgentOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const { openSignal } = useAgent();
  useStudyWatchFor(summary?.attached && summary.file_session_id ? summary.file_session_id : null);
  useRunAttention();
  const { notice: studyNotice } = useStudyWatch();

  useEffect(() => installChangeRequestListener(window, agentStore), []);
  useEffect(() => { if (openSignal > 0) setAgentOpen(true); }, [openSignal]);

  useEffect(() => installFocusShortcut(window, () => {
    setAgentOpen(true);
    setFocusSignal((n) => n + 1);
  }), []);

  const toggleLayout = useCallback(() => layoutStore.set(toggledLayout(layoutPref, width)), [layoutPref, width]);

  return (
    <>
      <AppShell
        layout={layout} route={route} caseInfo={caseInfoOf(summary)} hysysDialog={hysysDialogOf(summary)} onSubmit={onSubmit}
        onToggleLayout={toggleLayout} agentOpen={agentOpen} onToggleAgent={() => setAgentOpen((open) => !open)}
        focusSignal={focusSignal}
        banner={<StudyNotice notice={studyNotice} onDismiss={studyWatch.dismissNotice} />}
      />
      <TutorialCoach />
    </>
  );
}
