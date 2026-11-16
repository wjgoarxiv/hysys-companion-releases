import { demoClient, type DemoClient, type SseHandler } from "../api/client";
import type { ChangeRequest, ChooseRoute, CreateResult, CrResult, FixSeed, FollowUp } from "./types";

export type CreateBody = { file_session_id: string; text?: string; seed?: FixSeed; route?: ChooseRoute; follow_up?: FollowUp };

export type AgentApi = {
  createCr(body: CreateBody): Promise<CreateResult>;
  listCrs(sid: string): Promise<{ change_requests: ChangeRequest[] }>;
  getCr(id: string, sid: string): Promise<CrResult>;
  trial(id: string, sid: string): Promise<CrResult>;
  confirm(id: string, sid: string): Promise<CrResult>;
  setParams(id: string, sid: string, params: Record<string, unknown>): Promise<CrResult>;
  approve(id: string, sid: string): Promise<CrResult>;
  discard(id: string, sid: string): Promise<CrResult>;
  revert(id: string, sid: string, opts?: { restoreSnapshot?: boolean }): Promise<CrResult>;
  ask(sid: string, question: string, onEvent: SseHandler, signal?: AbortSignal): Promise<void>;
};

const base = "demo:change-requests";
const enc = encodeURIComponent;

export function createAgentApi(client: Pick<DemoClient, "getJson" | "postJson" | "postSse">): AgentApi {
  const step = (action: string) => (id: string, sid: string) =>
    client.postJson<CrResult>(`${base}/${enc(id)}/${action}`, { file_session_id: sid });
  return {
    createCr: (body) => client.postJson<CreateResult>(base, body),
    listCrs: (sid) => client.getJson(`${base}?file_session_id=${enc(sid)}`),
    getCr: (id, sid) => client.getJson(`${base}/${enc(id)}?file_session_id=${enc(sid)}`),
    trial: step("trial"),
    confirm: step("confirm"),
    setParams: (id, sid, params) => client.postJson<CrResult>(`${base}/${enc(id)}/params`, { file_session_id: sid, params }),
    approve: step("approve"),
    discard: step("discard"),
    revert: (id, sid, opts) => client.postJson<CrResult>(`${base}/${enc(id)}/revert`, { file_session_id: sid, ...(opts?.restoreSnapshot ? { restore_snapshot: true } : {}) }),
    ask: (sid, question, onEvent, signal) => client.postSse("demo:file/ask/stream", { file_session_id: sid, question }, onEvent, { signal }),
  };
}

export const agentApi: AgentApi = createAgentApi({
  getJson: (path, opts) => demoClient().getJson(path, opts),
  postJson: (path, body, opts) => demoClient().postJson(path, body, opts),
  postSse: (path, body, onEvent, opts) => demoClient().postSse(path, body, onEvent, opts),
});
