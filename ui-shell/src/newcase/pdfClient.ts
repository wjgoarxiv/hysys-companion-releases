
export const PDF_PAGES_PATH = "demo:pdf/pages";
export const PDF_MIME = "application/pdf";
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export type PdfPages = { count: number; thumbs: string[] };

type PdfPagesClient = {
  postJson<T = unknown>(path: string, body?: unknown): Promise<T>;
};

export function isPdfUpload(file: { type?: string; name?: string }): boolean {
  const type = (file.type ?? "").toLowerCase().split(";", 1)[0].trim();
  if (type === PDF_MIME) return true;
  if (type === "image/png" || type === "image/jpeg" || type === "image/jpg") return false;
  return (file.name ?? "").toLowerCase().endsWith(".pdf");
}

export function pdfThumbSrc(b64: string): string {
  const text = b64.trim();
  return text.startsWith("data:") ? text : `data:image/png;base64,${text}`;
}

export async function fetchPdfPages(client: PdfPagesClient, pdfB64: string): Promise<PdfPages> {
  const body = await client.postJson<unknown>(PDF_PAGES_PATH, { pdf_b64: pdfB64 });
  if (!body || typeof body !== "object") throw new Error("pdf_pages_bad");
  const count = (body as { count?: unknown }).count;
  const thumbs = (body as { thumbs?: unknown }).thumbs;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || !Array.isArray(thumbs) || thumbs.some((item) => typeof item !== "string")) {
    throw new Error("pdf_pages_bad");
  }
  return { count, thumbs };
}
