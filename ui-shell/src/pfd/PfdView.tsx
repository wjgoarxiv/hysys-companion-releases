import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow,
  type AriaLabelConfig, type Node, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { translate, useLocale, useT, type Translate } from "../i18n";
import { sheetModelFromTopology } from "../pfdsheet/model";
import { PfdSheetExport } from "../pfdsheet/PfdSheetExport";
import type { CaseTopology } from "../state/case";
import {
  buildPfdGraph, effectiveShowLogic, flowNodesOf, framePlan, highlightTarget, minimapPlan, partitionUnits, PFD_FIT_FLOOR, PFD_FIT_FLOOR_NARROW,
  PFD_FIT_MAX_ZOOM, PFD_FIT_PADDING, PFD_FLOW_PROPS, PFD_NARROW_WIDTH, startViewport,
  type PfdFlag, type PfdNodeData,
} from "./graph";
import { highlightStore } from "./highlight";
import { kindKey, nameSaysKind } from "./kinds";

const FOCUS_ZOOM = 1;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
const motionMs = () => (reducedMotion() ? 0 : 200);

const flagClass = (flag: PfdFlag | null): string => (flag ? ` wb-pfd-node--${flag}` : "");

function UnitNode({ data }: NodeProps<Node<PfdNodeData>>) {
  const t = useT();
  const kind = data.family ? t(kindKey(data.family)) : "";
  const showKind = kind !== "" && !nameSaysKind(data.name, [translate("ko", kindKey(data.family!)), translate("en", kindKey(data.family!))]);
  return (
    <div className={`wb-pfd-node wb-pfd-node--unit${data.highlighted ? " wb-pfd-node--on" : ""}${data.logic ? " wb-pfd-node--logic" : ""}${data.family === "recycle" ? " wb-pfd-node--recycle" : ""}${flagClass(data.flag)}`}>
      <Handle type="target" position={Position.Left} className="wb-pfd-handle" isConnectable={false} />
      <strong className="wb-pfd-node__name">{data.label}</strong>
      {showKind && <span className="wb-pfd-node__kind">{kind}</span>}
      {data.flag && <span className="wb-pfd-node__flag" aria-hidden="true">!</span>}
      <Handle type="source" position={Position.Right} className="wb-pfd-handle" isConnectable={false} />
    </div>
  );
}

function StreamNode({ data }: NodeProps<Node<PfdNodeData>>) {
  return (
    <div className={`wb-pfd-node wb-pfd-node--stream${data.energy ? " wb-pfd-node--energy" : ""}${data.highlighted ? " wb-pfd-node--on" : ""}${flagClass(data.flag)}`}>
      <Handle type="target" position={Position.Left} className="wb-pfd-handle" isConnectable={false} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} className="wb-pfd-handle" isConnectable={false} />
    </div>
  );
}

const nodeTypes = { unit: UnitNode, stream: StreamNode };

function ariaLabels(t: Translate): Partial<AriaLabelConfig> {
  return {
    "node.a11yDescription.default": t("pfd.node.hint"),
    "edge.a11yDescription.default": t("pfd.edge.hint"),
    "controls.ariaLabel": t("pfd.controls"),
    "controls.zoomIn.ariaLabel": t("pfd.zoomIn"),
    "controls.zoomOut.ariaLabel": t("pfd.zoomOut"),
    "controls.fitView.ariaLabel": t("pfd.fit"),
    "minimap.ariaLabel": t("pfd.minimap"),
  };
}

export type PfdViewProps = {
  topology: CaseTopology;
  caseName?: string;
  highlight?: string | null;
  focusNonce?: number;
  flags?: Readonly<Record<string, PfdFlag>>;
  onInspect?: (name: string) => void;
};

function useStableTopology(topology: CaseTopology): CaseTopology {
  const last = useRef({ topology, key: JSON.stringify(topology) });
  if (topology !== last.current.topology) {
    const key = JSON.stringify(topology);
    if (key !== last.current.key) last.current = { topology, key };
  }
  return last.current.topology;
}

function PfdCanvas({ topology: liveTopology, caseName, highlight = null, focusNonce = 0, flags, onInspect }: PfdViewProps) {
  const t = useT();
  const topology = useStableTopology(liveTopology);
  const flowId = `wb-pfd-${useId().replace(/:/g, "")}`;
  const [full, setFull] = useState(false);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  const [fitsAll, setFitsAll] = useState(true);
  const [showLogic, setShowLogic] = useState(false);
  const locale = useLocale();
  const flagKey = JSON.stringify(flags ?? {});
  const logicUnits = useMemo(() => partitionUnits(topology).logic, [topology]);
  const logicShown = effectiveShowLogic(showLogic, highlight, topology);
  const graph = useMemo(() => buildPfdGraph(topology, highlight, flags, { showLogic: logicShown }), [topology, highlight, flagKey, logicShown]); // eslint-disable-line react-hooks/exhaustive-deps
  const logicFlagged = !logicShown && logicUnits.some((u) => flags?.[u.name]);
  const legend = useMemo(() => ({
    energy: graph.edges.some((e) => e.data?.kind === "energy"),
    recycle: graph.edges.some((e) => e.data?.recycle),
  }), [graph]);
  const labelled = useMemo(() => ({
    nodes: graph.nodes.map((n) => {
      const label = t(n.type === "unit" ? "pfd.unit" : "pfd.stream", { name: n.data.name });
      return { ...n, ariaLabel: n.data.flag ? t("pfd.flagged", { label }) : label };
    }),
    edges: graph.edges.map((e) => ({
      ...e,
      ariaLabel: t("pfd.connection", { from: e.source.slice(2), to: e.target.slice(2), stream: e.data?.streamName ? ` · ${e.data.streamName}` : "" }),
    })),
  }), [graph, locale]);
  const aria = useMemo(() => ariaLabels(t),
    [locale]);
  const mini = minimapPlan(graph.nodes.length, canvas.width, canvas.height);
  const nodeIds = useMemo(() => graph.nodes.map((n) => n.id).join("|"), [graph.nodes]);
  const { fitView, setCenter, getZoom, getNodes, setViewport } = useReactFlow();
  const initialized = useNodesInitialized();
  const frame = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const fit = useCallback(() => {
    moved.current = false;
    void fitView({ padding: PFD_FIT_PADDING, maxZoom: PFD_FIT_MAX_ZOOM, duration: motionMs() });
  }, [fitView]);

  const frameStart = useCallback((duration: number) => {
    const el = frame.current;
    const nodes = getNodes();
    if (!el || nodes.length === 0 || el.clientWidth <= 0 || el.clientHeight <= 0) return;
    const xs = nodes.map((n) => n.position.x);
    const ys = nodes.map((n) => n.position.y);
    const bounds = {
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(...nodes.map((n) => n.position.x + (n.width ?? 0))) - Math.min(...xs),
      height: Math.max(...nodes.map((n) => n.position.y + (n.height ?? 0))) - Math.min(...ys),
    };
    const floorZoom = el.clientWidth < PFD_NARROW_WIDTH ? PFD_FIT_FLOOR_NARROW : PFD_FIT_FLOOR;
    const plan = framePlan(bounds, el.clientWidth, el.clientHeight);
    setFitsAll(plan.fitsAll);
    if (plan.fitsAll) {
      void fitView({ padding: PFD_FIT_PADDING, maxZoom: PFD_FIT_MAX_ZOOM, duration });
      return;
    }
    void setViewport(startViewport(flowNodesOf(nodes), el.clientWidth, el.clientHeight, floorZoom), { duration });
  }, [fitView, getNodes, setViewport]);

  useEffect(() => {
    if (!initialized) return;
    const id = window.setTimeout(() => { moved.current = false; frameStart(motionMs()); }, 120);
    return () => window.clearTimeout(id);
  }, [initialized, nodeIds, frameStart]);

  useEffect(() => {
    const target = highlightTarget(graph, highlight);
    if (!initialized || !target) return;
    const id = window.setTimeout(() => {
      moved.current = true;
      void setCenter(target.x, target.y, { zoom: Math.max(getZoom(), FOCUS_ZOOM), duration: motionMs() });
    }, 180);
    return () => window.clearTimeout(id);
  }, [graph, highlight, focusNonce, initialized, setCenter, getZoom]);

  useEffect(() => {
    const el = frame.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      setCanvas({ width, height });
      if (moved.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => frameStart(0));
    });
    observer.observe(el);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [frameStart]);

  useEffect(() => {
    if (!full) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  return (
    <div className={`wb-pfd${full ? " wb-pfd--full" : ""}`} data-wb-pfd-frame role="group" aria-label={t("pfd.label")}>
      <div className="wb-pfd__bar">
        <span className="wb-pfd__lead">
          {highlight ? (
            <span className="ui-tag wb-pfd__mark">
              <span className="wb-pfd__mark-name">{t("pfd.highlight", { name: highlight })}</span>
              <button type="button" className="wb-pfd__mark-clear" aria-label={t("pfd.highlight.clear")} onClick={() => highlightStore.clear()}>×</button>
            </span>
          ) : (
            <span className="wb-legend ui-meta" data-wb-pfd-legend>
              <span className="wb-legend__item wb-legend__item--material">{t("pfd.legend.material")}</span>
              {legend.energy && <span className="wb-legend__item wb-legend__item--energy">{t("pfd.legend.energy")}</span>}
              {legend.recycle && <span className="wb-legend__item wb-legend__item--recycle">{t("pfd.legend.recycle")}</span>}
            </span>
          )}
        </span>
        <span className="wb-pfd__tools">
          {logicUnits.length > 0 && (
            <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" data-wb-pfd-logic-toggle aria-pressed={logicShown} onClick={() => setShowLogic((v) => !v)}>
              {t("pfd.logic.toggle")} <span className="ui-num">({logicUnits.length})</span>
              {logicFlagged && <span className="wb-pfd__logic-flag" title={t("pfd.logic.flagged")} aria-label={t("pfd.logic.flagged")}>!</span>}
            </button>
          )}
          <span className="ui-meta wb-pfd__hint" data-wb-pfd-zoom-hint>{t("pfd.zoomHint")}</span>
          <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" data-wb-pfd-fit onClick={fit}>{t("pfd.fit")}</button>
          <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" data-wb-pfd-fullscreen aria-pressed={full} onClick={() => setFull((v) => !v)}>
            {full ? t("pfd.closeFullscreen") : t("pfd.fullscreen")}
          </button>
          <PfdSheetExport model={useMemo(() => sheetModelFromTopology(topology, caseName ?? ""), [topology, caseName])} />
        </span>
      </div>
      <div className="wb-pfd__canvas" ref={frame} onKeyDown={(event) => {
        const node = (event.target as HTMLElement).closest?.(".react-flow__node");
        const id = node?.getAttribute("data-id") ?? "";
        if (onInspect && event.key === "Enter" && id.length > 2) onInspect(id.slice(2));
      }}>
        <ReactFlow
          id={flowId}
          nodes={labelled.nodes}
          edges={labelled.edges}
          nodeTypes={nodeTypes}
          ariaLabelConfig={aria}
          fitView
          fitViewOptions={{ padding: PFD_FIT_PADDING, maxZoom: PFD_FIT_MAX_ZOOM }}
          onMoveStart={(event) => { if (event) moved.current = true; }}
          onNodeClick={onInspect ? (_event, node) => onInspect(String(node.data.name)) : undefined}
          onEdgeClick={onInspect ? (_event, edge) => { if (edge.data?.streamName) onInspect(String(edge.data.streamName)); } : undefined}
          {...PFD_FLOW_PROPS}
        >
          <Background variant={BackgroundVariant.Lines} gap={32} lineWidth={1} color="var(--c-line)" />
          <Controls showInteractive={false} showFitView={false} />
          {mini.show && !fitsAll && (
            <MiniMap
              pannable zoomable ariaLabel={t("pfd.minimap")} style={{ width: mini.width, height: mini.height }}
              maskStrokeColor="var(--c-accent)" maskStrokeWidth={mini.maskStrokePx}
            />
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

export function PfdView(props: PfdViewProps) {
  const t = useT();
  if (props.topology.units.length === 0) return <p className="ui-meta" data-wb-pfd-empty>{t("pfd.empty")}</p>;
  return (
    <ReactFlowProvider>
      <PfdCanvas {...props} />
    </ReactFlowProvider>
  );
}
