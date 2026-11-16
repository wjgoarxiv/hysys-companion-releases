import type { DraftTopologyData } from "./types";
import type { FlowState } from "./flow";

export const ADDABLE_KINDS = [
  "heater", "cooler", "heat_exchanger", "pump", "compressor", "expander", "valve", "separator",
  "flash_tank", "mixer", "tee", "recycle", "distillation", "absorber", "conversion_reactor",
] as const;
export type AddableKind = (typeof ADDABLE_KINDS)[number];

export type DraftEdit =
  | { op: "add_unit"; name: string; kind: AddableKind }
  | { op: "remove_unit"; name: string }
  | { op: "add_stream"; name: string; from?: string; to?: string }
  | { op: "remove_stream"; name: string }
  | { op: "connect"; stream: string; unit: string; side: "in" | "out" }
  | { op: "disconnect"; stream: string; unit: string };

export type RevisionDraft = { text: string; edits: DraftEdit[] };
export const emptyRevision = (): RevisionDraft => ({ text: "", edits: [] });
export const MAX_REVISION_TEXT = 2000;
export const MAX_EDITS = 40;
const MAX_NAME = 40;

export type EditProblem = "name" | "taken" | "unknownUnit" | "unknownStream" | "notConnected" | "same" | "tooMany";

const key = (text: string): string => text.trim().toLocaleLowerCase();
const has = (list: { name: string }[], name: string): boolean => list.some((item) => key(item.name) === key(name));
const goodName = (name: string): boolean => {
  const text = name.trim();
  return text.length > 0 && text.length <= MAX_NAME && !/[\u0000-\u001f<>"\\]/.test(text);
};

export function applyEdits(topology: DraftTopologyData, edits: DraftEdit[]): DraftTopologyData {
  let units = [...(topology.units ?? [])];
  let streams = [...(topology.streams ?? [])];
  let links = [...(topology.connections ?? [])];
  const unitOf = (name: string) => units.find((unit) => key(unit.name) === key(name));
  const streamOf = (name: string) => streams.find((stream) => key(stream.name) === key(name));
  const ensureStream = (name: string): string => {
    const found = streamOf(name);
    if (found) return found.name;
    streams = [...streams, { name: name.trim(), type: "material" }];
    return name.trim();
  };
  const dropSide = (stream: string, side: "in" | "out") => {
    links = links.filter((link) => !(side === "in" ? link.type === "feed" && key(link.from) === key(stream) : link.type === "product" && key(link.to) === key(stream)));
  };
  for (const edit of edits) {
    switch (edit.op) {
      case "add_unit":
        if (!unitOf(edit.name)) units = [...units, { name: edit.name.trim(), type: edit.kind, kind: edit.kind }];
        break;
      case "remove_unit": {
        const unit = unitOf(edit.name);
        if (!unit) break;
        units = units.filter((item) => item !== unit);
        links = links.filter((link) => key(link.from) !== key(unit.name) && key(link.to) !== key(unit.name));
        break;
      }
      case "add_stream": {
        if (streamOf(edit.name)) break;
        const name = ensureStream(edit.name);
        const from = edit.from ? unitOf(edit.from) : undefined;
        const to = edit.to ? unitOf(edit.to) : undefined;
        if (from) links = [...links, { from: from.name, to: name, type: "product" }];
        if (to) links = [...links, { from: name, to: to.name, type: "feed" }];
        break;
      }
      case "remove_stream": {
        const stream = streamOf(edit.name);
        const name = stream?.name ?? edit.name;
        streams = streams.filter((item) => item !== stream);
        links = links.filter((link) => key(link.from) !== key(name) && key(link.to) !== key(name));
        break;
      }
      case "connect": {
        const unit = unitOf(edit.unit);
        if (!unit) break;
        const name = ensureStream(edit.stream);
        dropSide(name, edit.side);
        links = [...links, edit.side === "in" ? { from: name, to: unit.name, type: "feed" } : { from: unit.name, to: name, type: "product" }];
        break;
      }
      case "disconnect":
        links = links.filter((link) => !((key(link.from) === key(edit.stream) && key(link.to) === key(edit.unit)) || (key(link.from) === key(edit.unit) && key(link.to) === key(edit.stream))));
        break;
    }
  }
  return { units, streams, connections: links };
}

export function checkEdit(topology: DraftTopologyData, before: DraftEdit[], edit: DraftEdit): EditProblem | null {
  if (before.length >= MAX_EDITS) return "tooMany";
  const now = applyEdits(topology, before);
  const units = now.units ?? [];
  const streams = now.streams ?? [];
  const links = now.connections ?? [];
  const unitKnown = (name: string) => has(units, name);
  switch (edit.op) {
    case "add_unit":
      if (!goodName(edit.name)) return "name";
      return unitKnown(edit.name) ? "taken" : null;
    case "remove_unit":
      return unitKnown(edit.name) ? null : "unknownUnit";
    case "add_stream":
      if (!goodName(edit.name)) return "name";
      if (has(streams, edit.name)) return "taken";
      if ((edit.from && !unitKnown(edit.from)) || (edit.to && !unitKnown(edit.to))) return "unknownUnit";
      if (edit.from && edit.to && key(edit.from) === key(edit.to)) return "same";
      return null;
    case "remove_stream":
      return has(streams, edit.name) ? null : "unknownStream";
    case "connect":
      if (!goodName(edit.stream)) return "name";
      return unitKnown(edit.unit) ? null : "unknownUnit";
    case "disconnect":
      return links.some((link) => (key(link.from) === key(edit.stream) && key(link.to) === key(edit.unit)) || (key(link.from) === key(edit.unit) && key(link.to) === key(edit.stream)))
        ? null : "notConnected";
  }
}

export function linksOf(topology: DraftTopologyData, unit: string): { stream: string; side: "in" | "out" }[] {
  return (topology.connections ?? []).flatMap((link): { stream: string; side: "in" | "out" }[] => {
    if (link.type === "feed" && key(link.to) === key(unit)) return [{ stream: link.from, side: "in" as const }];
    if (link.type === "product" && key(link.from) === key(unit)) return [{ stream: link.to, side: "out" as const }];
    return [];
  });
}

export function suggestName(topology: DraftTopologyData, kind: AddableKind): string {
  const prefix: Record<AddableKind, string> = {
    heater: "E", cooler: "E", heat_exchanger: "E", pump: "P", compressor: "K", expander: "K", valve: "VLV", separator: "V",
    flash_tank: "V", mixer: "MIX", tee: "TEE", recycle: "RCY", distillation: "T", absorber: "T", conversion_reactor: "CRV",
  };
  const head = prefix[kind];
  for (let n = 100; n < 1000; n += 1) {
    const name = `${head}-${n}`;
    if (!has(topology.units ?? [], name)) return name;
  }
  return `${head}-${Date.now() % 1000}`;
}

export function suggestStreamName(topology: DraftTopologyData): string {
  for (let n = 1; n < 1000; n += 1) {
    const name = `S-${n}`;
    if (!has(topology.streams ?? [], name)) return name;
  }
  return `S-${Date.now() % 1000}`;
}

export function touchedNames(edits: DraftEdit[]): Set<string> {
  const out = new Set<string>();
  for (const edit of edits) {
    if ("name" in edit) out.add(edit.name);
    if ("stream" in edit) out.add(edit.stream);
    if ("unit" in edit) out.add(edit.unit);
  }
  return out;
}

export function canRevise(state: FlowState): boolean {
  if (state.busy || state.jobId === null || state.draft === null) return false;
  if (state.phase === "awaiting_approval") return true;
  if (state.phase === "needs_input") return !state.questions.some((q) => q.id.startsWith("clarify:"));
  if (state.phase === "error") return state.error?.can_revise === true || state.error?.can_recheck === true;
  return false;
}

export function beginRevise(state: FlowState): FlowState {
  return { ...state, phase: "starting", busy: true, error: null, verify: null, approval: null, questions: [], stages: [],
    live: { sub: null, lines: [], elapsedS: null }, hysysDialog: null, note: null };
}

export const revisionReady = (draft: RevisionDraft): boolean => draft.text.trim().length > 0 || draft.edits.length > 0;
