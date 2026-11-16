import type { SheetModel } from "./model";
import { buildPfdSheet, type SheetLocale } from "./sheet";

const PNG_TARGET_W = 4961;

export function pfdFileName(caseName: string, ext: "svg" | "png" | "pdf"): string {
  const stem = caseName.trim().replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "case";
  return `${stem}-PFD.${ext}`;
}

export function sheetSvg(model: SheetModel, locale: SheetLocale): string {
  return buildPfdSheet(model, { locale, date: new Date().toISOString().slice(0, 10) });
}

async function saveBytes(name: string, bytes: Uint8Array, mime: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function saveSvgFile(model: SheetModel, locale: SheetLocale): Promise<void> {
  const svg = sheetSvg(model, locale);
  await saveBytes(pfdFileName(model.caseName, "svg"), new TextEncoder().encode(svg), "image/svg+xml");
}

export function svgToPngBytes(svg: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const image = new Image();
    image.onload = () => {
      const scale = PNG_TARGET_W / image.width;
      const canvas = document.createElement("canvas");
      canvas.width = PNG_TARGET_W;
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no_2d_context")); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("encode_failed")); return; }
        void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)));
      }, "image/png");
    };
    image.onerror = () => reject(new Error("raster_failed"));
    image.src = url;
  });
}

export async function savePngFile(model: SheetModel, locale: SheetLocale): Promise<void> {
  const png = await svgToPngBytes(sheetSvg(model, locale));
  await saveBytes(pfdFileName(model.caseName, "png"), png, "image/png");
}

export class PfdPdfError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PfdPdfError";
    this.status = status;
  }
}

export async function fetchSheetPdf(_svg: string): Promise<Uint8Array> {
  throw new PfdPdfError(501, "PDF export is not part of the screen demo. SVG and PNG work.");
}

export async function savePdfFile(model: SheetModel, locale: SheetLocale): Promise<void> {
  const pdf = await fetchSheetPdf(sheetSvg(model, locale));
  await saveBytes(pfdFileName(model.caseName, "pdf"), pdf, "application/pdf");
}
