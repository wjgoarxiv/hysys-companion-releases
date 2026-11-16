export const pdfMessages = {
  "pdf.picker.title": { ko: "페이지 고르기", en: "Choose a page" },
  "pdf.picker.page": { ko: "{n}쪽", en: "Page {n}" },
} as const;

export type PdfMessageKey = keyof typeof pdfMessages;
