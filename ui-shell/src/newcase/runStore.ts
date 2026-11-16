import { DemoHttpError, type SseHandler } from "../api/client";
import { caseStore, type CaseSummary } from "../state/case";
import { catalog } from "../i18n/catalog";
import { emptyRevision, type RevisionDraft } from "./revise";
import { applyEvent, createRunTracker, initialFlowState, jobActive, markLost, type FlowState, type LostState } from "./flow";

export type NewCaseEntry = "words" | "template" | "image";

export type NewCaseRun = {
  entry: NewCaseEntry | null;
  state: FlowState;
  words: string;
  fromAgent: boolean;
  templateKind: string;
  edits: Record<string, string>;
  imageB64: string | null;
  imageMime: string | null;
  imagePreview: string | null;
  imageProblem: "type" | "size" | null;
  repairArmed: boolean;
  answers: Record<string, string>;
  took: number | null;
  runStart: number | null;
  stepAt: number | null;
  signalAt: number | null;
  approvalSince: { token: string; at: number } | null;
  revision: RevisionDraft;
};

export type Update<T> = T | ((prev: T) => T);

const blank = (): NewCaseRun => ({
  entry: null, state: initialFlowState(), words: "", fromAgent: false, templateKind: "", edits: {},
  imageB64: null, imageMime: null, imagePreview: null, imageProblem: null, repairArmed: false, answers: {},
  took: null, runStart: null, stepAt: null, signalAt: null, approvalSince: null, revision: emptyRevision(),
});

const waitsForPerson = (phase: FlowState["phase"]): boolean => phase === "needs_input" || phase === "awaiting_verify_confirm";

function clocks(prev: NewCaseRun, next: NewCaseRun): NewCaseRun {
  if (next.state === prev.state) return next;
  const now = Date.now();
  const out = { ...next };
  if (next.state.questionsSeq !== prev.state.questionsSeq && Object.keys(out.answers).length > 0) out.answers = {};
  if (next.state.stages.length === 0) out.runStart = null;
  else if (out.runStart === null) out.runStart = now;
  if (next.state.stages.length !== prev.state.stages.length) out.stepAt = now;
  if (waitsForPerson(prev.state.phase) && !waitsForPerson(next.state.phase) && next.state.busy) {
    out.stepAt = now;
    out.signalAt = now;
  }
  if (next.state.busy && !prev.state.busy) out.signalAt = now;
  if (next.state.stages.length === 0 && !next.state.busy) out.signalAt = null;
  if (next.state.phase !== prev.state.phase) {
    out.took = next.state.phase === "opened" && out.runStart !== null ? (now - out.runStart) / 1000 : null;
  }
  const token = next.state.approval?.approval_token ?? null;
  if (token === null) out.approvalSince = null;
  else if (out.approvalSince?.token !== token) out.approvalSince = { token, at: now };
  return out;
}

const openPathOf = (summary: CaseSummary | null): string | null => (summary && summary.attached ? summary.path : null);

export function createNewCaseRunStore(initial: Partial<NewCaseRun> = {}) {
  let current: NewCaseRun = { ...blank(), ...initial };
  const refusalOf = (error: unknown): { code: string; message_ko?: string; message_en?: string; job_id?: string } | null => {
    const record = (error && typeof error === "object" ? error : {}) as { status?: unknown; body?: unknown; name?: unknown };
    const isRefusal = error instanceof DemoHttpError || (record.name === "DemoHttpError" && typeof record.status === "number");
    if (!isRefusal || typeof record.status !== "number") return null;
    const body = (record.body && typeof record.body === "object" ? record.body : {}) as Record<string, unknown>;
    const out: { code: string; message_ko?: string; message_en?: string; job_id?: string } = {
      code: typeof body.code === "string" && body.code ? body.code : `HTTP_${record.status}`,
    };
    if (typeof body.message_ko === "string" && body.message_ko) out.message_ko = body.message_ko;
    if (typeof body.message_en === "string" && body.message_en) out.message_en = body.message_en;
    if (typeof body.job_id === "string" && body.job_id) out.job_id = body.job_id;
    return out;
  };
  let applyBaseline: string | null | undefined;
  const listeners = new Set<() => void>();
  const apply = (change: (prev: NewCaseRun) => NewCaseRun, notify = true): void => {
    const prev = current;
    current = clocks(prev, change(prev));
    if (notify && current !== prev) listeners.forEach((listener) => listener());
  };
  const runs = createRunTracker();
  let mounted = 0;
  const store = {
    runs,
    onOpened: undefined as ((path: string) => void) | undefined,
    get: (): NewCaseRun => current,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    set<K extends keyof NewCaseRun>(key: K, value: Update<NewCaseRun[K]>): void {
      apply((prev) => {
        const next = typeof value === "function" ? (value as (old: NewCaseRun[K]) => NewCaseRun[K])(prev[key]) : value;
        return Object.is(next, prev[key]) ? prev : { ...prev, [key]: next };
      });
    },
    patch(change: Partial<NewCaseRun>): void {
      apply((prev) => ({ ...prev, ...change }));
    },
    takesSeed(): boolean {
      return !jobActive(current.state);
    },
    seed(text: string, notify = true): void {
      const finished = (phase: FlowState["phase"]): boolean => phase === "opened" || phase === "error" || phase === "lost";
      if (finished(current.state.phase)) runs.abort();
      apply((prev) => {
        const base = finished(prev.state.phase) ? blank() : prev;
        const keep = base.entry === "words" && base.words.trim() !== "";
        return { ...base, entry: "words", words: keep ? base.words : text, fromAgent: true };
      }, notify);
    },
    reset(): void {
      runs.abort();
      applyBaseline = undefined;
      apply(() => blank());
    },
    cancelRun(): void {
      runs.abort();
      applyBaseline = undefined;
      apply((prev) => ({
        ...blank(), entry: prev.entry, words: prev.words, fromAgent: prev.fromAgent, templateKind: prev.templateKind, edits: prev.edits,
        imageB64: prev.imageB64, imageMime: prev.imageMime, imagePreview: prev.imagePreview, imageProblem: prev.imageProblem,
      }));
    },
    attach(): () => void {
      mounted += 1;
      return () => {
        mounted -= 1;
        setTimeout(() => { if (mounted === 0 && !jobActive(current.state)) store.reset(); }, 0);
      };
    },
    drive(start: (signal: AbortSignal, onEvent: SseHandler) => Promise<void>, settle: () => void): Promise<void> {
      if (current.state.phase === "applying" && applyBaseline === undefined) applyBaseline = openPathOf(caseStore.get().summary);
      const watched = async (signal: AbortSignal, emit: SseHandler): Promise<void> => {
        try {
          await start(signal, emit);
        } catch (error) {
          if (signal.aborted) return;
          const refusal = refusalOf(error);
          if (refusal) {
            apply((prev) => ({ ...prev, state: applyEvent(prev.state, "error", refusal), signalAt: Date.now() }));
            return;
          }
        }
        if (signal.aborted) return;
        apply((prev) => ({ ...prev, state: markLost(prev.state) }));
        if (current.state.phase === "lost" && current.state.lost?.from === "applying") void store.recheckLost();
      };
      return runs.run(watched, (name, data) => {
        const wasOpened = current.state.phase === "opened";
        apply((prev) => ({ ...prev, state: applyEvent(prev.state, name, data), signalAt: Date.now() }));
        const { phase, openedPath } = current.state;
        if (phase === "opened" && openedPath && !wasOpened) {
          applyBaseline = undefined;
          void caseStore.refresh({ fresh: true }).catch(() => {});
          store.onOpened?.(openedPath);
        }
      }, settle);
    },
    async recheckLost(): Promise<void> {
      const lost = current.state.lost;
      if (current.state.phase !== "lost" || !lost || lost.from !== "applying" || lost.check === "checking") return;
      const mark = (check: LostState["check"]): void => apply((prev) => (prev.state.phase === "lost" && prev.state.lost ? { ...prev, state: { ...prev.state, lost: { ...prev.state.lost, check } } } : prev));
      mark("checking");
      await caseStore.refresh({ fresh: true }).catch(() => {});
      if (current.state.phase !== "lost") return;
      const seen = caseStore.get();
      const summary = seen.summary;
      if (seen.error) return mark("unreachable");
      const path = openPathOf(summary);
      if (summary && summary.attached && path !== null && path !== applyBaseline && !summary.busy) {
        applyBaseline = undefined;
        apply((prev) => ({ ...prev, state: applyEvent(prev.state, "opened", { path, note_ko: catalog["newcase.lost.openedNote"].ko, note_en: catalog["newcase.lost.openedNote"].en }), signalAt: Date.now() }));
        store.onOpened?.(path);
        return;
      }
      mark(summary?.busy ? "busy" : "none");
    },
  };
  return store;
}

export type NewCaseRunStore = ReturnType<typeof createNewCaseRunStore>;

export const newCaseRun = createNewCaseRunStore();

export function resetNewCaseRun(): void {
  newCaseRun.reset();
}
