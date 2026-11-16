import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useT, type MessageKey } from "../i18n";
import { staggerStyle } from "../motion";
import { SkeletonRows } from "../screens/Screen";
import {
  formatQuantity, formatRelative, formatSignedQuantity, formatUnknown, formatVersionTime, newestFirst, structureEmpty,
  otherCaseFile, unreadableMessageKey, valueLabelKey, type UnreadableRow, type VersionDiff, type VersionEntry, type VersionSource,
} from "./model";

export type VersionsViewProps = {
  caseStatus: "loading" | "detached" | "error" | "ready";
  caseMessage?: string | null;
  listStatus: "idle" | "loading" | "error" | "ready";
  listError?: string | null;
  entries: VersionEntry[];
  unreadable: UnreadableRow[];
  selected: string[];
  diff: VersionDiff | null;
  diffLoading?: boolean;
  diffError?: string | null;
  layout: "panel" | "wide";
  openFile?: string | null;
  snapshotLabel: string;
  snapshotNote: string;
  snapshotBusy: boolean;
  snapshotOpen?: boolean;
  editingId: string | null;
  draftLabel: string;
  draftNote: string;
  restoreId: string | null;
  restoreBusy: boolean;
  restoredName: string | null;
  actionError?: string | null;
  onRetryCase: () => void;
  onRetry: () => void;
  onRetryDiff?: () => void;
  onToggle: (id: string) => void;
  onComparePrevious: (id: string) => void;
  onSnapshotLabel: (value: string) => void;
  onSnapshotNote: (value: string) => void;
  onSnapshot: () => void;
  onEdit: (id: string) => void;
  onDraftLabel: (value: string) => void;
  onDraftNote: (value: string) => void;
  onEditKey: (key: string) => void;
  onAskRestore: (id: string) => void;
  onCancelRestore: () => void;
  onConfirmRestore: () => void;
};

const SOURCE_KEY: Record<VersionSource, MessageKey> = {
  agent: "versions.source.agent",
  user: "versions.source.user",
  auto: "versions.source.auto",
};

function Alert({ children, onRetry, retryLabel }: { children: ReactNode; onRetry?: () => void; retryLabel: string }) {
  return (
    <div className="ui-callout ui-callout--negative" role="alert">
      <p>{children}</p>
      {onRetry && <button type="button" className="ui-btn ui-btn--sm" onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}

export function resetSnapshotDraft(props: Pick<VersionsViewProps, "onSnapshotLabel" | "onSnapshotNote">) {
  props.onSnapshotLabel("");
  props.onSnapshotNote("");
}

function SnapshotControl(props: VersionsViewProps) {
  const t = useT();
  const [open, setOpen] = useState(props.snapshotOpen === true);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !props.snapshotBusy && !props.actionError) setOpen(false);
    wasBusy.current = props.snapshotBusy;
  }, [props.snapshotBusy, props.actionError]);
  const label = props.snapshotBusy ? t("versions.snapshot.working") : t("versions.snapshot");
  return (
    <>
      <div className="wb-versions__bar">
        <h1 className="ui-visually-hidden">{t("screen.versions.title")}</h1>
        {props.caseStatus === "ready" && (
          <button type="button" className="ui-btn ui-btn--sm" data-action="snapshot"
            aria-expanded={open} aria-busy={props.snapshotBusy} disabled={props.snapshotBusy}
            onClick={() => { if (!open) resetSnapshotDraft(props); setOpen((value) => !value); }}>
            {label}
          </button>
        )}
      </div>
      {props.caseStatus === "ready" && open && (
        <form className="wb-versions__snap" onSubmit={(event) => { event.preventDefault(); if (!props.snapshotBusy) props.onSnapshot(); }}>
          <label className="ui-field">
            <span className="ui-field__label">{t("versions.label.optional")}</span>
            <input className="ui-input" value={props.snapshotLabel} maxLength={200} onChange={(event) => props.onSnapshotLabel(event.target.value)} />
          </label>
          <label className="ui-field">
            <span className="ui-field__label">{t("versions.note.optional")}</span>
            <input className="ui-input" value={props.snapshotNote} maxLength={4000} onChange={(event) => props.onSnapshotNote(event.target.value)} />
          </label>
          <div className="ui-cluster">
            <button type="submit" className="ui-btn ui-btn--sm ui-btn--primary" data-action="snapshot-save" disabled={props.snapshotBusy}>
              {props.snapshotBusy ? t("versions.snapshot.working") : t("versions.edit.save")}
            </button>
            <button type="button" className="ui-btn ui-btn--sm" onClick={() => { resetSnapshotDraft(props); setOpen(false); }}>{t("versions.restore.cancel")}</button>
          </div>
        </form>
      )}
    </>
  );
}

function editKeyDown(event: KeyboardEvent, onEditKey: (key: string) => void) {
  if (event.key !== "Enter" && event.key !== "Escape") return;
  event.preventDefault();
  onEditKey(event.key);
}

function Timeline(props: VersionsViewProps) {
  const t = useT();
  const entries = newestFirst(props.entries);
  const selected = new Set(props.selected);
  return (
    <ol className="ui-list wb-versions__list wb-stagger">
      {entries.map((entry, index) => {
        const when = formatVersionTime(entry.time);
        const title = entry.label || when;
        const parent = entry.parent ? entries.find((item) => item.id === entry.parent) : undefined;
        const parentText = entry.parent
          ? t("versions.parent", { name: parent ? (parent.label || formatVersionTime(parent.time)) : t("versions.parent.missing") })
          : "";
        const editing = props.editingId === entry.id;
        const fromFile = otherCaseFile(entry.caseFile, props.openFile);
        return (
          <li key={entry.id} id={`wb-ver-${entry.id}`} data-version-id={entry.id} data-source={entry.source} style={staggerStyle(index)}>
            <div className="wb-versions__row">
              <div className="wb-versions__head">
                <strong className="wb-versions__name">{title}</strong>
                {when && <time className="ui-meta ui-num" dateTime={entry.time}>{when}</time>}
                <span className="ui-tag">{t(SOURCE_KEY[entry.source])}</span>
                {fromFile && <span className="ui-meta wb-versions__from" data-wb-case-file title={fromFile}>{t("versions.fromFile", { name: fromFile })}</span>}
              </div>
              {entry.note && !editing && <p className="ui-meta">{entry.note}</p>}
              {parentText && <a className="ui-meta" href={`#wb-ver-${entry.parent}`}>{parentText}</a>}
              {editing ? (
                <div className="wb-versions__editor">
                  <label className="ui-field">
                    <span className="ui-field__label">{t("versions.label")}</span>
                    <input className="ui-input" value={props.draftLabel} maxLength={200}
                      onChange={(event) => props.onDraftLabel(event.target.value)}
                      onKeyDown={(event) => editKeyDown(event, props.onEditKey)} />
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">{t("versions.note")}</span>
                    <textarea className="ui-textarea" value={props.draftNote} maxLength={4000}
                      onChange={(event) => props.onDraftNote(event.target.value)}
                      onKeyDown={(event) => editKeyDown(event, props.onEditKey)} />
                  </label>
                  <p className="ui-field__hint">{t("versions.edit.hint")}</p>
                  <button type="button" className="ui-btn ui-btn--sm ui-btn--primary" onClick={() => props.onEditKey("Enter")}>{t("versions.edit.save")}</button>
                </div>
              ) : (
                <div className="wb-versions__actions">
                  <label className="ui-check">
                    <input type="checkbox" checked={selected.has(entry.id)}
                      disabled={!selected.has(entry.id) && selected.size >= 2}
                      aria-label={`${t("versions.compare")} ${title}`}
                      onChange={() => props.onToggle(entry.id)} />
                    <span>{t("versions.compare")}</span>
                  </label>
                  <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => props.onAskRestore(entry.id)}>{t("versions.restore")}</button>
                  <details className="wb-more">
                    <summary className="ui-btn ui-btn--sm ui-btn--quiet" aria-label={t("versions.more")}>···</summary>
                    <div className="wb-more__menu">
                      {index < entries.length - 1 && (
                        <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => props.onComparePrevious(entry.id)}>
                          {t("versions.comparePrev")}
                        </button>
                      )}
                      <button type="button" className="ui-btn ui-btn--sm ui-btn--quiet" onClick={() => props.onEdit(entry.id)}>{t("versions.edit")}</button>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </li>
        );
      })}
      {props.unreadable.map((row, index) => (
        <li key={`bad-${row.id ?? index}`} data-unreadable="true">
          <div className="wb-versions__row wb-versions__unreadable">
            <strong>{t("versions.unreadable")}</strong>
            <p className="ui-meta" title={row.reason || undefined}>{t(unreadableMessageKey(row.reason))}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function nameList(title: string, rows: { name: string; type?: string | null }[]) {
  if (!rows.length) return null;
  return (
    <div className="ui-stack ui-stack--tight">
      <h3 className="wb-subhead">{title}</h3>
      <ul className="ui-list">
        {rows.map((row) => <li key={row.name}><span className="wb-versions__name">{row.name}{row.type ? ` · ${row.type}` : ""}</span></li>)}
      </ul>
    </div>
  );
}

function stringList(title: string, rows: string[]) {
  if (!rows.length) return null;
  return (
    <div className="ui-stack ui-stack--tight">
      <h3 className="wb-subhead">{title}</h3>
      <ul className="ui-list">{rows.map((row) => <li key={row}><span className="wb-versions__name">{row}</span></li>)}</ul>
    </div>
  );
}

function StructureBody({ diff }: { diff: VersionDiff }) {
  const t = useT();
  if (structureEmpty(diff)) return <p>{t("versions.diff.structure.none")}</p>;
  const direction = (value: string) => value === "in" ? t("versions.dir.in") : value === "out" ? t("versions.dir.out") : value;
  return (
    <div className="ui-stack">
      {nameList(`${t("versions.diff.units")} · ${t("versions.diff.added")}`, diff.units.added)}
      {nameList(`${t("versions.diff.units")} · ${t("versions.diff.removed")}`, diff.units.removed)}
      {stringList(`${t("versions.diff.streams")} · ${t("versions.diff.added")}`, diff.streams.added)}
      {stringList(`${t("versions.diff.streams")} · ${t("versions.diff.removed")}`, diff.streams.removed)}
      {diff.connections.added.length > 0 && (
        <div className="ui-stack ui-stack--tight">
          <h3 className="wb-subhead">{`${t("versions.diff.connections")} · ${t("versions.diff.added")}`}</h3>
          <ul className="ui-list">
            {diff.connections.added.map((edge) => (
              <li key={`${edge.unit}-${edge.direction}-${edge.stream}`}>{edge.unit} {direction(edge.direction)} {edge.stream}</li>
            ))}
          </ul>
        </div>
      )}
      {diff.connections.removed.length > 0 && (
        <div className="ui-stack ui-stack--tight">
          <h3 className="wb-subhead">{`${t("versions.diff.connections")} · ${t("versions.diff.removed")}`}</h3>
          <ul className="ui-list">
            {diff.connections.removed.map((edge) => (
              <li key={`${edge.unit}-${edge.direction}-${edge.stream}`}>{edge.unit} {direction(edge.direction)} {edge.stream}</li>
            ))}
          </ul>
        </div>
      )}
      {diff.connections.moved.length > 0 && (
        <div className="ui-stack ui-stack--tight">
          <h3 className="wb-subhead">{t("versions.diff.moved")}</h3>
          <ul className="ui-list">
            {diff.connections.moved.map((edge) => (
              <li key={`${edge.unit}-${edge.direction}`}>{edge.unit} {direction(edge.direction)}: {edge.from} → {edge.to}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function caption(key: string, t: (key: MessageKey) => string): string {
  const dot = key.lastIndexOf(".");
  const owner = dot >= 0 ? key.slice(0, dot) : "";
  const name = dot >= 0 ? key.slice(dot + 1) : key;
  const labelKey = valueLabelKey(name);
  const label = labelKey ? t(labelKey) : name;
  return owner ? `${owner} · ${label}` : label;
}

function SpecsBody({ diff }: { diff: VersionDiff }) {
  const t = useT();
  if (!diff.specs.length) return <p>{t("versions.diff.specs.none")}</p>;
  return (
    <ul className="ui-list">
      {diff.specs.map((row) => (
        <li key={row.key}><span className="wb-versions__name">{row.key}: {formatUnknown(row.a)} → {formatUnknown(row.b)}</span></li>
      ))}
    </ul>
  );
}

export function ValuesBody({ diff }: { diff: VersionDiff }) {
  const t = useT();
  if (!diff.values.length) return <p>{t("versions.diff.values.none")}</p>;
  return (
    <div className="ui-table-wrap">
      <table className="ui-table ui-table--compact">
        <thead>
          <tr>
            <th>{t("versions.col.item")}</th>
            <th className="is-num">{t("versions.col.before")}</th>
            <th className="is-num">{t("versions.col.after")}</th>
            <th className="is-num">{t("versions.col.abs")}</th>
            <th className="is-num">{t("versions.col.rel")}</th>
          </tr>
        </thead>
        <tbody>
          {diff.values.map((row) => (
            <tr key={`${row.scope}-${row.key}`}>
              <td>{caption(row.key, t)}</td>
              <td className="is-num ui-num">{formatQuantity(row.a, row.unit)}</td>
              <td className="is-num ui-num">{formatQuantity(row.b, row.unit)}</td>
              <td className="is-num ui-num">{row.abs_delta === null ? "—" : formatSignedQuantity(row.abs_delta, row.unit)}</td>
              <td className="is-num ui-num">{formatRelative(row.rel_delta, row.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffSection({ layout, id, title, children }: { layout: "panel" | "wide"; id: string; title: string; children: ReactNode }) {
  if (layout === "panel") {
    return (
      <details className="ui-disclosure wb-diffsec" open data-diff-section={id}>
        <summary>{title}</summary>
        <div>{children}</div>
      </details>
    );
  }
  return (
    <section className="ui-panel ui-panel--flush wb-diffsec" data-diff-section={id}>
      <div className="ui-panel__head"><h2 className="ui-panel__title">{title}</h2></div>
      <div className="wb-diffsec__body">{children}</div>
    </section>
  );
}

function DiffView(props: VersionsViewProps) {
  const t = useT();
  if (props.selected.length !== 2) {
    return props.layout === "wide" ? <p className="ui-meta">{t("versions.diff.hint")}</p> : null;
  }
  if (props.diffError) return <Alert retryLabel={t("versions.retry")} onRetry={props.onRetryDiff}>{props.diffError}</Alert>;
  if (props.diffLoading || !props.diff) return <p className="ui-meta" role="status">{t("versions.diff.loading")}</p>;
  const diff = props.diff;
  return (
    <div className="wb-diff-sections">
      <DiffSection layout={props.layout} id="structure" title={t("versions.diff.structure")}><StructureBody diff={diff} /></DiffSection>
      <DiffSection layout={props.layout} id="specs" title={t("versions.diff.specs")}><SpecsBody diff={diff} /></DiffSection>
      <DiffSection layout={props.layout} id="values" title={t("versions.diff.values")}><ValuesBody diff={diff} /></DiffSection>
    </div>
  );
}

function RestoreDialog({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    try {
      if (dialog.open) dialog.close();
      dialog.showModal();
    } catch {
    }
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  return (
    <dialog ref={ref} className="ui-dialog" open data-restore-dialog="open" aria-labelledby="wb-restore-title"
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onCancel(); } }}>
      <div className="ui-dialog__body">
        <h2 className="ui-panel__title" id="wb-restore-title">{t("versions.restore.title")}</h2>
        <p>{t("versions.restore.body")}</p>
      </div>
      <div className="ui-dialog__actions">
        <button type="button" className="ui-btn" onClick={onCancel} autoFocus>{t("versions.restore.cancel")}</button>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onConfirm} disabled={busy}>
          {busy ? t("versions.restore.working") : t("versions.restore.confirm")}
        </button>
      </div>
    </dialog>
  );
}

export function VersionsView(props: VersionsViewProps) {
  const t = useT();
  const ready = props.caseStatus === "ready";
  const showEmpty = ready && props.listStatus === "ready" && props.entries.length === 0 && props.unreadable.length === 0;
  const showList = ready && props.listStatus === "ready" && (props.entries.length > 0 || props.unreadable.length > 0);
  const timeline = showList ? <Timeline {...props} /> : null;
  const diff = ready ? <DiffView {...props} /> : null;
  const columns = props.layout === "wide" && showList
    ? (
      <div className="wb-versions__split">
        <div className="wb-versions__timeline">{timeline}</div>
        <div className="wb-versions__diff">{diff}</div>
      </div>
    )
    : <>{timeline}{props.layout === "wide" ? null : diff}</>;
  return (
    <div className="wb-versions">
      <SnapshotControl {...props} />
      {props.caseStatus === "loading" && <><p className="ui-meta" role="status">{t("versions.caseLoading")}</p><SkeletonRows count={3} /></>}
      {props.caseStatus === "error" && <Alert retryLabel={t("versions.retry")} onRetry={props.onRetryCase}>{t("versions.caseError")}</Alert>}
      {props.caseStatus === "detached" && (
        <div className="wb-nocase">
          <p><strong>{props.caseMessage || t("versions.noCase")}</strong></p>
          <a className="ui-btn ui-btn--sm ui-btn--primary" href="#/new">{t("nav.new")}</a>
        </div>
      )}
      {props.actionError && <Alert retryLabel={t("versions.retry")}>{props.actionError}</Alert>}
      {ready && props.listStatus === "loading" && <><p className="ui-meta" role="status">{t("versions.loading")}</p><SkeletonRows count={3} /></>}
      {ready && props.listStatus === "error" && <Alert retryLabel={t("versions.retry")} onRetry={props.onRetry}>{props.listError || t("versions.listError")}</Alert>}
      {showEmpty && <p className="wb-empty">{t("screen.versions.empty")}</p>}
      {columns}
      {ready && props.restoredName && (
        <p className="ui-callout ui-callout--positive" role="status" data-restored-name={props.restoredName}>
          {t("versions.restore.done", { name: props.restoredName })}
        </p>
      )}
      {ready && props.restoreId && (
        <RestoreDialog busy={props.restoreBusy} onCancel={props.onCancelRestore} onConfirm={props.onConfirmRestore} />
      )}
    </div>
  );
}
