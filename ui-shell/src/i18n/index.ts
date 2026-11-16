import { useSyncExternalStore } from "react";
import { catalog, type MessageKey } from "./catalog";

export { catalog, type MessageKey } from "./catalog";
export type UiLocale = "ko" | "en";
export const UI_LOCALE_STORAGE_KEY = "hysys_ui_locale";

export function isUiLocale(value: unknown): value is UiLocale {
  return value === "ko" || value === "en";
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function loadLocale(): UiLocale {
  try {
    const raw = storage()?.getItem(UI_LOCALE_STORAGE_KEY);
    return isUiLocale(raw) ? raw : "ko";
  } catch {
    return "ko";
  }
}

let current: UiLocale = loadLocale();
const listeners = new Set<() => void>();

export const getLocale = (): UiLocale => current;
export const subscribeLocale = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function setLocale(value: unknown): boolean {
  if (!isUiLocale(value)) return false;
  current = value;
  try {
    storage()?.setItem(UI_LOCALE_STORAGE_KEY, value);
  } catch {
  }
  if (typeof document !== "undefined") document.documentElement.lang = value;
  listeners.forEach((listener) => listener());
  return true;
}

export function initializeLocale(): void {
  current = loadLocale();
  if (typeof document !== "undefined") document.documentElement.lang = current;
}

export type TextParams = Readonly<Record<string, string | number>>;

export function translate(locale: UiLocale, key: MessageKey, params?: TextParams): string {
  const template: string = catalog[key][locale];
  return params ? template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name: string) => String(params[name] ?? match)) : template;
}

export type Translate = (key: MessageKey, params?: TextParams) => string;

export const t: Translate = (key, params) => translate(current, key, params);

export function useLocale(): UiLocale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

export function useT(): Translate {
  const locale = useLocale();
  return (key, params) => translate(locale, key, params);
}
