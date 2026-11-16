import { endedNow, isLive, type Study } from "./model";
import { fetchStudies, type StudyClient } from "./api";

export type StudyNotice = { id: string; name: string; state: Study["state"]; failed: number; total: number; kind?: Study["kind"] };
export type StudyWatchState = { sid: string | null; studies: Study[]; loaded: boolean; error: unknown; notice: StudyNotice | null };
export type StudyWatchDeps = {
  client: () => StudyClient;
  attention: () => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

export const POLL_LIVE_MS = 3000;

export function createStudyWatch(deps: StudyWatchDeps) {
  let state: StudyWatchState = { sid: null, studies: [], loaded: false, error: null, notice: null };
  let timer: unknown = null;
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<StudyWatchState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const stopTimer = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
  };
  const schedule = () => {
    stopTimer();
    if (state.sid && state.studies.some(isLive)) timer = deps.setTimer(() => void refresh(), POLL_LIVE_MS);
  };

  async function refresh(): Promise<void> {
    const sid = state.sid;
    if (!sid) return;
    const mine = ++seq;
    try {
      const studies = await fetchStudies(deps.client(), sid);
      if (mine !== seq || sid !== state.sid) return;
      const before = new Map(state.studies.map((s) => [s.id, s]));
      const ended = studies.find((s) => endedNow(before.get(s.id), s));
      set({ studies, loaded: true, error: null, ...(ended ? { notice: { id: ended.id, name: ended.name, state: ended.state, failed: ended.failed, total: ended.total, kind: ended.kind } } : {}) });
      if (ended) deps.attention();
    } catch (error) {
      if (mine !== seq || sid !== state.sid) return;
      set({ error, loaded: true });
    }
    schedule();
  }

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    watch(sid: string | null) {
      if (sid === state.sid) return;
      stopTimer();
      seq += 1;
      set({ sid, studies: [], loaded: false, error: null, notice: null });
      if (sid) void refresh();
    },
    refresh,
    put(study: Study) {
      const others = state.studies.filter((s) => s.id !== study.id);
      set({ studies: [study, ...others] });
      schedule();
    },
    drop(id: string) {
      set({ studies: state.studies.filter((s) => s.id !== id) });
      schedule();
    },
    dismissNotice: () => set({ notice: null }),
  };
}

export type StudyWatch = ReturnType<typeof createStudyWatch>;
