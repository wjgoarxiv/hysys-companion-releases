import dagre from "@dagrejs/dagre";
import { getViewportForBounds, MarkerType, type Edge, type Node } from "@xyflow/react";
import type { CaseTopology, TopologyUnit } from "../state/case";
import { isLogicalFamily, unitFamily, type UnitFamily } from "./kinds";

export type PfdFlag = "error" | "warning" | "info";
export type PfdNodeData = {
  label: string;
  name: string;
  kind: string;
  family: UnitFamily | null;
  role?: "inlet" | "outlet";
  energy: boolean;
  highlighted: boolean;
  flag: PfdFlag | null;
  logic?: boolean;
};
export type PfdEdgeData = { kind: string; streamName: string; recycle: boolean; highlighted: boolean };
export type PfdGraph = { nodes: Node<PfdNodeData>[]; edges: Edge<PfdEdgeData>[] };

export const PFD_SIZE = { unitW: 168, unitH: 52, streamW: 120, streamH: 30 } as const;
const LAYOUT = { rankdir: "LR", nodesep: 24, ranksep: 64, marginx: 16, marginy: 16, acyclicer: "greedy" } as const;
const EDGE = { strokeWidth: 1.5, highlightWidth: 3, arrow: 16, energyDash: "4 3", recycleDash: "5 4", flowDash: "10 4" } as const;
export const PFD_BIG_GRAPH_NODES = 250;
export const PFD_FIT_PADDING = 0.18;
export const PFD_FIT_FLOOR = 0.6;
export const PFD_NARROW_WIDTH = 480;
export const PFD_FIT_FLOOR_NARROW = 0.65;
export const PFD_FIT_MAX_ZOOM = 1.1;

type Bounds = { x: number; y: number; width: number; height: number };

export function framePlan(bounds: Bounds, width: number, height: number): { zoom: number; fitsAll: boolean } {
  const zoom = getViewportForBounds(bounds, width, height, 0.01, PFD_FIT_MAX_ZOOM, PFD_FIT_PADDING).zoom;
  return { zoom, fitsAll: zoom >= (width < PFD_NARROW_WIDTH ? PFD_FIT_FLOOR_NARROW : PFD_FIT_FLOOR) };
}

export const PFD_START_MARGIN = 16;

export function partitionUnits(topology: CaseTopology): { process: TopologyUnit[]; logic: TopologyUnit[] } {
  const energy = new Set(topology.streams.filter((s) => s.type === "energy").map((s) => s.name));
  const carriesMaterial = new Set<string>();
  for (const c of topology.connections) {
    if (c.type === "energy" || energy.has(c.from) || energy.has(c.to)) continue;
    carriesMaterial.add(c.from);
    carriesMaterial.add(c.to);
  }
  const anyMaterial = carriesMaterial.size > 0;
  const process: TopologyUnit[] = [];
  const logic: TopologyUnit[] = [];
  for (const unit of topology.units) {
    const family = unitFamily(unit.type);
    const isLogic = family === "recycle" ? false : isLogicalFamily(family) || (anyMaterial && !carriesMaterial.has(unit.name));
    (isLogic ? logic : process).push(unit);
  }
  return { process, logic };
}

export function effectiveShowLogic(showLogic: boolean, highlight: string | null | undefined, topology: CaseTopology): boolean {
  if (showLogic) return true;
  return !!highlight && partitionUnits(topology).logic.some((u) => u.name === highlight);
}

export const pfdLabelWidth = (label: string): number => label.length * 8 + 24;
const LABEL_HEIGHT = 20;

export const PFD_FLOW_PROPS = {
  zoomOnScroll: false,
  preventScrolling: false,
  zoomActivationKeyCode: ["Control", "Meta"] as string[],
  nodesDraggable: false,
  nodesConnectable: false,
  elementsSelectable: false,
  minZoom: 0.15,
  maxZoom: 2.5,
  proOptions: { hideAttribution: true },
} as const;

const unitId = (name: string) => `u:${name}`;
const streamId = (name: string) => `s:${name}`;
const STROKE = "var(--c-ink-3)";
const STROKE_ENERGY = "var(--c-info)";
const STROKE_RECYCLE = "var(--c-accent)";
const STROKE_ON = "var(--c-ink)";

type Link = { stream: string; from: string; to: string; kind: string };

function linksOf(topology: CaseTopology, units: Set<string>): { links: Link[]; energy: Set<string> } {
  const energy = new Set(topology.streams.filter((s) => s.type === "energy").map((s) => s.name));
  const producers = new Map<string, Set<string>>();
  const consumers = new Map<string, Set<string>>();
  const kinds = new Map<string, string>();
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(value);
  };
  const links: Link[] = [];
  for (const c of topology.connections) {
    const fromUnit = units.has(c.from);
    const toUnit = units.has(c.to);
    if (fromUnit && toUnit) {
      links.push({ stream: "", from: unitId(c.from), to: unitId(c.to), kind: c.type });
    } else if (fromUnit && !toUnit) {
      add(producers, c.to, c.from);
      kinds.set(c.to, c.type);
      if (c.type === "energy") energy.add(c.to);
    } else if (!fromUnit && toUnit) {
      add(consumers, c.from, c.to);
      kinds.set(c.from, c.type);
      if (c.type === "energy") energy.add(c.from);
    }
  }
  const streams = new Set([...producers.keys(), ...consumers.keys()]);
  for (const stream of streams) {
    const kind = energy.has(stream) ? "energy" : (kinds.get(stream) ?? "material");
    const from = [...(producers.get(stream) ?? [])];
    const to = [...(consumers.get(stream) ?? [])];
    if (from.length && to.length) {
      for (const f of from) for (const t of to) links.push({ stream, from: unitId(f), to: unitId(t), kind });
    } else if (to.length) {
      for (const t of to) links.push({ stream, from: streamId(stream), to: unitId(t), kind });
    } else {
      for (const f of from) links.push({ stream, from: unitId(f), to: streamId(stream), kind });
    }
  }
  return { links, energy };
}

export function buildPfdGraph(
  fullTopology: CaseTopology, highlight?: string | null, flags: Readonly<Record<string, PfdFlag>> = {}, options: { showLogic?: boolean } = {},
): PfdGraph {
  const mark = highlight ?? null;
  const { process, logic } = partitionUnits(fullTopology);
  const logicNames = new Set(logic.map((u) => u.name));
  const topology: CaseTopology = {
    units: process, streams: fullTopology.streams,
    connections: fullTopology.connections.filter((c) => !logicNames.has(c.from) && !logicNames.has(c.to)),
  };
  const unitNames = new Set(topology.units.map((u) => u.name));
  const unitType = new Map(topology.units.map((u) => [u.name, u.type]));
  const { links, energy } = linksOf(topology, unitNames);

  const nodes: Node<PfdNodeData>[] = topology.units.map((u) => ({
    id: unitId(u.name),
    type: "unit",
    position: { x: 0, y: 0 },
    width: PFD_SIZE.unitW,
    height: PFD_SIZE.unitH,
    measured: { width: PFD_SIZE.unitW, height: PFD_SIZE.unitH },
    data: { label: u.name, name: u.name, kind: u.type, family: unitFamily(u.type), energy: false, highlighted: mark === u.name, flag: flags[u.name] ?? null },
  }));
  const seen = new Set(nodes.map((n) => n.id));
  for (const link of links) {
    for (const [id, role] of [[link.from, "inlet"], [link.to, "outlet"]] as const) {
      if (!id.startsWith("s:") || seen.has(id)) continue;
      seen.add(id);
      const name = id.slice(2);
      nodes.push({
        id, type: "stream", position: { x: 0, y: 0 }, width: PFD_SIZE.streamW, height: PFD_SIZE.streamH,
        measured: { width: PFD_SIZE.streamW, height: PFD_SIZE.streamH },
        data: { label: name, name, kind: energy.has(name) ? "energy" : "material", family: null, role, energy: energy.has(name), highlighted: mark === name, flag: flags[name] ?? null },
      });
    }
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({ ...LAYOUT });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: n.width, height: n.height });
  const labelled = (l: Link) => l.stream !== "" && l.from.startsWith("u:") && l.to.startsWith("u:");
  for (const l of links) g.setEdge(l.from, l.to, labelled(l) ? { width: pfdLabelWidth(l.stream), height: LABEL_HEIGHT, labelpos: "c" } : {});
  dagre.layout(g);
  const placed = nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - (n.width ?? 0) / 2, y: p.y - (n.height ?? 0) / 2 } };
  });

  if (options.showLogic && logic.length > 0) placed.push(...logicRail(placed, logic, mark, flags));

  const big = placed.length > PFD_BIG_GRAPH_NODES;
  const xById = new Map(placed.map((n) => [n.id, n.position.x]));
  const edges: Edge<PfdEdgeData>[] = links.map((l, index) => {
    const kind = l.kind;
    const isEnergy = kind === "energy";
    const interUnit = l.from.startsWith("u:") && l.to.startsWith("u:");
    const srcType = (unitType.get(l.from.slice(2)) ?? "").toLowerCase();
    const back = interUnit && (xById.get(l.from) ?? 0) > (xById.get(l.to) ?? 0);
    const recycle = interUnit && !isEnergy && (srcType.includes("recycle") || back);
    const highlighted = mark !== null && l.stream === mark;
    const stroke = highlighted ? STROKE_ON : isEnergy ? STROKE_ENERGY : recycle ? STROKE_RECYCLE : STROKE;
    const classes = ["wb-pfd-edge"];
    if (recycle) classes.push("wb-pfd-edge--recycle");
    if (isEnergy) classes.push("wb-pfd-edge--energy");
    if (highlighted) classes.push("wb-pfd-edge--on");
    const dash = isEnergy ? EDGE.energyDash : recycle ? EDGE.recycleDash : big ? undefined : EDGE.flowDash;
    return {
      id: `e${index}:${l.from}->${l.to}:${l.stream}`,
      source: l.from,
      target: l.to,
      type: "smoothstep",
      ...(labelled(l) ? { label: l.stream } : {}),
      animated: !isEnergy && !big,
      className: classes.join(" "),
      markerEnd: { type: MarkerType.ArrowClosed, width: EDGE.arrow, height: EDGE.arrow, color: stroke },
      style: { stroke, strokeWidth: highlighted ? EDGE.highlightWidth : EDGE.strokeWidth, ...(dash ? { strokeDasharray: dash } : {}) },
      data: { kind, streamName: l.stream, recycle, highlighted },
    };
  });
  return { nodes: placed, edges };
}

const RAIL_GAP = 16;
const RAIL_TOP = 72;

function logicRail(flow: Node<PfdNodeData>[], logic: TopologyUnit[], mark: string | null, flags: Readonly<Record<string, PfdFlag>>): Node<PfdNodeData>[] {
  const left = flow.length ? Math.min(...flow.map((n) => n.position.x)) : 0;
  const right = flow.length ? Math.max(...flow.map((n) => n.position.x + (n.width ?? 0))) : 0;
  const bottom = flow.length ? Math.max(...flow.map((n) => n.position.y + (n.height ?? 0))) : -RAIL_TOP;
  const cols = Math.min(8, Math.max(4, Math.floor((right - left + RAIL_GAP) / (PFD_SIZE.unitW + RAIL_GAP))));
  return logic.map((u, index) => ({
    id: unitId(u.name),
    type: "unit",
    position: {
      x: left + (index % cols) * (PFD_SIZE.unitW + RAIL_GAP),
      y: bottom + RAIL_TOP + Math.floor(index / cols) * (PFD_SIZE.unitH + RAIL_GAP),
    },
    width: PFD_SIZE.unitW,
    height: PFD_SIZE.unitH,
    measured: { width: PFD_SIZE.unitW, height: PFD_SIZE.unitH },
    data: { label: u.name, name: u.name, kind: u.type, family: unitFamily(u.type), energy: false, highlighted: mark === u.name, flag: flags[u.name] ?? null, logic: true },
  }));
}

export const flowNodesOf = <T extends { data?: { logic?: boolean } }>(nodes: readonly T[]): T[] => {
  const flow = nodes.filter((n) => !n.data?.logic);
  return flow.length > 0 ? flow : [...nodes];
};

export function startViewport(
  nodes: ReadonlyArray<{ position: { x: number; y: number }; width?: number; height?: number }>, width: number, height: number, zoom: number,
): { x: number; y: number; zoom: number } {
  if (nodes.length === 0) return { x: PFD_START_MARGIN, y: PFD_START_MARGIN, zoom };
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const x = PFD_START_MARGIN - minX * zoom;
  const windowRight = minX + (width - 2 * PFD_START_MARGIN) / zoom;
  const near = nodes.filter((n) => n.position.x < windowRight);
  const flowH = (height - 2 * PFD_START_MARGIN) / zoom;
  const top = Math.min(...near.map((n) => n.position.y));
  const bottom = Math.max(...near.map((n) => n.position.y + (n.height ?? 0)));
  if (bottom - top <= flowH) return { x, y: height / 2 - ((top + bottom) / 2) * zoom, zoom };
  let bandTop = top;
  let best = -1;
  for (const start of near.map((n) => n.position.y).sort((a, b) => a - b)) {
    const count = near.filter((n) => n.position.y >= start && n.position.y + (n.height ?? 0) <= start + flowH).length;
    if (count > best) { best = count; bandTop = start; }
  }
  return { x, y: PFD_START_MARGIN - bandTop * zoom, zoom };
}

const MINIMAP_BIG_NODES = 40;
export function minimapPlan(nodeCount: number, canvasWidth: number, canvasHeight: number): { show: boolean; width: number; height: number; maskStrokePx: number } {
  const show = canvasWidth >= 480 && canvasHeight >= 240;
  const big = nodeCount > MINIMAP_BIG_NODES;
  return {
    show,
    width: big ? (canvasWidth >= 900 ? 240 : 200) : 144,
    height: big ? Math.min(160, Math.max(96, Math.floor(canvasHeight * 0.3))) : 96,
    maskStrokePx: 2,
  };
}

export function highlightTarget(graph: PfdGraph, name: string | null | undefined): { x: number; y: number } | null {
  if (!name) return null;
  const centre = (n: Node) => ({ x: n.position.x + (n.width ?? 0) / 2, y: n.position.y + (n.height ?? 0) / 2 });
  const node = graph.nodes.find((n) => n.data.name === name);
  if (node) return centre(node);
  const edge = graph.edges.find((e) => e.data?.streamName === name);
  if (!edge) return null;
  const a = graph.nodes.find((n) => n.id === edge.source);
  const b = graph.nodes.find((n) => n.id === edge.target);
  if (!a || !b) return null;
  const ca = centre(a);
  const cb = centre(b);
  return { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
}
