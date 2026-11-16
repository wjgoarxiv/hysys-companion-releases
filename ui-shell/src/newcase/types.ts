import { catalog } from "../i18n/catalog";

export type NewCaseMode = "words" | "template" | "image";

export type TopologyUnit = { name: string; type: string; kind: string };
export type TopologyStream = { name: string; type: string };
export type TopologyConnection = { from: string; to: string; type: string };
export type DraftTopologyData = { units: TopologyUnit[]; streams: TopologyStream[]; connections: TopologyConnection[] };

export type ConfirmationItem = { target: string; kind: string; reason: string };

export type QuestionOption = { value: string; label: string };
export type DraftQuestion = { id: string; label: string; raw: unknown; options: QuestionOption[] };

export type DofAnswer = { id: string; op_kind?: string; answer: string };

export type VerifyState = { converged: boolean; can_repair: boolean; can_continue_repair?: boolean; reason_ko?: string; reason_en?: string };

export type NeedsApproval = { job_id: string; approval_token: string; unconverged: boolean; ttl_seconds: number | null };

export type BlockerLine = { message_ko: string; message_en: string };

export type NewCaseErrorState = {
  code: string; message_ko: string; message_en: string; can_repair: boolean; blockers: BlockerLine[];
  can_confirm: boolean; job_id: string | null;
  can_recheck: boolean;
  can_revise: boolean;
  can_resume: boolean;
  can_continue_repair: boolean;
  reason: string | null;
};

export type TemplateParam = { name: string; label_ko: string; label_en: string; unit: string; default: number; min?: number; max?: number };
export type TemplateFixed = { name: string; label_ko: string; label_en: string; value: string };
export type TemplateDef = {
  kind: string; display_ko: string; display_en: string; params: TemplateParam[]; fixed: TemplateFixed[];
  group: "process" | "unit"; units: number | null; description_ko: string; description_en: string;
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

export function parseTopology(value: unknown): DraftTopologyData {
  if (!value || typeof value !== "object") return { units: [], streams: [], connections: [] };
  const raw = value as { units?: unknown; streams?: unknown; connections?: unknown };
  const units: TopologyUnit[] = [];
  const streams: TopologyStream[] = [];
  const connections: TopologyConnection[] = [];
  if (Array.isArray(raw.units)) {
    for (const entry of raw.units.slice(0, 50)) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const name = String(item.name ?? "");
      if (!name.trim()) continue;
      const kind = String(item.kind ?? item.type ?? "").trim();
      units.push({ name: name.trim(), type: String(item.type ?? item.kind ?? "").trim(), kind });
    }
  }
  if (Array.isArray(raw.streams)) {
    for (const entry of raw.streams.slice(0, 50)) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const name = String(item.name ?? "");
      if (!name.trim()) continue;
      const streamType = String(item.type ?? "material").trim() || "material";
      streams.push({ name: name.trim(), type: streamType });
    }
  }
  if (Array.isArray(raw.connections)) {
    for (const entry of raw.connections.slice(0, 100)) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const from = String(item.from ?? "").trim();
      const to = String(item.to ?? "").trim();
      if (!from || !to) continue;
      connections.push({ from, to, type: String(item.type ?? "feed").trim() || "feed" });
    }
  }
  return { units, streams, connections };
}

export function parseConfirmations(value: unknown, locale = "ko"): ConfirmationItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((entry, index): ConfirmationItem[] => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const targetRaw = raw.target ?? raw.id ?? raw.name;
    const target = typeof targetRaw === "string" && targetRaw.trim() ? targetRaw.trim() : `item-${index + 1}`;
    const kind = typeof raw.kind === "string" ? raw.kind.trim() : "";
    const reasonRaw = locale === "ko" ? (raw.reason_ko ?? raw.reason_en) : (raw.reason_en ?? raw.reason_ko);
    const reason = typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim() : target;
    return [{ target, kind, reason }];
  });
}

function questionText(raw: Record<string, unknown>, locale: string): string {
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return undefined;
  };
  if (locale === "ko") {
    return String(pick("question_ko", "label_ko", "text_ko", "text", "question", "label", "prompt", "question_en", "label_en") ?? "");
  }
  return String(pick("question_en", "label_en", "text_en", "text", "question", "label", "prompt", "question_ko", "label_ko") ?? "");
}

function questionOptions(raw: Record<string, unknown>, locale: string): QuestionOption[] {
  const hint = raw.input_hint && typeof raw.input_hint === "object" ? (raw.input_hint as Record<string, unknown>) : {};
  const list = [raw.options, raw.choices, raw.candidates, hint.choices, hint.options].find(Array.isArray) as unknown[] | undefined;
  if (!list) return [];
  return list.slice(0, 30).flatMap((entry): QuestionOption[] => {
    if (typeof entry === "string") return entry.trim() ? [{ value: entry.trim(), label: entry.trim() }] : [];
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const text = (...keys: string[]): string => {
      for (const key of keys) if (typeof item[key] === "string" && (item[key] as string).trim()) return (item[key] as string).trim();
      return "";
    };
    const value = text("value", "id", "key", "name");
    const label = (locale === "ko" ? text("label_ko", "label", "label_en") : text("label_en", "label", "label_ko")) || value;
    return value || label ? [{ value: value || label, label }] : [];
  });
}

export function parseQuestions(value: unknown, locale = "ko"): DraftQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const idRaw = raw.id ?? raw.key ?? raw.name;
    const id = typeof idRaw === "string" && idRaw.trim() ? idRaw.trim() : `q${index + 1}`;
    const label = questionText(raw, locale) || id;
    return [{ id, label, raw: entry, options: questionOptions(raw, locale) }];
  });
}

export function questionSuggestion(raw: unknown, locale: string): { text: string; why: string } | null {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (ko: string, en: string): string => {
    const first = locale === "ko" ? [row[ko], row[en]] : [row[en], row[ko]];
    const found = first.find((value) => typeof value === "string" && value.trim());
    return typeof found === "string" ? found.trim() : "";
  };
  const text = pick("suggestion_ko", "suggestion_en");
  return text ? { text, why: pick("suggestion_why_ko", "suggestion_why_en") } : null;
}

export type DraftItemValue = { key: string; value: number | string; unit: string };
export type DraftItemDetail = { name: string; kind: "unit" | "stream"; type: string; inlets: string[]; outlets: string[]; values: DraftItemValue[] };

const VALUE_UNITS: [RegExp, string][] = [[/_kPa$/i, "kPa"], [/_C$/, "°C"], [/_K$/, "K"], [/_kW$/i, "kW"], [/_pct$/i, "%"]];
const unitOfKey = (key: string): string => VALUE_UNITS.find(([pattern]) => pattern.test(key))?.[1] ?? "";
const names = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap((entry): string[] => (typeof entry === "string" && entry.trim() ? [entry.trim()] : [])) : [];

function scalarValues(raw: Record<string, unknown>, skip: Set<string>): DraftItemValue[] {
  const out: DraftItemValue[] = [];
  const add = (key: string, value: unknown, unitHint: string): void => {
    if (typeof value === "number" && Number.isFinite(value)) out.push({ key, value, unit: unitHint || unitOfKey(key) });
  };
  for (const [key, value] of Object.entries(raw)) {
    if (!skip.has(key)) add(key, value, "");
  }
  const conditions = raw.conditions && typeof raw.conditions === "object" ? (raw.conditions as Record<string, unknown>) : {};
  const units = raw.units && typeof raw.units === "object" ? (raw.units as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(conditions)) add(key, value, typeof units[key] === "string" ? String(units[key]) : "");
  return out.slice(0, 12);
}

export function parseDraftDetails(spec: unknown): Record<string, DraftItemDetail> {
  const raw = spec && typeof spec === "object" ? (spec as Record<string, unknown>) : {};
  const out: Record<string, DraftItemDetail> = {};
  const skip = new Set(["name", "tag", "id", "kind", "type", "inlet_streams", "outlet_streams", "energy_streams", "conditions", "units", "composition"]);
  for (const op of Array.isArray(raw.unit_operations) ? raw.unit_operations.slice(0, 50) : []) {
    if (!op || typeof op !== "object") continue;
    const row = op as Record<string, unknown>;
    const name = String(row.name ?? row.tag ?? "").trim();
    if (!name) continue;
    out[name] = { name, kind: "unit", type: String(row.kind ?? row.type ?? ""), inlets: names(row.inlet_streams), outlets: names(row.outlet_streams), values: scalarValues(row, skip) };
  }
  for (const stream of Array.isArray(raw.streams) ? raw.streams.slice(0, 80) : []) {
    if (!stream || typeof stream !== "object") continue;
    const row = stream as Record<string, unknown>;
    const name = String(row.name ?? row.id ?? "").trim();
    if (!name || out[name]) continue;
    out[name] = { name, kind: "stream", type: String(row.type ?? ""), inlets: [], outlets: [], values: scalarValues(row, skip) };
  }
  return out;
}

export const LEDGER_KINDS = ["user_given", "default_disclosed", "llm_assumed", "repair_filled", "approximation"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];
export type DraftLedger = Record<string, LedgerKind>;

export function parseLedger(...lists: unknown[]): DraftLedger {
  const out: DraftLedger = {};
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list.slice(0, 500) : []) {
      if (!row || typeof row !== "object") continue;
      const { path, kind } = row as Record<string, unknown>;
      if (typeof path === "string" && path && (LEDGER_KINDS as readonly string[]).includes(String(kind))) out[path] = kind as LedgerKind;
    }
  }
  return out;
}

export function ledgerKindOf(ledger: DraftLedger | undefined, detail: DraftItemDetail | null, key: string): LedgerKind | null {
  if (!ledger || !detail) return null;
  const paths = detail.kind === "stream"
    ? [`streams.${detail.name}.conditions.${key}`, ...(key === "molar_flow" || key === "mass_flow" ? [`streams.${detail.name}.conditions.flow`] : [])]
    : [`unit_operations.${detail.name}.${key}`, `unit_operations.${detail.name}.design_specs.${key}`];
  for (const path of paths) if (ledger[path]) return ledger[path];
  return null;
}

export type UnappliedItem = { target: string; property: string; value: string; reason: string };

const KNOWN_REASONS = new Set(Object.keys(catalog).flatMap((key) => (key.startsWith("newcase.unapplied.reason.") ? [key.slice("newcase.unapplied.reason.".length)] : [])));

const UNAPPLIED_PROPS: Record<string, { key: string; unit?: string }> = {
  T_C: { key: "temperature", unit: "°C" },
  temperature: { key: "temperature", unit: "°C" },
  outlet_T_C: { key: "outlet_T_C", unit: "°C" },
  P_kPa: { key: "pressure", unit: "kPa" },
  pressure: { key: "pressure", unit: "kPa" },
  outlet_P_kPa: { key: "outlet_P_kPa", unit: "kPa" },
  pressure_drop_kPa: { key: "pressure_drop_kPa", unit: "kPa" },
  duty: { key: "duty" },
  duty_kW: { key: "duty", unit: "kW" },
  flow: { key: "flow" },
  molar_flow: { key: "molar_flow" },
  mass_flow: { key: "mass_flow" },
};

export function parseUnapplied(body: unknown): UnappliedItem[] {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const rows = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.slice(0, 50).filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : []);
  const propOf = (value: unknown): { key: string; unit?: string } => UNAPPLIED_PROPS[text(value)] ?? { key: "unknown" };
  const out: UnappliedItem[] = [];
  for (const r of rows(raw.unapplied_user_specs)) {
    const prop = propOf(r.property);
    const sentUnit = typeof r.value_unit === "string" && r.value_unit ? r.value_unit : prop.unit;
    const unit = sentUnit ? ` ${sentUnit}` : "";
    const value = typeof r.value === "number" || (typeof r.value === "string" && r.value) ? ` ${String(r.value)}${unit}` : "";
    const code = typeof r.reason === "string" ? r.reason : "";
    out.push({ target: text(r.unit) || text(r.stream), property: prop.key, value, reason: KNOWN_REASONS.has(code) ? code : "generic" });
  }
  for (const r of rows(raw.apply_failures)) {
    out.push({ target: text(r.target), property: propOf(r.property).key, value: "", reason: text(r.reason).toUpperCase().startsWith("REJECTED") ? "hysys_rejected" : "generic" });
  }
  return out;
}

export function parseVerify(value: unknown): VerifyState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.converged !== "boolean") return null;
  const reasonKo = typeof raw.reason_ko === "string" && raw.reason_ko ? raw.reason_ko : "";
  const reasonEn = typeof raw.reason_en === "string" && raw.reason_en ? raw.reason_en : "";
  const out: VerifyState = { converged: raw.converged, can_repair: raw.can_repair === true };
  if (raw.can_continue_repair === true) out.can_continue_repair = true;
  if (reasonKo || reasonEn) {
    out.reason_ko = reasonKo || reasonEn;
    out.reason_en = reasonEn || reasonKo;
  }
  return out;
}

export function parseNeedsApproval(value: unknown): NeedsApproval | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.job_id !== "string" || !raw.job_id) return null;
  if (typeof raw.approval_token !== "string" || !raw.approval_token) return null;
  const ttl = typeof raw.ttl_remaining_seconds === "number" && Number.isFinite(raw.ttl_remaining_seconds) ? Math.max(0, Math.floor(raw.ttl_remaining_seconds)) : null;
  return { job_id: raw.job_id, approval_token: raw.approval_token, unconverged: raw.unconverged === true, ttl_seconds: ttl };
}

export function parseError(value: unknown): NewCaseErrorState {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const code = typeof raw.code === "string" && raw.code ? raw.code : "STEP_FAILED";
  const coded = (catalog as Record<string, { ko: string; en: string } | undefined>)[`newcase.err.${code}`];
  const sentKo = typeof raw.message_ko === "string" ? raw.message_ko : "";
  const sentEn = typeof raw.message_en === "string" ? raw.message_en : "";
  const tag = code && code !== "STEP_FAILED" ? ` (${code})` : "";
  const reasonKept = code === "GOLDEN_VERIFY_FAILED" && /[가-힣]/.test(sentKo);
  const message_ko = reasonKept ? sentKo : coded ? coded.ko : /[가-힣]/.test(sentKo) ? sentKo : sentKo || sentEn ? catalog["newcase.err.generic"].ko + tag : catalog["newcase.errorFallback"].ko;
  const message_en = reasonKept && sentEn ? sentEn : coded ? coded.en : sentEn || (sentKo && !/[가-힣]/.test(sentKo) ? sentKo : catalog["newcase.errorFallback"].en);
  const job_id = typeof raw.job_id === "string" && raw.job_id ? raw.job_id : null;
  const reasonRaw = typeof raw.reason === "string" ? raw.reason.trim() : "";
  const reason = reasonRaw ? reasonRaw : null;
  const blockers = (Array.isArray(raw.blockers) ? raw.blockers : []).flatMap((item): BlockerLine[] => {
    const line = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const ko = typeof line.message_ko === "string" ? line.message_ko.trim() : "";
    const en = typeof line.message_en === "string" ? line.message_en.trim() : "";
    return ko || en ? [{ message_ko: ko || en, message_en: en || ko }] : [];
  });
  return { code, message_ko, message_en, can_repair: raw.can_repair === true, blockers, can_confirm: raw.can_confirm === true, job_id, can_recheck: raw.can_recheck === true, can_revise: raw.can_revise === true, can_resume: raw.can_resume === true, can_continue_repair: raw.can_continue_repair === true, reason };
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function parseTemplateRows(value: unknown): TemplateDef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): TemplateDef[] => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const kind = text(raw.kind);
    if (!kind) return [];
    const params = (Array.isArray(raw.params) ? raw.params : []).flatMap((item): TemplateParam[] => {
      const p = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const name = text(p.name);
      if (!name || !finite(p.default)) return [];
      return [{
        name, label_ko: text(p.label_ko) || name, label_en: text(p.label_en) || name, unit: text(p.unit),
        default: p.default, min: finite(p.min) ? p.min : undefined, max: finite(p.max) ? p.max : undefined,
      }];
    });
    const fixed = (Array.isArray(raw.fixed) ? raw.fixed : []).flatMap((item): TemplateFixed[] => {
      const f = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const name = text(f.name);
      const value = text(f.value);
      return name && value ? [{ name, label_ko: text(f.label_ko) || name, label_en: text(f.label_en) || name, value }] : [];
    });
    return [{
      kind, display_ko: text(raw.display_ko) || kind, display_en: text(raw.display_en) || kind, params, fixed,
      group: raw.group === "process" ? "process" : "unit", units: finite(raw.units) && raw.units > 0 ? raw.units : null,
      description_ko: text(raw.description_ko), description_en: text(raw.description_en),
    }];
  });
}

export function changedParams(template: TemplateDef, edits: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const param of template.params) {
    const raw = edits[param.name];
    if (raw === undefined || raw.trim() === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value) && value !== param.default) out[param.name] = value;
  }
  return out;
}

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function validateImageFile(file: { type: string; size: number; name?: string }): { ok: true } | { ok: false; reason: "type" | "size" } {
  const mime = file.type.toLowerCase();
  if (mime === "application/pdf" || (!mime && (file.name ?? "").toLowerCase().endsWith(".pdf"))) {
    return file.size > 0 && file.size <= MAX_PDF_BYTES ? { ok: true } : { ok: false, reason: "size" };
  }
  const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!ACCEPTED_IMAGE_TYPES.has(mime) && !ACCEPTED_IMAGE_TYPES.has(normalized)) return { ok: false, reason: "type" };
  if (!(file.size > 0) || file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

export function stripDataUrlPrefix(dataUrl: string): string {
  const marker = ";base64,";
  const at = dataUrl.indexOf(marker);
  return at >= 0 ? dataUrl.slice(at + marker.length) : dataUrl;
}
