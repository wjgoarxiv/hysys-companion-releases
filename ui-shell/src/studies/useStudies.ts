import { useEffect, useSyncExternalStore } from "react";
import { demoClient } from "../api/client";
import { createStudyWatch } from "./store";


export const studyWatch = createStudyWatch({
  client: () => demoClient(),
  attention: () => {},
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function useStudyWatch() {
  return useSyncExternalStore(studyWatch.subscribe, studyWatch.get, studyWatch.get);
}

export function useStudyWatchFor(sid: string | null): void {
  useEffect(() => studyWatch.watch(sid), [sid]);
}
