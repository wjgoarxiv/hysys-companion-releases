import type { CaseTopology } from "../state/case";

export type SuggestGroup = "ask" | "change" | "create";
export type Suggestion = { group: SuggestGroup; text: string };
type Loc = "ko" | "en";

const T = {
  ko: {
    streamValues: (s: string) => `${s} 온도와 압력을 알려줘`,
    unitOutlet: (u: string) => `${u} 출구 온도가 몇 도야?`,
    converge: () => "수렴 안 되는 곳을 찾아줘",
    changeOutlet: (u: string) => `${u} 출구 온도를 바꿔줘`,
    valveBetween: (a: string, b: string) => `${a}와 ${b} 사이에 밸브 추가`,
    moreFlow: (s: string) => `${s} 유량을 10% 늘려줘`,
    create: ["물을 40도로 식히는 냉각기 공정 만들어줘", "LNG를 기화시키는 공정 만들어줘", "천연가스에서 물을 빼는 탈수 공정 만들어줘"],
  },
  en: {
    streamValues: (s: string) => `Show the temperature and pressure of ${s}`,
    unitOutlet: (u: string) => `What is the outlet temperature of ${u}?`,
    converge: () => "Find where the case does not converge",
    changeOutlet: (u: string) => `Change the outlet temperature of ${u}`,
    valveBetween: (a: string, b: string) => `Add a valve between ${a} and ${b}`,
    moreFlow: (s: string) => `Increase the flow of ${s} by 10%`,
    create: ["Build a process that cools water to 40 C", "Create an LNG vaporisation process", "Design a natural gas dehydration process"],
  },
};

const loc = (locale: string): Loc => (locale === "en" ? "en" : "ko");
const isEnergy = (type: string) => /energy|heat\s*flow/i.test(type);

function namesOf(topology: CaseTopology) {
  const units = topology.units.map((u) => u.name);
  const unitSet = new Set(units);
  const streams = topology.streams.filter((s) => !isEnergy(s.type)).map((s) => s.name);
  const streamSet = new Set(streams);
  let pair: [string, string] | null = null;
  for (const out of topology.connections) {
    if (!unitSet.has(out.from) || !streamSet.has(out.to)) continue;
    const next = topology.connections.find((c) => c.from === out.to && unitSet.has(c.to) && c.to !== out.from);
    if (next) { pair = [out.from, next.to]; break; }
  }
  const thermal = topology.units.find((u) => /heat|cool|exch|chill|lng|air/i.test(u.type))?.name ?? units[0] ?? null;
  const watched = topology.connections.find((c) => unitSet.has(c.from) && streamSet.has(c.to))?.to ?? streams[0] ?? null;
  return { units, streams, pair, thermal, watched };
}

export function caseSuggestions(topology: CaseTopology, locale: string): Suggestion[] {
  const t = T[loc(locale)];
  const { pair, thermal, watched } = namesOf(topology);
  const ask: Suggestion[] = [];
  const change: Suggestion[] = [];
  if (watched) ask.push({ group: "ask", text: t.streamValues(watched) });
  if (thermal) ask.push({ group: "ask", text: t.unitOutlet(thermal) });
  ask.push({ group: "ask", text: t.converge() });
  if (thermal) change.push({ group: "change", text: t.changeOutlet(thermal) });
  if (pair) change.push({ group: "change", text: t.valveBetween(pair[0], pair[1]) });
  if (watched) change.push({ group: "change", text: t.moreFlow(watched) });
  return [...ask, ...change].slice(0, 6);
}

export function noCaseSuggestions(locale: string): Suggestion[] {
  return T[loc(locale)].create.map((text) => ({ group: "create" as const, text }));
}

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function mentions(text: string, name: string): boolean {
  if (name.length < 2 || /^\d+$/.test(name)) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRe(name)}(?![\\p{Script=Latin}\\p{N}_-])`, "u").test(text);
}

export function followUps(lastText: string, topology: CaseTopology, locale: string): Suggestion[] {
  const t = T[loc(locale)];
  const { units, streams } = namesOf(topology);
  const named = [...units.map((name) => ({ name, unit: true })), ...streams.map((name) => ({ name, unit: false }))]
    .filter((item) => item.name && mentions(lastText, item.name))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (!named) return [];
  return named.unit
    ? [{ group: "ask", text: t.unitOutlet(named.name) }, { group: "change", text: t.changeOutlet(named.name) }]
    : [{ group: "ask", text: t.streamValues(named.name) }, { group: "change", text: t.moreFlow(named.name) }];
}

const fillListeners = new Set<(text: string) => void>();

export function fillCommand(text: string): void {
  fillListeners.forEach((listener) => listener(text));
}

export function mergeFill(current: string, next: string, lastFilled: string | null): string {
  if (current.trim() === "" || current === lastFilled) return next;
  return `${current.trimEnd()}\n${next}`;
}

export function onCommandFill(listener: (text: string) => void): () => void {
  fillListeners.add(listener);
  return () => void fillListeners.delete(listener);
}

export function fillStep(current: string, next: string, lastFilled: string | null): { text: string; lastFilled: string | null } {
  const text = mergeFill(current, next, lastFilled);
  return { text, lastFilled: text === next ? next : null };
}
