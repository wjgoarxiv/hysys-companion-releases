import { useCallback, useEffect, useSyncExternalStore } from "react";
import { postJson } from "../api/client";
import type { ProblemsResponse } from "./model";

export type ProblemsState = {
  status: "idle" | "loading" | "ready" | "error";
  fileSessionId: string | null;
  data: ProblemsResponse | null;
  error: string | null;
  refreshing: boolean;
};

export const IDLE_PROBLEMS: ProblemsState = { status: "idle", fileSessionId: null, data: null, error: null, refreshing: false };

type Post = (path: string, body: unknown) => Promise<ProblemsResponse>;

export function createProblemsController(post: Post = (path, body) => postJson<ProblemsResponse>(path, body)) {
  let state: ProblemsState = IDLE_PROBLEMS;
  let ticket = 0;
  const listeners = new Set<() => void>();
  const emit = (next: ProblemsState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  async function load(fileSessionId: string | null, opts: { force?: boolean } = {}): Promise<void> {
    if (!fileSessionId) {
      ticket += 1;
      emit(IDLE_PROBLEMS);
      return;
    }
    const sameCase = state.fileSessionId === fileSessionId;
    if (sameCase && state.status === "loading") return; // that read is already running
    if (sameCase && state.refreshing && !opts.force) return;
    const mine = ++ticket;
    emit(sameCase && state.data
      ? { ...state, status: "ready", refreshing: true, error: null }
      : { status: "loading", fileSessionId, data: null, error: null, refreshing: false });
    try {
      const data = await post("demo:problems", { file_session_id: fileSessionId });
      if (mine === ticket) emit({ status: "ready", fileSessionId, data, error: null, refreshing: false });
    } catch (err) {
      if (mine === ticket) {
        emit({ status: "error", fileSessionId, data: null, error: err instanceof Error ? err.message : String(err), refreshing: false });
      }
    }
  }

  return {
    get: () => state,
    load,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export const problemsController = createProblemsController();

export function useProblems(fileSessionId: string | null): { state: ProblemsState; reload: () => void } {
  const state = useSyncExternalStore(problemsController.subscribe, problemsController.get, problemsController.get);
  useEffect(() => { void problemsController.load(fileSessionId); }, [fileSessionId]);
  const reload = useCallback(() => { void problemsController.load(fileSessionId, { force: true }); }, [fileSessionId]);
  return { state, reload };
}
