import { asEntry, fileNameOf, parseVersionDiff, parseVersionList, type VersionDiff, type VersionEntry, type VersionList } from "./model";

export type PostClient = { postJson<T = unknown>(path: string, body?: unknown): Promise<T> };

export async function fetchVersionList(client: PostClient, fileSessionId: string): Promise<VersionList> {
  return parseVersionList(await client.postJson("demo:versions", { file_session_id: fileSessionId }));
}

export async function takeSnapshot(client: PostClient, fileSessionId: string, label: string, note: string): Promise<VersionList> {
  await client.postJson("demo:versions/snapshot", {
    file_session_id: fileSessionId, label, note, source: "user",
  });
  return fetchVersionList(client, fileSessionId);
}

export async function fetchVersionDiff(client: PostClient, fileSessionId: string, a: string, b: string): Promise<VersionDiff> {
  return parseVersionDiff(await client.postJson("demo:versions/diff", { file_session_id: fileSessionId, a, b }));
}

export async function saveVersionNote(client: PostClient, fileSessionId: string, id: string, label: string, note: string): Promise<VersionEntry> {
  const body = await client.postJson<{ entry?: unknown }>("demo:versions/note", {
    file_session_id: fileSessionId, id, label, note,
  });
  const entry = asEntry(body?.entry);
  if (!entry) throw new Error("invalid version entry");
  return entry;
}

export async function restoreVersion(
  client: PostClient,
  fileSessionId: string,
  id: string,
  refreshCase: (opts?: { reconnect: boolean }) => Promise<void>,
  markSwitching?: () => void,
): Promise<{ fileName: string; path: string }> {
  const body = await client.postJson<{ path?: unknown }>("demo:versions/restore", { file_session_id: fileSessionId, id });
  const path = body && typeof body.path === "string" ? body.path : "";
  const fileName = fileNameOf(path);
  markSwitching?.();
  await refreshCase({ reconnect: true });
  return { fileName, path };
}
