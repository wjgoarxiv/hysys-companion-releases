import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocale, useT, type MessageKey } from "../i18n";
import type { CaseTopology } from "../state/case";
import { PfdView } from "../pfd/PfdView";
import { kindKey, unitFamily } from "../pfd/kinds";
import { ledgerKindOf, questionSuggestion, type DraftItemDetail, type DraftLedger, type DraftQuestion, type DraftTopologyData, type VerifyState } from "./types";

const KEY_LABELS: Record<string, MessageKey> = {
  outlet_P_kPa: "newcase.item.key.outletP",
  outlet_pressure_kPa: "newcase.item.key.outletP",
  outlet_T_C: "newcase.item.key.outletT",
  outlet_temperature_C: "newcase.item.key.outletT",
  target_outlet_T_C: "newcase.item.key.targetOutletT",
  inlet_pressure_kPa: "newcase.item.key.inletP",
  temperature: "newcase.item.key.temperature",
  temperature_C: "newcase.item.key.temperature",
  temp_C: "newcase.item.key.temperature",
  T_C: "newcase.item.key.temperature",
  T_K: "newcase.item.key.temperature",
  pressure: "newcase.item.key.pressure",
  pressure_kPa: "newcase.item.key.pressure",
  P_kPa: "newcase.item.key.pressure",
  pressure_drop_kPa: "newcase.item.key.pressureDrop",
  delta_P_kPa: "newcase.item.key.pressureDrop",
  head_kPa: "newcase.item.key.head",
  duty: "newcase.item.key.duty",
  duty_kW: "newcase.item.key.duty",
  heat_duty_kW: "newcase.item.key.duty",
  energy_kW: "newcase.item.key.energy",
  total_energy_kW: "newcase.item.key.energy",
  flow: "newcase.item.key.flow",
  molar_flow: "newcase.item.key.molarFlow",
  molar_flow_kgmole_h: "newcase.item.key.molarFlow",
  flow_kgmole_h: "newcase.item.key.molarFlow",
  mass_flow: "newcase.item.key.massFlow",
  mass_flow_kgph: "newcase.item.key.massFlow",
  efficiency: "newcase.item.key.efficiency",
  adiabatic_efficiency: "newcase.item.key.adiabaticEfficiency",
  polytropic_efficiency: "newcase.item.key.polytropicEfficiency",
  vapor_fraction: "newcase.item.key.vaporFraction",
  pressure_ratio: "newcase.item.key.pressureRatio",
  compression_ratio: "newcase.item.key.compressionRatio",
  expansion_ratio: "newcase.item.key.expansionRatio",
  ratio: "newcase.item.key.ratio",
  reflux_ratio: "newcase.item.key.refluxRatio",
  stages: "newcase.item.key.stages",
  number_of_stages: "newcase.item.key.stages",
  num_stages: "newcase.item.key.stages",
  n_stages: "newcase.item.key.stages",
  conversion_pct: "newcase.item.key.conversion",
};

const KEY_UNIT_SUFFIX = /_(?:kPa|C|K|kW|pct|kgph|kgmole_h|kmolph)$/i;

export function plainKeyWords(key: string): string {
  const words = key.replace(KEY_UNIT_SUFFIX, "").replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s_]+/).filter(Boolean).map((word) => word.toLowerCase());
  const text = words.join(" ");
  return text ? text[0].toUpperCase() + text.slice(1) : key;
}

const labelKey = (key: string): MessageKey | undefined => (Object.hasOwn(KEY_LABELS, key) ? KEY_LABELS[key] : undefined);

export function itemKeyLabel(key: string, t: (key: MessageKey) => string): string {
  return labelKey(key) ? t(labelKey(key)!) : plainKeyWords(key);
}

const formatNumber = (value: number): string => (Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(5))));

function familyLabel(detail: DraftItemDetail, t: (key: MessageKey) => string): string {
  const family = detail.kind === "unit" ? unitFamily(detail.type) : null;
  return family ? ` · ${t(kindKey(family))}` : "";
}

export function isCardEscape(event: Pick<ReactKeyboardEvent, "key" | "defaultPrevented"> & { nativeEvent: { isComposing: boolean } }): boolean {
  return event.key === "Escape" && !event.defaultPrevented && !event.nativeEvent.isComposing;
}

export function unitVerifyReason(verify: VerifyState | null | undefined, name: string, locale: string): string | null {
  if (!verify || verify.converged) return null;
  const reason = (locale === "ko" ? verify.reason_ko ?? verify.reason_en : verify.reason_en ?? verify.reason_ko)?.trim();
  if (!reason) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}($|[^A-Za-z0-9_-])`).test(reason) ? reason : null;
}

export function DraftItemCard({ detail, name, questions = [], verify = null, ledger, onClose, onPick }: {
  detail: DraftItemDetail | null; name: string; questions?: DraftQuestion[]; verify?: VerifyState | null; ledger?: DraftLedger; onClose: () => void; onPick: (name: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const pfd = card.current?.parentElement ?? null;
    card.current?.focus({ preventScroll: true });
    return () => {
      const back = before?.isConnected ? before : pfd?.isConnected ? pfd : null;
      back?.focus({ preventScroll: true });
    };
  }, []);
  const reason = unitVerifyReason(verify, name, locale);
  const open = questions.flatMap((q) => {
    const [head, unit, field] = q.id.split(":");
    const suggestion = head === "dof" && unit === name ? questionSuggestion(q.raw, locale) : null;
    return suggestion ? [{ key: field ?? q.id, label: q.label === q.id ? "" : q.label, suggestion }] : [];
  });
  const links = (label: string, list: string[]) => list.length > 0 && (
    <p className="wb-item__links">
      <span className="ui-meta">{label}</span>
      {list.map((other) => (
        <button key={other} type="button" className="ui-tag wb-item__link" onClick={() => onPick(other)}>{other}</button>
      ))}
    </p>
  );
  const values = detail?.values ?? [];
  return (
    <section ref={card} tabIndex={-1} className="wb-item wb-pop" data-newcase-item={name} aria-label={t("newcase.item.title", { name })}
      onKeyDown={(event) => { if (isCardEscape(event)) { event.preventDefault(); onClose(); } }}>
      <div className="wb-item__head">
        <strong className="wb-item__name">{name}</strong>
        {detail && <span className="ui-tag wb-item__kind">{t(`pfd.item.kind.${detail.kind}` as MessageKey)}{familyLabel(detail, t)}</span>}
        <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet wb-item__close" onClick={onClose}>{t("pfd.item.close")}</button>
      </div>
      {detail && links(t("pfd.item.in"), detail.inlets)}
      {detail && links(t("pfd.item.out"), detail.outlets)}
      {values.length === 0 && open.length === 0 ? <p className="ui-meta">{t("newcase.item.noValues")}</p> : (
        <dl className="wb-item__values">
          {values.map((row, index) => {
            const source = ledgerKindOf(ledger, detail, row.key);
            return (
            <div key={`${row.key}-${index}`} className="wb-item__row">
              <dt>{itemKeyLabel(row.key, t)}
                {source && <span className="ui-meta wb-source" data-newcase-source={source} title={t("newcase.source.label", { source: t(`newcase.source.${source}` as MessageKey) })}>{t(`newcase.source.${source}` as MessageKey)}</span>}
              </dt>
              <dd className="ui-num">{typeof row.value === "number" ? formatNumber(row.value) : row.value}{row.unit ? ` ${row.unit}` : ""}</dd>
            </div>
            );
          })}
          {open.map((row) => (
            <div key={`q-${row.key}`} className="wb-item__row" data-newcase-item-suggestion>
              <dt>{labelKey(row.key) ? t(labelKey(row.key)!) : row.label || plainKeyWords(row.key)}</dt>
              <dd>{t("newcase.item.suggested", { value: row.suggestion.text })}</dd>
            </div>
          ))}
        </dl>
      )}
      {reason && <p className="ui-meta" data-newcase-item-reason>{t("newcase.item.verifyReason", { reason })}</p>}
      <p className="ui-meta">{t("newcase.item.note")}</p>
    </section>
  );
}

export function DraftTopology({ topology, details, questions, verify, ledger, changed }: {
  topology: DraftTopologyData; details?: Record<string, DraftItemDetail>; questions?: DraftQuestion[]; verify?: VerifyState | null; ledger?: DraftLedger;
  changed?: ReadonlySet<string>;
}) {
  const t = useT();
  const [inspected, setInspected] = useState<string | null>(null);
  const units = topology.units ?? [];
  const streams = topology.streams ?? [];
  const connections = topology.connections ?? [];
  if (connections.length > 0) {
    const full: CaseTopology = {
      units: units.map((unit) => ({ name: unit.name, type: unit.type })),
      streams: streams.map((stream) => ({ name: stream.name, type: stream.type })),
      connections: connections.map((link) => ({ from: link.from, to: link.to, type: link.type })),
    };
    return (
      <div data-newcase="draft-pfd" tabIndex={-1}>
        <PfdView topology={full} flags={changed && changed.size > 0 ? Object.fromEntries([...changed].map((name) => [name, "info" as const])) : undefined} onInspect={(name) => setInspected(name)} />
        {inspected
          ? <DraftItemCard key={inspected} name={inspected} detail={details?.[inspected] ?? null} questions={questions} verify={verify} ledger={ledger}
              onClose={() => setInspected(null)} onPick={(name) => setInspected(name)} />
          : <p className="ui-meta wb-pad" data-newcase-pfd-hint>{t("newcase.item.hint")}</p>}
      </div>
    );
  }
  if (units.length === 0 && streams.length === 0) {
    return <p className="ui-meta" data-newcase="topology-empty">{t("newcase.emptyTopology")}</p>;
  }
  return (
    <div className="wb-topolist" data-newcase="topology">
      {units.length > 0 && (
        <section aria-label={t("newcase.unitsLabel")}>
          <p className="ui-meta">{t("newcase.unitsLabel")} <span className="ui-num">{units.length}</span></p>
          <ul className="wb-chips">
            {units.map((unit, index) => (
              <li key={`${unit.name}-${index}`} data-newcase-unit={unit.name}><span className="ui-tag">{unit.name}</span></li>
            ))}
          </ul>
        </section>
      )}
      {streams.length > 0 && (
        <section aria-label={t("newcase.streamsLabel")}>
          <p className="ui-meta">{t("newcase.streamsLabel")} <span className="ui-num">{streams.length}</span></p>
          <ul className="wb-chips">
            {streams.map((stream, index) => (
              <li key={`${stream.name}-${index}`} data-newcase-stream={stream.name}><span className="ui-tag">{stream.name}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
