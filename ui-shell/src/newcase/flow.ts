import type { SseHandler } from "../api/client";
import { parseAssumptions, type AssumptionItem } from "./sources";
import {
  answerNewCase,
  approveNewCase,
  cancelNewCase,
  repairNewCase,
  recheckNewCase,
  confirmNewCase,
  startImage,
  startTemplate,
  startWords,
  type NewCaseClient,
} from "./client";
import {
  parseConfirmations,
  parseDraftDetails,
  parseError,
  parseLedger,
  parseNeedsApproval,
  parseQuestions,
  parseTopology,
  parseUnapplied,
  parseVerify,
  type ConfirmationItem,
  type DraftLedger,
  type UnappliedItem,
  type DraftQuestion,
  type DofAnswer,
  type DraftItemDetail,
  type DraftTopologyData,
  type NeedsApproval,
  type NewCaseErrorState,
  type NewCaseMode,
  type VerifyState,
} from "./types";

export type FlowPhase = "idle" | "starting" | "needs_input" | "awaiting_approval" | "awaiting_verify_confirm" | "verifying" | "applying" | "opened" | "error" | "lost";

export type LostState = { from: FlowPhase; check: "idle" | "checking" | "none" | "busy" | "unreachable" };

export type FlowStage = { id: string; ko?: string; en?: string; agent?: string; state?: string; units?: number; streams?: number };

export type ActivityLine = { stage: string; sub?: string; ko: string; en: string };

export type LiveInfo = { sub: string | null; lines: ActivityLine[]; elapsedS: number | null };

export const ACTIVITY_KEEP = 8;

export type ClarifyAspect = { id: string; ok: boolean; found: string[]; missing: string[] };
export type ClarifyState = { aspects: ClarifyAspect[]; clear: number; total: number; answered: boolean; text?: string };

export type FlowState = {
  mode: NewCaseMode | null;
  clarify: ClarifyState | null;
  phase: FlowPhase;
  stages: FlowStage[];
  jobId: string | null;
  draft: { topology: DraftTopologyData; assumptions: AssumptionItem[]; details?: Record<string, DraftItemDetail>; ledger?: DraftLedger } | null;
  questions: DraftQuestion[];
  questionsSeq: number;
  verify: VerifyState | null;
  approval: NeedsApproval | null;
  openedPath: string | null;
  savedPath: string | null;
  openedNote: { ko: string; en: string } | null;
  unapplied: UnappliedItem[];
  hysysDialog: { text: string; since: string | null } | null;
  note: "cancelled" | "locked" | null;
  error: NewCaseErrorState | null;
  confirmations: ConfirmationItem[];
  requiresConfirmation: boolean;
  confirmed: string[];
  busy: boolean;
  dofAnswers: DofAnswer[];
  live: LiveInfo;
  lost: LostState | null;
};

export function initialFlowState(): FlowState {
  return {
    mode: null,
    clarify: null,
    phase: "idle",
    stages: [],
    jobId: null,
    draft: null,
    questions: [],
    questionsSeq: 0,
    verify: null,
    approval: null,
    openedPath: null,
    savedPath: null,
    openedNote: null,
    unapplied: [],
    hysysDialog: null,
    note: null,
    error: null,
    confirmations: [],
    requiresConfirmation: false,
    confirmed: [],
    busy: false,
    dofAnswers: [],
    live: { sub: null, lines: [], elapsedS: null },
    lost: null,
  };
}

export function collectDofAnswers(kept: DofAnswer[], questions: DraftQuestion[], answers: Record<string, string>): DofAnswer[] {
  const out = new Map(kept.map((entry) => [entry.id, entry]));
  for (const q of questions) {
    const answer = (answers[q.id] ?? "").trim();
    if (!q.id.startsWith("dof:") || !answer) continue;
    const kind = asRecord(q.raw).op_kind;
    out.set(q.id, { id: q.id, ...(typeof kind === "string" && kind ? { op_kind: kind } : {}), answer });
  }
  return [...out.values()];
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry): string[] => (typeof entry === "string" && entry.trim() ? [entry.trim()] : []));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const secondsOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);

export function applyEvent(state: FlowState, name: string, data: unknown): FlowState {
  const body = asRecord(data);
  switch (name) {
    case "stage": {
      const id = typeof body.stage === "string" && body.stage ? body.stage : "";
      if (!id) return state;
      const ko = typeof body.label_ko === "string" && body.label_ko ? body.label_ko : undefined;
      const en = typeof body.label_en === "string" && body.label_en ? body.label_en : undefined;
      const agent = typeof body.agent === "string" && body.agent ? body.agent : undefined;
      const stageState = typeof body.state === "string" && body.state ? body.state : undefined;
      const phase = state.phase === "idle" ? "starting" : state.phase;
      const jobId = typeof body.job_id === "string" && body.job_id ? body.job_id : state.jobId;
      const note = state.note === "locked" ? null : state.note;
      const same = agent ? state.stages.findIndex((row) => row.id === id && row.agent === agent) : -1;
      if (same >= 0) return { ...state, phase, jobId, note, stages: state.stages.map((row, i) => (i === same ? { id, ko, en, agent, state: stageState } : row)) };
      const count = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined);
      const found = count(body.units) !== undefined && count(body.streams) !== undefined ? { units: count(body.units), streams: count(body.streams) } : {};
      const live = state.stages[state.stages.length - 1]?.id === id ? state.live : { ...state.live, sub: null, elapsedS: null };
      return { ...state, phase, jobId, note, live, stages: [...state.stages, agent ? { id, ko, en, agent, state: stageState } : { id, ko, en, ...found }] };
    }
    case "activity": {
      const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
      const ko = text(body.text_ko);
      const en = text(body.text_en);
      const sub = text(body.sub);
      const stage = text(body.stage) || state.stages[state.stages.length - 1]?.id || "";
      const elapsed = secondsOf(body.elapsed_s);
      const last = state.live.lines[state.live.lines.length - 1];
      const repeat = last !== undefined && last.stage === stage && last.ko === (ko || en) && last.en === (en || ko);
      const lines = ko || en ? (repeat ? state.live.lines : [...state.live.lines, { stage, ...(sub ? { sub } : {}), ko: ko || en, en: en || ko }].slice(-ACTIVITY_KEEP)) : state.live.lines;
      const live: LiveInfo = { sub: sub || state.live.sub, lines, elapsedS: elapsed ?? state.live.elapsedS };
      return { ...state, live };
    }
    case "heartbeat": {
      const elapsed = secondsOf(body.elapsed_s);
      return elapsed === null || elapsed === state.live.elapsedS ? state : { ...state, live: { ...state.live, elapsedS: elapsed } };
    }
    case "clarify": {
      const aspects = (Array.isArray(body.aspects) ? body.aspects : []).flatMap((item): ClarifyAspect[] => {
        const row = asRecord(item);
        return typeof row.id === "string" && row.id
          ? [{ id: row.id, ok: row.ok === true, found: asStringList(row.found), missing: asStringList(row.missing) }]
          : [];
      });
      const total = typeof body.total === "number" ? body.total : aspects.length;
      const clear = typeof body.clear === "number" ? body.clear : aspects.filter((a) => a.ok).length;
      const clarify: ClarifyState = { aspects, clear, total, answered: body.answered === true,
        ...(typeof body.text === "string" && body.text ? { text: body.text } : {}) };
      const questions = parseQuestions(body.questions);
      if (questions.length > 0 && typeof body.job_id === "string") {
        return { ...state, clarify, jobId: body.job_id, questions, questionsSeq: state.questionsSeq + 1, phase: "needs_input", busy: false };
      }
      if (clarify.answered) return { ...state, clarify, questions: [], phase: "starting", busy: true };
      return { ...state, clarify };
    }
    case "draft": {
      const topology = parseTopology(body.topology ?? body);
      const assumptions = parseAssumptions(body.assumptions);
      const details = parseDraftDetails(body.spec);
      const ledger = parseLedger(body.ledger, body.assumptions);
      const questions = parseQuestions(body.questions);
      const confirmations = parseConfirmations(body.confirmations);
      const requiresConfirmation = body.requires_confirmation === true || confirmations.length > 0;
      const confirmed = state.confirmed.filter((target) => confirmations.some((item) => item.target === target));
      if (typeof body.job_id === "string" && body.job_id) {
        if (questions.length > 0) {
          return { ...state, jobId: body.job_id, draft: { topology, assumptions, details, ledger }, questions, questionsSeq: state.questionsSeq + 1, confirmations, requiresConfirmation, confirmed, phase: "needs_input", busy: false };
        }
      } else if (questions.length > 0) {
        return { ...state, draft: { topology, assumptions, details, ledger }, questions, questionsSeq: state.questionsSeq + 1, confirmations, requiresConfirmation, confirmed, phase: "needs_input", busy: false };
      }
      return { ...state, draft: { topology, assumptions, details, ledger }, confirmations, requiresConfirmation, confirmed, busy: false };
    }
    case "verify": {
      const verify = parseVerify(body);
      return verify ? { ...state, verify } : state;
    }
    case "needs_approval": {
      const approval = parseNeedsApproval(body);
      if (!approval) return state;
      return { ...state, jobId: approval.job_id, approval, questions: [], phase: "awaiting_approval", busy: false };
    }
    case "opened": {
      const path = typeof body.path === "string" ? body.path : "";
      const ko = typeof body.note_ko === "string" ? body.note_ko : "";
      const en = typeof body.note_en === "string" ? body.note_en : ko;
      const savedPath = typeof body.saved_path === "string" && body.saved_path ? body.saved_path : null;
      return { ...state, openedPath: path, savedPath, openedNote: ko ? { ko, en } : null, unapplied: parseUnapplied(body), hysysDialog: null, note: null, phase: "opened", busy: false };
    }
    case "hysys_dialog": {
      if (typeof body.text !== "string") return { ...state, hysysDialog: null };
      const since = typeof body.since === "string" && body.since ? body.since : null;
      return { ...state, hysysDialog: { text: body.text.trim(), since } };
    }
    case "cancelled":
      return { ...initialFlowState(), note: "cancelled" };
    case "error": {
      const parsed = parseError(body);
      if (parsed.code === "VERIFY_CONFIRM_REQUIRED" && parsed.can_confirm) {
        return { ...state, jobId: parsed.job_id ?? state.jobId, error: parsed, hysysDialog: null, note: null, phase: "awaiting_verify_confirm", busy: false };
      }
      return { ...state, jobId: parsed.job_id ?? state.jobId, error: parsed, hysysDialog: null, note: null, phase: "error", busy: false };
    }
    default:
      return state;
  }
}

export function jobActive(state: FlowState): boolean {
  return state.busy || (state.phase !== "idle" && state.phase !== "opened" && state.phase !== "error" && state.phase !== "lost");
}

export function canLoseConnection(state: FlowState): boolean {
  return state.busy && !isAnswering(state) && (state.phase === "starting" || state.phase === "applying" || state.phase === "verifying");
}

export function markLost(state: FlowState): FlowState {
  if (!canLoseConnection(state)) return state;
  return { ...state, phase: "lost", busy: false, hysysDialog: null, note: null, lost: { from: state.phase, check: "idle" } };
}

export function canWaitForConfirm(state: FlowState): boolean {
  return state.phase === "awaiting_verify_confirm"
    && state.error?.code === "VERIFY_CONFIRM_REQUIRED"
    && state.error.can_confirm === true;
}

export function isChecklistComplete(state: FlowState): boolean {
  if (!state.requiresConfirmation || state.confirmations.length === 0) return true;
  const done = new Set(state.confirmed);
  return state.confirmations.every((item) => done.has(item.target));
}

export function toggleConfirmation(state: FlowState, target: string): FlowState {
  const confirmed = state.confirmed.includes(target)
    ? state.confirmed.filter((item) => item !== target)
    : [...state.confirmed, target];
  return { ...state, confirmed };
}

export function canApprove(state: FlowState): boolean {
  return state.phase === "awaiting_approval" && state.approval !== null && isChecklistComplete(state);
}

export function canOfferRepair(state: FlowState): boolean {
  if (state.phase !== "error" || state.error?.code === "PREVIEW_BLOCKED") return false;
  return state.error?.can_repair === true;
}

export function canResume(state: FlowState): boolean {
  return state.phase === "error" && state.error?.can_resume === true && (state.error.job_id ?? state.jobId) !== null;
}

export function canResumeLost(state: FlowState): boolean {
  return state.phase === "lost" && state.lost?.from !== "applying" && state.jobId !== null;
}

export function canRepairBlocked(state: FlowState): boolean {
  return state.phase === "error" && state.error?.code === "PREVIEW_BLOCKED" && state.error.can_repair === true && state.jobId !== null;
}

export function canContinueRepair(state: FlowState): boolean {
  if (state.phase === "error") return state.error?.can_continue_repair === true && state.jobId !== null;
  return state.phase === "awaiting_approval" && state.verify?.converged === false && state.verify.can_continue_repair === true && state.jobId !== null;
}

export function canRecheck(state: FlowState): boolean {
  if (state.jobId === null) return false;
  if (state.phase === "error") return state.error?.can_recheck === true;
  return state.phase === "awaiting_approval" && state.approval !== null;
}

export function beginRepair(state: FlowState): FlowState {
  return { ...state, phase: "starting", busy: true, error: null, verify: null, approval: null, questions: [] };
}

export function beginAnswer(state: FlowState, answers: Record<string, string>): FlowState {
  return { ...state, phase: "starting", busy: true, error: null, dofAnswers: collectDofAnswers(state.dofAnswers, state.questions, answers) };
}

export function isAnswering(state: FlowState): boolean {
  return state.phase === "starting" && state.busy && state.questions.length > 0;
}

export function endAnswer(state: FlowState): FlowState {
  if (state.phase !== "starting" || !state.busy) return state;
  return state.questions.length > 0 ? { ...state, phase: "needs_input", busy: false } : { ...state, busy: false };
}

export function beginConfirm(state: FlowState): FlowState {
  return { ...state, phase: "verifying", busy: true, error: null };
}

export function isUnconverged(state: FlowState): boolean {
  if (state.approval?.unconverged === true) return true;
  if (state.verify && state.verify.converged === false) return true;
  return false;
}

export function cannotStop(state: FlowState): boolean {
  if (state.phase === "applying") return true;
  if (state.phase === "verifying") return false;
  const step = state.stages[state.stages.length - 1]?.id;
  return state.busy && (step === "apply" || step === "open");
}

export function isApplyInProgress(error: unknown): boolean {
  const e = error as { status?: unknown; body?: unknown } | null;
  return !!e && e.status === 409 && JSON.stringify(e.body ?? "").includes("apply_in_progress");
}

export function createRunTracker() {
  let current = 0;
  let controller: AbortController | null = null;
  return {
    async run(start: (signal: AbortSignal, onEvent: SseHandler) => Promise<void>, onEvent: SseHandler, settle: () => void, external?: AbortSignal): Promise<void> {
      controller?.abort();
      const mine = ++current;
      const own = new AbortController();
      controller = own;
      external?.addEventListener("abort", () => own.abort(), { once: true });
      try {
        await start(own.signal, (name, data) => {
          if (mine === current) onEvent(name, data);
        });
      } catch (error) {
        if (mine !== current) return;
        throw error;
      } finally {
        if (mine === current) settle();
      }
    },
    abort(): void {
      current += 1;
      controller?.abort();
      controller = null;
    },
  };
}

export function createNewCaseFlow(client: NewCaseClient) {
  let state: FlowState = initialFlowState();
  const listeners = new Set<() => void>();
  const runs = createRunTracker();

  const set = (next: FlowState): void => {
    state = next;
    for (const listener of listeners) listener();
  };

  const onEvent = (name: string, data: unknown): void => {
    set(applyEvent(state, name, data));
  };
  const settle = (): void => {
    if (isAnswering(state)) set(endAnswer(state));
    else if (createNewCaseFlowStayBusy(state)) set({ ...state, busy: false });
  };

  return {
    getState: (): FlowState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    reset(): void {
      set(initialFlowState());
    },
    async startWords(text: string, opts?: { repair?: boolean; dofAnswers?: DofAnswer[]; signal?: AbortSignal }): Promise<void> {
      set({ ...initialFlowState(), dofAnswers: opts?.dofAnswers ?? [], mode: "words", phase: "starting", busy: true });
      await runs.run((signal, emit) => startWords(client, text, emit, { ...opts, signal }), onEvent, settle, opts?.signal);
    },
    async startTemplate(kind: string, params: Record<string, number>, opts?: { repair?: boolean; dofAnswers?: DofAnswer[]; signal?: AbortSignal }): Promise<void> {
      set({ ...initialFlowState(), dofAnswers: opts?.dofAnswers ?? [], mode: "template", phase: "starting", busy: true });
      await runs.run((signal, emit) => startTemplate(client, kind, params, emit, { ...opts, signal }), onEvent, settle, opts?.signal);
    },
    async startImage(image_b64: string, opts?: { repair?: boolean; dofAnswers?: DofAnswer[]; signal?: AbortSignal }): Promise<void> {
      set({ ...initialFlowState(), dofAnswers: opts?.dofAnswers ?? [], mode: "image", phase: "starting", busy: true });
      await runs.run((signal, emit) => startImage(client, image_b64, emit, { ...opts, signal }), onEvent, settle, opts?.signal);
    },
    async repairBlocked(opts?: { signal?: AbortSignal }): Promise<void> {
      if (!canRepairBlocked(state) || !state.jobId) throw new Error("not_repairable");
      const job_id = state.jobId;
      set(beginRepair(state));
      await runs.run((signal, emit) => repairNewCase(client, job_id, emit, { signal }), onEvent, settle, opts?.signal);
    },
    async continueRepair(opts?: { signal?: AbortSignal }): Promise<void> {
      if (!canContinueRepair(state) || !state.jobId) throw new Error("not_repairable");
      const job_id = state.jobId;
      set(beginRepair(state));
      await runs.run((signal, emit) => repairNewCase(client, job_id, emit, { signal }), onEvent, settle, opts?.signal);
    },
    async recheck(opts?: { signal?: AbortSignal }): Promise<void> {
      if (!canRecheck(state) || !state.jobId) throw new Error("not_recheckable");
      const job_id = state.jobId;
      set({ ...state, phase: "verifying", busy: true, error: null, approval: null });
      await runs.run((signal, emit) => recheckNewCase(client, job_id, emit, { signal }), onEvent, settle, opts?.signal);
    },
    async answer(answers: Record<string, string>, opts?: { signal?: AbortSignal }): Promise<void> {
      if (state.phase !== "needs_input" || !state.jobId) throw new Error("not_awaiting_answers");
      const job_id = state.jobId;
      set(beginAnswer(state, answers));
      await runs.run((signal, emit) => answerNewCase(client, job_id, answers, emit, { signal }), onEvent, settle, opts?.signal);
    },
    toggleConfirm(target: string): void {
      set(toggleConfirmation(state, target));
    },
    async approve(opts?: { signal?: AbortSignal }): Promise<void> {
      if (!canApprove(state) || !state.approval) throw new Error("not_awaiting_approval");
      const { job_id, approval_token } = state.approval;
      const confirmed = state.confirmed;
      set({ ...state, phase: "applying", busy: true });
      await runs.run((signal, emit) => approveNewCase(client, job_id, approval_token, emit, { signal, confirmed }), onEvent, settle, opts?.signal);
    },
    async confirm(opts?: { signal?: AbortSignal }): Promise<void> {
      if (!canWaitForConfirm(state) || !state.jobId) throw new Error("not_awaiting_confirm");
      const job_id = state.jobId;
      set(beginConfirm(state));
      await runs.run((signal, emit) => confirmNewCase(client, job_id, emit, { signal }), onEvent, settle, opts?.signal);
    },
    async cancel(): Promise<boolean> {
      if (state.phase === "opened" || state.phase === "idle") return false;
      if (state.jobId) {
        try {
          await cancelNewCase(client, state.jobId);
        } catch (error) {
          if (isApplyInProgress(error)) {
            set({ ...state, note: "locked" });
            return false;
          }
        }
      }
      runs.abort();
      set({ ...initialFlowState(), note: "cancelled" });
      return true;
    },
  };
}

function createNewCaseFlowStayBusy(state: FlowState): boolean {
  return state.busy && state.phase !== "needs_input" && state.phase !== "awaiting_approval"
    && state.phase !== "awaiting_verify_confirm" && state.phase !== "opened" && state.phase !== "error";
}

export type NewCaseFlow = ReturnType<typeof createNewCaseFlow>;
