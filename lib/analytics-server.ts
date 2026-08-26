/**
 * Server-side PostHog capture — no SDK, one `fetch` to the public capture API.
 *
 * (No `import "server-only"`: this module is imported by Edge middleware, which
 * is not bundled under the `react-server` condition that package resolves
 * through. Nothing here is client-importable anyway — it reads request headers.)
 *
 * ## Why not `posthog-node`
 *
 * `posthog-node` batches events in memory and flushes on a timer, which is
 * exactly wrong here: middleware and route handlers are serverless invocations
 * that can be frozen the instant they return a response, so a queued batch is a
 * dropped batch unless every call site remembers to `await posthog.shutdown()`.
 * A single awaited POST has no queue to lose. It is also the only option that
 * runs in Edge middleware, where `posthog-node` does not, so this file is the
 * one capture path for *both* runtimes instead of two that drift.
 *
 * Cost is one HTTPS round-trip, which the caller keeps off the critical path by
 * wrapping it in `after()`.
 *
 * ## Identity
 *
 * A browser that has already loaded posthog-js carries its distinct id in the
 * `ph_<key>_posthog` cookie. Reading it (`distinctIdFromCookie`) is what makes a
 * server event land on the *same person* as that visitor's client events —
 * without it, "viewed the docs page" and "actually ran shadcn add" would be two
 * unrelated strangers and the funnel between them could not be drawn.
 *
 * A CLI or an agent has no cookie and never will. Those get a stable
 * pseudonymous id derived from IP + user-agent, and are sent with
 * `$process_person_profile: false` so they are counted without creating a person
 * profile for every bot that crawls the registry.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * `NEXT_PUBLIC_POSTHOG_HOST` is the *dashboard* host (`us.posthog.com`), which
 * is a different hostname from the *ingestion* one (`us.i.posthog.com`) — POST
 * an event to the dashboard and it is silently discarded. Derive ingestion from
 * the region the same way `next.config.ts` does, so one env var stays the only
 * thing anyone has to set.
 *
 * Unlike the browser, this does not go through the `/ingest` proxy: there is no
 * ad blocker between two servers, and pointing the app's own origin at itself
 * would be a loop.
 */
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "").includes("eu.")
  ? "https://eu.i.posthog.com"
  : "https://us.i.posthog.com";

export type ServerEvent =
  /**
   * ★ The conversion event. A `shadcn add` fetch of `/r/<component>.json` — the
   * only signal in this product that someone *installed* a component rather than
   * looked at one. Everything else on the site is a leading indicator of this.
   */
  | "registry_component_fetched"
  /**
   * A fetch of `/r/<name>.json` for a component that does not exist — a 404.
   *
   * Deliberately a *separate* event rather than a `found: false` property on the
   * one above, because middleware cannot see a response status: it fires on the
   * way in, so without this split every 404 would land in the conversion count
   * and any insight built on `registry_component_fetched` would silently include
   * failed installs. Splitting keeps that number correct by default.
   *
   * It is also worth reading on its own. Someone running `shadcn add` against a
   * name we do not have is the same signal as a zero-result docs search — a
   * request for a component, written by a user who did not know they were filing
   * one. Trimming the registry in ee250e3 left 68 such names in the wild.
   */
  | "registry_component_missing"
  /** `/llms.txt` or `/llms-full.txt` — the size of the AI-agent channel. */
  | "llms_txt_fetched"
  /** A docs search, with its result count. Zero-result queries are the roadmap. */
  | "docs_searched"
  /**
   * A render reached the front of the queue and started.
   *
   * Paired with the two below so the funnel is legible: `editor_export_started`
   * fires in the browser and can only say someone asked. These three are the
   * only view of what the box actually did — and since the renderer moved onto
   * hardware we own, its throughput is our problem rather than a platform's.
   *
   * `queued_ms` is the one to watch. It is the wait for a concurrency slot, so
   * it stays near zero until demand passes `RENDER_MAX_CONCURRENT` and then
   * climbs fast. That number, not CPU, is what says "buy a bigger box".
   */
  | "render_started"
  /**
   * A finished MP4. `render_ms` over `frames` gives frames-per-second on this
   * hardware, which is the figure that decides whether the editor's length cap
   * is still honest.
   */
  | "render_succeeded"
  /**
   * A render that did not produce a file. `reason` is the message shown to the
   * user, `timed_out` separates a wedged Chromium from a genuine failure —
   * they need different fixes and would otherwise be one indistinguishable
   * number.
   */
  | "render_failed";

type Props = Record<string, unknown>;

/**
 * Send one event. Never throws and never rejects — analytics must not be able to
 * fail a registry fetch. Returns immediately as a no-op when unconfigured, so a
 * local checkout without a PostHog key behaves exactly like one with it.
 */
export async function captureServer(
  event: ServerEvent,
  distinctId: string,
  properties: Props = {},
  /**
   * When the thing happened, if that is not now.
   *
   * Only the debounced docs search passes this: it holds a query until the
   * person stops typing, so the flush can be seconds — or, if nobody searches
   * again, much longer — after the search itself. Without this the event would
   * land at flush time and a search made last thing at night could be counted
   * against the next morning.
   */
  timestamp: string = new Date().toISOString(),
): Promise<void> {
  // Same dev gate as the client provider: a local `pnpm dev` hitting
  // /r/<thing>.json must not land in the install count that decides what gets
  // built next. `pnpm build && pnpm start` sends for real.
  if (!KEY || process.env.NODE_ENV === "development") return;

  try {
    await fetch(`${HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          // Mirrors the client's `person_profiles: "identified_only"`: count the
          // event, don't mint a person for every crawler that hits the registry.
          $process_person_profile: false,
        },
        timestamp,
      }),
    });
  } catch {
    // Swallowed on purpose. See the doc comment.
  }
}

/**
 * The visitor's posthog-js distinct id, if this request came from a browser that
 * has already booted the client SDK. Cookie name is `ph_<projectKey>_posthog`
 * and the value is URL-encoded JSON.
 */
export function distinctIdFromCookie(cookies: {
  get(name: string): { value: string } | undefined;
}): string | null {
  if (!KEY) return null;
  const raw = cookies.get(`ph_${KEY}_posthog`)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as {
      distinct_id?: string;
    };
    return parsed.distinct_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Stable pseudonymous id for a caller with no cookie — a CLI, an agent, a bot.
 *
 * SHA-256 over IP + user-agent, truncated. Not reversible to an IP, stable for
 * as long as that machine keeps the same address, which is enough to tell "forty
 * installs" apart from "one person installing forty times" without storing
 * anything identifying. Web Crypto, so it runs on the Edge runtime.
 */
export async function anonymousId(ip: string, ua: string): Promise<string> {
  const bytes = new TextEncoder().encode(`snapcn:${ip}:${ua}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `anon:${hex}`;
}

export type ClientKind = "agent" | "bot" | "cli" | "browser" | "unknown";

/**
 * Who is on the other end of a registry fetch.
 *
 * This is the property that makes `registry_component_fetched` worth having:
 * without it the number is "requests", which GoogleBot inflates and which cannot
 * distinguish a human running `shadcn add` from Claude Code running it for them.
 * With it you can read the install count three ways — humans, agents, and
 * crawlers-to-ignore — which is the actual question about how this registry is
 * being adopted.
 *
 * Order matters. `PerplexityBot` and `ChatGPT-User` both contain bot-ish tokens,
 * and agents commonly run through Node, so agents are matched first, then
 * crawlers, then generic HTTP clients, and only then browsers — because a
 * headless agent will happily send a full `Mozilla/5.0` string.
 */
export function classifyClient(userAgent: string | null): ClientKind {
  if (!userAgent) {
    // No UA at all is almost always a script. `fetch` in Node sends none.
    return "cli";
  }
  const ua = userAgent.toLowerCase();

  if (
    /claude|anthropic|chatgpt|openai|gptbot|perplexity|cursor|copilot|codeium|gemini|google-extended|cohere|you\.com|phind/.test(
      ua,
    )
  ) {
    return "agent";
  }
  if (/bot\b|crawler|spider|slurp|facebookexternalhit|bingpreview/.test(ua)) {
    return "bot";
  }
  if (
    /shadcn|node|undici|axios|got\/|curl|wget|bun|deno|python-requests|go-http|okhttp|libwww|httpie/.test(
      ua,
    )
  ) {
    return "cli";
  }
  if (/mozilla|webkit|gecko|chrome|safari|firefox|edge/.test(ua)) {
    return "browser";
  }
  return "unknown";
}
