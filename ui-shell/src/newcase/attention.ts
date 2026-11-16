import { useEffect } from "react";
import { beaconOf, type Beacon, type BeaconTone } from "../shell/NewCaseBeacon";
import { getLocale, translate, type MessageKey } from "../i18n";
import { newCaseRun, type NewCaseRunStore } from "./runStore";
import type { FlowState } from "./flow";

export type AwayProgressStatus = "Normal" | "Paused" | "Error" | "None";

export type RunAttentionDeps = {
  notify(title: string, body: string): void | Promise<void>;
  flash(): void | Promise<void>;
  progress(status: AwayProgressStatus, pct: number | null): void | Promise<void>;
  keepAwake(on: boolean): void | Promise<unknown>;
  focused(): boolean;
  now(): number;
};

export type AwayEntry = { at: number; tone: BeaconTone; step: number; total: number };

const TITLE_KEY: Record<Exclude<BeaconTone, "running">, MessageKey> = {
  waiting: "newcase.away.waiting", ready: "newcase.away.ready", stopped: "newcase.away.stopped", done: "newcase.away.done",
};

const pctOf = (beacon: Beacon): number | null => (beacon.total > 0 ? (beacon.step / beacon.total) * 100 : null);

function progressOf(beacon: Beacon | null): { status: AwayProgressStatus; pct: number | null } {
  if (!beacon) return { status: "None", pct: null };
  switch (beacon.tone) {
    case "running": return { status: "Normal", pct: pctOf(beacon) ?? 0 };
    case "waiting": case "ready": return { status: "Paused", pct: pctOf(beacon) };
    case "stopped": return { status: "Error", pct: pctOf(beacon) };
    case "done": return { status: "None", pct: null };
  }
}

function safeCall(work: () => unknown): void {
  try {
    const out = work();
    if (out && typeof (out as PromiseLike<unknown>).then === "function") {
      (out as Promise<unknown>).catch(() => {});
    }
  } catch {
  }
}

export function createRunAttention(deps: RunAttentionDeps) {
  let lastProgress: { status: AwayProgressStatus; pct: number | null } | null = null;
  let keepOn = false;
  let away: AwayEntry[] = [];

  const isFocused = (): boolean => {
    try {
      return deps.focused();
    } catch {
      return true;
    }
  };
  const stamp = (): number => {
    try {
      return deps.now();
    } catch {
      return Date.now();
    }
  };

  return {
    observe(prevState: FlowState | null, nextState: FlowState | null): void {
      const before = prevState ? beaconOf(prevState) : null;
      const after = nextState ? beaconOf(nextState) : null;
      const toneChanged = (before?.tone ?? null) !== (after?.tone ?? null);
      const focused = isFocused();
      const locale = getLocale();
      if (after && after.tone !== "running" && toneChanged && !focused) {
        const title = translate(locale, TITLE_KEY[after.tone]);
        const body = after.total > 0
          ? translate(locale, "newcase.away.step", { n: after.step, total: after.total })
          : translate(locale, "newcase.away.hint");
        safeCall(() => deps.notify(title, body));
        safeCall(() => deps.flash());
      }
      if (after && toneChanged && !focused) {
        away.push({ at: stamp(), tone: after.tone, step: after.step, total: after.total });
      }
      const progress = progressOf(after);
      if (!lastProgress || lastProgress.status !== progress.status || lastProgress.pct !== progress.pct) {
        lastProgress = progress;
        safeCall(() => deps.progress(progress.status, progress.pct));
      }
      const want = after?.tone === "running";
      if (want !== keepOn) {
        keepOn = want;
        safeCall(() => deps.keepAwake(want));
      }
    },
    takeAway(): AwayEntry[] {
      const out = away;
      away = [];
      return out;
    },
  };
}

export type RunAttention = ReturnType<typeof createRunAttention>;

let card: AwayEntry[] | null = null;
const cardListeners = new Set<() => void>();
export const awayCardStore = {
  get: (): AwayEntry[] | null => card,
  subscribe(listener: () => void): () => void {
    cardListeners.add(listener);
    return () => void cardListeners.delete(listener);
  },
  show(entries: AwayEntry[]): void {
    card = entries;
    cardListeners.forEach((listener) => listener());
  },
  dismiss(): void {
    card = null;
    cardListeners.forEach((listener) => listener());
  },
};

function browserDeps(): RunAttentionDeps {
  return {
    notify: () => {},
    flash: () => {},
    progress: () => {},
    keepAwake: () => {},
    focused: () => (typeof document === "undefined" ? true : document.hasFocus()),
    now: () => Date.now(),
  };
}

export function useRunAttention(store: Pick<NewCaseRunStore, "subscribe" | "get"> = newCaseRun): void {
  useEffect(() => {
    const attention = createRunAttention(browserDeps());
    let prev = store.get().state;
    const stop = store.subscribe(() => {
      const next = store.get().state;
      attention.observe(prev, next);
      prev = next;
    });
    const onFocus = (): void => {
      const entries = attention.takeAway();
      if (entries.length === 0) return;
      if (!beaconOf(store.get().state)) return;
      awayCardStore.show(entries);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      stop();
      attention.observe(prev, null);
      window.removeEventListener("focus", onFocus);
    };
  }, [store]);
}
