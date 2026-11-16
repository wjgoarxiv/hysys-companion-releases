import type { MessageKey } from "../i18n";

export const VERSION_SOURCES = ["agent", "user", "auto"] as const;
export type VersionSource = (typeof VERSION_SOURCES)[number];

export type VersionEntry = {
  id: string;
  time: string;
  label: string;
  note: string;
  source: VersionSource;
  parent: string | null;
  caseFile: string;
};

export type UnreadableRow = { id: string | null; reason: string };
export type VersionList = { entries: VersionEntry[]; unreadable: UnreadableRow[] };

export type NamedChange = { name: string; type?: string | null };
export type EdgeChange = { unit: string; direction: string; stream: string };
export type MovedEdge = { unit: string; direction: string; from: string; to: string };
export type SpecChange = { key: string; a: unknown; b: unknown };
export type ValueChange = {
  scope: string;
  key: string;
  a: unknown;
  b: unknown;
  abs_delta: number | null;
  rel_delta: number | null;
  unit?: string | null;
};

export type VersionDiff = {
  units: { added: NamedChange[]; removed: NamedChange[] };
  streams: { added: string[]; removed: string[] };
  connections: { added: EdgeChange[]; removed: EdgeChange[]; moved: MovedEdge[] };
  specs: SpecChange[];
  values: ValueChange[];
};

const VALUE_LABELS: Record<string, MessageKey> = {
  T: "versions.value.T",
  P: "versions.value.P",
  mass_flow: "versions.value.mass_flow",
  molar_flow: "versions.value.molar_flow",
  vapour_fraction: "versions.value.vapour_fraction",
};

export function formatVersionTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fileNameOf(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return String(Math.round(value * 1e6) / 1e6);
}

export function formatSigned(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const text = formatNumber(Math.abs(value));
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return text;
}

export function formatSignedQuantity(value: number, unit?: string | null): string {
  const text = formatSigned(Number(formatMeasure(value)));
  const label = unitLabel(unit);
  return label && text !== "—" ? `${text} ${label}` : text;
}

const INTERVAL_TEMPERATURE_UNITS: readonly string[] = ["C", "F", "°C", "°F"];

export function formatRelative(value: number | null, unit?: string | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (unit && INTERVAL_TEMPERATURE_UNITS.includes(unit.trim())) return "—";
  const percent = Math.round(value * 1000) / 10;
  return `${formatSigned(percent)}%`;
}

export function unitLabel(unit?: string | null): string {
  if (!unit) return "";
  return unit === "C" ? "°C" : unit === "F" ? "°F" : unit;
}

export function formatMeasure(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return String(Math.abs(value) >= 1 ? Math.round(value * 1e3) / 1e3 : Number(value.toPrecision(4)));
}

export function formatQuantity(value: unknown, unit?: string | null): string {
  const text = typeof value === "number" ? formatMeasure(value) : formatUnknown(value);
  const label = unitLabel(unit);
  return label && text !== "—" ? `${text} ${label}` : text;
}

export function formatUnknown(value: unknown): string {
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string" && value) return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return "—";
}

export function valueLabelKey(name: string): MessageKey | null {
  return VALUE_LABELS[name] ?? null;
}

export type UnreadableKind = "missingFile" | "badJson" | "badId" | "other";

const UNREADABLE_KEY: Record<UnreadableKind, MessageKey> = {
  missingFile: "versions.unreadable.missingFile",
  badJson: "versions.unreadable.badJson",
  badId: "versions.unreadable.badId",
  other: "versions.unreadable.other",
};

export function unreadableKind(reason: string): UnreadableKind {
  const text = reason.toLowerCase();
  if (text.startsWith("missing file")) return "missingFile";
  if (text.includes("invalid id") || text.includes("bad id") || text.includes("do not match its id")) return "badId";
  if (text.includes("manifest unreadable") || text.includes("not an object") || text.includes("malformed") || text.includes("json")) {
    return "badJson";
  }
  return "other";
}

export function unreadableMessageKey(reason: string): MessageKey {
  return UNREADABLE_KEY[unreadableKind(reason)];
}

export function newestFirst(entries: readonly VersionEntry[]): VersionEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry.time < b.entry.time ? 1 : a.entry.time > b.entry.time ? -1 : a.index - b.index))
    .map((row) => row.entry);
}

function isSource(value: unknown): value is VersionSource {
  return value === "agent" || value === "user" || value === "auto";
}

export function asEntry(value: unknown): VersionEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.time !== "string" || !isSource(row.source)) return null;
  const parent = row.parent;
  if (!(parent === null || parent === undefined || typeof parent === "string")) return null;
  return {
    id: row.id,
    time: row.time,
    label: typeof row.label === "string" ? row.label : "",
    note: typeof row.note === "string" ? row.note : "",
    source: row.source,
    parent: typeof parent === "string" ? parent : null,
    caseFile: typeof row.case_file === "string" ? row.case_file : "",
  };
}

export function otherCaseFile(entryFile: string, openFile: string | null | undefined): string | null {
  if (!entryFile || !openFile) return null;
  return entryFile.toLowerCase() === openFile.toLowerCase() ? null : entryFile;
}

export function parseVersionList(value: unknown): VersionList {
  if (!value || typeof value !== "object") throw new Error("invalid version list");
  const raw = value as { entries?: unknown; unreadable?: unknown };
  if (!Array.isArray(raw.entries) || !Array.isArray(raw.unreadable)) throw new Error("invalid version list");
  const entries: VersionEntry[] = [];
  const unreadable: UnreadableRow[] = [];
  for (const item of raw.unreadable) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; reason?: unknown };
    unreadable.push({
      id: typeof row.id === "string" ? row.id : null,
      reason: typeof row.reason === "string" ? row.reason : "",
    });
  }
  for (const item of raw.entries) {
    const entry = asEntry(item);
    if (entry) entries.push(entry);
    else unreadable.push({ id: null, reason: "" });
  }
  return { entries: newestFirst(entries), unreadable };
}

function asNamed(value: unknown): NamedChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as { name?: unknown }).name !== "string") return [];
    const row = item as { name: string; type?: unknown };
    return [{ name: row.name, type: typeof row.type === "string" ? row.type : null }];
  });
}

function asEdges(value: unknown): EdgeChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { unit?: unknown; direction?: unknown; stream?: unknown };
    if (typeof row.unit !== "string" || typeof row.direction !== "string" || typeof row.stream !== "string") return [];
    return [{ unit: row.unit, direction: row.direction, stream: row.stream }];
  });
}

function asMoved(value: unknown): MovedEdge[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { unit?: unknown; direction?: unknown; from?: unknown; to?: unknown };
    if (typeof row.unit !== "string" || typeof row.direction !== "string" || typeof row.from !== "string" || typeof row.to !== "string") return [];
    return [{ unit: row.unit, direction: row.direction, from: row.from, to: row.to }];
  });
}

export function parseVersionDiff(value: unknown): VersionDiff {
  const wrapped = value && typeof value === "object" && "diff" in value ? (value as { diff: unknown }).diff : value;
  if (!wrapped || typeof wrapped !== "object") throw new Error("invalid version diff");
  const diff = wrapped as Record<string, unknown>;
  const units = (diff.units ?? {}) as { added?: unknown; removed?: unknown };
  const streams = (diff.streams ?? {}) as { added?: unknown; removed?: unknown };
  const connections = (diff.connections ?? {}) as { added?: unknown; removed?: unknown; moved?: unknown };
  const specs = Array.isArray(diff.specs) ? diff.specs.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as { key?: unknown }).key !== "string") return [];
    const row = item as { key: string; a?: unknown; b?: unknown };
    return [{ key: row.key, a: row.a ?? null, b: row.b ?? null }];
  }) : [];
  const values = Array.isArray(diff.values) ? diff.values.flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as { key?: unknown }).key !== "string") return [];
    const row = item as { scope?: unknown; key: string; a?: unknown; b?: unknown; abs_delta?: unknown; rel_delta?: unknown; unit?: unknown };
    return [{
      scope: typeof row.scope === "string" ? row.scope : "",
      key: row.key,
      a: row.a ?? null,
      b: row.b ?? null,
      abs_delta: typeof row.abs_delta === "number" ? row.abs_delta : null,
      rel_delta: typeof row.rel_delta === "number" ? row.rel_delta : null,
      unit: typeof row.unit === "string" ? row.unit : null,
    }];
  }) : [];
  return {
    units: { added: asNamed(units.added), removed: asNamed(units.removed) },
    streams: {
      added: Array.isArray(streams.added) ? streams.added.filter((item): item is string => typeof item === "string") : [],
      removed: Array.isArray(streams.removed) ? streams.removed.filter((item): item is string => typeof item === "string") : [],
    },
    connections: { added: asEdges(connections.added), removed: asEdges(connections.removed), moved: asMoved(connections.moved) },
    specs,
    values,
  };
}

export function structureEmpty(diff: VersionDiff): boolean {
  const { units, streams, connections } = diff;
  return units.added.length + units.removed.length + streams.added.length + streams.removed.length
    + connections.added.length + connections.removed.length + connections.moved.length === 0;
}

export function toggleSelected(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  if (selected.length >= 2) return [...selected];
  return [...selected, id];
}

export function compareWithPrevious(entriesNewest: readonly { id: string }[], id: string): [string, string] | null {
  const index = entriesNewest.findIndex((entry) => entry.id === id);
  if (index < 0 || index + 1 >= entriesNewest.length) return null;
  return [entriesNewest[index + 1].id, id];
}

export function diffPair(entries: readonly { id: string; time: string }[], selected: readonly string[]): { a: string; b: string } | null {
  if (selected.length !== 2) return null;
  const timeOf = (id: string) => entries.find((entry) => entry.id === id)?.time ?? "";
  const [left, right] = selected;
  return timeOf(left) <= timeOf(right) ? { a: left, b: right } : { a: right, b: left };
}

export type NoteDraft = { label: string; note: string };
export type NoteEditResult = { action: "save"; label: string; note: string } | { action: "cancel" } | { action: "ignore" };

export function noteEditResult(key: string, draft: NoteDraft): NoteEditResult {
  if (key === "Enter") return { action: "save", label: draft.label, note: draft.note };
  if (key === "Escape" || key === "Esc") return { action: "cancel" };
  return { action: "ignore" };
}

export function messageFromBody(body: unknown, locale: "ko" | "en"): string | null {
  if (!body || typeof body !== "object") return null;
  const detail = "detail" in body ? (body as { detail: unknown }).detail : body;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const row = detail as { message_ko?: unknown; message_en?: unknown };
  const ko = typeof row.message_ko === "string" ? row.message_ko : null;
  const en = typeof row.message_en === "string" ? row.message_en : null;
  if (locale === "en") return en ?? ko;
  return ko ?? en;
}

export function errorText(err: unknown, locale: "ko" | "en", fallback: string): string {
  const body = err && typeof err === "object" && "body" in err ? (err as { body: unknown }).body : null;
  return messageFromBody(body, locale) ?? fallback;
}
