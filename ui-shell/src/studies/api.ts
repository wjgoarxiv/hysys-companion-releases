import { parseCandidates, parseCatalog, parseStudy, parseStudyList, type Catalog, type DynCandidate, type DynPrepared, type Study } from "./model";

export type StudyClient = {
  getJson<T = unknown>(path: string): Promise<T>;
  postJson<T = unknown>(path: string, body?: unknown): Promise<T>;
};

const q = (sid: string) => `file_session_id=${encodeURIComponent(sid)}`;

function studyOf(body: unknown): Study {
  const study = parseStudy((body as { study?: unknown } | null)?.study);
  if (!study) throw new Error("invalid study");
  return study;
}

export async function fetchCatalog(client: StudyClient, sid: string): Promise<Catalog> {
  return parseCatalog(await client.getJson(`demo:studies/catalog?${q(sid)}`));
}

export async function fetchStudies(client: StudyClient, sid: string): Promise<Study[]> {
  return parseStudyList(await client.getJson(`demo:studies?${q(sid)}`));
}

export class StartFailed extends Error {
  constructor(readonly study: Study, readonly cause: unknown) { super("start failed"); }
}

export async function createAndStart(client: StudyClient, sid: string, body: Record<string, unknown>, uiLocale: string): Promise<Study> {
  const created = studyOf(await client.postJson("demo:studies", { ...body, file_session_id: sid, ui_locale: uiLocale }));
  try {
    return studyOf(await client.postJson(`demo:studies/${encodeURIComponent(created.id)}/start`, { file_session_id: sid }));
  } catch (err) {
    throw new StartFailed(created, err);
  }
}

export type DynSetup =
  | { status: "loading" } | { status: "off" } | { status: "error"; message: string }
  | { status: "notDynamic" } | { status: "ready"; candidates: DynCandidate[] };

export async function fetchDynamicsSetup(client: StudyClient): Promise<DynSetup> {
  const status = (await client.getJson<{ enabled?: boolean }>("demo:file/dynamics/run/status")) ?? {};
  if (status.enabled !== true) return { status: "off" };
  const probe = (await client.getJson<{ is_dynamic?: boolean; sample_candidates?: unknown }>("demo:file/dynamics/probe")) ?? {};
  if (probe.is_dynamic !== true) return { status: "notDynamic" };
  return { status: "ready", candidates: parseCandidates(probe.sample_candidates) };
}

export async function prepareDynamics(client: StudyClient, body: Record<string, unknown>): Promise<DynPrepared> {
  const res = (await client.postJson<{ plan?: unknown; confirmation_token?: unknown; notes?: unknown }>("demo:file/dynamics/run/prepare", body)) ?? {};
  if (typeof res.confirmation_token !== "string" || !res.plan || typeof res.plan !== "object") throw new Error("invalid prepare");
  const notes = Array.isArray(res.notes) ? res.notes.map((n) => (typeof n === "string" ? n : (n as { text?: unknown })?.text)).filter((n): n is string => typeof n === "string") : [];
  return { token: res.confirmation_token, plan: res.plan as Record<string, unknown>, notes };
}

export async function fetchDynamicsFigure(client: StudyClient, runId: string): Promise<string> {
  const res = (await client.getJson<{ mime?: string; content_b64?: string }>(`demo:file/dynamics/run/figure?run_id=${encodeURIComponent(runId)}&format=png`)) ?? {};
  if (!res.content_b64) throw new Error("no figure");
  return `data:${res.mime || "image/png"};base64,${res.content_b64}`;
}

export type StudyAction = "start" | "resume" | "cancel";

export async function studyAction(client: StudyClient, sid: string, id: string, action: StudyAction): Promise<Study> {
  return studyOf(await client.postJson(`demo:studies/${encodeURIComponent(id)}/${action}`, { file_session_id: sid }));
}

export async function discardStudy(client: StudyClient, sid: string, id: string): Promise<void> {
  await client.postJson(`demo:studies/${encodeURIComponent(id)}/discard`, { file_session_id: sid });
}
