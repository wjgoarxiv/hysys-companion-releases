import type { UiLocale } from "../i18n";
import { hashFor, type RouteId } from "../router";
import { highlightStore, type HighlightStore } from "../pfd/highlight";

export type Severity = "error" | "warning" | "info";
export const SEVERITIES: readonly Severity[] = ["error", "warning", "info"];

export type ProblemFix = {
  kind: string;
  target: string;
  params: Record<string, unknown>;
  summary_ko: string;
  summary_en: string;
};
export type ProblemItem = {
  id: string;
  severity: Severity;
  title_ko: string;
  title_en: string;
  detail: string;
  locate: { kind: string; name: string };
  fix: ProblemFix | null;
  source: string;
};
export type SourceFailure = { source: string; reason: string };
export type ProblemsResponse = {
  file_session_id: string;
  items: ProblemItem[];
  counts: Record<Severity, number>;
  sources_failed: SourceFailure[];
  read_only?: boolean;
};

export const CHANGE_REQUEST_EVENT = "wb:change-request";
export type ChangeRequestDetail = { file_session_id: string; seed: ProblemFix; title: string };

export const titleOf = (item: ProblemItem, locale: UiLocale): string => (locale === "en" ? item.title_en : item.title_ko);

const severityOf = (value: string): Severity => (value === "error" || value === "warning" ? value : "info");

export function groupBySeverity(items: readonly ProblemItem[]): Array<{ severity: Severity; items: ProblemItem[] }> {
  return SEVERITIES
    .map((severity) => ({ severity, items: items.filter((item) => severityOf(item.severity) === severity) }))
    .filter((group) => group.items.length > 0);
}

export const goTo = (route: RouteId): void => { window.location.hash = hashFor(route); };

export const canLocate = (item: ProblemItem): boolean => Boolean(item.locate?.name);

export function locateProblem(
  item: ProblemItem,
  deps: { highlight?: HighlightStore; navigate: (route: RouteId) => void },
): void {
  const store = deps.highlight ?? highlightStore;
  if (canLocate(item)) store.set(item.locate.name);
  else store.clear();
  deps.navigate("case");
}

export function requestChange(
  item: ProblemItem,
  fileSessionId: string,
  locale: UiLocale,
  target: EventTarget = window,
): boolean {
  if (!item.fix) return false;
  const detail: ChangeRequestDetail = { file_session_id: fileSessionId, seed: item.fix, title: titleOf(item, locale) };
  target.dispatchEvent(new CustomEvent(CHANGE_REQUEST_EVENT, { detail }));
  return true;
}
