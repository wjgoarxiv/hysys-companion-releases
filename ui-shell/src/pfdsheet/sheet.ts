import type { UnitFamily } from "../pfd/kinds";
import { depthsOf, type SheetLink, type SheetModel } from "./model";

export type SheetLocale = "ko" | "en";
export type SheetOpts = { locale?: SheetLocale; date?: string };

export const SHEET_W = 420;
export const SHEET_H = 297;

const INK = "#1b1b1b";
const MUTED = "#5a5a5a";
const ACCENT = "#0b5fff";
const ENERGY = "#0e7c86";
const PAPER = "#ffffff";
const FONT = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";

const SYM_W = 30;
const SYM_H = 20;

type Placed = { x: number; y: number; row: number; col: number };
type Edge = { link: SheetLink; points: string; mid: { x: number; y: number }; lane: "row" | "drop" | "return" | "edge" | "energy"; nameBelow?: boolean };

const esc = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r2 = (n: number): number => Math.round(n * 100) / 100;

const KIND_LABEL: Record<SheetLocale, Record<string, string>> = {
  ko: {
    separator: "분리기", heater: "히터", cooler: "쿨러", exchanger: "열교환기", compressor: "압축기",
    expander: "팽창기", pump: "펌프", valve: "밸브", mixer: "혼합기", splitter: "분배기",
    column: "증류탑", reactor: "반응기", recycle: "리사이클", pipe: "배관", absorber: "흡수탑",
    flash: "플래시 드럼", generic: "장치",
  },
  en: {
    separator: "Separator", heater: "Heater", cooler: "Cooler", exchanger: "Exchanger", compressor: "Compressor",
    expander: "Expander", pump: "Pump", valve: "Valve", mixer: "Mixer", splitter: "Splitter",
    column: "Column", reactor: "Reactor", recycle: "Recycle", pipe: "Pipe", absorber: "Absorber",
    flash: "Flash drum", generic: "Unit",
  },
};

function extents(family: UnitFamily | null, type: string): { hx: number; hy: number } {
  const lower = type.toLowerCase();
  if (family === "separator") return /flash/.test(lower) ? { hx: 15, hy: 7 } : { hx: 7, hy: 10 };
  if (family === "column") return { hx: 7, hy: 15.5 };
  if (family === "heater") return { hx: 15, hy: 10 };
  if (family === "cooler") return { hx: 15, hy: 12.5 };
  if (family === "exchanger") return { hx: 15, hy: 8 };
  if (family === "pump") return { hx: 8, hy: 8 };
  if (family === "compressor" || family === "expander") return { hx: 11, hy: 7 };
  if (family === "valve") return { hx: 7, hy: 6 };
  if (family === "mixer" || family === "splitter") return { hx: 6, hy: 6 };
  if (family === "recycle") return { hx: 13, hy: 8 };
  if (family === "reactor") return { hx: 7, hy: 16.5 };
  if (family === "pipe") return { hx: 15, hy: 1 };
  return { hx: 13, hy: 8 };
}

const unitH = (family: UnitFamily | null, type: string): number => Math.max(extents(family, type).hy, 10);

const kindWord = (family: UnitFamily | null, type: string, locale: SheetLocale): string => {
  const lower = type.toLowerCase();
  if (family === "column" && /absor|strip/.test(lower)) return KIND_LABEL[locale].absorber;
  if (family === "separator" && /flash/.test(lower)) return KIND_LABEL[locale].flash;
  if (family && family in KIND_LABEL[locale]) return KIND_LABEL[locale][family];
  return KIND_LABEL[locale].generic;
};

function symbolInner(family: UnitFamily | null, type: string): string {
  const w = SYM_W;
  const h = SYM_H;
  const x0 = -w / 2;
  const y0 = -h / 2;
  const s = `stroke="${INK}" stroke-width="0.5" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const lower = type.toLowerCase();
  if (family === "separator" && !/flash/.test(lower)) {
    return `<rect x="${x0 + 8}" y="${y0}" width="14" height="${h}" rx="7" ${s}/><line x1="${x0 + 8}" y1="0" x2="${x0 + 22}" y2="0" ${s}/>`;
  }
  if (family === "separator") {
    return `<rect x="${x0}" y="${y0 + 3}" width="${w}" height="${h - 6}" rx="${(h - 6) / 2}" ${s}/><line x1="${x0 + 6}" y1="${y0 + 3}" x2="${x0 + 6}" y2="${y0 + h - 3}" ${s}/>`;
  }
  if (family === "column") {
    const trays = [-5, -1.5, 2, 5.5].map((dy) => `<line x1="${x0 + 9}" y1="${dy}" x2="${x0 + 21}" y2="${dy}" ${s}/>`).join("");
    const packing = /absor|strip|pack/.test(lower)
      ? `<polyline points="${x0 + 10},4 ${x0 + 14},0 ${x0 + 18},4 ${x0 + 22},0" ${s}/>` : trays;
    return `<rect x="${x0 + 8}" y="${y0 - 3}" width="14" height="${h + 6}" ${s}/>`
      + `<ellipse cx="${x0 + 15}" cy="${y0 - 3}" rx="7" ry="2.5" ${s}/><ellipse cx="${x0 + 15}" cy="${y0 + h + 3}" rx="7" ry="2.5" ${s}/>${packing}`;
  }
  if (family === "heater" || family === "cooler") {
    const fins = family === "cooler"
      ? `<line x1="${x0 + 7}" y1="${y0 - 2.5}" x2="${x0 + 7}" y2="${y0}" ${s}/><line x1="${x0 + 15}" y1="${y0 - 2.5}" x2="${x0 + 15}" y2="${y0}" ${s}/><line x1="${x0 + 23}" y1="${y0 - 2.5}" x2="${x0 + 23}" y2="${y0}" ${s}/>` : "";
    return `${fins}<rect x="${x0}" y="${y0}" width="${w}" height="${h}" ${s}/>`
      + `<polyline points="${x0 + 5},5 ${x0 + 10},-5 ${x0 + 15},5 ${x0 + 20},-5 ${x0 + 25},5" ${s}/>`;
  }
  if (family === "exchanger") {
    return `<rect x="${x0}" y="${y0 + 2}" width="${w}" height="${h - 4}" rx="6" ${s}/><line x1="${x0}" y1="0" x2="${x0 + w}" y2="0" ${s}/>`;
  }
  if (family === "pump") {
    return `<circle cx="0" cy="0" r="8" ${s}/><polygon points=" -4,-4.5 5,0 -4,4.5" fill="${INK}" stroke="none"/>`;
  }
  if (family === "compressor") {
    return `<polygon points="${x0 + 4},-7 ${x0 + 26},-3.5 ${x0 + 26},3.5 ${x0 + 4},7" ${s}/><line x1="${x0 + 4}" y1="-7" x2="${x0 + 4}" y2="7" ${s}/>`;
  }
  if (family === "expander") {
    return `<polygon points="${x0 + 4},-3.5 ${x0 + 26},-7 ${x0 + 26},7 ${x0 + 4},3.5" ${s}/><line x1="${x0 + 26}" y1="-7" x2="${x0 + 26}" y2="7" ${s}/>`;
  }
  if (family === "valve") {
    return `<polygon points="${x0 + 8},-6 ${x0 + 8},6 ${x0 + 22},0" ${s}/><polygon points="${x0 + 22},-6 ${x0 + 22},6 ${x0 + 8},0" ${s}/>`;
  }
  if (family === "mixer" || family === "splitter") {
    const dot = family === "splitter" ? `<circle cx="0" cy="0" r="1.6" fill="${INK}" stroke="none"/>` : "";
    return `<circle cx="0" cy="0" r="6" ${s}/><line x1="-6" y1="0" x2="6" y2="0" ${s}/><line x1="0" y1="-6" x2="0" y2="0" ${s}/>${dot}`;
  }
  if (family === "recycle") {
    return `<rect x="${x0 + 2}" y="${y0 + 2}" width="${w - 4}" height="${h - 4}" rx="4" ${s} stroke-dasharray="2.5 1.5"/>`
      + `<path d="M -6,-1 A 6.5,6.5 0 1 1 -6.5,2.5" ${s}/><polygon points="-9.5,-2.5 -3.5,-1.5 -7.5,3" fill="${INK}" stroke="none"/>`;
  }
  if (family === "reactor") {
    return `<rect x="${x0 + 8}" y="${y0}" width="14" height="${h}" rx="7" ${s}/>`
      + `<line x1="0" y1="${y0 - 4}" x2="0" y2="2" ${s}/><line x1="-4" y1="-1" x2="4" y2="-1" ${s}/><line x1="-4" y1="3" x2="4" y2="3" ${s}/>`
      + `<rect x="-3" y="${y0 - 6.5}" width="6" height="2.5" ${s}/>`;
  }
  if (family === "pipe") {
    return `<line x1="${x0}" y1="0" x2="${x0 + w}" y2="0" ${s} stroke-width="0.9"/>`;
  }
  return `<rect x="${x0 + 2}" y="${y0 + 2}" width="${w - 4}" height="${h - 4}" ${s} stroke-dasharray="2.5 1.5"/>`;
}

const unconnected = (model: SheetModel): boolean =>
  model.units.length >= 2 && !model.links.some((l) => l.from !== null && l.to !== null);

function orderUnits(model: SheetModel): string[] {
  if (unconnected(model)) return model.units.map((u) => u.name);
  const { depth } = depthsOf(model.units.map((u) => u.name), model.links);
  return [...model.units]
    .sort((a, b) => (depth.get(a.name) ?? 0) - (depth.get(b.name) ?? 0) || a.name.localeCompare(b.name))
    .map((u) => u.name);
}

export function buildPfdSheet(model: SheetModel, opts: SheetOpts = {}): string {
  const locale: SheetLocale = opts.locale === "en" ? "en" : "ko";
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const byName = new Map(model.units.map((u) => [u.name, u]));
  const changed = new Set(model.changed ?? []);
  const order = orderUnits(model);
  const n = order.length;

  const perRow = n <= 6 ? Math.max(n, 1) : n <= 16 ? 8 : 10;
  const rows = Math.max(1, Math.ceil(n / perRow));

  const areaX = 10;
  const areaTop = 34;
  const areaR = 410;
  const areaBot = 242;
  const areaW = areaR - areaX;
  const areaH = areaBot - areaTop;
  const cellW = areaW / perRow;
  const cellH = areaH / rows;

  const at = new Map<string, Placed>();
  order.forEach((name, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    at.set(name, { x: r2(areaX + col * cellW + cellW / 2), y: r2(areaTop + row * cellH + cellH / 2), row, col });
  });

  const rowLane = new Map<string, number>();
  const keyOf = (p: Placed): string => `${p.row}`;
  const laneCount = new Map<string, number>();
  const edges: Edge[] = [];
  let returnLane = 0;
  let dropLane = 0;

  const port = (name: string, side: "E" | "W" | "N" | "S"): { x: number; y: number } => {
    const p = at.get(name)!;
    const u = byName.get(name)!;
    const { hx, hy } = extents(u.family, u.type);
    if (side === "E") return { x: r2(p.x + hx), y: p.y };
    if (side === "W") return { x: r2(p.x - hx), y: p.y };
    if (side === "N") return { x: p.x, y: r2(p.y - hy) };
    return { x: p.x, y: r2(p.y + hy) };
  };

  const rowHMax = new Map<number, number>();
  for (const [name, p] of at) {
    const u = byName.get(name)!;
    rowHMax.set(p.row, Math.max(rowHMax.get(p.row) ?? 0, unitH(u.family, u.type)));
  }

  const linkNo = (link: SheetLink): number | null => {
    const hit = model.streams.find((s) => s.name === link.stream && s.from === link.from && s.to === link.to);
    return hit ? hit.no : null;
  };

  const exclusion = (name: string): { x0: number; x1: number; y0: number; y1: number } => {
    const p = at.get(name)!;
    const u = byName.get(name)!;
    const H = unitH(u.family, u.type);
    const half = Math.max(SYM_W / 2, u.name.length * 1.45, kindWord(u.family, u.type, locale).length * 1.05) + 1;
    return { x0: p.x - half, x1: p.x + half, y0: p.y - (H + 7), y1: p.y + (H + 7) };
  };
  const crossesAny = (x: number, yTop: number, yBot: number, except: string): boolean =>
    order.some((name) => {
      if (name === except) return false;
      const b = exclusion(name);
      return x > b.x0 && x < b.x1 && yBot > b.y0 && yTop < b.y1;
    });
  const trackClear = (x0: number, x1: number, y: number, except: string): boolean =>
    !order.some((name) => {
      if (name === except) return false;
      const b = exclusion(name);
      return x1 > b.x0 && x0 < b.x1 && y > b.y0 && y < b.y1;
    });
  const topEntry = (target: string): { ex: number; tagClearY: number } => {
    const p = at.get(target)!;
    const u = byName.get(target)!;
    const H = unitH(u.family, u.type);
    const off = Math.max(1.5, Math.min(extents(u.family, u.type).hx - 1, target.length * 1.45 + 2));
    return { ex: r2(p.x + off), tagClearY: r2(p.y - (H + 8.4)) };
  };
  const bottomEntry = (target: string): { ex: number; kindClearY: number } => {
    const p = at.get(target)!;
    const u = byName.get(target)!;
    const H = unitH(u.family, u.type);
    const off = Math.max(1.5, Math.min(extents(u.family, u.type).hx - 1, kindWord(u.family, u.type, locale).length * 1.05 + 2));
    return { ex: r2(p.x + off), kindClearY: r2(p.y + H + 8.2) };
  };
  const jogY = (row: number, y: number): number => {
    const rH = rowHMax.get(row) ?? 10;
    const down = r2(y + rH + 10);
    return down <= areaBot - 6 ? down : r2(y - (rH + 10));
  };

  for (const link of model.links) {
    if (link.kind === "energy") {
      const unit = link.to ?? link.from;
      if (!unit || !at.has(unit)) continue;
      const p = port(unit, "N");
      const top = areaTop - 8;
      const lanes = [p.x, p.x + 19, p.x - 19, p.x + 38, p.x - 38, p.x + 57, p.x - 57];
      const laneX = r2(lanes.find((x) => !crossesAny(x, top, p.y, unit)) ?? p.x);
      const { ex, tagClearY } = topEntry(unit);
      const pts = `${laneX},${top} ${laneX},${tagClearY} ${ex},${tagClearY} ${ex},${p.y}`;
      edges.push({ link, points: pts, mid: { x: laneX, y: r2((top + tagClearY) / 2) }, lane: "energy" });
      continue;
    }
    if (link.from && link.to && at.has(link.from) && at.has(link.to)) {
      const a = at.get(link.from)!;
      const b = at.get(link.to)!;
      if (link.recycle || b.row < a.row || (b.row === a.row && b.col < a.col)) {
        const laneY = r2(areaBot - 4 - returnLane * 4);
        returnLane += 1;
        const pa = port(link.from, "E");
        const gapX = b.col === 0 ? areaX + 2 : r2(areaX + b.col * cellW);
        const { ex, kindClearY } = bottomEntry(link.to);
        const rightX = r2(areaR - 3);
        const portY = port(link.to, "S").y;
        const pts = `${pa.x},${pa.y} ${rightX},${pa.y} ${rightX},${laneY} ${gapX},${laneY} ${gapX},${kindClearY} ${ex},${kindClearY} ${ex},${portY}`;
        edges.push({ link, points: pts, mid: { x: r2((rightX + gapX) / 2), y: laneY }, lane: "return" });
      } else if (b.row === a.row) {
        const k = laneCount.get(keyOf(a)) ?? 0;
        laneCount.set(keyOf(a), k + 1);
        const pa = port(link.from, "E");
        const pb = port(link.to, "W");
        const blockedAt = (y: number): boolean =>
          order.some((name) => {
            if (name === link.from || name === link.to) return false;
            const e = exclusion(name);
            return pa.x < e.x1 && pb.x > e.x0 && y > e.y0 && y < e.y1;
          });
        const picked = [0, 1, 2]
          .map((i) => r2(a.y + ([0, -5, 5][(k + i) % 3] ?? 0)))
          .find((yy) => !blockedAt(yy));
        if (picked !== undefined) {
          const pts = picked === a.y
            ? `${pa.x},${pa.y} ${pb.x},${pb.y}`
            : `${pa.x},${pa.y} ${r2(pa.x + 3)},${pa.y} ${r2(pa.x + 3)},${picked} ${r2(pb.x - 3)},${picked} ${r2(pb.x - 3)},${pb.y} ${pb.x},${pb.y}`;
          edges.push({ link, points: pts, mid: { x: r2((pa.x + pb.x) / 2), y: picked }, lane: "row" });
        } else {
          const jy = jogY(a.row, a.y);
          const bX1 = r2(areaX + (a.col + 1) * cellW);
          const bX2 = r2(areaX + b.col * cellW);
          const pts = `${pa.x},${pa.y} ${bX1},${pa.y} ${bX1},${jy} ${bX2},${jy} ${bX2},${pb.y} ${pb.x},${pb.y}`;
          edges.push({ link, points: pts, mid: { x: r2((bX1 + bX2) / 2), y: jy }, lane: "row" });
        }
      } else {
        const chanY = r2(areaTop + (a.row + 1) * cellH + 4 + (dropLane % 3) * 3);
        dropLane += 1;
        const pa = port(link.from, "S");
        const pb = at.get(link.to)!;
        const portY = port(link.to, "N").y;
        const { ex: sx } = bottomEntry(link.from);
        const { ex, tagClearY } = topEntry(link.to);
        const pts = `${sx},${pa.y} ${sx},${chanY} ${pb.x},${chanY} ${pb.x},${tagClearY} ${ex},${tagClearY} ${ex},${portY}`;
        edges.push({ link, points: pts, mid: { x: r2((sx + pb.x) / 2), y: chanY }, lane: "drop" });
      }
      continue;
    }
    if (!link.from && link.to && at.has(link.to)) {
      const target = link.to;
      const pb = port(target, "W");
      const col = at.get(target)!.col;
      const row = at.get(target)!.row;
      const x0 = areaX + 2;
      if (trackClear(x0, pb.x, pb.y, target)) {
        edges.push({ link, points: `${x0},${pb.y} ${pb.x},${pb.y}`, mid: { x: r2((x0 + pb.x) / 2), y: pb.y }, lane: "edge" });
        continue;
      }
      const y = jogY(row, pb.y);
      const bX = r2(areaX + col * cellW);
      const pts = `${x0},${y} ${bX},${y} ${bX},${pb.y} ${pb.x},${pb.y}`;
      edges.push({ link, points: pts, mid: { x: r2((x0 + bX) / 2), y }, lane: "edge", nameBelow: y > pb.y });
      continue;
    }
    if (link.from && !link.to && at.has(link.from)) {
      const source = link.from;
      const pa = port(source, "E");
      const row = at.get(source)!.row;
      const x1 = areaR - 6;
      const u = byName.get(source)!;
      const myNo = linkNo(link);
      const overhead = (l: SheetLink): number => (/gas|vap|overhead|top/i.test(l.stream) ? 0 : 1);
      const sibs = model.links
        .filter((l) => l.from === source && !l.to && l.kind !== "energy")
        .sort((a, b) => overhead(a) - overhead(b) || (linkNo(a) ?? 0) - (linkNo(b) ?? 0))
        .map((l) => linkNo(l))
        .filter((n): n is number => n !== null);
      const split = u.family === "column" || sibs.length >= 2;
      if (!split && trackClear(pa.x, x1 + 6, pa.y, source)) {
        edges.push({ link, points: `${pa.x},${pa.y} ${x1},${pa.y}`, mid: { x: r2((pa.x + x1) / 2), y: pa.y }, lane: "edge" });
        continue;
      }
      const rH = rowHMax.get(row) ?? 10;
      if (split && myNo !== null && sibs[0] === myNo) {
        const { ex } = topEntry(source);
        const portY = port(source, "N").y;
        const laneY = r2(at.get(source)!.y - (rH + 12.4));
        const pts = `${ex},${portY} ${ex},${laneY} ${x1},${laneY}`;
        edges.push({ link, points: pts, mid: { x: r2((ex + x1) / 2), y: laneY }, lane: "edge" });
        continue;
      }
      if (split && myNo !== null && sibs.length > 0) {
        const { ex } = bottomEntry(source);
        const portY = port(source, "S").y;
        const laneY = r2(at.get(source)!.y + rH + 10.2);
        const pts = `${ex},${portY} ${ex},${laneY} ${x1},${laneY}`;
        edges.push({ link, points: pts, mid: { x: r2((ex + x1) / 2), y: laneY }, lane: "edge", nameBelow: true });
        continue;
      }
      const y = jogY(row, pa.y);
      const below = y > pa.y;
      const ex = below ? bottomEntry(source).ex : topEntry(source).ex;
      const portY = port(source, below ? "S" : "N").y;
      const pts = `${ex},${portY} ${ex},${y} ${x1},${y}`;
      edges.push({ link, points: pts, mid: { x: r2((ex + x1) / 2), y }, lane: "edge", nameBelow: below });
    }
  }

  const rowLabel = (text: string, x: number, y: number, size: number, anchor: "start" | "middle" | "end", bold: boolean, fill: string): string =>
    `<text x="${r2(x)}" y="${r2(y)}" font-family="${FONT}" font-size="${size}" text-anchor="${anchor}" `
    + `fill="${fill}"${bold ? ` font-weight="700"` : ""}>${esc(text)}</text>`;

  const DIA = Math.min(8, (cellW - SYM_W) / 1.6);
  const diaNum = Math.max(2.2, DIA * 0.42);

  let symbols = "";
  for (const name of order) {
    const unit = byName.get(name)!;
    const p = at.get(name)!;
    const isChanged = changed.has(name);
    const stroke = isChanged ? ACCENT : INK;
    const box = `${r2(p.x - SYM_W / 2)},${r2(p.y - SYM_H / 2)},${SYM_W},${SYM_H}`;
    const { hx, hy } = extents(unit.family, unit.type);
    const ports = `E:${r2(p.x + hx)},${p.y} W:${r2(p.x - hx)},${p.y} N:${p.x},${r2(p.y - hy)} S:${p.x},${r2(p.y + hy)}`;
    const tagSize = unit.name.length > 12 ? 2.4 : 2.9;
    const kind = kindWord(unit.family, unit.type, locale);
    symbols += `<g data-sym="${esc(name)}" data-box="${box}" data-ports="${ports}">`;
    if (isChanged) {
      symbols += `<rect x="${r2(p.x - SYM_W / 2 - 3)}" y="${r2(p.y - SYM_H / 2 - 3)}" width="${SYM_W + 6}" height="${SYM_H + 6}" rx="3" `
        + `fill="none" stroke="${ACCENT}" stroke-width="0.6" stroke-dasharray="2 1.2"/>`;
    }
    symbols += `<g transform="translate(${p.x} ${p.y})" stroke="${stroke}">${symbolInner(unit.family, unit.type)}</g>`;
    const H = unitH(unit.family, unit.type);
    symbols += rowLabel(unit.name, p.x, p.y - (H + 4), tagSize, "middle", true, stroke);
    symbols += rowLabel(kind, p.x, p.y + H + 4.6, 2.1, "middle", false, isChanged ? ACCENT : MUTED);
    symbols += `</g>`;
  }

  let lines = `<defs><marker id="pfd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
    + `<polygon points="0,0.8 8,4 0,7.2" fill="${INK}"/></marker>`
    + `<marker id="pfd-arrow-e" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`
    + `<polygon points="0,0.8 8,4 0,7.2" fill="${ENERGY}"/></marker></defs>`;
  let labels = "";
  for (const edge of edges) {
    const no = linkNo(edge.link);
    const isChanged = (edge.link.from && changed.has(edge.link.from)) || (edge.link.to && changed.has(edge.link.to));
    const color = edge.lane === "energy" ? ENERGY : isChanged ? ACCENT : INK;
    const width = edge.lane === "energy" ? 0.35 : edge.link.stream === "" ? 0.5 : 0.7;
    const dash = edge.lane === "energy" ? ` stroke-dasharray="3 1.5"` : edge.link.recycle ? ` stroke-dasharray="4 1.6"` : "";
    const marker = edge.lane === "energy" ? "pfd-arrow-e" : "pfd-arrow";
    lines += `<polyline points="${edge.points}" fill="none" stroke="${color}" stroke-width="${width}"${dash} marker-end="url(#${marker})"/>`;
    if (no !== null) {
      const lx = Math.min(Math.max(edge.mid.x, areaX + 8), areaR - 8);
      const ly = Math.min(Math.max(edge.mid.y, areaTop - 4), areaBot + 8);
      const edgeLabelX = edge.lane === "edge" ? (edge.link.from === null ? areaX + 3 : areaR - 7) : null;
      const nearEdge = edgeLabelX !== null && Math.abs(lx - edgeLabelX) < 30;
      const below = edge.nameBelow ?? edge.lane === "return";
      labels += `<g data-slabel="${no}" data-at="${r2(lx)},${r2(ly)}">`
        + `<rect x="${r2(lx - DIA / 2)}" y="${r2(ly - DIA / 2)}" width="${r2(DIA)}" height="${r2(DIA)}" transform="rotate(45 ${r2(lx)} ${r2(ly)})" fill="${PAPER}" stroke="${color}" stroke-width="0.4"/>`
        + `<text x="${r2(lx)}" y="${r2(ly + diaNum * 0.47)}" font-family="${FONT}" font-size="${r2(diaNum)}" text-anchor="middle" fill="${color}" font-weight="700">${no}</text>`
        + (nearEdge ? "" : `<text x="${r2(lx)}" y="${r2(ly + (below ? DIA / 2 + 6.4 : -(DIA / 2 + 2.4)))}" font-family="${FONT}" font-size="2.1" text-anchor="middle" fill="${color}">${esc(edge.link.stream)}</text>`)
        + `</g>`;
    } else if (edge.link.stream !== "") {
      labels += `<text x="${r2(edge.mid.x)}" y="${r2(edge.mid.y - 2)}" font-family="${FONT}" font-size="2.1" text-anchor="middle" fill="${MUTED}">${esc(edge.link.stream)}</text>`;
    }
    if (edge.lane === "edge") {
      const ex = edge.link.from === null ? areaX + 3 : areaR - 7;
      const anchor = edge.link.from === null ? "start" : "end";
      labels += rowLabel(edge.link.stream, ex, edge.mid.y - 2.4, 2.1, anchor, true, isChanged ? ACCENT : MUTED);
    }
    if (edge.lane === "energy" && edge.link.stream !== "") {
      labels += rowLabel(edge.link.stream, edge.mid.x + 3, areaTop - 5, 2.1, "start", false, ENERGY);
    }
  }

  const title = locale === "ko" ? "공정 흐름도" : "Process flow diagram";
  const streamTitle = locale === "ko" ? "스트림 표" : "Stream table";
  const equipTitle = locale === "ko" ? "장치" : "Equipment";
  const sheetWord = locale === "ko" ? `도면 1 / 1` : `Sheet 1 / 1`;
  const toolWord = "HYSYS Companion";
  const streamNote = locale === "ko" ? "값은 HYSYS에 연결되면 표시돼요" : "Values appear when HYSYS is attached";

  const equipChips = order.map((name) => `${name} · ${kindWord(byName.get(name)!.family, byName.get(name)!.type, locale)}`);
  const chipW = (chip: string): number => 4 + chip.length * 1.35;
  const bandRows: string[][] = [[]];
  let bandUsed = 0;
  for (const chip of equipChips) {
    const w = chipW(chip);
    if (bandUsed + w > areaW - 4 && bandRows[bandRows.length - 1].length > 0) { bandRows.push([]); bandUsed = 0; }
    bandRows[bandRows.length - 1].push(chip);
    bandUsed += w + 3;
  }
  const bandLines = bandRows.slice(0, 2).map((rowItems, ri) => {
    let cx = areaX + 2;
    return rowItems.map((chip) => {
      const w = chipW(chip);
      const s = `<rect x="${r2(cx)}" y="${r2(16 + ri * 6.5)}" width="${r2(w)}" height="5.4" rx="1" fill="none" stroke="${MUTED}" stroke-width="0.3"/>`
        + `<text x="${r2(cx + 2)}" y="${r2(16 + ri * 6.5 + 3.8)}" font-family="${FONT}" font-size="2.1" fill="${INK}">${esc(chip)}</text>`;
      cx += w + 3;
      return s;
    }).join("");
  }).join("");
  const extraChips = equipChips.length - bandRows.slice(0, 2).flat().length;

  let contentBottom = areaTop;
  for (const [name, p] of at) {
    const u = byName.get(name)!;
    contentBottom = Math.max(contentBottom, p.y + unitH(u.family, u.type) + 7);
  }
  for (const edge of edges) {
    const pad = edge.lane === "return" ? DIA / 2 + 11 : edge.lane === "drop" ? DIA / 2 + 3 : 3;
    contentBottom = Math.max(contentBottom, edge.mid.y + pad);
  }
  const linkNote = locale === "ko" ? "연결은 다음 단계에서 그려져요" : "Connections are drawn in the next step";
  const note = unconnected(model)
    ? `<text data-sheet-note="1" x="${areaX + areaW / 2}" y="${r2(Math.min(areaBot - 4, contentBottom + 4))}" font-family="${FONT}" font-size="2.6" text-anchor="middle" fill="${MUTED}">${esc(linkNote)}</text>`
    : "";
  const tableX = 10;
  const tableY = Math.min(250, r2(contentBottom + 10));
  const tableR = 286;
  const tableBot = 289;
  const cols = 5;
  const colW = (tableR - tableX) / cols;
  const rowH = 4.4;
  const perCol = Math.max(1, Math.floor((tableBot - tableY - 8) / rowH));
  let table = `<text x="${tableX}" y="${tableY - 1.5}" font-family="${FONT}" font-size="2.6" font-weight="700" fill="${INK}">${esc(streamTitle)}</text>`;
  model.streams.forEach((s, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    if (col >= cols) return;
    const cx = tableX + col * colW;
    const cy = tableY + 2 + row * rowH;
    const route = `${s.from ?? (locale === "ko" ? "유입" : "in")} → ${s.to ?? (locale === "ko" ? "유출" : "out")}`;
    const shown = col === cols - 1 && row === perCol - 1 && model.streams.length > cols * perCol
      ? `… +${model.streams.length - cols * perCol}`
      : `${s.no} ${s.name} · ${route}`;
    const conds = (model.values[s.name] ?? []).slice(0, 2).join(" · ");
    table += `<text x="${r2(cx + 1)}" y="${r2(cy)}" font-family="${FONT}" font-size="2" fill="${changed.has(s.name) ? ACCENT : INK}">${esc(shown)}${conds ? ` <tspan fill="${MUTED}">${esc(conds)}</tspan>` : ""}</text>`;
  });
  if (!model.streams.some((s) => (model.values[s.name] ?? []).length > 0)) {
    table += `<text x="${tableX}" y="${tableBot}" font-family="${FONT}" font-size="2" fill="${MUTED}">${esc(streamNote)}</text>`;
  }

  const titleBlock = `<g data-titleblock="1">`
    + `<rect x="292" y="255" width="122" height="32" fill="none" stroke="${INK}" stroke-width="0.5"/>`
    + `<line x1="292" y1="263" x2="414" y2="263" stroke="${INK}" stroke-width="0.4"/>`
    + `<line x1="292" y1="271" x2="414" y2="271" stroke="${INK}" stroke-width="0.4"/>`
    + `<line x1="292" y1="279" x2="414" y2="279" stroke="${INK}" stroke-width="0.4"/>`
    + `<text x="296" y="261" font-family="${FONT}" font-size="3.2" font-weight="700" fill="${INK}">${esc(title)}</text>`
    + `<text x="296" y="269" font-family="${FONT}" font-size="2.4" fill="${INK}">${esc(model.caseName || (locale === "ko" ? "이름 없는 케이스" : "Untitled case"))}</text>`
    + `<text x="296" y="277" font-family="${FONT}" font-size="2" fill="${MUTED}">${esc(date)} · ${esc(toolWord)}</text>`
    + `<text x="296" y="285" font-family="${FONT}" font-size="2" fill="${MUTED}">${esc(sheetWord)} · NTS</text>`
    + `</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}mm" height="${SHEET_H}mm" viewBox="0 0 ${SHEET_W} ${SHEET_H}" data-schematic-mode="pfd" font-family="${FONT}">`
    + `<rect x="0" y="0" width="${SHEET_W}" height="${SHEET_H}" fill="${PAPER}"/>`
    + `<rect x="4" y="4" width="${SHEET_W - 8}" height="${SHEET_H - 8}" fill="none" stroke="${INK}" stroke-width="0.6" data-frame="outer"/>`
    + `<rect x="7" y="7" width="${SHEET_W - 14}" height="${SHEET_H - 14}" fill="none" stroke="${INK}" stroke-width="0.25" data-frame="inner"/>`
    + `<text x="${areaX}" y="13" font-family="${FONT}" font-size="2.6" font-weight="700" fill="${INK}">${esc(equipTitle)}${extraChips > 0 ? ` (+${extraChips})` : ""}</text>`
    + bandLines
    + `<g data-drawing="1">${lines}${symbols}${labels}${note}</g>`
    + `<g data-streamtable="1">${table}</g>`
    + titleBlock
    + `</svg>`;
}
