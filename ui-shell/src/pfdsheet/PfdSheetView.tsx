import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocale, useT } from "../i18n";
import type { SheetModel } from "./model";
import { buildPfdSheet } from "./sheet";
import { PfdSheetExport } from "./PfdSheetExport";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const STEP = 0.25;
const BUTTON = { minWidth: 32, minHeight: 32 };
const PAPER_PX = (420 / 25.4) * 96;

export function PfdSheetView({ model, title }: { model: SheetModel; title?: string }) {
  const t = useT();
  const locale = useLocale();
  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const svg = useMemo(
    () => buildPfdSheet(model, { locale, date: new Date().toISOString().slice(0, 10) })
      .replace("<svg ", '<svg style="width:100%;height:auto;display:block" '),
    [model, locale],
  );
  const paperZoom = (): number => clamp(PAPER_PX / Math.max(1, frame.current?.clientWidth ?? PAPER_PX));

  const clamp = (next: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100));
  const onKey = (event: ReactKeyboardEvent): void => {
    if (event.key === "+" || event.key === "=") setZoom((z) => clamp(z + STEP));
    else if (event.key === "-") setZoom((z) => clamp(z - STEP));
    else if (event.key === "0") setZoom(1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="wb-pfdsheet" data-wb-pfdsheet aria-label={title ?? t("pfdsheet.view.label")}>
      <div className="wb-pfdsheet__bar">
        <span className="wb-pfdsheet__tools" role="group" aria-label={t("pfdsheet.view.label")}>
          <button type="button" className="ui-btn ui-btn--sm" style={BUTTON} aria-label={t("pfdsheet.view.zoomOut")}
            onClick={() => setZoom((z) => clamp(z - STEP))}>−</button>
          <button type="button" className="ui-btn ui-btn--sm" style={BUTTON} aria-label={t("pfdsheet.view.zoomIn")}
            onClick={() => setZoom((z) => clamp(z + STEP))}>+</button>
          <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" style={BUTTON} onClick={() => setZoom(paperZoom())}>
            {t("pfdsheet.view.reset")}
          </button>
          <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" style={BUTTON}
            onClick={() => { setZoom(1); frame.current?.scrollTo({ left: 0, top: 0 }); }}>
            {t("pfdsheet.view.fit")}
          </button>
        </span>
        <PfdSheetExport model={model} />
      </div>
      <div className="wb-pfdsheet__canvas" ref={frame} tabIndex={0} onKeyDown={onKey}
        style={{ overflow: "auto", maxHeight: 560 }}>
        <div style={{ width: `${zoom * 100}%`, maxWidth: "none" }} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
}
