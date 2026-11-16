
export type PfdKind = "vessel" | "pump" | "compressor" | "cooler" | "heater" | "valve" | "mixer";
export type PfdUnit = { id: string; kind: PfdKind; x: number; y: number; label: string; labelAt?: [number, number] };
export type PfdStream = { points: [number, number][]; name: string; note?: string; at: [number, number]; energy?: boolean };
export type PfdDemo = {
  id: string;
  title: { ko: string; en: string };
  about: { ko: string; en: string };
  units: PfdUnit[];
  streams: PfdStream[];
};

export const PFD_W = 960;
export const PFD_H = 540;

export const PFD_DEMOS: readonly PfdDemo[] = [
  {
    id: "lng-vaporization",
    title: { ko: "LNG 기화·송출", en: "LNG vaporisation and send-out" },
    about: { ko: "펌프로 승압한 LNG를 기화기와 트림 히터로 데워 천연가스로 보내요.", en: "LNG is pumped up, vaporised and trim-heated into send-out gas." },
    units: [
      { id: "P-100", kind: "pump", x: 230, y: 270, label: "P-100 LNG Pump" },
      { id: "E-100", kind: "heater", x: 470, y: 270, label: "E-100 Vaporizer" },
      { id: "E-101", kind: "heater", x: 690, y: 270, label: "E-101 Trim Heater" },
    ],
    streams: [
      { points: [[40, 270], [206, 270]], name: "LNG Feed", note: "-160 °C · 600 kPa · 50,000 kg/h · C1 92% C2 5% C3 3%", at: [40, 218] },
      { points: [[254, 270], [444, 270]], name: "HP LNG", note: "7,000 kPa", at: [290, 246] },
      { points: [[496, 270], [664, 270]], name: "Cold NG", note: "-10 °C", at: [530, 246] },
      { points: [[716, 270], [920, 270]], name: "Send-out NG", note: "5 °C · 6,900 kPa", at: [750, 246] },
    ],
  },
  {
    id: "gas-compression",
    title: { ko: "가스 압축·냉각·분리", en: "Gas compression, cooling and knock-out" },
    about: { ko: "가스를 압축한 뒤 공랭식으로 식히고, 생긴 응축액을 분리기에서 빼요.", en: "Gas is compressed, after-cooled, and the condensate is knocked out." },
    units: [
      { id: "K-100", kind: "compressor", x: 230, y: 300, label: "K-100 Compressor" },
      { id: "E-100", kind: "cooler", x: 460, y: 300, label: "E-100 After-cooler" },
      { id: "V-100", kind: "vessel", x: 680, y: 300, label: "V-100 Separator", labelAt: [573, 384] },
    ],
    streams: [
      { points: [[40, 300], [200, 300]], name: "Feed Gas", note: "30 °C · 200 kPa · 10,000 kg/h · C1 80% C2 10% C3 6% nC4 4%", at: [40, 232] },
      { points: [[260, 300], [434, 300]], name: "Hot Gas", note: "1,000 kPa", at: [290, 276] },
      { points: [[486, 300], [650, 300]], name: "Cooled Gas", note: "40 °C", at: [510, 276] },
      { points: [[680, 240], [680, 150], [920, 150]], name: "Product Gas", at: [740, 136] },
      { points: [[680, 360], [680, 450], [920, 450]], name: "Condensate", at: [740, 436] },
      { points: [[230, 180], [230, 280]], name: "Q-K100", at: [242, 196], energy: true },
    ],
  },
  {
    id: "two-stage-flash",
    title: { ko: "2단 플래시 분리", en: "Two-stage flash separation" },
    about: { ko: "원료를 데워 고압 분리기에서 한 번, 밸브로 감압해 저압 분리기에서 또 한 번 나눠요.", en: "Heated feed splits in an HP separator, then again after a let-down valve in an LP separator." },
    units: [
      { id: "E-100", kind: "heater", x: 190, y: 300, label: "E-100 Feed Heater" },
      { id: "V-100", kind: "vessel", x: 400, y: 300, label: "V-100 HP Separator", labelAt: [279, 384] },
      { id: "VLV-100", kind: "valve", x: 570, y: 420, label: "VLV-100" },
      { id: "V-101", kind: "vessel", x: 760, y: 360, label: "V-101 LP Separator", labelAt: [639, 500] },
    ],
    streams: [
      { points: [[30, 300], [164, 300]], name: "Feed", note: "25 °C · 3,000 kPa · 20,000 kg/h · C1 40% C3 20% nC5 20% nC7 20%", at: [24, 220] },
      { points: [[216, 300], [370, 300]], name: "Hot Feed", note: "80 °C", at: [236, 276] },
      { points: [[400, 240], [400, 120], [920, 120]], name: "HP Gas", at: [460, 106] },
      { points: [[400, 360], [400, 420], [554, 420]], name: "HP Liquid", at: [410, 446] },
      { points: [[586, 420], [730, 420]], name: "LP Feed", note: "500 kPa", at: [610, 396] },
      { points: [[760, 300], [760, 220], [920, 220]], name: "LP Gas", at: [790, 206] },
      { points: [[760, 420], [760, 490], [920, 490]], name: "LP Liquid", at: [790, 476] },
    ],
  },
  {
    id: "propane-refrigeration",
    title: { ko: "프로판 냉동 사이클", en: "Propane refrigeration loop" },
    about: { ko: "압축 → 응축 → 팽창 밸브 → 칠러로 도는 닫힌 냉동 루프예요.", en: "A closed loop: compressor, condenser, expansion valve and chiller." },
    units: [
      { id: "K-100", kind: "compressor", x: 250, y: 150, label: "K-100 Compressor", labelAt: [250, 100] },
      { id: "E-100", kind: "cooler", x: 700, y: 150, label: "E-100 Condenser", labelAt: [810, 198] },
      { id: "VLV-100", kind: "valve", x: 700, y: 390, label: "VLV-100 JT Valve" },
      { id: "E-101", kind: "heater", x: 250, y: 390, label: "E-101 Chiller", labelAt: [156, 395] },
    ],
    streams: [
      { points: [[280, 150], [674, 150]], name: "Hot Vapour", note: "1,500 kPa", at: [380, 126] },
      { points: [[700, 176], [700, 374]], name: "Condensed C3", note: "45 °C · 1,450 kPa · 5,000 kg/h · 100% propane", at: [716, 270] },
      { points: [[684, 390], [276, 390]], name: "Cold Mix", note: "-35 °C", at: [420, 366] },
      { points: [[250, 364], [250, 230], [200, 230], [200, 150], [220, 150]], name: "Return Vapour", at: [60, 226] },
      { points: [[250, 500], [250, 416]], name: "Q-Chiller", at: [262, 490], energy: true },
    ],
  },
  {
    id: "mix-letdown",
    title: { ko: "두 원료 혼합·감압·분리", en: "Mixing, let-down and separation" },
    about: { ko: "두 가스를 섞어 밸브로 압력을 낮춘 뒤, 기체와 액체로 나눠요.", en: "Two feeds are mixed, let down through a valve and split into gas and liquid." },
    units: [
      { id: "MIX-100", kind: "mixer", x: 280, y: 290, label: "MIX-100" },
      { id: "VLV-100", kind: "valve", x: 480, y: 290, label: "VLV-100" },
      { id: "V-100", kind: "vessel", x: 700, y: 290, label: "V-100 Separator", labelAt: [593, 372] },
    ],
    streams: [
      { points: [[40, 180], [240, 180], [240, 278], [266, 284]], name: "Feed-1", note: "40 °C · 5,000 kPa · 8,000 kg/h · C1 85% C2 10% C3 5%", at: [40, 128] },
      { points: [[40, 400], [240, 400], [240, 302], [266, 296]], name: "Feed-2", note: "60 °C · 5,000 kPa · 4,000 kg/h · C3 50% nC4 50%", at: [40, 432] },
      { points: [[298, 290], [464, 290]], name: "Mixed", at: [330, 276] },
      { points: [[496, 290], [670, 290]], name: "Let-down", note: "1,500 kPa", at: [520, 266] },
      { points: [[700, 230], [700, 140], [920, 140]], name: "Vapour", at: [740, 126] },
      { points: [[700, 350], [700, 440], [920, 440]], name: "Liquid", at: [740, 426] },
    ],
  },
];

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function unitShape(u: PfdUnit): string {
  const { x, y } = u;
  switch (u.kind) {
    case "vessel":
      return `<rect x="${x - 30}" y="${y - 60}" width="60" height="120" rx="28" class="eq"/>`;
    case "pump":
      return `<circle cx="${x}" cy="${y}" r="24" class="eq"/><path d="M${x - 14} ${y + 30} L${x + 14} ${y + 30} L${x} ${y + 22} Z" class="eq"/>`;
    case "compressor":
      return `<path d="M${x - 30} ${y - 30} L${x + 30} ${y - 14} L${x + 30} ${y + 14} L${x - 30} ${y + 30} Z" class="eq"/>`;
    case "cooler":
    case "heater":
      return `<circle cx="${x}" cy="${y}" r="26" class="eq"/><path d="M${x - 20} ${y + 12} L${x - 8} ${y - 12} L${x + 2} ${y + 12} L${x + 12} ${y - 12} L${x + 20} ${y}" class="ln"/>`;
    case "valve":
      return `<path d="M${x - 16} ${y - 11} L${x + 16} ${y + 11} L${x + 16} ${y - 11} L${x - 16} ${y + 11} Z" class="eq"/>`;
    case "mixer":
      return `<path d="M${x - 14} ${y - 18} L${x + 18} ${y} L${x - 14} ${y + 18} Z" class="eq"/>`;
  }
}

function unitLabelX(u: PfdUnit): number {
  return u.labelAt ? u.labelAt[0] : u.x;
}

function unitLabelY(u: PfdUnit): number {
  if (u.labelAt) return u.labelAt[1];
  return u.kind === "vessel" ? u.y + 82 : u.kind === "pump" ? u.y + 52 : u.y + 48;
}

const NOTE_LINE_CHARS = 24;

export function noteLines(note: string | undefined): string[] {
  if (!note) return [];
  const lines: string[] = [];
  for (const part of note.split(" · ")) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 3 + part.length <= NOTE_LINE_CHARS) { lines[last] += ` · ${part}`; continue; }
    let line = "";
    const words = part.split(" ").reduce<string[]>((acc, word) => {
      if (acc.length && /%$|^(°C|kPa|kg\/h)$/.test(word)) acc[acc.length - 1] += ` ${word}`;
      else acc.push(word);
      return acc;
    }, []);
    for (const word of words) {
      if (line && line.length + 1 + word.length > NOTE_LINE_CHARS) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}

export type LabelBox = { text: string; left: number; top: number; right: number; bottom: number };

export function pfdLabelBoxes(demo: PfdDemo): LabelBox[] {
  const boxes: LabelBox[] = [];
  for (const s of demo.streams) {
    const [lx, ly] = s.at;
    boxes.push({ text: s.name, left: lx, top: ly - 12, right: lx + s.name.length * 8.4, bottom: ly + 3 });
    noteLines(s.note).forEach((line, i) => {
      const y = ly + 16 + i * 14;
      boxes.push({ text: line, left: lx, top: y - 10, right: lx + line.length * 6.4, bottom: y + 3 });
    });
  }
  for (const u of demo.units) {
    const y = unitLabelY(u);
    const half = (u.label.length * 9) / 2;
    const x = unitLabelX(u);
    boxes.push({ text: u.label, left: x - half, top: y - 12, right: x + half, bottom: y + 3 });
  }
  return boxes;
}

export function pfdSvg(demo: PfdDemo): string {
  const streams = demo.streams.map((s) => {
    const d = s.points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`).join(" ");
    const [lx, ly] = s.at;
    const note = noteLines(s.note).map((line, i) => `<text x="${lx}" y="${ly + 16 + i * 14}" class="note">${esc(line)}</text>`).join("");
    return `<path d="${d}" class="${s.energy ? "en" : "st"}" marker-end="url(#${s.energy ? "ae" : "a"})"/><text x="${lx}" y="${ly}" class="sname">${esc(s.name)}</text>${note}`;
  }).join("");
  const units = demo.units.map((u) => `${unitShape(u)}<text x="${unitLabelX(u)}" y="${unitLabelY(u)}" class="ulabel">${esc(u.label)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PFD_W} ${PFD_H}" width="${PFD_W}" height="${PFD_H}">` +
    `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#111"/></marker>` +
    `<marker id="ae" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#c2410c"/></marker>` +
    `<style>.eq{fill:#fff;stroke:#111;stroke-width:2}.ln{fill:none;stroke:#111;stroke-width:1.6}.st{fill:none;stroke:#111;stroke-width:2}` +
    `.en{fill:none;stroke:#c2410c;stroke-width:1.6;stroke-dasharray:6 4}text{font-family:Arial,Helvetica,sans-serif;fill:#111}` +
    `.ulabel{font-size:15px;font-weight:700;text-anchor:middle}` +
    `.sname{font-size:14px;font-weight:700}.note{font-size:12px;fill:#333}.title{font-size:13px;fill:#444}</style></defs>` +
    `<rect width="${PFD_W}" height="${PFD_H}" fill="#fff"/><rect x="8" y="8" width="${PFD_W - 16}" height="${PFD_H - 16}" fill="none" stroke="#999"/>` +
    streams + units +
    `<text x="${PFD_W - 20}" y="${PFD_H - 20}" class="title" text-anchor="end">DEMO PFD · ${esc(demo.title.en)}</text></svg>`;
}

export const pfdDataUrl = (demo: PfdDemo): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pfdSvg(demo))}`;
