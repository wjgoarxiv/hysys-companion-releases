import { useCallback, useEffect, useRef, useState } from "react";
import { demoClient } from "../api/client";
import { getLocale, useLocale, useT } from "../i18n";
import { detachedReason, useCase } from "../state/case";
import { StartFailed, createAndStart, discardStudy, fetchCatalog, fetchDynamicsFigure, fetchDynamicsSetup, prepareDynamics, studyAction, type DynSetup } from "../studies/api";
import { draftBody, dynamicsBody, emptyDraft, type Catalog, type Draft, type Study } from "../studies/model";
import { StudiesView } from "../studies/StudiesView";
import { studyWatch, useStudyWatch } from "../studies/useStudies";
import { errorText } from "../versions/model";
import { ScreenFrame } from "./Screen";

export function Studies() {
  const t = useT();
  const locale = useLocale();
  const { summary, loading, error, switching, refresh } = useCase();
  const attached = summary?.attached ? summary : null;
  const sid = attached && attached.file_session_id ? attached.file_session_id : null;
  const watch = useStudyWatch();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "error" | "ready">("loading");
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [dynSetup, setDynSetup] = useState<DynSetup | null>(null);
  const [preparing, setPreparing] = useState(false);

  const sidRef = useRef(sid);
  sidRef.current = sid;
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    setEditorOpen(false); setSelectedId(null); setCatalog(null); setDynSetup(null); setDraft(emptyDraft()); setEditorError(null);
  }, [sid]);

  const loadDynamics = useCallback(() => {
    setDynSetup({ status: "loading" });
    fetchDynamicsSetup(demoClient()).then(setDynSetup,
      (err: unknown) => setDynSetup({ status: "error", message: errorText(err, getLocale(), t("studies.actionError")) }));
  }, [t]);
  useEffect(() => { if (watch.notice) setSelectedId(watch.notice.id); }, [watch.notice]);

  const loadCatalog = useCallback(() => {
    if (!sid) return;
    setCatalogStatus("loading");
    const forSid = sid;
    fetchCatalog(demoClient(), sid).then(
      (next) => {
        if (sidRef.current !== forSid) return;
        setCatalog(next); setCatalogStatus("ready");
        setDraft((d) => (d.name || d.monitors.length ? d : { ...d, timeoutS: next.limits.defaultTimeout }));
      },
      () => { if (sidRef.current === forSid) setCatalogStatus("error"); },
    );
  }, [sid]);

  const run = (key: string, fn: () => Promise<void>) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setActionError(null);
    fn().catch((err: unknown) => setActionError(errorText(err, getLocale(), t("studies.actionError"))))
      .finally(() => inFlight.current.delete(key));
  };

  const caseStatus = attached ? "ready" : loading && !summary ? "loading" : error && !summary ? "error" : "detached";
  return (
    <ScreenFrame title={t("screen.studies.title")}>
      <StudiesView
        caseStatus={caseStatus}
        caseMessage={summary && !summary.attached ? detachedReason(summary, locale, switching, t("casehome.switching")) : null}
        listStatus={!watch.loaded ? "loading" : watch.error && !watch.studies.length ? "error" : "ready"}
        studies={watch.studies}
        selectedId={selectedId}
        confirmDiscardId={confirmDiscardId}
        actionError={actionError}
        editor={editorOpen ? {
          catalog, catalogStatus, draft, busy, error: editorError,
          onChange: setDraft,
          onClose: () => setEditorOpen(false),
          dynamics: {
            setup: dynSetup, preparing, onLoad: loadDynamics,
            onPrepare: () => {
              if (preparing) return;
              setPreparing(true);
              setEditorError(null);
              const asked = draft;
              prepareDynamics(demoClient(), dynamicsBody(draft)).then(
                (prepared) => setDraft((d) => (d.samples === asked.samples && d.stopTimeS === asked.stopTimeS ? { ...d, prepared } : d)),
                (err: unknown) => setEditorError(errorText(err, getLocale(), t("studies.actionError"))),
              ).finally(() => setPreparing(false));
            },
          },
          onStart: () => {
            if (!sid || busy) return;
            setBusy(true);
            setEditorError(null);
            const body = draft.kind === "dynamics" && draft.prepared
              ? { name: draft.name.trim(), kind: "dynamics",
                  dynamics: { confirmation_token: draft.prepared.token, plan: draft.prepared.plan, operator_confirmed: true } }
              : draftBody(draft);
            const forSid = sid;
            const made = (study: Study) => {
              if (sidRef.current !== forSid) return;
              studyWatch.put(study); setSelectedId(study.id); setEditorOpen(false); setDraft(emptyDraft(catalog?.limits));
            };
            createAndStart(demoClient(), sid, body, locale).then(made, (err: unknown) => {
              if (err instanceof StartFailed) {
                made(err.study);
                setActionError(errorText(err.cause, getLocale(), t("studies.actionError")));
              } else {
                setEditorError(errorText(err, getLocale(), t("studies.actionError")));
              }
            }).finally(() => setBusy(false));
          },
        } : null}
        figure={(runId) => fetchDynamicsFigure(demoClient(), runId)}
        onRetryCase={() => { void refresh(); }}
        onRetry={() => { void studyWatch.refresh(); }}
        onRetryCatalog={loadCatalog}
        onNew={() => { setEditorOpen(true); setEditorError(null); if (!catalog) loadCatalog(); }}
        onSelect={setSelectedId}
        onAction={(id, action) => run(`${id}:${action}`, async () => { if (sid) studyWatch.put(await studyAction(demoClient(), sid, id, action)); })}
        onAskDiscard={setConfirmDiscardId}
        onDiscard={(id) => run(`${id}:discard`, async () => {
          if (!sid) return;
          await discardStudy(demoClient(), sid, id);
          studyWatch.drop(id);
          setConfirmDiscardId(null);
          if (selectedId === id) setSelectedId(null);
        })}
      />
    </ScreenFrame>
  );
}
