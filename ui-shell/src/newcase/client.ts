import type { SseHandler } from "../api/client";
import { parseTemplateRows, type DofAnswer, type TemplateDef } from "./types";
import { webLookupStore } from "./webLookup";

export type SsePost = (path: string, body: unknown, onEvent: SseHandler, opts?: { signal?: AbortSignal }) => Promise<void>;
export type NewCaseClient = {
  getJson<T = unknown>(path: string, opts?: { signal?: AbortSignal }): Promise<T>;
  postJson<T = unknown>(path: string, body?: unknown, opts?: { signal?: AbortSignal }): Promise<T>;
  postSse: SsePost;
};

export type NewCaseEventHandler = SseHandler;

export function listNewCaseTemplates(client: Pick<NewCaseClient, "getJson">): Promise<TemplateDef[]> {
  return client.getJson<{ templates?: unknown }>("demo:new-case/templates").then((body) => parseTemplateRows(body && typeof body === "object" ? body.templates : undefined));
}

function restartBody(opts?: { repair?: boolean; dofAnswers?: DofAnswer[] }): { repair?: true; dof_answers?: DofAnswer[] } {
  return { ...(opts?.repair ? { repair: true as const } : {}), ...(opts?.dofAnswers?.length ? { dof_answers: opts.dofAnswers } : {}) };
}

export function startWords(
  client: Pick<NewCaseClient, "postSse">,
  text: string,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal; repair?: boolean; dofAnswers?: DofAnswer[]; webLookup?: boolean },
): Promise<void> {
  const lookup = opts?.webLookup ?? webLookupStore.get() === "on";
  return client.postSse("demo:new-case", { mode: "words", text, ...restartBody(opts), ...(lookup ? {} : { web_research: false }) }, onEvent, opts);
}

export function startTemplate(
  client: Pick<NewCaseClient, "postSse">,
  kind: string,
  params: Record<string, number>,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal; repair?: boolean; dofAnswers?: DofAnswer[] },
): Promise<void> {
  return client.postSse("demo:new-case", { mode: "template", kind, params, ...restartBody(opts) }, onEvent, opts);
}

export function startImage(
  client: Pick<NewCaseClient, "postSse">,
  image_b64: string,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal; repair?: boolean; mime?: string; page?: number; dofAnswers?: DofAnswer[] },
): Promise<void> {
  return client.postSse("demo:new-case", {
    mode: "image", image_b64,
    ...(opts?.mime ? { mime: opts.mime } : {}),
    ...(typeof opts?.page === "number" ? { page: opts.page } : {}),
    ...restartBody(opts),
  }, onEvent, opts);
}

export function confirmNewCase(
  client: Pick<NewCaseClient, "postSse">,
  job_id: string,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  return client.postSse("demo:new-case/confirm", { job_id }, onEvent, opts);
}

export function answerNewCase(
  client: Pick<NewCaseClient, "postSse">,
  job_id: string,
  answers: Record<string, string>,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  return client.postSse("demo:new-case/answer", { job_id, answers }, onEvent, opts);
}

export function approveNewCase(
  client: Pick<NewCaseClient, "postSse">,
  job_id: string,
  approval_token: string,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal; confirmed?: string[] },
): Promise<void> {
  const confirmed = opts?.confirmed;
  return client.postSse("demo:new-case/approve", { job_id, approval_token, ...(confirmed && confirmed.length > 0 ? { confirmed } : {}) }, onEvent, opts);
}

export function repairNewCase(
  client: Pick<NewCaseClient, "postSse">,
  job_id: string,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  return client.postSse("demo:new-case/repair", { job_id }, onEvent, opts);
}

export function resumeNewCase(
  client: Pick<NewCaseClient, "postSse">,
  job_id: string,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  return client.postSse("demo:new-case/resume", { job_id }, onEvent, opts);
}

export function recheckNewCase(
  client: Pick<NewCaseClient, "postSse">,
  job_id: string,
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  return client.postSse("demo:new-case/recheck", { job_id }, onEvent, opts);
}

export function openNewCaseFolder(client: Pick<NewCaseClient, "postJson">, path: string): Promise<unknown> {
  return client.postJson("demo:new-case/open-folder", { path });
}

export function cancelNewCase(client: Pick<NewCaseClient, "postJson">, job_id: string): Promise<unknown> {
  return client.postJson("demo:new-case/cancel", { job_id });
}

export function reviseNewCase(
  client: Pick<NewCaseClient, "postSse">,
  job_id: string,
  revision: { text: string; edits: unknown[] },
  onEvent: NewCaseEventHandler,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const text = revision.text.trim();
  return client.postSse("demo:new-case/revise", { job_id, ...(text ? { text } : {}), edits: revision.edits }, onEvent, opts);
}
