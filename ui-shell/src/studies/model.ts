
export type TargetObject = "stream" | "operation" | "dynamics";
export type Target = { object: TargetObject; name: string; property: string; unit: string | null };
export type CatalogRow = Target & { value: number | null; writable: boolean };
export type Limits = { maxRuns: number; minSteps: number; maxSteps: number; minTimeout: number; maxTimeout: number; defaultTimeout: number };
export type Catalog = { targets: CatalogRow[]; limits: Limits };

export type StudyKind = "matrix" | "sweep" | "dynamics";
export type StudyState = "draft" | "queued" | "running" | "done" | "cancelled" | "interrupted" | "failed";
export type RunState = "pending" | "running" | "done" | "failed" | "timed_out";
export type Reading = { value: number | null; unit: string | null };
export type RunPhase = "starting" | "running" | "finishing" | "stopping";
export type RunProgress = { phase: RunPhase; t: number | null; stopS: number | null; values: Record<string, Reading> };
export type Run = {
  id: string; label: string; labelEn: string; state: RunState; gate: string | null; values: Record<string, Reading>; errors: string[];
  seconds: number | null; dynamicsRunId: string | null; startedAt: number | null; progress: RunProgress | null;
};
export type Study = {
  id: string; name: string; kind: StudyKind; state: StudyState; monitors: Target[]; runs: Run[];
  timeoutS: number; keepCopies: boolean; cancelRequested: boolean; total: number; finished: number; failed: number; note: string;
};

export const DEFAULT_LIMITS: Limits = { maxRuns: 50, minSteps: 2, maxSteps: 25, minTimeout: 30, maxTimeout: 600, defaultTimeout: 120 };
export const LIVE_STATES: readonly StudyState[] = ["queued", "running"];
export const RESUMABLE_STATES: readonly StudyState[] = ["cancelled", "interrupted", "failed"];

export function canResume(s: Study): boolean {
  return RESUMABLE_STATES.includes(s.state) && s.runs.some((r) => r.state === "pending" || r.gate === "hysys_ended");
}

const STUDY_STATES: readonly StudyState[] = ["draft", "queued", "running", "done", "cancelled", "interrupted", "failed"];
const RUN_STATES: readonly RunState[] = ["pending", "running", "done", "failed", "timed_out"];

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function valueKey(t: Pick<Target, "object" | "name" | "property">): string {
  return `${t.object}:${t.name}:${t.property}`;
}

export function asTarget(raw: unknown): Target | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if ((r.object !== "stream" && r.object !== "operation" && r.object !== "dynamics") || !str(r.name) || !str(r.property)) return null;
  return { object: r.object, name: str(r.name), property: str(r.property), unit: str(r.unit) || null };
}

export function parseCatalog(raw: unknown): Catalog {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const targets: CatalogRow[] = [];
  for (const item of Array.isArray(body.targets) ? body.targets : []) {
    const target = asTarget(item);
    if (target) targets.push({ ...target, value: num((item as Record<string, unknown>).value), writable: (item as Record<string, unknown>).writable === true });
  }
  const l = (body.limits && typeof body.limits === "object" ? body.limits : {}) as Record<string, unknown>;
  const pick = (v: unknown, d: number) => num(v) ?? d;
  return {
    targets,
    limits: {
      maxRuns: pick(l.max_runs, DEFAULT_LIMITS.maxRuns), minSteps: pick(l.min_steps, DEFAULT_LIMITS.minSteps),
      maxSteps: pick(l.max_steps, DEFAULT_LIMITS.maxSteps), minTimeout: pick(l.min_timeout_s, DEFAULT_LIMITS.minTimeout),
      maxTimeout: pick(l.max_timeout_s, DEFAULT_LIMITS.maxTimeout), defaultTimeout: pick(l.default_timeout_s, DEFAULT_LIMITS.defaultTimeout),
    },
  };
}

function parseReadings(raw: unknown): Record<string, Reading> {
  const values: Record<string, Reading> = {};
  if (raw && typeof raw === "object") {
    for (const [key, reading] of Object.entries(raw as Record<string, unknown>)) {
      const rd = (reading && typeof reading === "object" ? reading : {}) as Record<string, unknown>;
      values[key] = { value: num(rd.value), unit: str(rd.unit) || null };
    }
  }
  return values;
}

const PHASES: readonly RunPhase[] = ["starting", "running", "finishing", "stopping"];

function parseProgress(raw: unknown): RunProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (!PHASES.includes(p.phase as RunPhase)) return null;
  return { phase: p.phase as RunPhase, t: num(p.t), stopS: num(p.stop_s), values: parseReadings(p.values) };
}

function parseRun(raw: unknown): Run | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const values = parseReadings(r.values);
  const startedAt = typeof r.started_at === "string" ? Date.parse(r.started_at) : NaN;
  const state = RUN_STATES.includes(r.state as RunState) ? (r.state as RunState) : "pending";
  return {
    id: str(r.id), label: str(r.label), labelEn: str(r.label_en) || str(r.label), state, gate: str(r.gate) || null, values,
    errors: Array.isArray(r.errors) ? r.errors.filter((e): e is string => typeof e === "string") : [], seconds: num(r.seconds),
    dynamicsRunId: str(r.dynamics_run_id) || null,
    startedAt: Number.isFinite(startedAt) ? startedAt : null, progress: parseProgress(r.progress),
  };
}

export function parseStudy(raw: unknown): Study | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!str(s.id)) return null;
  const runs = (Array.isArray(s.runs) ? s.runs : []).map(parseRun).filter((r): r is Run => r !== null);
  const monitors = (Array.isArray(s.monitors) ? s.monitors : []).map(asTarget).filter((t): t is Target => t !== null);
  const history = Array.isArray(s.history) ? s.history : [];
  const last = history.length ? (history[history.length - 1] as Record<string, unknown>) : {};
  return {
    id: str(s.id), name: str(s.name), kind: s.kind === "sweep" || s.kind === "dynamics" ? s.kind : "matrix",
    state: STUDY_STATES.includes(s.state as StudyState) ? (s.state as StudyState) : "draft",
    monitors, runs, timeoutS: num(s.timeout_s) ?? DEFAULT_LIMITS.defaultTimeout,
    keepCopies: s.keep_copies === true, cancelRequested: s.cancel_requested === true, total: runs.length,
    finished: runs.filter((r) => r.state !== "pending" && r.state !== "running").length,
    failed: runs.filter((r) => r.state === "failed" || r.state === "timed_out").length,
    note: str(last.note),
  };
}

export function parseStudyList(raw: unknown): Study[] {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return (Array.isArray(body.studies) ? body.studies : []).map(parseStudy).filter((s): s is Study => s !== null);
}

export const isLive = (s: Pick<Study, "state">): boolean => LIVE_STATES.includes(s.state);


export type MatrixRow = { id: number; label: string; values: Array<number | null> };
export type SweepVar = { target: Target | null; min: number | null; max: number | null; steps: number | null };
export type DynCandidate = { object: string; property: string; label: string; unit: string | null };
export type DynPrepared = { token: string; plan: Record<string, unknown>; notes: string[] };
export type Draft = {
  name: string; kind: StudyKind; monitors: Target[]; inputs: Target[]; rows: MatrixRow[];
  sweep: SweepVar[]; includeBase: boolean; timeoutS: number; keepCopies: boolean;
  stopTimeS: number | null; samples: DynCandidate[]; prepared: DynPrepared | null;
};

export const MAX_DYN_STOP_S = 3600;
export const MAX_DYN_SAMPLES = 12;

export function parseCandidates(raw: unknown): DynCandidate[] {
  return (Array.isArray(raw) ? raw : []).flatMap((item) => {
    const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return str(r.object) && str(r.property)
      ? [{ object: str(r.object), property: str(r.property), label: str(r.label) || `${str(r.object)} ${str(r.property)}`, unit: str(r.unit) || null }]
      : [];
  });
}

export function dynamicsBody(d: Draft): Record<string, unknown> {
  return { stop_time_s: d.stopTimeS, schedule: [], sample: d.samples.map((c) => ({ object: c.object, property: c.property, label: c.label })) };
}

export function emptyDraft(limits: Limits = DEFAULT_LIMITS): Draft {
  return { name: "", kind: "matrix", monitors: [], inputs: [], rows: [], sweep: [{ target: null, min: null, max: null, steps: 5 }],
    includeBase: true, timeoutS: limits.defaultTimeout, keepCopies: false, stopTimeS: 300, samples: [], prepared: null };
}

export function runCount(d: Draft): number {
  if (d.kind === "dynamics") return 1;
  const base = d.includeBase ? 1 : 0;
  if (d.kind === "matrix") return base + d.rows.length;
  return base + d.sweep.reduce((n, v) => n * Math.max(0, v.steps ?? 0), d.sweep.length ? 1 : 0);
}

export type DraftProblem = "name" | "monitors" | "rows" | "cells" | "sweep" | "steps" | "range" | "tooMany" | "timeout" | "samples" | "stopTime" | "prepare";

export function draftProblem(d: Draft, limits: Limits = DEFAULT_LIMITS): DraftProblem | null {
  if (!d.name.trim()) return "name";
  if (d.kind === "dynamics") {
    if (!d.samples.length || d.samples.length > MAX_DYN_SAMPLES) return "samples";
    if (d.stopTimeS === null || !(d.stopTimeS > 0 && d.stopTimeS <= MAX_DYN_STOP_S)) return "stopTime";
    return d.prepared ? null : "prepare";
  }
  if (!d.monitors.length) return "monitors";
  if (d.kind === "matrix") {
    if (!d.inputs.length || !d.rows.length) return "rows";
    if (d.rows.some((row) => row.values.length !== d.inputs.length || row.values.some((v) => v === null))) return "cells";
  } else {
    if (!d.sweep.length || d.sweep.some((v) => !v.target)) return "sweep";
    if (d.sweep.some((v) => v.steps === null || v.steps < limits.minSteps || v.steps > limits.maxSteps)) return "steps";
    if (d.sweep.some((v) => v.min === null || v.max === null || v.min === v.max)) return "range";
  }
  if (runCount(d) > limits.maxRuns) return "tooMany";
  if (!(d.timeoutS >= limits.minTimeout && d.timeoutS <= limits.maxTimeout)) return "timeout";
  return null;
}

const wire = (t: Target) => ({ object: t.object, name: t.name, property: t.property, unit: t.unit });

export function draftBody(d: Draft): Record<string, unknown> {
  const common = { name: d.name.trim(), kind: d.kind, monitors: d.monitors.map(wire), include_base: d.includeBase,
    timeout_s: d.timeoutS, keep_copies: d.keepCopies };
  if (d.kind === "matrix") {
    return { ...common, rows: d.rows.map((row, i) => ({
      label: row.label.trim() || String(i + 1),
      overrides: d.inputs.map((t, j) => ({ ...wire(t), value: row.values[j] })),
    })) };
  }
  return { ...common, sweep: { variables: d.sweep.map((v) => ({ ...wire(v.target as Target), min: v.min, max: v.max, steps: v.steps })) } };
}


export function unitText(unit: string | null): string {
  if (!unit) return "";
  return unit === "C" ? "°C" : unit;
}

export function targetLabel(t: Target): string {
  const unit = unitText(t.unit);
  if (t.object === "dynamics") return `${t.name}${unit ? ` (${unit})` : ""}`;
  return `${t.name} ${t.property}${unit ? ` (${unit})` : ""}`;
}

export function formatValue(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return value.toExponential(2);
  const rounded = abs >= 1000 ? Number(value.toFixed(0)) : abs >= 100 ? Number(value.toFixed(1))
    : abs >= 1 ? Number(value.toFixed(2)) : Number(value.toPrecision(3));
  return (Object.is(rounded, -0) ? 0 : rounded).toString();
}

export function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export function runLabel(run: Run, locale: "ko" | "en"): string {
  return locale === "en" ? run.labelEn : run.label;
}

export function resultsTsv(study: Study, locale: "ko" | "en", stateText: (r: Run) => string, runHeader: string, stateHeader: string): string {
  const head = [runHeader, ...study.monitors.map(targetLabel), stateHeader];
  const lines = study.runs.map((run) => [
    runLabel(run, locale),
    ...study.monitors.map((m) => {
      const reading = run.values[valueKey(m)];
      return reading && reading.value !== null ? String(reading.value) : "";
    }),
    stateText(run),
  ]);
  return [head, ...lines].map((cells) => cells.map((c) => c.replace(/[\t\n\r]+/g, " ")).join("\t")).join("\n");
}

export function endedNow(before: Study | undefined, after: Study): boolean {
  return Boolean(before && isLive(before) && ["done", "failed", "interrupted"].includes(after.state));
}
