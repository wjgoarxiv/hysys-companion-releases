import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useT } from "../i18n";

const STEP = 16;
const BIG_STEP = 64;

export function agentWidthForKey(width: number, key: string, shift: boolean, bounds: { min: number; max: number }): number | null {
  const step = shift ? BIG_STEP : STEP;
  const next = key === "ArrowLeft" ? width + step
    : key === "ArrowRight" ? width - step
    : key === "Home" ? bounds.min
    : key === "End" ? bounds.max
    : null;
  return next === null ? null : Math.min(bounds.max, Math.max(bounds.min, next));
}

export function AgentSplitter({ width, min, max, onChange, onReset }: { width: number; min: number; max: number; onChange: (width: number) => void; onReset: () => void }) {
  const t = useT();
  const drag = useRef<{ x: number; width: number } | null>(null);
  const clamp = (value: number) => Math.min(max, Math.max(min, Math.round(value)));
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, width };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    if (event.buttons === 0) { onPointerEnd(event); return; }
    onChange(clamp(start.width + (start.x - event.clientX)));
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = agentWidthForKey(width, event.key, event.shiftKey, { min, max });
    if (next === null) return;
    event.preventDefault();
    onChange(next);
  };
  return (
    <div
      className="wb-agent-splitter" data-wb-agent-splitter role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label={t("agent.resize")} title={t("agent.resizeHint")}
      aria-valuenow={width} aria-valuemin={min} aria-valuemax={max}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={onKeyDown} onDoubleClick={onReset}
    />
  );
}
