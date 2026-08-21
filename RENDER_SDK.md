# @snapcn/render-sdk

An OSS engine library for rendering [Remotion](https://remotion.dev) with adapters per execution
backend. In spirit — like [files-sdk](https://github.com/haydenbleasel/files-sdk): one
small honest API, swappable adapters behind a single contract, the native SDK as an escape hatch.

A separate project in a separate repository. License — MIT.

---

## 1. Why

The render mechanism in snapcn is already **duplicated**: `lib/server/render-queue.ts` +
`app/api/render/*` (github-stars), and its copy-paste in `lib/server/site-video/*` +
`app/api/site-video/render/*` on the `feat/site-to-video` branch (two independent `p-limit`
instances in one process). A third consumer is on the way — **studio** (`studio.snapcn.dev`,
a separate deployment). All three need a single render engine.

The SDK solves: create a render job, learn its state/progress, get the result (url/stream) —
via a single contract on top of different backends (self-hosted server, AWS Lambda).

## 2. Boundary of responsibility

> **"You give us a `serveUrl` (+ `functionName` for lambda) — we own everything from `start()` onward."**

- **Where Remotion provisioning ends (`bundle` / `deploySite` / `deployFunction`) — that's where we begin.** Provisioning stays with the user/CI; the SDK does not wrap it (wrappers would be pass-through mirrors of the Remotion API, brittle across version changes).
- **The SDK does not ship HTTP** (neither a handler nor a browser client). Transport — recipes in the docs.
- **The SDK does not validate `inputProps`** — only the consumer knows their shape (they know their own composition). Domain validation (e.g., a stargazer limit, hex color, SSRF) lives in the application.
- **The SDK does not own the results catalog** — listing finished videos is the job of the consumer's DB (studio/drizzle) or files-sdk on top of the same bucket.

## 3. Packaging

One package + subpath exports, `@remotion/*` are **optional peer deps** (you install only the backend you need).

```
@snapcn/render-sdk          → RenderSdk, types, InMemoryStore, waitForCompletion, RenderError
@snapcn/render-sdk/server   → RenderServer   (peer: @remotion/renderer)
@snapcn/render-sdk/lambda   → RenderLambda   (peer: @remotion/lambda)
```

```ts
import { RenderSdk } from "@snapcn/render-sdk";
import { RenderServer } from "@snapcn/render-sdk/server";
import { RenderLambda } from "@snapcn/render-sdk/lambda";
```

`@remotion/bundler` is **not a peer dep of the SDK** — it is only needed in the user's build script.

The `server`/`lambda` adapters must run on **one and the same** Remotion version (the lambda function and
the bundle must match). The SDK performs a runtime assertion that the versions match
(bundle ↔ function ↔ renderer) and throws a `RenderError` if they have drifted apart.

## 4. Public surface (v1)

All server-side. The HTTP layer is on the consumer's side.

```ts
start(input: RenderInput, options?: OptionsOf<A>): Promise<RenderHandle>
getState(handle: RenderHandle): Promise<RenderState>
getUrl(handle: RenderHandle): Promise<string>
download(handle: RenderHandle): Promise<ReadableStream>
waitForCompletion(handle: RenderHandle, opts?: WaitOptions): Promise<RenderState>
```

| Method | What it does |
|---|---|
| `start` | Creates a render job, returns a serializable `handle`. server — puts it into the limiter; lambda — fires immediately. |
| `getState` | Pull-based state. server — from the state store; lambda — `getRenderProgress` from AWS. |
| `getUrl` | A unified url across all adapters (see §7). Deterministic, valid when `status === "done"`. |
| `download` | A stream of the result. server — read from disk; lambda — fetch from S3. |
| `waitForCompletion` | Server-side "start and wait" — a loop over `getState` until `done`/`error`. For CLI/cron/webhook and lambda polling. |

## 5. Types

```ts
type RenderStatus = "queued" | "rendering" | "done" | "error";

// A serializable opaque token. One type across all adapters.
type RenderHandle = string & { readonly __brand: unique symbol };

type RenderState = {
  status: RenderStatus;
  progress: number;        // 0..1
  error?: string;          // only when status === "error"
};

type RenderInput = {
  compositionId: string;                  // the only required field
  inputProps?: Record<string, unknown>;   // shape is validated by the consumer
  serveUrl?: string;                       // override of the default from the adapter config
  codec?: Codec;                           // default "h264"
  frameRange?: [number, number];
  scale?: number;
  width?: number;
  height?: number;                         // dimension override (as stars does per-orientation)
  jpegQuality?: number;
  pixelFormat?: PixelFormat;
};

type WaitOptions = {
  onProgress?: (progress: number) => void;
  intervalMs?: number;                     // default ~1000
  signal?: AbortSignal;
  timeoutMs?: number;
};

class RenderError extends Error {
  code:
    | "invalid_input"
    | "render_failed"
    | "timeout"
    | "not_found"
    | "version_mismatch"
    | "adapter_error";
}
```

### Hard typing requirement

Everything is **inferred automatically from the adapter passed in** — the user **never writes `as Type`**.

```ts
interface RenderAdapter<TOptions> {
  start(input: RenderInput, options?: TOptions): Promise<RenderHandle>;
  getState(handle: RenderHandle): Promise<RenderState>;
  getUrl(handle: RenderHandle): Promise<string>;
  download(handle: RenderHandle): Promise<ReadableStream>;
}

function RenderServer(config: ServerConfig): RenderAdapter<ServerOptions>;
function RenderLambda(config: LambdaConfig): RenderAdapter<LambdaOptions>;

class RenderSdk<A extends RenderAdapter<any>> {
  constructor(config: { adapter: A; store?: StateStore }) {}
  start(input: RenderInput, options?: OptionsOf<A>): Promise<RenderHandle> { /* ... */ }
}
```

```ts
const render = new RenderSdk({ adapter: RenderLambda({ region, functionName, serveUrl }) });
render.start({ compositionId: "x" }, { framesPerLambda: 20 }); // options auto-typed as LambdaOptions
render.start({ compositionId: "x" }, { chromiumOptions: {} }); // ❌ compile error: lambda doesn't have it
```

## 6. Adapter configs

```ts
// SERVER
RenderServer({
  serveUrl: "./.remotion-bundle",          // INPUT: the bundle (provided by the user/CI)
  workDir: "/srv/renders",                 // OUTPUT-WRITE: a local path (required)
  publicUrl?: "https://snapcn.dev/renders",// OPT: the http base at which YOU serve workDir
  concurrency?: 2,                          // limiter (per-process)
});

// LAMBDA
RenderLambda({
  region: "us-east-1",
  functionName: "remotion-render-4-0-xxx", // from deployFunction
  serveUrl: "https://....s3.../sites/app/index.html", // from deploySite
});

// SDK
new RenderSdk({
  adapter: RenderServer({ /* ... */ }),
  store?: InMemoryStore(),                  // default; swappable for Redis/SQL
});
```

`serveUrl` (input — the bundle) and `workDir`/`publicUrl` (output) are **different axes** and never get mixed up.

### Adapter-specific options (escape hatch, second argument of `start`)

```ts
type ServerOptions = {
  concurrency?: number;            // per-job override of the limiter
  chromiumOptions?: ChromiumOptions;
  timeoutInMilliseconds?: number;
};

type LambdaOptions = {
  framesPerLambda?: number;
  webhook?: WebhookConfig;         // lambda's native webhook
  privacy?: "public" | "private";
  outName?: string;
  maxRetries?: number;
};
```

## 7. Unified `getUrl`

The type is always `Promise<string>`; the instance is not blocked by the absence of `publicUrl`.

| Adapter / config | `getUrl(handle)` |
|---|---|
| Server with `publicUrl` | `${publicUrl}/${handle}.${ext}` |
| Server without `publicUrl` | `${handle}.${ext}` (just the file name — you concatenate it yourself) |
| Lambda | S3 url (signed for a private bucket) |

- The server adapter **itself** creates and names the file: `${workDir}/${handle}.${ext}`.
- `ext` depends on `codec` (per render): server takes it from the state store, lambda — from what is encoded in the `handle`.
- `publicUrl` **serves nothing by itself** — file availability is the user's responsibility (nginx/CDN/volume serving `workDir`); the SDK merely concatenates the string.

## 8. Lifecycle (browser scenario)

```
BROWSER                              CONSUMER (its own routes)         @snapcn/render-sdk
  │ POST /api/render {inputProps} ──► POST route (validation/auth) ──► start()
  │ ◄──────────────────────────────── { handle } ◄───────────────── handle
  │
  │ poll every ~700ms:
  │ GET /api/render/{handle} ───────► GET route ───────────────────► getState(handle)
  │ ◄──────────────────────────────── { status, progress }
  │ ... updates the progress bar ...
  │ ◄──────────────────────────────── { status: "done" }
  │
  │ GET <getUrl(handle)> ───────────► (static serving OR a route → download(handle)) ─► stream
  │ ◄═══════════════════ mp4 ════════════════════════════════════
```

Server scenario (CLI/cron/webhook): `const h = await render.start(...); await render.waitForCompletion(h, { onProgress })`.

## 9. State-store SPI

```ts
interface StateStore {
  create(handle: RenderHandle, initial: RenderRecord): Promise<void>;
  get(handle: RenderHandle): Promise<RenderRecord | null>;
  update(handle: RenderHandle, patch: Partial<RenderRecord>): Promise<void>;
  delete(handle: RenderHandle): Promise<void>;
}

type RenderRecord = {
  status: RenderStatus;
  progress: number;
  error?: string;
  codec: Codec;            // → ext for getUrl/download
  createdAt: number;
  meta?: Record<string, unknown>; // consumer data (repo/name/preview); the SDK knows nothing of the domain
};
```

- **server** relies on the store as the source of truth for progress (writes `onProgress` → reads `getState`).
- **lambda** does not use the store — state lives in AWS.
- Default — `InMemoryStore`. For multi-instance/persistence, swap it for Redis/SQL.

## 10. server vs lambda semantics

| | server | lambda |
|---|---|---|
| Execution | `@remotion/renderer` in-process | distributed on AWS |
| State | state store | `getRenderProgress` from AWS |
| Queue | `concurrency` limiter (per-process) | none, AWS scales on its own |
| `getUrl` | `publicUrl`/file name + `${handle}.${ext}` | S3 url |
| `download` | read from disk `workDir` | fetch from S3 |
| handle encodes | jobId (+ext from the store) | renderId + bucket + region + ext |
| Result upload | none (local file) | mandatory upload to S3 (that's how lambda works) |

## 11. Transport recipes (the "client" section in the docs)

### Next.js — POST (yours) + two GETs

```ts
// app/api/render/route.ts  — your validation/rate-limit/auth goes here
export async function POST(req: Request) {
  const input = parseRenderInput(await req.json());       // your domain validation
  const handle = await render.start({ compositionId: "github-stars", inputProps: input });
  return Response.json({ handle });
}
```
```ts
// app/api/render/[handle]/route.ts  — polling
export async function GET(_req, { params }) {
  const { handle } = await params;
  return Response.json(await render.getState(handle));
}
```
```ts
// app/api/render/[handle]/download/route.ts  — if workDir is NOT served statically
export async function GET(_req, { params }) {
  const { handle } = await params;
  const stream = await render.download(handle);
  return new Response(stream, { headers: { "Content-Type": "video/mp4" } });
}
```

### Browser poll loop

```ts
const { handle } = await (await fetch("/api/render", { method: "POST", body })).json();
const tick = async () => {
  const s = await (await fetch(`/api/render/${handle}`)).json();
  setProgress(s.progress);
  if (s.status === "done") return downloadFrom(await getUrlSomehow(handle));
  if (s.status === "error") throw new Error(s.error);
  setTimeout(tick, 700);
};
```

## 12. Provisioning recipes (on the user's side)

### Server — bundle (build step)

```ts
import { bundle } from "@remotion/bundler";
const serveUrl = await bundle({ entryPoint, webpackOverride });
// → pass serveUrl to RenderServer({ serveUrl })
```

### Lambda — deploy (CI)

```ts
import { deploySite, deployFunction } from "@remotion/lambda";
const { functionName } = await deployFunction({ region, /* ... */ });
const { serveUrl } = await deploySite({ region, entryPoint, /* ... */ });
// → pass to RenderLambda({ region, functionName, serveUrl })
```

## 13. Integrations

- **stars (snapcn.dev):** replaces `lib/server/render-queue.ts` + `render.ts` with `RenderServer`; `validate-input.ts` stays in the application; `use-mp4-export.ts` polls its own routes.
- **site-video:** removes the `lib/server/site-video/*` duplicate — **stars and site-video share one `RenderSdk` instance** (one limiter per process, fixes the bug with two `p-limit`s).
- **studio (studio.snapcn.dev):** its own SDK instance (separate deployment/process); records every render into **its own drizzle DB** `(project_id, user_id, handle, url, created_at)` → "getting finished videos" = a query against its own DB. One generic composition + a JSON spine in `inputProps`.

## 14. Out of scope for v1 (deliberately)

- **cancel** — lambda has no native cancellation; canceling a running server render cross-process is nontrivial too. Removed entirely.
- **list / delete** — the results catalog is the consumer's DB or files-sdk.
- **auto-cleanup** (TTL sweep, delete-after-download) — the user cleans up however they like.
- **storage adapter / upload** — no internal consumer; need to upload somewhere of your own → `download` → your own tool (a recipe in the docs).
- **provisioning wrappers** — pass-through mirrors of Remotion, we don't do them.
- **browser client / HTTP handler** — transport is recipes in the docs.

## 15. Known limitations of v1

- **State / limiter / url are per-process.** Multi-instance → you need a shared store (Redis) and sticky routing / a shared volume for static serving of `workDir`. A single-process deployment (like snapcn on Coolify) works out of the box.
- **`getUrl` is valid only when `status === "done"`** (before that the file/object isn't ready → 404).
- **Cloud Run / Vercel Sandbox / WebCodecs** — not in v1 (Remotion's Cloud Run is in alpha and not being developed; the rest are candidates for future adapters).

## 16. Future (v1.1+)

- Redis/SQL `StateStore` (durable, multi-instance).
- A thin browser client (`@snapcn/render-sdk/client`) — to remove the poll-loop duplication.
- `cancel` (hard for server, soft for lambda + `capabilities`).
- Adapters: Vercel Sandbox, Cloud Run (after the lambda runtime is ported).
