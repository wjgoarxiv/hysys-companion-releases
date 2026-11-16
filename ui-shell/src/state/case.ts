import { useSyncExternalStore } from "react";
import { getJson } from "../api/client";
import type { CaseInfo, SolverState } from "../shell/CaseHeader";

export type TopologyUnit = { name: string; type: string };
export type TopologyStream = { name: string; type: string };
export type TopologyConnection = { from: string; to: string; type: string };
export type CaseTopology = { units: TopologyUnit[]; streams: TopologyStream[]; connections: TopologyConnection[] };

export type AttachedCase = {
  attached: true;
  case_name: string;
  path: string;
  file_session_id: string;
  solver: { converged: boolean | null; unconverged_count: number };
  counts: { units: number; streams: number };
  topology: CaseTopology;
  provider: { id: string | null; signed_in: boolean };
  hysys_pid: number | null;
  owned: boolean;
  busy?: boolean;
  hysys_dialog?: { text: string; since: string; kind?: "dialog" | "unresponsive" } | null;
};
export type DetachedCase = { attached: false; reason_ko: string; reason_en: string; reconnectable?: boolean; busy?: boolean; hysys_dialog?: { text: string; since: string; kind?: "dialog" | "unresponsive" } | null };
export type CaseSummary = AttachedCase | DetachedCase;

export type CaseState = { summary: CaseSummary | null; loading: boolean; error: string | null; switching: boolean };

export const CASE_POLL_MS = 5000;
export const SWITCH_MAX_MS = 60_000;

export function detachedReason(summary: DetachedCase, locale: string, switching: boolean, switchingText: string): string {
  return switching ? switchingText : locale === "en" ? summary.reason_en : summary.reason_ko;
}

export function solverStateOf(summary: AttachedCase): SolverState {
  if (summary.solver.converged === true) return "converged";
  if (summary.solver.converged === false || summary.solver.unconverged_count > 0) return "unconverged";
  return "unknown";
}

export function hysysDialogOf(summary: CaseSummary | null): { text: string; unresponsive: boolean } | null {
  const dialog = summary?.hysys_dialog;
  return dialog ? { text: dialog.text, unresponsive: dialog.kind === "unresponsive" } : null;
}

export function caseInfoOf(summary: CaseSummary | null): CaseInfo | null {
  if (!summary || !summary.attached) return null;
  return {
    name: summary.case_name,
    solverState: solverStateOf(summary),
    unitCount: summary.counts.units,
    streamCount: summary.counts.streams,
    unconvergedCount: summary.solver.unconverged_count,
    hysys: { pid: summary.hysys_pid, owned: summary.owned },
    provider: { name: summary.provider.id ? "Demo AI" : null, signedIn: summary.provider.signed_in },
    ...(summary.busy ? { busy: true } : {}),
    ...(summary.hysys_dialog ? { hysysDialog: { text: summary.hysys_dialog.text, unresponsive: summary.hysys_dialog.kind === "unresponsive" } } : {}),
  };
}

export type CaseReadOptions = { reconnect: boolean; fresh?: boolean };

export function caseUrl(opts: CaseReadOptions): string {
  const query = [opts.reconnect ? "reconnect=true" : "", opts.fresh ? "fresh=true" : ""].filter(Boolean).join("&");
  return query ? `demo:case?${query}` : "demo:case";
}

export function createCaseStore(
  fetchCase: (opts: CaseReadOptions) => Promise<CaseSummary> = (opts) => getJson<CaseSummary>(caseUrl(opts)),
  now: () => number = Date.now,
  focusTarget: EventTarget | undefined = typeof window !== "undefined" ? window : undefined,
) {
  let state: CaseState = { summary: null, loading: true, error: null, switching: false };
  let switchingUntil = 0;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let inflight: Promise<void> | undefined;

  const emit = (next: CaseState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  function read(opts: CaseReadOptions): Promise<void> {
    return fetchCase(opts)
      .then((summary) => emit({ summary, loading: false, error: null, switching: !summary.attached && now() < switchingUntil }))
      .catch((err: unknown) => emit({ ...state, loading: false, error: err instanceof Error ? err.message : String(err) }));
  }

  function refresh(opts: Partial<CaseReadOptions> = {}): Promise<void> {
    if (opts.reconnect || opts.fresh) {
      const running = inflight ?? Promise.resolve();
      const asked = running.then(() => read({ reconnect: opts.reconnect === true, ...(opts.fresh ? { fresh: true } : {}) })).finally(() => { if (inflight === asked) inflight = undefined; });
      inflight = asked;
      return asked;
    }
    inflight ??= read({ reconnect: false }).finally(() => { inflight = undefined; });
    return inflight;
  }

  const onFocus = () => void refresh({ fresh: true });

  return {
    get: () => state,
    refresh,
    beginSwitch() {
      switchingUntil = now() + SWITCH_MAX_MS;
      emit({ ...state, switching: true });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        void refresh();
        timer = setInterval(() => void refresh(), CASE_POLL_MS);
        focusTarget?.addEventListener("focus", onFocus);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
          focusTarget?.removeEventListener("focus", onFocus);
        }
      };
    },
  };
}

export const caseStore = createCaseStore();

export function useCase(): CaseState & { refresh: (opts?: Partial<CaseReadOptions>) => Promise<void> } {
  const state = useSyncExternalStore(caseStore.subscribe, caseStore.get, caseStore.get);
  return { ...state, refresh: caseStore.refresh };
}
