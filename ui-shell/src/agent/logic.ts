import type { UiLocale } from "../i18n";
import { catalog } from "../i18n/catalog";
import { kindKey, nameSaysKind, unitFamily } from "../pfd/kinds";
import type { AnswerState, AnswerStep, ChangeRequest, CrNeed, CrState, DiffValueRow, ErrorInfo, SeedDetail } from "./types";

export { CHANGE_REQUEST_EVENT } from "../problems/model";

export function canApprove(cr: ChangeRequest): boolean {
  return cr.state === "ready" && !awaitsRoundTripNotice(cr);
}

export const awaitsRoundTripNotice = (cr: ChangeRequest): boolean => cr.kind === "structural" && cr.round_trip === null;

export const IN_FLIGHT: readonly CrState[] = ["trial", "approved", "reverting"];
export const isInFlight = (cr: ChangeRequest): boolean => IN_FLIGHT.includes(cr.state);

const CREATE_LIKE = new RegExp(
  "만들어|만들자|만들고|만들래|생성|새\\s*공정|새로운\\s*공정|새\\s*케이스|새로\\s*(?:짜|만|설계)|설계해|설계\\s*해|구성해|짜\\s*줘|짜줘|그려\\s*줘|처음부터|"
  + "\\b(?:create|build|generate|design|draft)\\b|\\bnew\\s+(?:process|flowsheet|case)\\b|\\bmake\\s+(?:me\\s+)?(?:a|an|the|new)\\b",
  "i",
);
export const isCreateLike = (text: string): boolean => CREATE_LIKE.test(text);

export const pick = (pair: { ko: string; en: string }, locale: UiLocale): string => (locale === "en" ? pair.en || pair.ko : pair.ko || pair.en);

export function errorInfoOf(err: unknown): ErrorInfo | null {
  const body = (err as { body?: unknown } | null)?.body as { detail?: unknown } | null | undefined;
  const detail = body?.detail;
  if (typeof detail === "string" && detail) return { ko: detail, en: detail };
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    const ko = typeof d.message_ko === "string" ? d.message_ko : typeof d.message === "string" ? d.message : null;
    const en = typeof d.message_en === "string" ? d.message_en : typeof d.message === "string" ? d.message : null;
    if (ko || en) return typeof d.alternative === "string" ? { ko, en, alternative: d.alternative } : { ko, en };
  }
  return null;
}

export function errorText(info: ErrorInfo | null, locale: UiLocale): string | null {
  if (!info) return null;
  return (locale === "en" ? info.en ?? info.ko : info.ko ?? info.en) || null;
}

const ANSWER_STEP_IDS: Record<string, string> = { "이해": "understand", understand: "understand", "조회": "lookup", lookup: "lookup", "작성": "write", write: "write" };
export const ANSWER_STEPS = ["understand", "lookup", "write"] as const;

function withStep(steps: AnswerStep[], id: string, state: AnswerStep["state"]): AnswerStep[] {
  const at = steps.findIndex((step) => step.id === id);
  if (at < 0) return [...steps.map((step) => ({ ...step, state: "done" as const })), { id, state, tools: [] }];
  return steps.map((step, index) => (index === at ? { ...step, state } : step));
}

export function reduceAnswerEvent(answer: AnswerState, name: string, data: unknown): AnswerState {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const steps = answer.steps ?? [];
  if (name === "stage" && typeof d.name === "string") {
    const id = ANSWER_STEP_IDS[d.name.trim()] ?? d.name.trim();
    return { ...answer, steps: withStep(steps, id, d.state === "done" ? "done" : "running") };
  }
  if (name === "tool" && typeof d.name === "string") {
    const open = steps.length ? steps : [{ id: "lookup", state: "running" as const, tools: [] }];
    const last = open.length - 1;
    return { ...answer, steps: open.map((step, index) => (index === last && !step.tools.includes(String(d.name)) ? { ...step, tools: [...step.tools, String(d.name)] } : step)) };
  }
  if (name === "narration_stream" && typeof d.delta === "string") return { ...answer, status: "streaming", text: answer.text + d.delta };
  if (name === "token" && d.channel === "output" && typeof d.delta === "string") return { ...answer, status: "streaming", text: answer.text + d.delta };
  if (name === "done") {
    const final = typeof d.answer_text === "string" ? d.answer_text.trim() : "";
    const text = final || answer.text;
    return { ...answer, status: text.trim() ? "done" : "empty", text };
  }
  if (name === "error") return { ...answer, status: "error" };
  return answer;
}

export function parseSeedDetail(detail: unknown): SeedDetail | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;
  const seed = d.seed as Record<string, unknown> | null | undefined;
  if (!seed || typeof seed !== "object" || typeof seed.kind !== "string" || typeof seed.target !== "string") return null;
  return {
    file_session_id: typeof d.file_session_id === "string" ? d.file_session_id : undefined,
    seed: seed as SeedDetail["seed"],
    title: typeof d.title === "string" ? d.title : undefined,
  };
}

export function repairText(repair: unknown, locale: UiLocale): string | null {
  if (typeof repair === "string") return repair.trim() || null;
  if (!repair || typeof repair !== "object") return null;
  const r = repair as Record<string, unknown>;
  for (const [ko, en] of [["summary_ko", "summary_en"], ["message_ko", "message_en"], ["label_ko", "label_en"]] as const) {
    const a = typeof r[ko] === "string" ? (r[ko] as string) : "";
    const b = typeof r[en] === "string" ? (r[en] as string) : "";
    const text = locale === "en" ? b || a : a || b;
    if (text.trim()) return text;
  }
  return typeof r.text === "string" && r.text.trim() ? r.text : null;
}

export const fileNameOf = (path: string | null): string => (path ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "";

export const displayUnit = (unit: string | null | undefined): string => (unit === "C" ? "°C" : unit === "F" ? "°F" : unit ?? "");

export function formatNumber(value: unknown, unit?: string | null): string {
  const text = typeof value === "number" && Number.isFinite(value) ? String(Number(value.toPrecision(5)))
    : typeof value === "string" && value ? value
    : typeof value === "boolean" ? String(value) : null;
  if (text === null) return "—";
  return unit && typeof value === "number" ? `${text} ${displayUnit(unit)}` : text;
}

const PROPERTY_LABEL_PREFIX = "agent.prop.";

export const splitCamel = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/_/g, " ");

export function valueLabel(key: string, locale: UiLocale): string {
  const dot = key.lastIndexOf(".");
  if (dot <= 0) return key;
  const owner = key.slice(0, dot);
  const prop = key.slice(dot + 1);
  const label = (catalog as Record<string, { ko: string; en: string } | undefined>)[PROPERTY_LABEL_PREFIX + prop];
  return `${owner} · ${label ? pick(label, locale) : splitCamel(prop)}`;
}

export function unitText(name: string, rawType: string | null | undefined, locale: UiLocale): string {
  const type = (rawType ?? "").trim();
  if (!type) return name;
  const family = unitFamily(type);
  if (!family) return `${name} (${type})`;
  const label = (catalog as Record<string, { ko: string; en: string } | undefined>)[kindKey(family)];
  if (!label) return `${name} (${type})`;
  return nameSaysKind(name, [label.ko, label.en]) ? name : `${name} ${pick(label, locale)}`;
}

export function snapshotTime(id: string | null): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-/.exec(id ?? "");
  if (!m) return null;
  const [y, mo, d, h, mi, se] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, se));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && h < 24 && mi < 60 && se < 60 ? date : null;
}

export const clockText = (date: Date): string => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export function keyDeltas(rows: readonly DiffValueRow[], limit = 3): DiffValueRow[] {
  const size = (row: DiffValueRow) => Math.abs(row.rel_delta ?? 0);
  return [...rows].sort((a, b) => size(b) - size(a)).slice(0, limit);
}

export function percentText(rel: number | null): string {
  if (rel === null || !Number.isFinite(rel)) return "—";
  if (rel === 0) return "0%";
  const pct = rel * 100;
  if (Math.abs(pct) < 0.1) return "<0.1%";
  const rounded = Number(pct.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

const OFFSET_UNIT = /^(°?[CF]|deg[CF])$/i;
const GAUGE_UNIT = /^(pa|kpa|mpa|bar|psi)g$/i;
const TEMPERATURE_KEY = /(^|\.)(T|[A-Za-z]*Temperature)$/;

export function deltaText(row: DiffValueRow): string {
  const unit = row.unit ?? "";
  const offset = OFFSET_UNIT.test(unit) || GAUGE_UNIT.test(unit) || (!unit && TEMPERATURE_KEY.test(row.key));
  if (!offset) return percentText(row.rel_delta);
  const change = typeof row.abs_delta === "number" && Number.isFinite(row.abs_delta) ? row.abs_delta
    : typeof row.a === "number" && typeof row.b === "number" ? row.b - row.a : null;
  if (change === null || !Number.isFinite(change)) return percentText(row.rel_delta);
  const shown = Number(Math.abs(change).toPrecision(4));
  const label = displayUnit(unit || "C");
  return shown === 0 ? `0 ${label}` : `${change < 0 ? "−" : "+"}${shown} ${label}`;
}

export function failureTitleKey(cr: ChangeRequest): "agent.cr.trial.notConverged" | "agent.cr.trial.applyFailed" | "agent.cr.trial.rolledBack" | "agent.cr.trial.stopped" {
  switch (cr.failure) {
    case "not_converged": return "agent.cr.trial.notConverged";
    case "rolled_back": return "agent.cr.trial.rolledBack";
    case "apply_refused":
    case "apply_error": return "agent.cr.trial.applyFailed";
    case "trial_error": return "agent.cr.trial.stopped";
    default: break;
  }
  if (!cr.trial) return "agent.cr.trial.stopped";
  if (cr.trial.kind === "preview" || cr.trial.converged === true) return "agent.cr.trial.applyFailed";
  return "agent.cr.trial.notConverged";
}

export const needsPending = (cr: ChangeRequest): boolean => (cr.needs ?? []).some((need) => need.required);

export function paramsFromForm(needs: readonly CrNeed[], values: Record<string, string | undefined>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const need of needs) {
    const raw = (values[need.name] ?? "").trim();
    if (!raw) {
      if (need.required) return null;
      continue;
    }
    if (need.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      out[need.name] = n;
    } else {
      out[need.name] = raw;
    }
  }
  return out;
}

export function specParamsFromForm(needs: readonly CrNeed[], values: Record<string, { value?: string; unit?: string } | undefined>): Record<string, { value: number; unit: string }> | null {
  const out: Record<string, { value: number; unit: string }> = {};
  for (const need of needs) {
    const raw = (values[need.name]?.value ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    out[need.name] = { value: n, unit: values[need.name]?.unit || need.unit_options?.[0] || need.unit_hint || "" };
  }
  return out;
}

export function checkParts(check: { iterations?: number | null; seconds?: number | null } | null | undefined): { iterations: number | null; seconds: string | null } {
  const iterations = typeof check?.iterations === "number" && Number.isFinite(check.iterations) ? check.iterations : null;
  const seconds = typeof check?.seconds === "number" && Number.isFinite(check.seconds) ? String(Number(check.seconds.toFixed(1))) : null;
  return { iterations, seconds };
}
