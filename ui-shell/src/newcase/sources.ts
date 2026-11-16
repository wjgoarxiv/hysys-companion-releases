import type { NewCaseClient } from "./client";

export type AssumptionSource = { url: string; title: string; excerpt: string; verified: boolean };
export type AssumptionItem = { text: string; source?: AssumptionSource };

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? value.trim() : null;
  } catch {
    return null;
  }
}

export function parseAssumptions(value: unknown): AssumptionItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry): AssumptionItem[] => {
    if (typeof entry === "string") return entry.trim() ? [{ text: entry.trim() }] : [];
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text || !("source_url" in row)) return []; // ledger rows and unsourced records are not lines on the card
    const url = safeHttpUrl(row.source_url);
    if (!url) return [{ text }];
    const title = typeof row.source_title === "string" && row.source_title.trim() ? row.source_title.trim() : new URL(url).host;
    const excerpt = typeof row.excerpt === "string" ? row.excerpt.trim() : "";
    return [{ text, source: { url, title, excerpt, verified: row.quote_verified === true } }];
  });
}

export function linkParts(text: string): Array<{ text: string; url?: string }> {
  const out: Array<{ text: string; url?: string }> = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'()]+/g)) {
    const raw = match[0].replace(/[.,;:!?]+$/, ""); // a sentence's own full stop is not part of the address
    const url = safeHttpUrl(raw);
    if (!url) continue;
    const start = match.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: raw, url });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export type OpenSourceDeps = { isTauri: () => boolean; client: Pick<NewCaseClient, "postJson"> };

export async function openSourceLink(event: { preventDefault: () => void }, url: string, deps: OpenSourceDeps): Promise<void> {
  if (!deps.isTauri()) return;
  event.preventDefault();
  try {
    await deps.client.postJson("demo:new-case/open-source", { url });
  } catch {
  }
}

