import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { anonymousId, distinctIdFromCookie } from "@/lib/analytics-server";
import { audioUploadExists } from "@/lib/server/audio-file";
import { ensureCleanupSweep } from "@/lib/server/cleanup";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { enqueueRender, type RenderSpec } from "@/lib/server/render-queue";
import {
  parseVideoTimelineInput,
  RenderInputError,
} from "@/lib/server/validate-input";
import { CANVAS, totalDuration } from "@/lib/video-editor/types";

// Node runtime: native Remotion render (Chromium) needs full Node, not edge.
export const runtime = "nodejs";

/**
 * POST /api/render
 *
 * Payload: `{ type: "video-timeline", clips[] }` — the multi-component editor
 * export.
 *
 * Rate-limits per IP, validates the payload, enqueues a background render, and
 * returns `{ jobId }` (202) immediately. The render never blocks the request;
 * poll `GET /api/render/[jobId]` for progress. Errors: `{ error, code }`.
 */
export async function POST(request: NextRequest) {
  // Install the TTL sweep on first request (idempotent).
  ensureCleanupSweep();

  const ip = clientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        error: "Too many render requests. Please wait and retry.",
        code: "rate_limited",
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "invalid_json" },
      { status: 400 },
    );
  }

  // Two halves, and the split is the point: the *body* may request a clean
  // export, the *session* is what grants it. A crafted POST asking for one
  // while signed out still gets the mark, because the grant never comes from
  // the payload.
  //
  // Signing in no longer removes the mark on its own — it only makes the
  // choice available, which is why this is `signedIn && requested` rather than
  // just `signedIn`. Failing closed is the only correct direction here: no
  // session, an unreadable session, or no explicit request all mean marked.
  let signedIn = false;
  try {
    signedIn = Boolean((await auth())?.user);
  } catch {
    // A session lookup that throws (DB down, adapter unconfigured) must not
    // hand out a clean export, and must not fail the render either.
    signedIn = false;
  }

  let spec: RenderSpec;
  try {
    spec = buildSpec(body, { signedIn, origin: publicOrigin(request) });
  } catch (err) {
    if (err instanceof RenderInputError) {
      return NextResponse.json(
        { error: err.message, code: "invalid_input" },
        { status: err.status },
      );
    }
    throw err;
  }

  // A soundtrack that is not on disk any more must stop the export, not ride
  // along in the spec. The renderer fetches `spec.audio.src` and, when it 404s,
  // carries on and produces a perfectly good video with no sound — which the
  // person downloading it has no way to know until they play it. An error they
  // can act on beats a file they have to discover is wrong.
  // `inputProps` is deliberately `Record<string, unknown>` — the queue does not
  // know what any composition wants — so the shape is read back here rather
  // than pretended into the type.
  const specAudio = spec.inputProps.audio as { uploadId?: string } | null;
  if (specAudio?.uploadId && !(await audioUploadExists(specAudio.uploadId))) {
    return NextResponse.json(
      {
        error:
          "That soundtrack is no longer available — re-upload it and try the export again.",
        code: "audio_missing",
      },
      { status: 409 },
    );
  }

  // Read here, not in the queue: the render runs detached and by the time it
  // starts there is no request left to take a cookie from. This is what joins a
  // render to the person who opened the editor.
  spec.distinctId =
    distinctIdFromCookie(request.cookies) ??
    (await anonymousId(ip, request.headers.get("user-agent") ?? ""));

  const jobId = enqueueRender(spec);
  return NextResponse.json({ jobId }, { status: 202 });
}

/**
 * Validate an untrusted body into the video-timeline render request.
 *
 * `signedIn` is a second argument rather than a field on `body` so the type
 * system enforces what the comment at the call site asks for: the payload can
 * carry the *request*, never the *authority*, and a future caller cannot forget
 * to supply the session.
 *
 * Exported for test — this is the one function where getting the argument
 * wrong gives away the paid feature.
 */
export function buildSpec(
  body: unknown,
  { signedIn, origin = "" }: { signedIn: boolean; origin?: string },
): RenderSpec {
  const { clips, removeWatermark, font, audio } = parseVideoTimelineInput(body);
  // The one line that decides who gets a clean file.
  const watermark = !(signedIn && removeWatermark);
  return {
    compositionId: "video-timeline",
    inputProps: {
      clips,
      watermark,
      font,
      // Built here from *our* origin and a validated id, so the only URL the
      // renderer can be pointed at is one of our own files.
      audio: audio
        ? {
            src: `${origin}/api/audio/${audio.id}`,
            name: "soundtrack",
            volume: audio.volume,
            trimStart: audio.trimStart,
            uploadId: audio.id,
            durationSeconds: 0,
          }
        : null,
    },
    width: CANVAS.width,
    height: CANVAS.height,
    fileName: "snapcn-video.mp4",
    // Same sum `calculateMetadata` uses in `src/remotion/Root.tsx`, computed
    // here so the queue can size the timeout before the render starts.
    durationInFrames: totalDuration(clips),
  };
}

/**
 * The origin a *browser* would use, which is not always the one in `request.url`.
 *
 * Behind a reverse proxy the request arrives on an internal socket: the proxy
 * sets `x-forwarded-proto: https` while the URL still carries `localhost:3000`.
 * Reading `new URL(request.url).origin` there yields `https://localhost:3000` —
 * a scheme and a port that never agree — and the renderer, which fetches the
 * soundtrack over the network, dies on a TLS handshake against a plain HTTP
 * port. It cost a working export the moment the app moved behind TLS.
 *
 * Forwarded headers win when present, because only the proxy knows the public
 * name. They are trusted for the same reason `clientIp` trusts them: nothing
 * reaches this process except through our own proxy.
 */
function publicOrigin(request: NextRequest): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  if (host) return `${proto || url.protocol.replace(":", "")}://${host}`;
  return url.origin;
}

/** First hop of x-forwarded-for (the real client behind the proxy), else fallback. */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
