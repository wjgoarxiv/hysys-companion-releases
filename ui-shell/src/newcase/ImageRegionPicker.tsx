import { useRef, useState } from "react";
import { useLocale } from "../i18n";

export type ImageRegion = { x0: number; y0: number; x1: number; y1: number };

export type ImageRegionPickerProps = {
  src: string;
  region: ImageRegion | null;
  onPick: (region: ImageRegion | null) => void;
};

const copy = {
  title: { ko: "읽을 구역 고르기", en: "Choose the section to read" },
  hint: { ko: "그림을 드래그해서 읽을 구역 하나를 고르세요.", en: "Drag over the picture to pick one section to read." },
  clear: { ko: "구역 지우기", en: "Clear the section" },
} as const;

function text(locale: "ko" | "en", key: keyof typeof copy): string {
  return copy[key][locale];
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalizeRegion(region: ImageRegion): ImageRegion | null {
  const x0 = Math.min(clamp01(region.x0), clamp01(region.x1));
  const y0 = Math.min(clamp01(region.y0), clamp01(region.y1));
  const x1 = Math.max(clamp01(region.x0), clamp01(region.x1));
  const y1 = Math.max(clamp01(region.y0), clamp01(region.y1));
  if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return null;
  return { x0, y0, x1, y1 };
}

export function regionToPixels(
  region: ImageRegion | null, width: number, height: number,
): [number, number, number, number] {
  const norm = region == null ? null : normalizeRegion(region);
  const box = norm ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  return [
    Math.round(box.x0 * width), Math.round(box.y0 * height),
    Math.round(box.x1 * width), Math.round(box.y1 * height),
  ];
}

export function ImageRegionPicker({ src, region, onPick }: ImageRegionPickerProps) {
  const locale = useLocale();
  const frame = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<ImageRegion | null>(null);
  const shown = draft ?? region;

  const relative = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  return (
    <section className="wb-regionpicker" data-newcase="image-region" aria-label={text(locale, "title")}>
      <h3 className="wb-subhead">{text(locale, "title")}</h3>
      <p className="wb-hint">{text(locale, "hint")}</p>
      <div
        className="wb-regionpicker__frame"
        ref={(node) => { frame.current = node; }}
        onPointerDown={(event) => {
          const point = relative(event.clientX, event.clientY);
          if (point == null) return;
          start.current = point;
          setDraft({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
        }}
        onPointerMove={(event) => {
          if (start.current == null) return;
          const point = relative(event.clientX, event.clientY);
          if (point == null) return;
          setDraft({ x0: start.current.x, y0: start.current.y, x1: point.x, y1: point.y });
        }}
        onPointerUp={() => {
          start.current = null;
          if (draft == null) return;
          const norm = normalizeRegion(draft);
          setDraft(null);
          onPick(norm);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            start.current = null;
            setDraft(null);
            onPick(null);
          }
        }}
      >
        <img src={src} alt="" />
        {shown == null ? null : (
          <div
            className="wb-regionpicker__box"
            style={{
              left: `${Math.min(shown.x0, shown.x1) * 100}%`,
              top: `${Math.min(shown.y0, shown.y1) * 100}%`,
              width: `${Math.abs(shown.x1 - shown.x0) * 100}%`,
              height: `${Math.abs(shown.y1 - shown.y0) * 100}%`,
            }}
          />
        )}
      </div>
      {region == null ? null : (
        <button type="button" className="ui-btn ui-btn--sm" onClick={() => onPick(null)}>
          {text(locale, "clear")}
        </button>
      )}
    </section>
  );
}
