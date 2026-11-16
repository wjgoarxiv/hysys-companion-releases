import { useSyncExternalStore } from "react";

export type HighlightState = { name: string | null; nonce: number };

export function createHighlightStore() {
  let state: HighlightState = { name: null, nonce: 0 };
  const listeners = new Set<() => void>();
  const emit = (next: HighlightState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    set: (name: string) => emit({ name, nonce: state.nonce + 1 }),
    clear: () => emit({ name: null, nonce: state.nonce }),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type HighlightStore = ReturnType<typeof createHighlightStore>;
export const highlightStore = createHighlightStore();

export function useHighlight(): HighlightState {
  return useSyncExternalStore(highlightStore.subscribe, highlightStore.get, highlightStore.get);
}
