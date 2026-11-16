import { useEffect, useState } from "react";
import { useT, type MessageKey } from "../i18n";
import {
  ADDABLE_KINDS, MAX_REVISION_TEXT, applyEdits, checkEdit, linksOf, revisionReady, suggestName, suggestStreamName,
  type AddableKind, type DraftEdit, type EditProblem, type RevisionDraft,
} from "./revise";
import type { DraftTopologyData } from "./types";

type Tool = "add_unit" | "add_stream" | "connect" | "disconnect" | "remove";
const TOOLS: Tool[] = ["add_unit", "add_stream", "connect", "disconnect", "remove"];

const kindLabel = (kind: string): MessageKey => `newcase.revise.kind.${kind}` as MessageKey;

export function editLine(edit: DraftEdit, t: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  switch (edit.op) {
    case "add_unit": return t("newcase.revise.line.addUnit", { name: edit.name, kind: t(kindLabel(edit.kind)) });
    case "remove_unit": return t("newcase.revise.line.removeUnit", { name: edit.name });
    case "add_stream": {
      const ends = edit.from && edit.to ? t("newcase.revise.line.fromTo", { from: edit.from, to: edit.to })
        : edit.from ? t("newcase.revise.line.from", { from: edit.from }) : edit.to ? t("newcase.revise.line.to", { to: edit.to }) : "";
      return t("newcase.revise.line.addStream", { name: edit.name }) + (ends ? ` ${ends}` : "");
    }
    case "remove_stream": return t("newcase.revise.line.removeStream", { name: edit.name });
    case "connect": return t(edit.side === "in" ? "newcase.revise.line.connectIn" : "newcase.revise.line.connectOut", { stream: edit.stream, unit: edit.unit });
    case "disconnect": return t("newcase.revise.line.disconnect", { stream: edit.stream, unit: edit.unit });
  }
}

export function RevisePanel({ topology, draft, busy, onChange, onSubmit, initialTool = "add_unit", initialOpen = false, openRequest = 0 }: {
  topology: DraftTopologyData; draft: RevisionDraft; busy: boolean;
  onChange: (next: RevisionDraft) => void; onSubmit: () => void; initialTool?: Tool; initialOpen?: boolean;
  openRequest?: number;
}) {
  const t = useT();
  const now = applyEdits(topology, draft.edits);
  const units = now.units.map((unit) => unit.name).filter(Boolean);
  const streams = now.streams.map((stream) => stream.name);
  const [open, setOpen] = useState(initialOpen || revisionReady(draft));
  useEffect(() => { if (openRequest > 0) setOpen(true); }, [openRequest]);
  const [tool, setTool] = useState<Tool>(initialTool);
  const [kind, setKind] = useState<AddableKind>("cooler");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [stream, setStream] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [side, setSide] = useState<"in" | "out">("in");
  const [target, setTarget] = useState("");
  const [problem, setProblem] = useState<EditProblem | null>(null);

  const pickUnit = unit || units[0] || "";
  const unitLinks = pickUnit ? linksOf(now, pickUnit) : [];
  const cut = target && unitLinks.some((link) => link.stream === target) ? target : unitLinks[0]?.stream ?? "";
  const removable = [...units.map((n) => `unit:${n}`), ...streams.map((n) => `stream:${n}`)];
  const removePick = target && removable.includes(target) ? target : removable[0] ?? "";

  const pending = (): DraftEdit | null => {
    switch (tool) {
      case "add_unit": return { op: "add_unit", name: (name || suggestName(now, kind)).trim(), kind };
      case "add_stream": return { op: "add_stream", name: (name || suggestStreamName(now)).trim(), ...(from ? { from } : {}), ...(to ? { to } : {}) };
      case "connect": return pickUnit ? { op: "connect", stream: (stream || streams[0] || "").trim(), unit: pickUnit, side } : null;
      case "disconnect": return pickUnit && cut ? { op: "disconnect", stream: cut, unit: pickUnit } : null;
      case "remove":
        if (!removePick) return null;
        return removePick.startsWith("unit:") ? { op: "remove_unit", name: removePick.slice(5) } : { op: "remove_stream", name: removePick.slice(7) };
    }
  };

  const add = (): void => {
    const edit = pending();
    if (!edit) return;
    const why = checkEdit(topology, draft.edits, edit);
    setProblem(why);
    if (why) return;
    onChange({ ...draft, edits: [...draft.edits, edit] });
    setName("");
    setTarget("");
  };

  const unitSelect = (value: string, set: (v: string) => void, label: MessageKey, optional = false) => (
    <label className="ui-field">
      <span className="ui-field__label">{t(label)}</span>
      <select className="ui-select" value={value} disabled={busy} onChange={(e) => { set(e.target.value); setProblem(null); }}>
        {optional && <option value="">{t("newcase.revise.none")}</option>}
        {units.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );

  if (!open) {
    return (
      <div className="wb-revise wb-revise--closed" data-newcase="revise">
        <p className="wb-revise__ask">{t("newcase.revise.ask")}</p>
        <button type="button" className="ui-btn ui-btn--sm" data-newcase-revise-open disabled={busy} onClick={() => setOpen(true)}>{t("newcase.revise.open")}</button>
      </div>
    );
  }

  const field = (() => {
    switch (tool) {
      case "add_unit":
        return (
          <>
            <label className="ui-field">
              <span className="ui-field__label">{t("newcase.revise.kind")}</span>
              <select className="ui-select" value={kind} disabled={busy} onChange={(e) => { setKind(e.target.value as AddableKind); setProblem(null); }} data-newcase-revise-kind>
                {ADDABLE_KINDS.map((k) => <option key={k} value={k}>{t(kindLabel(k))}</option>)}
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">{t("newcase.revise.name")}</span>
              <input className="ui-input" value={name} placeholder={suggestName(now, kind)} disabled={busy} maxLength={40}
                aria-invalid={problem === "name" || problem === "taken" ? true : undefined} onChange={(e) => { setName(e.target.value); setProblem(null); }} />
            </label>
          </>
        );
      case "add_stream":
        return (
          <>
            <label className="ui-field">
              <span className="ui-field__label">{t("newcase.revise.streamName")}</span>
              <input className="ui-input" value={name} placeholder={suggestStreamName(now)} disabled={busy} maxLength={40}
                aria-invalid={problem === "name" || problem === "taken" ? true : undefined} onChange={(e) => { setName(e.target.value); setProblem(null); }} />
            </label>
            {unitSelect(from, setFrom, "newcase.revise.from", true)}
            {unitSelect(to, setTo, "newcase.revise.to", true)}
          </>
        );
      case "connect":
        return (
          <>
            <label className="ui-field">
              <span className="ui-field__label">{t("newcase.revise.stream")}</span>
              <input className="ui-input" list="wb-revise-streams" value={stream} placeholder={streams[0] ?? suggestStreamName(now)} disabled={busy} maxLength={40}
                onChange={(e) => { setStream(e.target.value); setProblem(null); }} />
              <datalist id="wb-revise-streams">{streams.map((n) => <option key={n} value={n} />)}</datalist>
            </label>
            {unitSelect(pickUnit, setUnit, "newcase.revise.unit")}
            <div className="ui-field">
              <span className="ui-field__label">{t("newcase.revise.side")}</span>
              <div className="ui-segmented" role="group" aria-label={t("newcase.revise.side")}>
                <button type="button" aria-pressed={side === "in"} disabled={busy} onClick={() => setSide("in")}>{t("newcase.revise.sideIn")}</button>
                <button type="button" aria-pressed={side === "out"} disabled={busy} onClick={() => setSide("out")}>{t("newcase.revise.sideOut")}</button>
              </div>
            </div>
          </>
        );
      case "disconnect":
        return (
          <>
            {unitSelect(pickUnit, (v) => { setUnit(v); setTarget(""); }, "newcase.revise.unit")}
            <label className="ui-field">
              <span className="ui-field__label">{t("newcase.revise.link")}</span>
              <select className="ui-select" value={cut} disabled={busy || unitLinks.length === 0} onChange={(e) => { setTarget(e.target.value); setProblem(null); }}>
                {unitLinks.length === 0 && <option value="">{t("newcase.revise.noLinks")}</option>}
                {unitLinks.map((link) => <option key={`${link.side}-${link.stream}`} value={link.stream}>{t(link.side === "in" ? "newcase.revise.linkIn" : "newcase.revise.linkOut", { stream: link.stream })}</option>)}
              </select>
            </label>
          </>
        );
      case "remove":
        return (
          <label className="ui-field">
            <span className="ui-field__label">{t("newcase.revise.removeWhat")}</span>
            <select className="ui-select" value={removePick} disabled={busy || removable.length === 0} onChange={(e) => { setTarget(e.target.value); setProblem(null); }}>
              {units.length > 0 && <optgroup label={t("newcase.unitsLabel")}>{units.map((n) => <option key={`u-${n}`} value={`unit:${n}`}>{n}</option>)}</optgroup>}
              {streams.length > 0 && <optgroup label={t("newcase.streamsLabel")}>{streams.map((n) => <option key={`s-${n}`} value={`stream:${n}`}>{n}</option>)}</optgroup>}
            </select>
          </label>
        );
    }
  })();

  const ready = revisionReady(draft);
  return (
    <section className="wb-revise" data-newcase="revise" aria-labelledby="wb-revise-title">
      <div className="wb-revise__head">
        <h3 className="wb-revise__title" id="wb-revise-title">{t("newcase.revise.title")}</h3>
        <p className="ui-meta">{t("newcase.revise.lead")}</p>
      </div>

      <label className="ui-field wb-revise__words">
        <span className="ui-field__label">{t("newcase.revise.words")}</span>
        <textarea className="ui-textarea" rows={3} maxLength={MAX_REVISION_TEXT} value={draft.text} disabled={busy} data-newcase-revise-text
          placeholder={t("newcase.revise.wordsPlaceholder")} onChange={(e) => onChange({ ...draft, text: e.target.value })} />
      </label>

      <div className="wb-revise__hand">
        <p className="ui-field__label" id="wb-revise-tools">{t("newcase.revise.hand")}</p>
        <div className="ui-segmented wb-revise__tools" role="group" aria-labelledby="wb-revise-tools">
          {TOOLS.map((id) => (
            <button key={id} type="button" aria-pressed={tool === id} disabled={busy} data-newcase-revise-tool={id}
              onClick={() => { setTool(id); setProblem(null); setName(""); setTarget(""); }}>
              <span className="wb-revise__glyph" aria-hidden="true">{GLYPH[id]}</span>{t(`newcase.revise.tool.${id}` as MessageKey)}
            </button>
          ))}
        </div>
        <div className="wb-revise__form" data-newcase-revise-form={tool}>
          {field}
          <button type="button" className="ui-btn wb-revise__add" disabled={busy || pending() === null} onClick={add} data-newcase-revise-add>
            {t("newcase.revise.add")}
          </button>
        </div>
        {problem && <p className="ui-field__error" role="alert" data-newcase-revise-problem={problem}>{t(`newcase.revise.problem.${problem}` as MessageKey)}</p>}
      </div>

      {draft.edits.length > 0 && (
        <div className="wb-revise__list">
          <p className="ui-meta">{t("newcase.revise.listTitle", { n: draft.edits.length })}</p>
          <ol className="wb-revise__edits" data-newcase="revise-edits">
            {draft.edits.map((edit, index) => (
              <li key={`${index}-${edit.op}`} className="wb-pop" data-newcase-revise-edit={edit.op}>
                <span className="wb-revise__n ui-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="wb-revise__line">{editLine(edit, t)}</span>
                <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" disabled={busy}
                  aria-label={t("newcase.revise.undoOne", { line: editLine(edit, t) })}
                  onClick={() => onChange({ ...draft, edits: draft.edits.filter((_, i) => i !== index) })}>{t("newcase.revise.undo")}</button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="ui-form-actions wb-revise__actions">
        <button type="button" className="ui-btn ui-btn--primary" disabled={busy || !ready} onClick={onSubmit} data-newcase-revise-submit>{t("newcase.revise.submit")}</button>
        {ready && <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" disabled={busy} onClick={() => onChange({ text: "", edits: [] })}>{t("newcase.revise.clear")}</button>}
        <span className="ui-meta">{t("newcase.revise.note")}</span>
      </div>
    </section>
  );
}

const GLYPH: Record<Tool, string> = { add_unit: "+□", add_stream: "+→", connect: "⇢", disconnect: "✂", remove: "−" };
