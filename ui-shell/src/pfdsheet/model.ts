import type { UnitFamily } from "../pfd/kinds";
import { unitFamily } from "../pfd/kinds";
import type { CaseTopology } from "../state/case";
import type { DraftTopologyData } from "../newcase/types";

export type SheetUnit = { name: string; type: string; family: UnitFamily | null };
export type SheetLink = {
  stream: string;
  from: string | null;
  to: string | null;
  kind: "material" | "energy";
  recycle: boolean;
};
export type SheetModel = {
  caseName: string;
  units: SheetUnit[];
  streams: Array<{ no: number; name: string; from: string | null; to: string | null; kind: "material" | "energy" }>;
  links: SheetLink[];
  values: Record<string, string[]>;
  changed: string[];
};

const uniqueNames = (names: readonly string[]): string[] => [...new Set(names)].sort();

function linksOf(topology: { units: Array<{ name: string }>; connections: Array<{ from: string; to: string; type: string }> }, energy: Set<string>): SheetLink[] {
  const units = new Set(topology.units.map((u) => u.name));
  const producers = new Map<string, Set<string>>();
  const consumers = new Map<string, Set<string>>();
  const kinds = new Map<string, "material" | "energy">();
  const direct: SheetLink[] = [];
  const add = (map: Map<string, Set<string>>, key: string, value: string): void => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(value);
  };
  for (const c of topology.connections) {
    const kind = (c.type === "energy" || energy.has(c.from) || energy.has(c.to)) ? "energy" : "material";
    const fromUnit = units.has(c.from);
    const toUnit = units.has(c.to);
    if (fromUnit && toUnit) direct.push({ stream: "", from: c.from, to: c.to, kind, recycle: false });
    else if (fromUnit && !toUnit) { add(producers, c.to, c.from); kinds.set(c.to, kind); }
    else if (!fromUnit && toUnit) { add(consumers, c.from, c.to); kinds.set(c.from, kind); }
  }
  const out: SheetLink[] = [...direct];
  for (const name of uniqueNames([...producers.keys(), ...consumers.keys()])) {
    const kind = energy.has(name) ? "energy" : (kinds.get(name) ?? "material");
    const from = [...(producers.get(name) ?? [])].sort();
    const to = [...(consumers.get(name) ?? [])].sort();
    if (from.length > 0 && to.length > 0) {
      for (const f of from) for (const t of to) out.push({ stream: name, from: f, to: t, kind, recycle: false });
    } else if (to.length > 0) {
      for (const t of to) out.push({ stream: name, from: null, to: t, kind, recycle: false });
    } else {
      for (const f of from) out.push({ stream: name, from: f, to: null, kind, recycle: false });
    }
  }
  return out;
}

export function depthsOf(names: string[], links: SheetLink[]): { depth: Map<string, number>; recycle: Set<SheetLink> } {
  const flow = links.filter((l) => l.from && l.to && l.kind !== "energy");
  const energyFlow = links.filter((l) => l.from && l.to && l.kind === "energy");
  const next = new Map<string, string[]>();
  const energyNext = new Map<string, string[]>();
  for (const name of names) { next.set(name, []); energyNext.set(name, []); }
  for (const link of flow) next.get(link.from!)!.push(link.to!);
  for (const link of energyFlow) energyNext.get(link.from!)!.push(link.to!);
  for (const list of next.values()) list.sort();
  for (const list of energyNext.values()) list.sort();
  const indegree = new Map(names.map((n) => [n, 0]));
  for (const link of flow) indegree.set(link.to!, (indegree.get(link.to!) ?? 0) + 1);
  for (const link of energyFlow) indegree.set(link.to!, (indegree.get(link.to!) ?? 0) + 1);
  const feedTargets = new Set<string>();
  for (const link of links) if (!link.from && link.to && link.kind !== "energy") feedTargets.add(link.to);
  const materialPred = new Set<string>();
  for (const link of flow) materialPred.add(link.to!);
  const depth = new Map(names.map((n) => [n, 0]));
  const processed = new Set<string>();
  const queued = new Set<string>();
  const queue: string[] = [];
  const push = (n: string): void => { if (!processed.has(n) && !queued.has(n)) { queued.add(n); queue.push(n); } };
  for (const n of names) if ((indegree.get(n) ?? 0) === 0) push(n);
  const seed = (): void => {
    const rest = names.filter((n) => !processed.has(n) && !queued.has(n));
    if (rest.length === 0) return;
    const fed = rest.filter((n) => feedTargets.has(n)).sort();
    push(fed.length > 0 ? fed[0] : rest.sort()[0]);
  };
  if (queue.length === 0) seed();
  while (queue.length > 0) {
    queue.sort();
    const head = queue.shift()!;
    queued.delete(head);
    if (processed.has(head)) continue;
    processed.add(head);
    for (const target of next.get(head) ?? []) {
      if (processed.has(target)) continue;
      depth.set(target, Math.max(depth.get(target) ?? 0, (depth.get(head) ?? 0) + 1));
      indegree.set(target, (indegree.get(target) ?? 0) - 1);
      if ((indegree.get(target) ?? 0) <= 0) push(target);
    }
    for (const target of energyNext.get(head) ?? []) {
      if (processed.has(target)) continue;
      indegree.set(target, (indegree.get(target) ?? 0) - 1);
      if (!materialPred.has(target)) {
        depth.set(target, Math.max(depth.get(target) ?? 0, (depth.get(head) ?? 0) + 1));
      }
      if ((indegree.get(target) ?? 0) <= 0) push(target);
    }
    if (queue.length === 0 && processed.size < names.length) seed();
  }
  const recycle = new Set<SheetLink>();
  for (const link of flow) {
    if ((depth.get(link.to!) ?? 0) <= (depth.get(link.from!) ?? 0)) recycle.add(link);
  }
  return { depth, recycle };
}

function toModel(caseName: string, units: SheetUnit[], links: SheetLink[], energy: Set<string>, values: Record<string, string[]>, changed: string[]): SheetModel {
  const names = units.map((u) => u.name);
  const { depth, recycle } = depthsOf(names, links);
  for (const link of recycle) link.recycle = true;
  const ordered = [...links].sort((a, b) => {
    const da = a.from ? (depth.get(a.from) ?? 0) : -1;
    const db = b.from ? (depth.get(b.from) ?? 0) : -1;
    return da - db || a.stream.localeCompare(b.stream) || (a.from ?? "").localeCompare(b.from ?? "") || (a.to ?? "").localeCompare(b.to ?? "");
  });
  let no = 0;
  const streams = ordered
    .filter((link) => link.stream !== "")
    .map((link) => ({ no: ++no, name: link.stream, from: link.from, to: link.to, kind: link.kind }));
  void energy;
  return { caseName, units, streams, links: ordered, values, changed: [...changed].sort() };
}

export function sheetModelFromTopology(topology: CaseTopology, caseName: string, opts: { values?: Record<string, string[]>; changed?: readonly string[] } = {}): SheetModel {
  const units = topology.units.map((u) => ({ name: u.name, type: u.type, family: unitFamily(u.type) }));
  const energy = new Set(topology.streams.filter((s) => s.type === "energy").map((s) => s.name));
  return toModel(caseName, units, linksOf(topology, energy), energy, opts.values ?? {}, [...(opts.changed ?? [])]);
}

export function sheetModelFromDraft(topology: DraftTopologyData, caseName: string, changed?: ReadonlySet<string> | readonly string[]): SheetModel {
  const units = (topology.units ?? []).map((u) => ({ name: u.name, type: u.type || u.kind, family: unitFamily(u.kind || u.type) }));
  const energy = new Set((topology.streams ?? []).filter((s) => s.type === "energy").map((s) => s.name));
  const links = linksOf({ units, connections: (topology.connections ?? []).map((c) => ({ ...c })) }, energy);
  return toModel(caseName, units, links, energy, {}, changed ? [...changed] : []);
}
