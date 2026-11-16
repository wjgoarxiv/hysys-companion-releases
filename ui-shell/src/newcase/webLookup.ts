import { useSyncExternalStore } from "react";

export const WEB_LOOKUP_STORAGE_KEY = "hysys_wb_web_lookup";

export type WebLookupPref = "on" | "off";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export type WebLookupStore = {
  get: () => WebLookupPref;
  set: (value: WebLookupPref) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createWebLookupStore(opts: { getStorage?: () => StorageLike | undefined } = {}): WebLookupStore {
  const storage = (): StorageLike | undefined => {
    try {
      return (opts.getStorage ?? defaultStorage)();
    } catch {
      return undefined;
    }
  };
  let current: WebLookupPref;
  try {
    current = storage()?.getItem(WEB_LOOKUP_STORAGE_KEY) === "off" ? "off" : "on";
  } catch {
    current = "on";
  }
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(value: WebLookupPref) {
      if (value !== "on" && value !== "off") return;
      current = value;
      try {
        storage()?.setItem(WEB_LOOKUP_STORAGE_KEY, value);
      } catch {
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export const webLookupStore = createWebLookupStore();

export function useWebLookupPref(store: WebLookupStore = webLookupStore): WebLookupPref {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
