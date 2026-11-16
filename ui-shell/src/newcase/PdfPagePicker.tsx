import { useRef } from "react";
import { useLocale, type UiLocale } from "../i18n";
import { pdfMessages } from "../i18n/pdf";
import { pdfThumbSrc } from "./pdfClient";

export type PdfPagePickerProps = {
  count: number;
  thumbs: readonly string[];
  page: number;
  onPick: (page: number) => void;
};

export function movePdfPage(page: number, count: number, key: string): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  const current = Math.min(Math.max(page, 0), last);
  if (key === "ArrowRight" || key === "ArrowDown") return Math.min(last, current + 1);
  if (key === "ArrowLeft" || key === "ArrowUp") return Math.max(0, current - 1);
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}

function pdfText(locale: UiLocale, key: keyof typeof pdfMessages, params?: Readonly<Record<string, string | number>>): string {
  const template: string = pdfMessages[key][locale];
  return params ? template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name: string) => String(params[name] ?? match)) : template;
}

export function PdfPagePicker({ count, thumbs, page, onPick }: PdfPagePickerProps) {
  const locale = useLocale();
  const title = pdfText(locale, "pdf.picker.title");
  const shown = thumbs.slice(0, Math.max(0, count));
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const choose = (index: number) => {
    onPick(index);
    buttons.current[index]?.focus();
  };
  const onKey = (event: { key: string; preventDefault: () => void }) => {
    const next = movePdfPage(page, shown.length, event.key);
    if (next == null) return;
    event.preventDefault();
    choose(next);
  };
  return (
    <section className="wb-pdfpicker" data-newcase="pdf-picker" aria-label={title}>
      <h3 className="wb-subhead" id="wb-pdf-picker-title">{title}</h3>
      <div className="wb-pdfpicker__list" role="listbox" aria-labelledby="wb-pdf-picker-title" onKeyDown={onKey}>
        {shown.map((thumb, index) => {
          const label = pdfText(locale, "pdf.picker.page", { n: index + 1 });
          const selected = index === page;
          return (
            <button
              key={index}
              type="button"
              role="option"
              className="ui-btn ui-btn--sm wb-pdfpicker__page"
              ref={(node) => { buttons.current[index] = node; }}
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              aria-label={label}
              data-pdf-page={index}
              onClick={() => choose(index)}
            >
              <img src={pdfThumbSrc(thumb)} alt="" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
