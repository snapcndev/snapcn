import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { anonymousId, distinctIdFromCookie } from "@/lib/analytics-server";
import type { PlanLimits } from "@/lib/plans";
import { audioUploadExists } from "@/lib/server/audio-file";
import { ensureCleanupSweep } from "@/lib/server/cleanup";
import { isDbConfigured } from "@/lib/server/db";
import {
  consumeRender,
  planFor,
  QuotaExceededError,
} from "@/lib/server/entitlements";
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

  // No database, no meter — and an export is the one thing here that cannot be
  // served unmetered. `planFor` degrades to the free plan without one, but
  // `consumeRender` deliberately does not: a meter that silently no-ops is an
  // unlimited meter, which is worse than an endpoint that is honestly off. 503
  // rather than 500, in the house style, because this is an unconfigured
  // deployment rather than a broken one.
  if (!isDbConfigured) {
    return NextResponse.json(
      { error: "Exports aren't configured yet.", code: "not_configured" },
      { status: 503 },
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
  // export, the *plan* is what grants it. A crafted POST asking for one still
  // gets the mark, because the grant never comes from the payload — and it no
  // longer comes from merely having an account either. Signing in used to be
  // the whole price of a clean file, which meant the paid tier was being given
  // away to anyone who clicked "Continue with GitHub".
  //
  // Failing closed is the only correct direction: no session, or a session
  // lookup that throws, both land on the anonymous plan — marked, one export,
  // 720p — rather than failing the render or opening it up.
  let userId: string | null = null;
  try {
    userId = (await auth())?.user?.id ?? null;
  } catch {
    // A session lookup that throws (DB down, adapter unconfigured) must not
    // hand out a paid render, and must not fail the export either.
    userId = null;
  }
  const { plan, limits } = await planFor(userId);

  let spec: RenderSpec;
  try {
    spec = buildSpec(body, { limits, origin: publicOrigin(request) });
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

  // Two different ids, and they must not be the same value.
  //
  // `anon` joins this render to a visitor for analytics, so it hashes IP + UA —
  // that is what tells forty machines apart from one.
  //
  // `meterKey` *counts* the render, so every input to it has to be something
  // the caller cannot choose. The user-agent is a request header: hashing it in
  // means `-H "User-Agent: x$i"` mints a fresh 1-render allowance on every
  // request and the free tier has no ceiling at all. The cookie id was rejected
  // for the same reason — clearing it buys another export. IP alone is the only
  // input left that a caller does not hand us.
  const ua = request.headers.get("user-agent") ?? "";
  const anon = await anonymousId(ip, ua);
  const meterKey = userId ?? (await anonymousId(ip, ""));

  // Before the queue, not after. `enqueueRender` returns the moment the job is
  // registered, and from there the CPU is spent whether or not anyone ever
  // downloads the file — so metering the download, or the success, would be
  // metering the wrong thing. Also after validation: a body that fails
  // `buildSpec`, or a soundtrack that has been swept, must not cost someone an
  // export they never got.
  try {
    await consumeRender(meterKey, limits);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      // 402, the one status code that means exactly this. A 429 would read as
      // "slow down" and the client would retry into the same wall forever.
      return NextResponse.json(
        {
          error: quotaMessage(err, plan),
          code: err.code,
          used: err.used,
          limit: err.limit,
        },
        { status: 402 },
      );
    }
    throw err;
  }

  // Read here, not in the queue: the render runs detached and by the time it
  // starts there is no request left to take a cookie from. This is what joins a
  // render to the person who opened the editor.
  spec.distinctId = distinctIdFromCookie(request.cookies) ?? anon;
  spec.meterKey = meterKey;

  const jobId = enqueueRender(spec);
  return NextResponse.json({ jobId }, { status: 202 });
}

/**
 * Validate an untrusted body into the video-timeline render request.
 *
 * `limits` is a second argument rather than a field on `body` so the type
 * system enforces what the comment at the call site asks for: the payload can
 * carry the *request*, never the *authority*, and a future caller cannot forget
 * to supply the plan.
 *
 * The body's `removeWatermark` is not read at all any more. A toggle only ever
 * expressed a preference the plan already answers, and every value it could
 * hold was one more thing to get wrong at the boundary — so there is now no
 * flag left to forge, coerce, or smuggle in nested.
 *
 * Exported for test — this is the one function where getting the argument
 * wrong gives away the paid feature.
 */
export function buildSpec(
  body: unknown,
  { limits, origin = "" }: { limits: PlanLimits; origin?: string },
): RenderSpec {
  const { clips, font, audio } = parseVideoTimelineInput(body);
  // The composition is authored at CANVAS but rendered at whatever size the
  // spec carries — `render.ts` spreads these over the composition — so the
  // plan's ceiling *is* the output size, and the same clips come out 720p on
  // free and 1080p on a paid plan with no second composition to keep in sync.
  // The aspect comes from CANVAS rather than a hardcoded 16:9 so a change to
  // the editor's shape cannot leave paid renders stretched.
  const width = even(limits.maxWidth);
  const height = even((width * CANVAS.height) / CANVAS.width);
  return {
    compositionId: "video-timeline",
    inputProps: {
      clips,
      // The one line that decides who gets a clean file, and it reads only from
      // the plan.
      watermark: limits.watermark,
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
    width,
    height,
    fileName: "snapcn-video.mp4",
    // Same sum `calculateMetadata` uses in `src/remotion/Root.tsx`, computed
    // here so the queue can size the timeout before the render starts.
    durationInFrames: totalDuration(clips),
  };
}

/**
 * Round to an even number of pixels.
 *
 * h.264 encodes in 2×2 chroma blocks and libx264 refuses an odd dimension
 * outright ("width not divisible by 2"), so an odd ceiling would not produce a
 * slightly smaller video — it would produce a render that dies after every
 * frame has already been drawn. The two ceilings in use (1280, 1920) are both
 * even; this is here so that changing one in `lib/plans.ts` stays a pricing
 * decision rather than an encoder outage.
 */
function even(n: number): number {
  return Math.round(n / 2) * 2;
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

/**
 * Why the export was refused, in the words that fit the actual reason.
 *
 * `used > limit` is the whole discriminator, and it is only reachable one way:
 * the count was run up under a larger allowance and the allowance then shrank.
 * A person who simply reaches the free ceiling stops *at* it — `used === limit`
 * — because the meter cannot increment past the number it is testing against.
 *
 * The distinction matters because the two need opposite messages. Someone who
 * exported fifty videos this month is having an unusual day and should be told
 * how to ask for more. Someone whose subscription lapsed on the twentieth is
 * not over any ceiling they recognise; telling them about fair use when the
 * real answer is "your plan ended" sends them to support with a question
 * support cannot answer from the message.
 */
export function quotaMessage(err: QuotaExceededError, plan: string): string {
  // `plan === "free"` as well as the overshoot: a signed-in account on the free
  // row is the only state a downgrade can land in. An anonymous caller has
  // never had a plan to lose, so telling them one ended is a sentence about
  // somebody else — and they can overshoot too, the moment the anonymous
  // ceiling is ever lowered below a count already on disk.
  if (plan === "free" && err.used > err.limit) {
    return `Your plan ended, and the free tier allows ${err.limit} exports a month — you've used ${err.used}. Resubscribe to keep exporting, or wait for next month.`;
  }
  // Not an upsell. At fifty a month this is an abuse ceiling, and anyone who
  // reaches it honestly should get a way to keep working rather than a
  // checkout button — the upgrade offer lives on the watermark, which every
  // export passes through.
  const who = plan === "anonymous" ? " Signing in raises it." : "";
  return `That's ${err.limit} exports this month — the fair-use ceiling.${who} Email hello@snapcn.dev and we'll lift it.`;
}

/**
 * The client address, read from the END of `x-forwarded-for`.
 *
 * This used to take the *first* hop, which is the conventional reading and was
 * fine while the value only fed analytics. It stopped being fine when the same
 * value became a money control: `x-forwarded-for` is a request header, so under
 * any proxy that *appends* rather than replaces — nginx's
 * `$proxy_add_x_forwarded_for`, which is what the Dockerfile path here uses —
 * the caller writes the first hop themselves. `X-Forwarded-For: <random>` per
 * request then resets both the rate-limit bucket and the free-render meter, and
 * the free tier is unbounded.
 *
 * Counting from the right fixes that: the last entry is the one *our* proxy
 * appended, and a caller cannot append after us. `TRUSTED_PROXY_HOPS` is how
 * many trailing entries belong to infrastructure we own — 0 (the default) is
 * correct for nginx-append and for any platform that sets a single value; raise
 * it to 1 on a platform that appends its own hop after the client's.
 *
 * ponytail: header-derived, so it is only as good as the proxy in front. A
 * misconfigured deployment that forwards the header untouched still lets a
 * caller pick their own bucket — the rate limiter below is the real floor.
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const ours = Number(process.env.TRUSTED_PROXY_HOPS);
    const skip = Number.isFinite(ours) && ours > 0 ? Math.floor(ours) : 0;
    const client = hops[hops.length - 1 - skip] ?? hops[hops.length - 1];
    if (client) return client;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
