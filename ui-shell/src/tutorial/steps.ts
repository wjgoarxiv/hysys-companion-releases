import { useSyncExternalStore } from "react";
import type { MessageKey } from "../i18n";
import type { RouteId } from "../router";

export type TutorialContext = { route: RouteId; has: (selector: string) => boolean };
export type TutorialStep = {
  id: string;
  route?: RouteId;
  target?: string | readonly string[];
  done?: (ctx: TutorialContext) => boolean;
  dock?: boolean;
};

export function pickTarget(step: TutorialStep, visible: (selector: string) => boolean): string | null {
  const list = typeof step.target === "string" ? [step.target] : step.target ?? [];
  return list.find(visible) ?? null;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: "welcome" },
  { id: "hysys", route: "case", target: "[data-wb-region='topbar']", done: (c) => c.has("[data-wb-status] [data-ok='true']") },
  { id: "toNew", target: "a[href='#/new']", done: (c) => c.route === "new" },
  { id: "pickImage", route: "new", target: "[data-newcase-entry='image']", done: (c) => c.has("[data-newcase='image-form']") },
  { id: "pickDemo", route: "new", target: "[data-newcase='pfd-demos']", done: (c) => c.has("[data-newcase='image-preview']") },
  { id: "start", route: "new", target: "[data-newcase='image-form'] .ui-form-actions", done: (c) => c.has("[data-newcase='steps']") },
  { id: "watch", route: "new", target: ["[data-newcase='questions']", "[data-newcase='steps']"], dock: true, done: (c) => c.has("[data-newcase='approve']") },
  { id: "approve", route: "new", target: "[data-newcase='approve']", dock: true },
  { id: "pfd", route: "case", target: "[data-wb-pfd]" },
  { id: "problems", target: "a[href='#/problems']", done: (c) => c.route === "problems" },
  { id: "agentOpen", route: "case", target: "[data-wb-agent-toggle]", done: (c) => c.has("[data-wb-region='agent-column'], [data-wb-region='agent-pinned']") },
  { id: "agentAsk", route: "case", target: "[data-wb-suggest]", done: (c) => c.has("[data-wb-answer-status='done']") },
  { id: "agentChange", route: "case", target: "[data-wb-command-bar]", done: (c) => c.has("[data-wb-cr-state]") },
  { id: "versions", target: "a[href='#/versions']", done: (c) => c.route === "versions" },
  { id: "studies", target: "a[href='#/studies']", done: (c) => c.route === "studies" },
  { id: "finish" },
];

export const stepTitleKey = (step: TutorialStep) => `tutorial.${step.id}.title` as MessageKey;
export const stepBodyKey = (step: TutorialStep) => `tutorial.${step.id}.body` as MessageKey;

export const TUTORIAL_STORAGE_KEY = "hysys_wb_tutorial";
export type TutorialState = { open: boolean; index: number; seen: boolean; finished: boolean };
const CLOSED: TutorialState = { open: false, index: 0, seen: false, finished: false };
type StorageLike = Pick<Storage, "getItem" | "setItem">;

const clampIndex = (index: number) => Math.min(TUTORIAL_STEPS.length - 1, Math.max(0, Math.trunc(index)));

export function parseTutorialState(raw: string | null): TutorialState {
  if (!raw) return CLOSED;
  try {
    const value = JSON.parse(raw) as Partial<TutorialState>;
    const index = typeof value.index === "number" && Number.isFinite(value.index) ? clampIndex(value.index) : 0;
    return { open: value.open === true, index, seen: value.seen === true, finished: value.finished === true };
  } catch {
    return CLOSED;
  }
}

export function createTutorialStore(getStorage: () => StorageLike | undefined = () => {
  try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; }
}) {
  const listeners = new Set<() => void>();
  let state: TutorialState | null = null;
  const read = (): TutorialState => {
    if (state) return state;
    try { state = parseTutorialState(getStorage()?.getItem(TUTORIAL_STORAGE_KEY) ?? null); } catch { state = CLOSED; }
    return state;
  };
  const write = (next: TutorialState) => {
    state = next;
    try { getStorage()?.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(next)); } catch { /* the walk still works for this session */ }
    listeners.forEach((listener) => listener());
  };
  return {
    get: read,
    start(fresh = false) {
      const now = read();
      write({ open: true, index: fresh || now.finished ? 0 : now.index, seen: true, finished: false });
    },
    go(index: number) { write({ ...read(), index: clampIndex(index) }); },
    next() {
      const now = read();
      if (now.index >= TUTORIAL_STEPS.length - 1) write({ ...now, open: false, finished: true });
      else write({ ...now, index: now.index + 1 });
    },
    prev() { const now = read(); write({ ...now, index: clampIndex(now.index - 1) }); },
    close() { write({ ...read(), open: false, seen: true }); },
    subscribe(listener: () => void) { listeners.add(listener); return () => void listeners.delete(listener); },
  };
}

export type TutorialStore = ReturnType<typeof createTutorialStore>;
export const tutorialStore = createTutorialStore();
export const useTutorial = (store: TutorialStore = tutorialStore) => useSyncExternalStore(store.subscribe, store.get, store.get);
