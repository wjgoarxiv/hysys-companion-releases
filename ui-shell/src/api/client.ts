import { route } from "../mock/routes";

export type SseHandler = (name: string, data: unknown) => void;
export type RequestOptions = { signal?: AbortSignal };

export function isTauriRuntime(): boolean {
  return false;
}

export class DemoHttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(`demo_http_${status}`);
    this.name = "DemoHttpError";
    this.status = status;
    this.body = body;
  }
}

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});

async function answer<T>(method: "GET" | "POST", path: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
  await wait(120, opts.signal);
  const reply = route(method, path, body);
  if (reply.kind === "stream") throw new DemoHttpError(400, { detail: "stream route" });
  if (reply.status >= 400) throw new DemoHttpError(reply.status, reply.body);
  return reply.body as T;
}

export function createDemoClient() {
  return {
    async getJson<T = unknown>(path: string, opts?: RequestOptions): Promise<T> {
      return answer<T>("GET", path, undefined, opts);
    },
    async postJson<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
      return answer<T>("POST", path, body, opts);
    },
    async getBytes(_path: string): Promise<Uint8Array> {
      throw new DemoHttpError(404, { detail: "not in the demo" });
    },
    async postSse(path: string, body: unknown, onEvent: SseHandler, opts: RequestOptions = {}): Promise<void> {
      const reply = route("POST", path, body);
      if (reply.kind !== "stream") throw new DemoHttpError(reply.status, reply.body);
      for (const [name, data, delay] of reply.events) {
        await wait(delay ?? 450, opts.signal);
        if (opts.signal?.aborted) return;
        onEvent(name, data);
      }
    },
  };
}

export type DemoClient = ReturnType<typeof createDemoClient>;

let shared: DemoClient | undefined;
export function demoClient(): DemoClient {
  return (shared ??= createDemoClient());
}
export const getJson = <T = unknown>(path: string, opts?: RequestOptions) => demoClient().getJson<T>(path, opts);
export const postJson = <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) => demoClient().postJson<T>(path, body, opts);
export const postSse = (path: string, body: unknown, onEvent: SseHandler, opts?: RequestOptions) => demoClient().postSse(path, body, onEvent, opts);
