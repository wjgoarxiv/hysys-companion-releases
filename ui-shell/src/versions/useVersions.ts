import { useCallback, useEffect, useState } from "react";
import { demoClient } from "../api/client";
import { caseStore } from "../state/case";
import { getLocale, useLocale, useT } from "../i18n";
import { fetchVersionDiff, fetchVersionList, restoreVersion, saveVersionNote, takeSnapshot } from "./api";
import {
  compareWithPrevious, diffPair, errorText, newestFirst, noteEditResult, toggleSelected,
  type VersionDiff, type VersionList,
} from "./model";

export function useVersionBrowser(fileSessionId: string | null, refreshCase: (opts?: { reconnect: boolean }) => Promise<void>) {
  const t = useT();
  const locale = useLocale();
  const [list, setList] = useState<VersionList | null>(null);
  const [listStatus, setListStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [snapshotNote, setSnapshotNote] = useState("");
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoredName, setRestoredName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [diffNonce, setDiffNonce] = useState(0);
  const [sessionSeen, setSessionSeen] = useState(fileSessionId);
  if (sessionSeen !== fileSessionId) {
    setSessionSeen(fileSessionId);
    setSelected([]);
    setDiff(null);
    setDiffError(null);
    setEditingId(null);
    setRestoreId(null);
    setList(null);
    setListStatus(fileSessionId ? "loading" : "idle");
    setListError(null);
  }

  const reload = useCallback((sessionId: string) => {
    setListStatus("loading");
    setListError(null);
    return fetchVersionList(demoClient(), sessionId).then(
      (next) => { setList(next); setListStatus("ready"); },
      (err: unknown) => {
        setList(null);
        setListError(errorText(err, getLocale(), t("versions.listError")));
        setListStatus("error");
      },
    );
  }, [t]);

  useEffect(() => {
    if (!fileSessionId) return;
    let cancelled = false;
    setListStatus("loading");
    fetchVersionList(demoClient(), fileSessionId).then(
      (next) => { if (!cancelled) { setList(next); setListError(null); setListStatus("ready"); } },
      (err: unknown) => {
        if (!cancelled) {
          setList(null);
          setListError(errorText(err, getLocale(), t("versions.listError")));
          setListStatus("error");
        }
      },
    );
    return () => { cancelled = true; };
  }, [fileSessionId, locale]);

  const entries = list?.entries ?? [];
  const pair = diffPair(entries, selected);
  const pairA = pair?.a ?? "";
  const pairB = pair?.b ?? "";

  useEffect(() => {
    if (!fileSessionId || !pairA || !pairB) {
      setDiff(null);
      setDiffError(null);
      setDiffLoading(false);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    setDiffError(null);
    fetchVersionDiff(demoClient(), fileSessionId, pairA, pairB).then(
      (next) => { if (!cancelled) { setDiff(next); setDiffLoading(false); } },
      (err: unknown) => {
        if (!cancelled) {
          setDiff(null);
          setDiffError(errorText(err, getLocale(), t("versions.diffError")));
          setDiffLoading(false);
        }
      },
    );
    return () => { cancelled = true; };
  }, [fileSessionId, pairA, pairB, diffNonce, locale]);

  return {
    listStatus: fileSessionId ? listStatus : "idle",
    listError,
    entries,
    unreadable: list?.unreadable ?? [],
    selected,
    diff,
    diffLoading,
    diffError,
    snapshotLabel,
    snapshotNote,
    snapshotBusy,
    editingId,
    draftLabel,
    draftNote,
    restoreId,
    restoreBusy,
    restoredName,
    actionError,
    onRetry: () => { if (fileSessionId) void reload(fileSessionId); },
    onRetryDiff: () => setDiffNonce((value) => value + 1),
    onToggle: (id: string) => setSelected((current) => toggleSelected(current, id)),
    onComparePrevious: (id: string) => {
      const next = compareWithPrevious(newestFirst(entries), id);
      if (next) setSelected(next);
    },
    onSnapshotLabel: setSnapshotLabel,
    onSnapshotNote: setSnapshotNote,
    onSnapshot: () => {
      if (!fileSessionId || snapshotBusy) return;
      setSnapshotBusy(true);
      setActionError(null);
      const sentLabel = snapshotLabel;
      const sentNote = snapshotNote;
      void takeSnapshot(demoClient(), fileSessionId, snapshotLabel, snapshotNote)
        .then((next) => {
          setList(next); setListStatus("ready"); setListError(null);
          setSnapshotLabel((value) => (value === sentLabel ? "" : value));
          setSnapshotNote((value) => (value === sentNote ? "" : value));
        })
        .catch((err: unknown) => setActionError(errorText(err, getLocale(), t("versions.actionError"))))
        .finally(() => setSnapshotBusy(false));
    },
    onEdit: (id: string) => {
      const entry = entries.find((item) => item.id === id);
      if (!entry) return;
      setEditingId(id);
      setDraftLabel(entry.label);
      setDraftNote(entry.note);
    },
    onDraftLabel: setDraftLabel,
    onDraftNote: setDraftNote,
    onEditKey: (key: string) => {
      const decision = noteEditResult(key, { label: draftLabel, note: draftNote });
      if (decision.action === "cancel") {
        setEditingId(null);
        return;
      }
      if (decision.action !== "save" || !fileSessionId || !editingId) return;
      void saveVersionNote(demoClient(), fileSessionId, editingId, decision.label, decision.note)
        .then((entry) => {
          setList((current) => current
            ? { ...current, entries: newestFirst(current.entries.map((item) => item.id === entry.id ? entry : item)) }
            : current);
          setEditingId(null);
          setActionError(null);
        })
        .catch((err: unknown) => setActionError(errorText(err, getLocale(), t("versions.actionError"))));
    },
    onAskRestore: (id: string) => { setRestoreId(id); setActionError(null); },
    onCancelRestore: () => { if (!restoreBusy) setRestoreId(null); },
    onConfirmRestore: () => {
      if (!fileSessionId || !restoreId || restoreBusy) return;
      setRestoreBusy(true);
      setActionError(null);
      void restoreVersion(demoClient(), fileSessionId, restoreId, refreshCase, () => caseStore.beginSwitch())
        .then((result) => { setRestoredName(result.fileName); setRestoreId(null); })
        .catch((err: unknown) => setActionError(errorText(err, getLocale(), t("versions.actionError"))))
        .finally(() => setRestoreBusy(false));
    },
  };
}
