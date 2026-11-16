import { useEffect, useState } from "react";
import { getJson } from "../api/client";
import { useT, type MessageKey } from "../i18n";
import { formatValue } from "../studies/model";
import { SkeletonRows } from "../screens/Screen";
import { kindKey, unitFamily } from "./kinds";

export type CaseItem = {
  name: string;
  kind: "unit" | "stream" | "energy";
  type: string;
  inlets: string[];
  outlets: string[];
  values: { key: string; value: number | string; unit: string; label?: string }[];
  derived?: boolean;
};

const PROP_KEYS: Record<string, MessageKey> = {
  Temperature: "pfd.item.prop.temperature",
  Pressure: "pfd.item.prop.pressure",
  MolarFlow: "pfd.item.prop.molarFlow",
  MassFlow: "pfd.item.prop.massFlow",
  VapourFraction: "pfd.item.prop.vapourFraction",
  HeatFlow: "pfd.item.prop.duty",
  Duty: "pfd.item.prop.duty",
  PressureDrop: "pfd.item.prop.pressureDrop",
  DeltaP: "pfd.item.prop.pressureDrop",
  Efficiency: "pfd.item.prop.efficiency",
  AdiabaticEfficiency: "pfd.item.prop.adiabaticEfficiency",
  EnergyFlow: "pfd.item.prop.power",
  Power: "pfd.item.prop.power",
  MolecularWeight: "pfd.item.prop.molecularWeight",
  MassDensity: "pfd.item.prop.massDensity",
  MolarDensity: "pfd.item.prop.molarDensity",
  ActVolFlow: "pfd.item.prop.actVolFlow",
  MassEnthalpy: "pfd.item.prop.massEnthalpy",
  MassEntropy: "pfd.item.prop.massEntropy",
  MolarEntropy: "pfd.item.prop.molarEntropy",
  Viscosity: "pfd.item.prop.viscosity",
  ThermalConductivity: "pfd.item.prop.thermalConductivity",
  StdGasFlow: "pfd.item.prop.stdGasFlow",
  ActGasFlow: "pfd.item.prop.actGasFlow",
};

export const itemPath = (fileSessionId: string, name: string): string =>
  `demo:case/item?file_session_id=${encodeURIComponent(fileSessionId)}&name=${encodeURIComponent(name)}`;

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; item: CaseItem };

export function ItemCard({ fileSessionId, name, onClose, onPick, read = (path) => getJson<CaseItem>(path) }: {
  fileSessionId: string; name: string; onClose: () => void; onPick: (name: string) => void;
  read?: (path: string) => Promise<CaseItem>;
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  useEffect(() => {
    let live = true;
    setLoad({ status: "loading" });
    read(itemPath(fileSessionId, name))
      .then((item) => { if (live) setLoad({ status: "ready", item }); })
      .catch(() => { if (live) setLoad({ status: "error" }); });
    return () => { live = false; };
  }, [fileSessionId, name]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ItemCardView name={name} load={load} onClose={onClose} onPick={onPick} />;
}

function typeLabel(item: CaseItem, t: (key: MessageKey) => string): string {
  const family = item.kind === "unit" ? unitFamily(item.type) : null;
  return family ? ` · ${t(kindKey(family))}` : "";
}

export function ItemCardView({ name, load, onClose, onPick }: { name: string; load: Load; onClose: () => void; onPick: (name: string) => void }) {
  const t = useT();
  const item = load.status === "ready" ? load.item : null;
  const links = (label: string, names: string[]) => names.length > 0 && (
    <p className="wb-item__links">
      <span className="ui-meta">{label}</span>
      {names.map((other) => (
        <button key={other} type="button" className="ui-tag wb-item__link" onClick={() => onPick(other)}>{other}</button>
      ))}
    </p>
  );
  return (
    <section className="wb-item wb-pop" data-wb-item={name} aria-label={t("pfd.item.title", { name })}>
      <div className="wb-item__head">
        <strong className="wb-item__name">{name}</strong>
        {item && <span className="ui-tag wb-item__kind">{t(`pfd.item.kind.${item.kind}` as MessageKey)}{typeLabel(item, t)}</span>}
        <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet wb-item__close" onClick={onClose}>{t("pfd.item.close")}</button>
      </div>
      {load.status === "loading" && <><p className="ui-meta" role="status">{t("pfd.item.loading")}</p><SkeletonRows count={3} /></>}
      {load.status === "error" && <p className="ui-meta" role="alert">{t("pfd.item.error")}</p>}
      {item && (
        <>
          {links(t("pfd.item.in"), item.inlets)}
          {links(t("pfd.item.out"), item.outlets)}
          {item.values.length === 0 ? <p className="ui-meta">{t("pfd.item.noValues")}</p> : (
            <dl className="wb-item__values">
              {item.values.map((row) => (
                <div key={row.key} className="wb-item__row">
                  <dt>{row.label ?? (PROP_KEYS[row.key] ? t(PROP_KEYS[row.key]) : row.key)}</dt>
                  <dd className="ui-num">{typeof row.value === "number" ? formatValue(row.value) : row.value}{row.unit ? ` ${row.unit}` : ""}</dd>
                </div>
              ))}
            </dl>
          )}
          {item.derived && item.values.length > 0 && <p className="ui-meta" data-wb-item-derived>{t("pfd.item.derived")}</p>}
        </>
      )}
    </section>
  );
}
