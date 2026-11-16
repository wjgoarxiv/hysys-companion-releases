import { useMemo, useState } from "react";
import { useLocale, useT } from "../i18n";
import type { SheetModel } from "./model";
import { savePdfFile, savePngFile, saveSvgFile } from "./exportSheet";

export function PfdSheetExport({ model }: { model: SheetModel }) {
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState<null | "svg" | "png" | "pdf">(null);
  const [failed, setFailed] = useState(false);
  const disabled = busy !== null || model.units.length === 0;

  const run = useMemo(() => async (kind: "svg" | "png" | "pdf"): Promise<void> => {
    setBusy(kind);
    setFailed(false);
    try {
      if (kind === "svg") await saveSvgFile(model, locale);
      else if (kind === "png") await savePngFile(model, locale);
      else await savePdfFile(model, locale);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }, [model, locale]);

  return (
    <span className="wb-pfdsheet-export" data-wb-pfdsheet-export role="group" aria-label={t("pfdsheet.export")}>
      <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" disabled={disabled} onClick={() => void run("svg")}>
        {busy === "svg" ? t("pfdsheet.working") : t("pfdsheet.svg")}
      </button>
      <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" disabled={disabled} onClick={() => void run("png")}>
        {busy === "png" ? t("pfdsheet.working") : t("pfdsheet.png")}
      </button>
      <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" disabled={disabled} onClick={() => void run("pdf")}>
        {busy === "pdf" ? t("pfdsheet.working") : t("pfdsheet.pdf")}
      </button>
      {failed && <span className="ui-meta" role="alert">{t("pfdsheet.failed")}</span>}
    </span>
  );
}
