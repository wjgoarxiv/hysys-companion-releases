import { useSyncExternalStore } from "react";
import { useT, type MessageKey } from "../i18n";
import type { FlowState } from "../newcase/flow";
import { newCaseRun, type NewCaseRunStore } from "../newcase/runStore";
import { stagesFinished, stepNumber, stepTrack } from "../newcase/NewCaseView";

export type BeaconTone = "running" | "waiting" | "ready" | "stopped" | "done";
export type Beacon = { tone: BeaconTone; step: number; total: number };

export function beaconOf(state: FlowState): Beacon | null {
  const track = stepTrack(state.mode, state.stages, stagesFinished(state));
  const position = track.findIndex((step) => step.state === "now");
  const { n, total } = track.length > 0 ? stepNumber(track, Math.max(0, position)) : { n: 0, total: 0 };
  const at = (tone: BeaconTone): Beacon => ({ tone, step: n, total });
  switch (state.phase) {
    case "idle": return null;
    case "starting": case "verifying": case "applying": return at("running");
    case "needs_input": case "awaiting_verify_confirm": return at(state.busy ? "running" : "waiting");
    case "awaiting_approval": return at(state.busy ? "running" : "ready");
    case "error": case "lost": return at("stopped");
    case "opened": return { tone: "done", step: total, total };
  }
}

const TONE_TEXT: Record<BeaconTone, MessageKey> = {
  running: "nav.beacon.running", waiting: "nav.beacon.waiting", ready: "nav.beacon.ready", stopped: "nav.beacon.stopped", done: "nav.beacon.done",
};

export function NewCaseBeacon({ store = newCaseRun, compact = false }: { store?: Pick<NewCaseRunStore, "subscribe" | "get">; compact?: boolean }) {
  const t = useT();
  const run = useSyncExternalStore(store.subscribe, store.get, store.get);
  const beacon = beaconOf(run.state);
  if (!beacon) return null;
  const text = t(TONE_TEXT[beacon.tone]);
  const count = beacon.total > 0 ? `${beacon.step}/${beacon.total}` : "";
  return (
    <span className={`wb-beacon${compact ? " wb-beacon--compact" : ""}`} data-tone={beacon.tone} data-wb-beacon={beacon.tone}>
      <span className="wb-beacon__mark" aria-hidden="true"><span /></span>
      {!compact && <span className="wb-beacon__text" aria-hidden="true">{text}{count && beacon.tone !== "done" ? <span className="ui-num"> · {count}</span> : null}</span>}
      {compact && count && beacon.tone !== "done" && <span className="wb-beacon__count ui-num" aria-hidden="true">{count}</span>}
      <span className="ui-visually-hidden">{t("nav.beacon.sr", { state: text, count: count || "-" })}</span>
      {beacon.tone === "running" && <span className="wb-beacon__bar" aria-hidden="true"><span style={{ transform: `scaleX(${beacon.total ? (beacon.step / beacon.total).toFixed(3) : "0.3"})` }} /></span>}
    </span>
  );
}
