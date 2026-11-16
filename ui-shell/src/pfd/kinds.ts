import type { MessageKey } from "../i18n";

export type UnitFamily =
  | "separator" | "heater" | "cooler" | "exchanger" | "compressor" | "expander" | "pump" | "valve" | "mixer" | "splitter" | "column" | "reactor" | "recycle" | "pipe"
  | "controller" | "spreadsheet" | "adjust" | "set" | "balance" | "logic";

const RULES: ReadonlyArray<readonly [RegExp, UnitFamily]> = [
  [/recycle|rcy/, "recycle"],
  [/spreadsheet/, "spreadsheet"],
  [/adjust/, "adjust"],
  [/^set(op)?$/, "set"],
  [/balance/, "balance"],
  [/control|^pid|mpc|cascade|digitalop|ratioop/, "controller"],
  [/selec|logic|python|extension|schedul|stripchart|transferfunc|dynspec/, "logic"],
  [/distill|column|tower|absorb|strip|fractionat|fract|extract/, "column"],
  [/compress/, "compressor"],
  [/expand|turbine/, "expander"],
  [/pump/, "pump"],
  [/valve|vlv/, "valve"],
  [/exchang|\bhx\b|heatx|heatex|lng/, "exchanger"],
  [/cool|condens|chiller/, "cooler"],
  [/heat|reboil|fired/, "heater"],
  [/separat|flash|drum|scrub|knock|vessel|tank|sep\d|\bsep\b|decant/, "separator"],
  [/split|\btee|divider/, "splitter"],
  [/mix/, "mixer"],
  [/reactor|cstr|pfr|gibbs|conversion|equilibrium/, "reactor"],
  [/pipe/, "pipe"],
];

const LOGICAL: ReadonlySet<UnitFamily> = new Set<UnitFamily>(["controller", "spreadsheet", "adjust", "set", "balance", "logic"]);
export const isLogicalFamily = (family: UnitFamily | null): boolean => family !== null && LOGICAL.has(family);

export function unitFamily(rawKind: string): UnitFamily | null {
  const kind = rawKind.toLowerCase();
  for (const [pattern, family] of RULES) if (pattern.test(kind)) return family;
  return null;
}

export const kindKey = (family: UnitFamily): MessageKey => `pfd.kind.${family}`;

export function nameSaysKind(name: string, labels: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return labels.some((label) => label && lower.includes(label.toLowerCase()));
}
