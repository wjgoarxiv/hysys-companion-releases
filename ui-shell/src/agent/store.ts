import { useSyncExternalStore } from "react";
import { caseStore, type CaseSummary } from "../state/case";
import { hashFor } from "../router";
import { agentApi, type AgentApi } from "./api";
import { CHANGE_REQUEST_EVENT, canApprove, errorInfoOf, isCreateLike, isInFlight, parseSeedDetail, reduceAnswerEvent } from "./logic";
import { setNewCaseSeed } from "./newCaseSeed";
import type { AnswerState, ChangeRequest, ChooseRoute, ErrorInfo, FixSeed, FollowUp, SeedDetail } from "./types";

export type CrBusy = "trial" | "confirm" | "approve" | "discard" | "revert" | "params";
export type HistoryState = { status: "idle" | "loading" | "ready" | "error"; items: ChangeRequest[]; error: ErrorInfo | null };
export type AgentState = {
  sid: string | null;
  view: "idle" | "answer" | "card";
  sheetOpen: boolean;
  openSignal: number;
  answer: AnswerState | null;
  cr: ChangeRequest | null;
  crBusy: CrBusy | null;
  crError: ErrorInfo | null;
  history: HistoryState;
};

export function agentRunActive(state: AgentState): boolean {
  if (state.crBusy !== null) return true;
  if (state.answer && (state.answer.status === "thinking" || state.answer.status === "streaming")) return true;
  return state.cr !== null && isInFlight(state.cr);
}

export type AgentDeps = {
  api: AgentApi;
  getSession: () => string | null;
  navigate: (route: "new") => void;
  refreshCase: () => Promise<unknown> | void;
  pollMs?: number;
  schedule?: (flush: () => void) => () => void;
};

const frameSchedule = (flush: () => void): (() => void) => {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(flush);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(flush, 16);
  return () => clearTimeout(id);
};

const emptyHistory = (): HistoryState => ({ status: "idle", items: [], error: null });
const initialState = (sid: string | null = null): AgentState => ({
  sid, view: "idle", sheetOpen: false, openSignal: 0, answer: null, cr: null, crBusy: null, crError: null, history: emptyHistory(),
});

type Request = { kind: "text"; text: string; route?: ChooseRoute; followUp?: FollowUp } | { kind: "seed"; seed: FixSeed; title: string };
const OPTIMISTIC: Record<CrBusy, ChangeRequest["state"] | null> = { trial: "trial", confirm: "trial", approve: "approved", discard: null, revert: "reverting", params: null };

export function createAgentStore(deps: AgentDeps) {
  let state: AgentState = initialState();
  const listeners = new Set<() => void>();
  let turn = 0;
  let abort: AbortController | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let lastRequest: Request | null = null;
  let followUp: FollowUp | null = null;

  const set = (patch: Partial<AgentState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const stopPoll = () => {
    if (pollTimer !== undefined) clearTimeout(pollTimer);
    pollTimer = undefined;
  };
  const cancelWork = () => {
    turn += 1;
    abort?.abort();
    abort = undefined;
    stopPoll();
  };
  const reveal = (patch: Partial<AgentState>) => set({ ...patch, sheetOpen: true, openSignal: state.openSignal + 1 });

  function upsertHistory(cr: ChangeRequest) {
    const items = state.history.items;
    const next = items.some((item) => item.id === cr.id) ? items.map((item) => (item.id === cr.id ? cr : item)) : [...items, cr];
    set({ history: { ...state.history, items: next } });
  }

  async function loadHistory(): Promise<void> {
    const sid = state.sid;
    if (!sid) return;
    set({ history: { ...state.history, status: "loading", error: null } });
    try {
      const res = await deps.api.listCrs(sid);
      if (state.sid !== sid) return;
      set({ history: { status: "ready", items: res.change_requests ?? [], error: null } });
    } catch (err) {
      if (state.sid !== sid) return;
      set({ history: { ...state.history, status: "error", error: errorInfoOf(err) } });
    }
  }

  function adopt(sid: string | null): void {
    if (state.sid === sid) return;
    cancelWork();
    followUp = null;
    state = initialState(sid);
    listeners.forEach((listener) => listener());
    if (sid) void loadHistory();
  }

  function goNewCase(text: string) {
    setNewCaseSeed(text);
    set({ view: "idle", answer: null, cr: null, sheetOpen: false });
    deps.navigate("new");
  }

  function showCr(cr: ChangeRequest) {
    reveal({ view: "card", answer: null, cr, crBusy: null, crError: null });
    upsertHistory(cr);
    watch();
  }

  const sessionFor = (cr: ChangeRequest): string => deps.getSession() ?? cr.file_session_id;

  function watch() {
    stopPoll();
    const cr = state.cr;
    if (!cr || state.crBusy || !isInFlight(cr)) return;
    pollTimer = setTimeout(async () => {
      pollTimer = undefined;
      const current = state.cr;
      if (!current || current.id !== cr.id || state.crBusy) return;
      try {
        const res = await deps.api.getCr(cr.id, sessionFor(cr));
        if (state.cr?.id !== cr.id || state.crBusy) return;
        set({ cr: res.change_request });
        upsertHistory(res.change_request);
      } catch {
      }
      watch();
    }, deps.pollMs ?? 1500);
  }

  async function streamAnswer(question: string, sid: string, mine: number) {
    const ctl = new AbortController();
    abort = ctl;
    set({ answer: { status: "streaming", question, text: "", error: null } });
    let pending: AnswerState | null = null;
    let cancelFrame: (() => void) | null = null;
    const flush = () => {
      const cancel = cancelFrame;
      cancelFrame = null;
      cancel?.();
      const next = pending;
      pending = null;
      if (next && mine === turn && state.answer) set({ answer: next });
    };
    try {
      await deps.api.ask(sid, question, (name, data) => {
        if (mine !== turn || !state.answer) return;
        const base = pending ?? state.answer;
        const next = reduceAnswerEvent(base, name, data);
        if (next === base) return;
        pending = next;
        if (next.status !== "streaming") flush();
        else if (cancelFrame === null) cancelFrame = (deps.schedule ?? frameSchedule)(flush);
      }, ctl.signal);
      flush();
      if (mine !== turn || !state.answer) return;
      const a = state.answer;
      if (a.status === "streaming" || a.status === "done") set({ answer: { ...a, status: a.text.trim() ? "done" : "empty" } });
    } catch (err) {
      flush();
      if (mine !== turn || ctl.signal.aborted || !state.answer) return;
      set({ answer: { ...state.answer, status: "error", error: errorInfoOf(err) } });
    }
  }

  async function run(request: Request): Promise<void> {
    const sid = deps.getSession();
    adopt(sid);
    cancelWork();
    const mine = turn;
    lastRequest = request;
    const label = request.kind === "text" ? request.text : request.title;
    if (!sid) {
      if (request.kind === "text" && isCreateLike(request.text)) return goNewCase(request.text);
      reveal({ view: "answer", cr: null, crBusy: null, crError: null, answer: { status: "nocase", question: label, text: "", error: null } });
      return;
    }
    reveal({ view: "answer", cr: null, crBusy: null, crError: null, answer: { status: "thinking", question: label, text: "", error: null } });
    try {
      const res = await deps.api.createCr(request.kind === "text"
        ? { file_session_id: sid, text: request.text, ...(request.route ? { route: request.route } : {}), ...(request.followUp ? { follow_up: request.followUp } : {}) }
        : { file_session_id: sid, seed: request.seed });
      if (mine !== turn) return;
      if (res.redirect === "reply" && res.reply && request.kind === "text") {
        const reply = res.reply;
        if (reply.kind === "question") followUp = { request: reply.request || request.text, question: reply.message_ko || reply.message_en };
        set({ answer: { status: "done", question: request.text, text: "", error: null, reply: { kind: reply.kind, ko: reply.message_ko, en: reply.message_en } } });
        return;
      }
      if (res.redirect === "new-case" && request.kind === "text") return goNewCase(request.text);
      if (res.redirect === "choose" && request.kind === "text") {
        set({ answer: { status: "choose", question: request.text, text: "", error: null, choices: res.choices?.length ? res.choices : ["edit", "new-case", "answer"] } });
        return;
      }
      if (res.change_request) return showCr(res.change_request);
      if (request.kind === "text") await streamAnswer(request.text, sid, mine);
    } catch (err) {
      if (mine !== turn || !state.answer) return;
      set({ answer: { ...state.answer, status: "error", error: errorInfoOf(err) } });
    }
  }

  async function act(kind: CrBusy, params?: Record<string, unknown>): Promise<void> {
    const cr = state.cr;
    if (!cr || state.crBusy) return;
    if (kind === "approve" && !canApprove(cr)) return;
    if (kind === "confirm" && cr.state !== "needs_confirm") return;
    stopPoll();
    const optimistic = OPTIMISTIC[kind];
    set({ crBusy: kind, crError: null, cr: optimistic ? { ...cr, state: optimistic } : cr });
    try {
      const sid = sessionFor(cr);
      const res = kind === "params" ? await deps.api.setParams(cr.id, sid, params ?? {})
        : kind === "revert" ? await (params?.restoreSnapshot === true ? deps.api.revert(cr.id, sid, { restoreSnapshot: true }) : deps.api.revert(cr.id, sid))
        : await deps.api[kind](cr.id, sid);
      const next = res.change_request;
      upsertHistory(next);
      if (state.cr?.id !== cr.id) return;
      set({ crBusy: null, cr: next });
      if ((kind === "approve" && next.state === "applied") || (kind === "revert" && next.state === "reverted")) void deps.refreshCase();
    } catch (err) {
      if (state.cr?.id !== cr.id) return;
      set({ crBusy: null, crError: errorInfoOf(err) ?? { ko: null, en: null }, cr });
      try {
        const fresh = await deps.api.getCr(cr.id, sessionFor(cr));
        if (state.cr?.id === cr.id) set({ cr: fresh.change_request });
        upsertHistory(fresh.change_request);
      } catch {
      }
    }
    watch();
  }

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    adopt,
    loadHistory,
    submit: (raw: string): Promise<void> => {
      const text = raw.trim();
      if (!text) return Promise.resolve();
      const answering = followUp;
      followUp = null;
      return run({ kind: "text", text, ...(answering ? { followUp: answering } : {}) });
    },
    openSeed(detail: SeedDetail): Promise<void> {
      const sid = deps.getSession();
      if (detail.file_session_id && detail.file_session_id !== sid) return Promise.resolve();
      return run({ kind: "seed", seed: detail.seed, title: detail.title ?? detail.seed.summary_ko ?? detail.seed.target });
    },
    retry: (): Promise<void> => (lastRequest ? run(lastRequest) : Promise.resolve()),
    choose(route: ChooseRoute): Promise<void> {
      if (lastRequest?.kind !== "text") return Promise.resolve();
      if (route === "new-case") {
        cancelWork();
        goNewCase(lastRequest.text);
        return Promise.resolve();
      }
      return run({ kind: "text", text: lastRequest.text, route });
    },
    runTrial: () => act("trial"),
    confirm: () => act("confirm"),
    setParams: (params: Record<string, unknown>) => act("params", params),
    approve: () => act("approve"),
    discard: () => act("discard"),
    revert: () => act("revert"),
    revertViaSnapshot: () => act("revert", { restoreSnapshot: true }),
    async openCr(id: string): Promise<void> {
      const cached = state.history.items.find((item) => item.id === id);
      cancelWork();
      if (cached) showCr(cached);
      const sid = state.sid;
      if (!sid) return;
      try {
        const res = await deps.api.getCr(id, sid);
        if (state.cr?.id === id && !state.crBusy) {
          set({ cr: res.change_request });
          upsertHistory(res.change_request);
          watch();
        } else if (!cached) {
          showCr(res.change_request);
        }
      } catch (err) {
        if (!cached) reveal({ view: "answer", cr: null, answer: { status: "error", question: "", text: "", error: errorInfoOf(err) } });
      }
    },
    back() {
      cancelWork();
      followUp = null;
      set({ view: "idle", answer: null, cr: null, crBusy: null, crError: null });
    },
    closeSheet() {
      set({ sheetOpen: false });
    },
    openSheet() {
      set({ sheetOpen: true });
    },
  };
}

export type AgentStore = ReturnType<typeof createAgentStore>;

const attachedSession = (summary: CaseSummary | null): string | null => (summary && summary.attached ? summary.file_session_id : null);

export const agentStore: AgentStore = createAgentStore({
  api: agentApi,
  getSession: () => attachedSession(caseStore.get().summary),
  navigate: () => { window.location.hash = hashFor("new"); },
  refreshCase: () => caseStore.refresh({ fresh: true }),
});

export function useAgent(store: AgentStore = agentStore): AgentState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function installChangeRequestListener(target: EventTarget, store: Pick<AgentStore, "openSeed">): () => void {
  const onEvent = (event: Event) => {
    const detail = parseSeedDetail((event as CustomEvent).detail);
    if (detail) void store.openSeed(detail);
  };
  target.addEventListener(CHANGE_REQUEST_EVENT, onEvent);
  return () => target.removeEventListener(CHANGE_REQUEST_EVENT, onEvent);
}
