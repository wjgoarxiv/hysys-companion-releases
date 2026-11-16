export type CrState = "draft" | "trial" | "ready" | "needs_confirm" | "approved" | "applied" | "reverting" | "reverted" | "failed" | "discarded";
export type CrKind = "scalar" | "structural";

export type DiffEdge = { unit: string; direction: string; stream: string };
export type DiffMoved = { unit: string; direction: string; from: string; to: string };
export type DiffSpecRow = { key: string; a: unknown; b: unknown; unit?: string | null };
export type DiffValueRow = { scope: string; key: string; a: unknown; b: unknown; abs_delta: number | null; rel_delta: number | null; unit?: string | null };
export type CrDiff = {
  units: { added: Array<{ name: string; type?: string | null }>; removed: Array<{ name: string; type?: string | null }> };
  streams: { added: string[]; removed: string[] };
  connections: { added: DiffEdge[]; removed: DiffEdge[]; moved: DiffMoved[] };
  specs: DiffSpecRow[];
  values: DiffValueRow[];
};

export type CrCheck = { status?: string | null; iterations?: number | null; seconds?: number | null };

export type CrNeed = {
  name: string; label_ko: string; label_en: string; unit_hint: string | null; kind: "number" | "text" | "spec"; required: boolean; options?: string[];
  unit_options?: string[];
  inlet_p_kpa?: number | null;
  title_ko?: string; title_en?: string;
};

export type CrTrial = { kind?: string | null; converged: boolean | null; check?: CrCheck | null; before?: unknown; after?: unknown; reason?: string | null; repair?: unknown };

export type RoundTrip = {
  seconds_min: number; seconds_max: number;
  unsaved_changes: number; unsaved_seconds: number; baseline: "last_saved" | "edit_started";
  new_file: string; closes_without_saving: boolean;
};

export type ChangeRequest = {
  id: string;
  file_session_id: string;
  kind: CrKind;
  state: CrState;
  created: string;
  text: string;
  seed: unknown;
  what: { ko: string; en: string };
  original_path: string;
  trial: CrTrial | null;
  diff: CrDiff | null;
  error: string | null;
  failure?: string | null;
  round_trip?: RoundTrip | null;
  confirm?: { reason: string } | null;
  snapshot_id: string | null;
  new_path: string | null;
  reverted_via: string | null;
  revert?: { method: string; path?: string | null; message_ko?: string; message_en?: string } | null;
  archived: boolean;
  history: Array<{ time: string; state: string; note: string }>;
  needs?: CrNeed[];
  params?: Record<string, unknown>;
  assumptions?: Array<{ ko: string; en: string }>;
};

export type FixSeed = { kind: string; target: string; params: Record<string, unknown>; summary_ko?: string; summary_en?: string };
export type SeedDetail = { file_session_id?: string; seed: FixSeed; title?: string };

export type ChooseRoute = "edit" | "new-case" | "answer";
export type ReplyKind = "answer" | "question" | "refuse" | "unavailable";
export type CreateReply = { kind: ReplyKind; message_ko: string; message_en: string; request?: string };
export type FollowUp = { request: string; question: string };
export type CreateResult = { redirect: "answer" | "new-case" | "choose" | "reply" | null; choices?: ChooseRoute[]; reply?: CreateReply; change_request: ChangeRequest | null };
export type CrResult = { change_request: ChangeRequest };

export type ErrorInfo = { ko: string | null; en: string | null; alternative?: string | null };

export type AnswerStatus = "nocase" | "choose" | "thinking" | "streaming" | "done" | "empty" | "error";
export type AnswerStep = { id: string; state: "running" | "done"; tools: string[] };
export type AnswerState = {
  status: AnswerStatus; question: string; text: string; error: ErrorInfo | null; steps?: AnswerStep[]; choices?: ChooseRoute[];
  reply?: { kind: ReplyKind; ko: string; en: string };
};
