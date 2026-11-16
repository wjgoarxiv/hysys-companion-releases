import type { ReactNode } from "react";

export type Inline = { kind: "text" | "strong" | "code"; value: string };
export type Block =
  | { kind: "p"; lines: Inline[][] }
  | { kind: "ul" | "ol"; items: Inline[][] };

const LONG_FLOAT = /(?<![\w.])(-?\d+\.\d{5,})(?!\d|\.\d|[eE][+-]?\d)/g;

export function tidyNumbers(text: string): string {
  return text.replace(LONG_FLOAT, (literal) => {
    const n = Number(literal);
    if (!Number.isFinite(n)) return literal;
    const decimals = n === 0 ? 0 : Math.max(0, 3 - Math.floor(Math.log10(Math.abs(n))));
    const fixed = n.toFixed(decimals);
    const short = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
    return short === "-0" || short === "" ? "0" : short;
  });
}

const INLINE = /\*\*([^*\n]+?)\*\*|`([^`\n]+)`/g;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) out.push({ kind: "text", value: text.slice(last, match.index) });
    out.push(match[1] !== undefined ? { kind: "strong", value: match[1] } : { kind: "code", value: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[][] | null = null;
  let list: { kind: "ul" | "ol"; items: Inline[][] } | null = null;
  const flush = () => {
    if (paragraph) blocks.push({ kind: "p", lines: paragraph });
    if (list) blocks.push(list);
    paragraph = null;
    list = null;
  };
  for (const raw of tidyNumbers(text).replace(/\r\n?/g, "\n").split("\n")) {
    if (raw.trim() === "") { flush(); continue; }
    const bullet = BULLET.exec(raw);
    const numbered = bullet ? null : NUMBERED.exec(raw);
    const item = bullet ?? numbered;
    if (item) {
      const kind = bullet ? "ul" : "ol";
      if (list && list.kind !== kind) flush();
      if (paragraph) { blocks.push({ kind: "p", lines: paragraph }); paragraph = null; }
      list ??= { kind, items: [] };
      list.items.push(parseInline(item[1]));
      continue;
    }
    if (list) flush();
    const heading = HEADING.exec(raw);
    (paragraph ??= []).push(heading ? [{ kind: "strong", value: heading[1].trim() }] : parseInline(raw.trim()));
  }
  flush();
  return blocks;
}

function inlineNodes(parts: Inline[]): ReactNode[] {
  return parts.map((part, index) => {
    if (part.kind === "strong") return <strong key={index}>{part.value}</strong>;
    if (part.kind === "code") return <code key={index} className="wb-md__code">{part.value}</code>;
    return part.value;
  });
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {parseMarkdown(text).map((block, index) => {
        if (block.kind === "p") {
          return (
            <p key={index} className="wb-md__p">
              {block.lines.map((line, i) => (i === 0 ? inlineNodes(line) : [<br key={`br${i}`} />, ...inlineNodes(line)]))}
            </p>
          );
        }
        const Tag = block.kind;
        return (
          <Tag key={index} className="wb-md__list">
            {block.items.map((item, i) => <li key={i}>{inlineNodes(item)}</li>)}
          </Tag>
        );
      })}
    </>
  );
}
