import { useSyncExternalStore } from "react";

export const THEME_STORAGE_KEY = "hysys_wb_theme";
export const LAYOUT_STORAGE_KEY = "hysys_wb_layout";
export const WIDE_MIN_WIDTH = 1100;

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export const LAYOUT_CHOICES = ["auto", "panel", "wide"] as const;
export type ThemePref = (typeof THEME_CHOICES)[number];
export type LayoutPref = (typeof LAYOUT_CHOICES)[number];
export type Layout = "panel" | "wide";

type StorageLike = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;
type RootLike = { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function createChoiceStore<T extends string>(opts: {
  key: string;
  choices: readonly T[];
  fallback: T;
  getStorage?: () => StorageLike | undefined;
  onApply?: (value: T) => void;
}) {
  const storage = (): StorageLike | undefined => {
    try {
      return (opts.getStorage ?? defaultStorage)();
    } catch {
      return undefined;
    }
  };
  const read = (): T => {
    try {
      const raw = storage()?.getItem(opts.key);
      return opts.choices.find((choice) => choice === raw) ?? opts.fallback;
    } catch {
      return opts.fallback;
    }
  };
  let current = read();
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    init() {
      current = read();
      opts.onApply?.(current);
    },
    set(value: T) {
      if (!opts.choices.includes(value)) return;
      current = value;
      opts.onApply?.(value);
      try {
        storage()?.setItem(opts.key, value);
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

export function applyTheme(root: RootLike, pref: ThemePref): void {
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

export function createThemeStore(opts: { getStorage?: () => StorageLike | undefined; getRoot?: () => RootLike | undefined } = {}) {
  return createChoiceStore<ThemePref>({
    key: THEME_STORAGE_KEY,
    choices: THEME_CHOICES,
    fallback: "system",
    getStorage: opts.getStorage,
    onApply(pref) {
      const root = opts.getRoot ? opts.getRoot() : typeof document === "undefined" ? undefined : document.documentElement;
      if (root) applyTheme(root, pref);
    },
  });
}

export function createLayoutStore(opts: { getStorage?: () => StorageLike | undefined } = {}) {
  return createChoiceStore<LayoutPref>({ key: LAYOUT_STORAGE_KEY, choices: LAYOUT_CHOICES, fallback: "auto", getStorage: opts.getStorage });
}

export function resolveLayout(pref: LayoutPref, width: number): Layout {
  if (pref !== "auto") return pref;
  return width >= WIDE_MIN_WIDTH ? "wide" : "panel";
}

export function toggledLayout(pref: LayoutPref, width: number): Layout {
  return resolveLayout(pref, width) === "wide" ? "panel" : "wide";
}

export const AGENT_WIDTH_STORAGE_KEY = "hysys_wb_agent_width";
export const AGENT_W_MIN = 320;
export const AGENT_W_MAX = 720;
export const AGENT_W_DEFAULT = 320;
export const PFD_MIN_WIDTH = 480;

export function clampAgentWidth(width: number, bodyWidth: number): number {
  const wanted = Number.isFinite(width) ? width : AGENT_W_DEFAULT;
  const roomy = Number.isFinite(bodyWidth) ? bodyWidth - PFD_MIN_WIDTH : AGENT_W_MAX;
  const max = Math.max(AGENT_W_MIN, Math.min(AGENT_W_MAX, roomy));
  return Math.round(Math.min(max, Math.max(AGENT_W_MIN, wanted)));
}

export function createAgentWidthStore(opts: { getStorage?: () => StorageLike | undefined } = {}) {
  const storage = (): StorageLike | undefined => {
    try {
      return (opts.getStorage ?? defaultStorage)();
    } catch {
      return undefined;
    }
  };
  const read = (): number => {
    try {
      const raw = storage()?.getItem(AGENT_WIDTH_STORAGE_KEY);
      const value = raw ? Number(raw) : Number.NaN;
      return Number.isInteger(value) && value >= AGENT_W_MIN && value <= AGENT_W_MAX ? value : AGENT_W_DEFAULT;
    } catch {
      return AGENT_W_DEFAULT;
    }
  };
  let current = read();
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  return {
    get: () => current,
    set(width: number) {
      const next = clampAgentWidth(width, Number.POSITIVE_INFINITY);
      if (next === current) return;
      current = next;
      try {
        storage()?.setItem(AGENT_WIDTH_STORAGE_KEY, String(next));
      } catch {
      }
      publish();
    },
    reset() {
      current = AGENT_W_DEFAULT;
      try {
        storage()?.removeItem?.(AGENT_WIDTH_STORAGE_KEY);
      } catch {
      }
      publish();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export const themeStore = createThemeStore();
export const layoutStore = createLayoutStore();
export const agentWidthStore = createAgentWidthStore();

export function useAgentWidth(): number {
  return useSyncExternalStore(agentWidthStore.subscribe, agentWidthStore.get, () => AGENT_W_DEFAULT);
}

export function useTheme(): ThemePref {
  return useSyncExternalStore(themeStore.subscribe, themeStore.get, () => "system");
}
export function useLayoutPref(): LayoutPref {
  return useSyncExternalStore(layoutStore.subscribe, layoutStore.get, () => "auto");
}
