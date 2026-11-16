import { useT, type MessageKey } from "../i18n";
import type { DynSetup } from "./api";
import {
  MAX_DYN_SAMPLES, MAX_DYN_STOP_S, draftProblem, formatValue, runCount, targetLabel, unitText, valueKey,
  type Catalog, type CatalogRow, type Draft, type DraftProblem, type DynCandidate, type Target,
} from "./model";

export type DynamicsEditor = { setup: DynSetup | null; preparing: boolean; onLoad: () => void; onPrepare: () => void };

export type StudyEditorProps = {
  catalog: Catalog;
  draft: Draft;
  busy: boolean;
  error?: string | null;
  onChange: (draft: Draft) => void;
  onStart: () => void;
  onClose: () => void;
  dynamics: DynamicsEditor;
};

const MAX_SWEEP_VARIABLES = 2;

const PROBLEM_KEY: Record<DraftProblem, MessageKey> = {
  name: "studies.problem.name", monitors: "studies.problem.monitors", rows: "studies.problem.rows",
  cells: "studies.problem.cells", sweep: "studies.problem.sweep", steps: "studies.problem.steps",
  range: "studies.problem.range", tooMany: "studies.problem.tooMany", timeout: "studies.problem.timeout",
  samples: "studies.problem.samples", stopTime: "studies.problem.stopTime", prepare: "studies.problem.prepare",
};

const sameCandidate = (a: DynCandidate, b: DynCandidate) => a.object === b.object && a.property === b.property;

function DynamicsFields({ draft, dynamics, onChange }: { draft: Draft; dynamics: DynamicsEditor; onChange: (d: Draft) => void }) {
  const t = useT();
  const setup = dynamics.setup;
  const change = (patch: Partial<Draft>) => onChange({ ...draft, ...patch, prepared: null });
  if (!setup || setup.status === "loading") return <p className="ui-meta" role="status">{t("studies.dyn.loading")}</p>;
  if (setup.status === "off") return <p className="ui-meta" data-wb-study-dyn="off">{t("studies.dyn.off")}</p>;
  if (setup.status === "notDynamic") return <p className="ui-meta" data-wb-study-dyn="notDynamic">{t("studies.dyn.notDynamic")}</p>;
  if (setup.status === "error") {
    return (
      <div className="ui-callout ui-callout--negative" role="alert">
        <p>{setup.message}</p>
        <button type="button" className="ui-btn ui-btn--sm" onClick={dynamics.onLoad}>{t("studies.retry")}</button>
      </div>
    );
  }
  return (
    <div className="ui-stack ui-stack--tight" data-wb-study-dyn="ready">
      <label className="ui-field wb-studies__timeout">
        <span className="ui-field__label">{t("studies.dyn.stopTime", { max: MAX_DYN_STOP_S })}</span>
        <input className="ui-input ui-num" inputMode="decimal" defaultValue={draft.stopTimeS ?? ""}
          onChange={(event) => change({ stopTimeS: parseNumber(event.target.value) })} />
      </label>
      <fieldset className="ui-field">
        <legend className="ui-field__label">{t("studies.dyn.samples", { max: MAX_DYN_SAMPLES })}</legend>
        {!setup.candidates.length && <p className="ui-meta">{t("studies.dyn.noCandidates")}</p>}
        {setup.candidates.map((c) => {
          const on = draft.samples.some((x) => sameCandidate(x, c));
          return (
            <label key={`${c.object}:${c.property}`} className="ui-check">
              <input type="checkbox" checked={on} disabled={!on && draft.samples.length >= MAX_DYN_SAMPLES}
                onChange={() => change({ samples: on ? draft.samples.filter((x) => !sameCandidate(x, c)) : [...draft.samples, c] })} />
              <span>{c.label}{c.unit ? ` (${unitText(c.unit)})` : ""}</span>
            </label>
          );
        })}
      </fieldset>
      <span className="ui-meta">{t("studies.dyn.holdNote")}</span>
      {draft.prepared ? (
        <div className="ui-callout ui-callout--info wb-pop" data-wb-study-dyn-plan>
          <p><strong>{t("studies.dyn.confirmTitle")}</strong></p>
          <ul>{draft.prepared.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      ) : (
        <div><button type="button" className="ui-btn ui-btn--sm" data-action="study-dyn-prepare" disabled={dynamics.preparing || !draft.samples.length}
          aria-busy={dynamics.preparing} onClick={dynamics.onPrepare}>{t(dynamics.preparing ? "studies.dyn.preparing" : "studies.dyn.prepare")}</button></div>
      )}
    </div>
  );
}

const sameTarget = (a: Target, b: Target) => valueKey(a) === valueKey(b);

function parseNumber(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function TargetSelect({ rows, label, onPick, value = "" }: { rows: CatalogRow[]; label: string; onPick: (row: CatalogRow) => void; value?: string }) {
  const t = useT();
  return (
    <select className="ui-select" aria-label={label} value={value}
      onChange={(event) => { const row = rows[Number(event.target.value)]; if (row) onPick(row); }}>
      <option value="">{t("studies.editor.pick")}</option>
      {rows.map((row, i) => (
        <option key={valueKey(row)} value={String(i)}>{targetLabel(row)}{row.value !== null ? ` · ${formatValue(row.value)}` : ""}</option>
      ))}
    </select>
  );
}

function Chips({ items, onRemove }: { items: Target[]; onRemove: (index: number) => void }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <ul className="wb-studies__chips">
      {items.map((item, i) => (
        <li key={valueKey(item)} className="ui-tag wb-pop">
          <span>{targetLabel(item)}</span>
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" aria-label={t("studies.editor.remove", { name: targetLabel(item) })} onClick={() => onRemove(i)}>×</button>
        </li>
      ))}
    </ul>
  );
}

function currentOf(catalog: Catalog, target: Target): number | null {
  return catalog.targets.find((row) => sameTarget(row, target))?.value ?? null;
}

function MatrixTable({ catalog, draft, onChange }: { catalog: Catalog; draft: Draft; onChange: (d: Draft) => void }) {
  const t = useT();
  const setCell = (r: number, c: number, value: number | null) =>
    onChange({ ...draft, rows: draft.rows.map((row, i) => (i === r ? { ...row, values: row.values.map((v, j) => (j === c ? value : v)) } : row)) });
  const addRow = () => onChange({ ...draft, rows: [...draft.rows, { id: Math.max(0, ...draft.rows.map((x) => x.id)) + 1, label: "", values: draft.inputs.map((input) => currentOf(catalog, input)) }] });
  if (!draft.inputs.length) return null;
  return (
    <div className="ui-field">
      <span className="ui-field__label">{t("studies.editor.rows")}</span>
      <div className="ui-table-wrap">
        <table className="ui-table ui-table--compact" data-wb-study-matrix>
          <thead>
            <tr>
              <th scope="col">{t("studies.editor.rowLabel")}</th>
              {draft.inputs.map((input) => <th key={valueKey(input)} scope="col" className="is-num">{targetLabel(input)}</th>)}
              <th scope="col"><span className="ui-visually-hidden">{t("studies.editor.remove", { name: "" })}</span></th>
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row, r) => (
              <tr key={row.id}>
                <td>
                  <input className="ui-input" value={row.label} maxLength={60} placeholder={String(r + 1)} aria-label={`${t("studies.editor.rowLabel")} ${r + 1}`}
                    onChange={(event) => onChange({ ...draft, rows: draft.rows.map((x, i) => (i === r ? { ...x, label: event.target.value } : x)) })} />
                </td>
                {draft.inputs.map((input, c) => (
                  <td key={valueKey(input)} className="is-num">
                    <input className="ui-input ui-num" inputMode="decimal" aria-label={`${targetLabel(input)} ${r + 1}`}
                      defaultValue={row.values[c] === null ? "" : String(row.values[c])}
                      onChange={(event) => setCell(r, c, parseNumber(event.target.value))} />
                  </td>
                ))}
                <td>
                  <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" aria-label={t("studies.editor.removeRow", { n: r + 1 })}
                    onClick={() => onChange({ ...draft, rows: draft.rows.filter((_, i) => i !== r) })}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><button type="button" className="ui-btn ui-btn--sm" data-action="study-add-row" onClick={addRow}>{t("studies.editor.addRow")}</button></div>
    </div>
  );
}

function SweepVariables({ catalog, writable, draft, onChange }: { catalog: Catalog; writable: CatalogRow[]; draft: Draft; onChange: (d: Draft) => void }) {
  const t = useT();
  const setVar = (i: number, patch: Partial<Draft["sweep"][number]>) =>
    onChange({ ...draft, sweep: draft.sweep.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  return (
    <div className="ui-stack ui-stack--tight">
      {draft.sweep.map((v, i) => {
        const now = v.target ? currentOf(catalog, v.target) : null;
        const unit = v.target ? unitText(v.target.unit) : "";
        const picked = v.target ? String(writable.findIndex((row) => sameTarget(row, v.target as Target))) : "";
        return (
          <fieldset key={i} className="wb-studies__var">
            <legend className="ui-field__label">{t("studies.editor.variable", { n: i + 1 })}</legend>
            <TargetSelect rows={writable} label={t("studies.editor.variable", { n: i + 1 })} value={picked}
              onPick={(row) => setVar(i, { target: row, min: v.min ?? row.value, max: v.max })} />
            {now !== null && <span className="ui-meta ui-num">{t("studies.editor.current", { value: `${formatValue(now)} ${unit}`.trim() })}</span>}
            <div className="wb-studies__range">
              <label className="ui-field">
                <span className="ui-field__label">{t("studies.editor.min")}</span>
                <input className="ui-input ui-num" inputMode="decimal" defaultValue={v.min ?? ""} key={`min-${picked}`}
                  onChange={(event) => setVar(i, { min: parseNumber(event.target.value) })} />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">{t("studies.editor.max")}</span>
                <input className="ui-input ui-num" inputMode="decimal" defaultValue={v.max ?? ""}
                  onChange={(event) => setVar(i, { max: parseNumber(event.target.value) })} />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">{t("studies.editor.steps")}</span>
                <input className="ui-input ui-num" inputMode="numeric" defaultValue={v.steps ?? ""}
                  onChange={(event) => setVar(i, { steps: parseNumber(event.target.value) })} />
              </label>
            </div>
            {draft.sweep.length > 1 && (
              <div><button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={() => onChange({ ...draft, sweep: draft.sweep.filter((_, j) => j !== i) })}>
                {t("studies.editor.remove", { name: t("studies.editor.variable", { n: i + 1 }) })}
              </button></div>
            )}
          </fieldset>
        );
      })}
      {draft.sweep.length < MAX_SWEEP_VARIABLES && (
        <div><button type="button" className="ui-btn ui-btn--sm" onClick={() => onChange({ ...draft, sweep: [...draft.sweep, { target: null, min: null, max: null, steps: 5 }] })}>
          {t("studies.editor.addVariable")}
        </button></div>
      )}
    </div>
  );
}

export function StudyEditor({ catalog, draft, busy, error, onChange, onStart, onClose, dynamics }: StudyEditorProps) {
  const t = useT();
  const writable = catalog.targets.filter((row) => row.writable);
  const readable = catalog.targets;
  const problem = draftProblem(draft, catalog.limits);
  const limits = catalog.limits;
  const problemText = problem
    ? t(PROBLEM_KEY[problem], { min: problem === "timeout" ? limits.minTimeout : limits.minSteps, max: problem === "timeout" ? limits.maxTimeout : problem === "tooMany" ? limits.maxRuns : limits.maxSteps })
    : null;
  const addInput = (row: CatalogRow) => {
    if (draft.inputs.some((x) => sameTarget(x, row))) return;
    onChange({ ...draft, inputs: [...draft.inputs, row], rows: draft.rows.map((r) => ({ ...r, values: [...r.values, row.value] })) });
  };
  return (
    <form className="ui-panel wb-studies__editor" data-wb-study-editor aria-label={t("studies.editor.title")}
      onSubmit={(event) => { event.preventDefault(); if (!busy && !problem) onStart(); }}>
      <div className="ui-panel__head">
        <h2 className="ui-panel__title">{t("studies.editor.title")}</h2>
        <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={onClose}>{t("studies.editor.close")}</button>
      </div>
      <div className="ui-stack">
        <label className="ui-field">
          <span className="ui-field__label">{t("studies.editor.name")}</span>
          <input className="ui-input" value={draft.name} maxLength={80} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
        </label>
        <fieldset className="ui-field">
          <legend className="ui-field__label">{t("studies.editor.kind")}</legend>
          <div className="ui-segmented">
            {(["matrix", "sweep", "dynamics"] as const).map((kind) => (
              <button key={kind} type="button" aria-pressed={draft.kind === kind} data-kind={kind}
                onClick={() => { onChange({ ...draft, kind }); if (kind === "dynamics" && !dynamics.setup) dynamics.onLoad(); }}>{t(`studies.kind.${kind}`)}</button>
            ))}
          </div>
          <span className="ui-meta">{t(`studies.editor.kind.${draft.kind}Hint`)}</span>
        </fieldset>

        {draft.kind === "matrix" && (
          <div className="ui-field">
            <span className="ui-field__label">{t("studies.editor.inputs")}</span>
            <Chips items={draft.inputs} onRemove={(i) => onChange({
              ...draft, inputs: draft.inputs.filter((_, j) => j !== i), rows: draft.rows.map((r) => ({ ...r, values: r.values.filter((_, j) => j !== i) })),
            })} />
            <TargetSelect rows={writable} label={t("studies.editor.inputs")} onPick={addInput} />
            <span className="ui-meta">{t("studies.editor.inputs.hint")}</span>
          </div>
        )}
        {draft.kind === "matrix" && <MatrixTable catalog={catalog} draft={draft} onChange={onChange} />}
        {draft.kind === "sweep" && <SweepVariables catalog={catalog} writable={writable} draft={draft} onChange={onChange} />}
        {draft.kind === "dynamics" && <DynamicsFields draft={draft} dynamics={dynamics} onChange={onChange} />}

        {draft.kind !== "dynamics" && <>
        <div className="ui-field">
          <span className="ui-field__label">{t("studies.editor.monitors")}</span>
          <Chips items={draft.monitors} onRemove={(i) => onChange({ ...draft, monitors: draft.monitors.filter((_, j) => j !== i) })} />
          <TargetSelect rows={readable} label={t("studies.editor.monitors")}
            onPick={(row) => { if (!draft.monitors.some((x) => sameTarget(x, row))) onChange({ ...draft, monitors: [...draft.monitors, row] }); }} />
          <span className="ui-meta">{t("studies.editor.monitors.hint")}</span>
        </div>

        <label className="ui-check">
          <input type="checkbox" checked={draft.includeBase} onChange={(event) => onChange({ ...draft, includeBase: event.target.checked })} />
          <span>{t("studies.editor.includeBase")}</span>
        </label>
        <label className="ui-field wb-studies__timeout">
          <span className="ui-field__label">{t("studies.editor.timeout")}</span>
          <input className="ui-input ui-num" inputMode="numeric" defaultValue={draft.timeoutS}
            onChange={(event) => onChange({ ...draft, timeoutS: parseNumber(event.target.value) ?? Number.NaN })} />
        </label>
        <label className="ui-check">
          <input type="checkbox" checked={draft.keepCopies} onChange={(event) => onChange({ ...draft, keepCopies: event.target.checked })} />
          <span>{t("studies.editor.keepCopies")}</span>
        </label>
        </>}

        <p className="ui-meta ui-num" data-wb-study-count>{t("studies.editor.count", { count: runCount(draft), max: limits.maxRuns })}</p>
        <p className="ui-meta">{t("studies.editor.queueNote")}</p>
        {problemText && <p className="ui-meta" data-wb-study-problem={problem}>{problemText}</p>}
        {error && <div className="ui-callout ui-callout--negative" role="alert"><p>{error}</p></div>}
        <div className="ui-cluster">
          <button type="submit" className="ui-btn ui-btn--primary" data-action="study-start" disabled={busy || problem !== null} aria-busy={busy}>
            {busy ? t("studies.editor.starting") : t(draft.kind === "dynamics" ? "studies.dyn.confirmStart" : "studies.editor.startNow")}
          </button>
        </div>
      </div>
    </form>
  );
}
