// Answers every screen request from the sample data in this folder. The only state is whether the
// demo case has been "opened" by approving the new-case draft, and the one sample change request.
import caseAttached from "./case-attached.json";
import caseDetached from "./case-detached.json";
import changeRequest from "./change-request.json";
import newcase from "./newcase.json";
import problems from "./problems.json";
import studies from "./studies.json";
import templates from "./templates.json";
import versionDiff from "./version-diff.json";
import versions from "./versions.json";

type Script = Array<[string, unknown, number?]>;
export type Reply =
  | { kind: "json"; status: number; body: unknown }
  | { kind: "stream"; events: Script };

const OPENED_KEY = "hysys_demo_opened";
const readOpened = (): boolean => {
  try { return new URLSearchParams(location.search).get("case") === "open" || sessionStorage.getItem(OPENED_KEY) === "1"; } catch { return false; }
};
let opened = readOpened();
let cr: Record<string, unknown> | null = null;

function setOpened(): void {
  opened = true;
  try { sessionStorage.setItem(OPENED_KEY, "1"); } catch { /* storage may be blocked */ }
}

const json = (body: unknown, status = 200): Reply => ({ kind: "json", status, body });
const stream = (events: unknown[]): Reply => ({ kind: "stream", events: events as Script });
const notInDemo = () => json({ message_ko: "화면 데모에서는 쓸 수 없는 기능이에요.", message_en: "Not available in the screen demo." }, 501);

export function route(method: "GET" | "POST", path: string, body: unknown): Reply {
  const [key] = path.split("?");
  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (key === "demo:case") return json(opened ? caseAttached : caseDetached);
  if (key === "demo:case/item") return json(itemOf(new URLSearchParams(path.split("?")[1] ?? "").get("name") ?? ""));
  if (key === "demo:problems") return json(problems);

  if (key === "demo:new-case/templates") return json(templates);
  if (key === "demo:new-case") return stream(payload.mode === "words" ? newcase.start_words : newcase.start_other);
  if (key === "demo:new-case/answer") return stream(newcase.after_answer);
  if (key === "demo:new-case/revise") return stream(newcase.revise);
  if (["demo:new-case/recheck", "demo:new-case/resume", "demo:new-case/repair", "demo:new-case/confirm"].includes(key)) return stream(newcase.recheck);
  if (key === "demo:new-case/approve") {
    setOpened();
    return stream(newcase.approve);
  }
  if (key === "demo:new-case/cancel") return json({ ok: true });

  if (key === "demo:file/ask/stream") return stream(newcase.ask);
  if (key === "demo:change-requests") {
    if (method === "GET") return json({ change_requests: cr ? [cr] : [] });
    cr = { ...changeRequest, text: typeof payload.text === "string" && payload.text ? payload.text : changeRequest.text };
    return json({ redirect: null, change_request: cr });
  }
  if (key.startsWith("demo:change-requests/")) {
    const action = key.split("/")[2];
    const next: Record<string, string> = { approve: "applied", discard: "discarded", revert: "reverted" };
    if (cr && action && next[action]) cr = { ...cr, state: next[action] };
    return json({ change_request: cr ?? changeRequest });
  }

  if (key === "demo:versions") return json(versions);
  if (key === "demo:versions/diff") return json(versionDiff);
  if (key === "demo:studies/catalog") return json(studies.catalog);
  if (key === "demo:studies") return method === "GET" ? json(studies.list) : notInDemo();
  if (key === "demo:file/dynamics/run/status") return json({ enabled: false });
  return notInDemo();
}

function itemOf(name: string) {
  const conn = caseAttached.topology.connections;
  const unit = caseAttached.topology.units.find((u) => u.name === name);
  const stream = caseAttached.topology.streams.find((s) => s.name === name);
  return {
    name,
    kind: unit ? "unit" : stream?.type === "energy" ? "energy" : "stream",
    type: unit?.type ?? stream?.type ?? "",
    inlets: conn.filter((c) => c.to === name).map((c) => c.from),
    outlets: conn.filter((c) => c.from === name).map((c) => c.to),
    values: stream && stream.type === "material"
      ? [{ key: "Temperature", value: 35, unit: "°C" }, { key: "Pressure", value: 3470, unit: "kPa" }]
      : [],
  };
}
