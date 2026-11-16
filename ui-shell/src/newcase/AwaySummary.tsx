import { useSyncExternalStore } from "react";
import { useT, type MessageKey } from "../i18n";
import type { BeaconTone } from "../shell/NewCaseBeacon";
import { awayCardStore, type AwayEntry } from "./attention";

const STATE_KEY: Record<BeaconTone, MessageKey> = {
  running: "nav.beacon.running",
  waiting: "nav.beacon.waiting",
  ready: "nav.beacon.ready",
  stopped: "nav.beacon.stopped",
  done: "nav.beacon.done",
};

const NEXT_KEY: Record<BeaconTone, MessageKey> = {
  running: "newcase.away.nextRunning",
  waiting: "newcase.away.nextWaiting",
  ready: "newcase.away.nextReady",
  stopped: "newcase.away.nextStopped",
  done: "newcase.away.nextDone",
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

export function AwaySummary() {
  const t = useT();
  const entries = useSyncExternalStore(awayCardStore.subscribe, awayCardStore.get, awayCardStore.get);
  if (!entries || entries.length === 0) return null;
  const last: AwayEntry = entries[entries.length - 1];
  return (
    <section className="ui-callout ui-callout--info wb-away" role="status" data-newcase="away">
      <div className="wb-away__head">
        <strong>{t("newcase.away.title")}</strong>
        <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" aria-label={t("studies.notice.dismiss")} onClick={() => awayCardStore.dismiss()}>×</button>
      </div>
      <ul className="wb-away__rows ui-meta ui-num" data-newcase="away-rows">
        {entries.map((entry, index) => {
          const at = new Date(entry.at);
          const when = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
          return (
            <li key={`${entry.at}-${index}`} data-newcase="away-row">
              {when} · {t(STATE_KEY[entry.tone])}{entry.total > 0 ? ` · ${entry.step}/${entry.total}` : ""}
            </li>
          );
        })}
      </ul>
      <p className="wb-away__next" data-newcase="away-next">{t(NEXT_KEY[last.tone])}</p>
    </section>
  );
}
