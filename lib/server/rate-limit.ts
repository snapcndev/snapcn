import "server-only";

/**
 * Per-IP rate limiter, in-memory. Renders cost real CPU, so this caps how often
 * a single client can kick one off: at most `RENDER_RATE_LIMIT` requests per
 * `RENDER_RATE_WINDOW_MS` window. Implemented as a token bucket (capacity =
 * limit, refilled smoothly across the window) so bursts are bounded without a
 * hard fixed-window edge. Cheap and good enough for a single-process box — not a
 * distributed limiter.
 */

interface Bucket {
  /** Fractional tokens currently available. */
  tokens: number;
  /** Last time (ms) the bucket was refilled. */
  updatedAt: number;
}

/**
 * What is being limited. Each name gets its own bucket per IP and its own
 * budget: uploading a soundtrack and exporting a video are different actions
 * with different costs, and sharing one bucket meant three uploads left you
 * two exports for the minute.
 */
export type RateLimitBucket =
  | "render"
  | "audio"
  | "showcase"
  | "project"
  | "checkout";

/** Env prefix per bucket. `render` keeps `RENDER_*` so existing config still applies. */
const ENV_PREFIX: Record<RateLimitBucket, string> = {
  render: "RENDER",
  audio: "AUDIO",
  showcase: "SHOWCASE",
  project: "PROJECT",
  checkout: "CHECKOUT",
};

/**
 * Fallbacks: an upload is cheap next to a render, so it gets a wider budget —
 * and a project save is cheaper still. Autosave fires on a debounce while
 * someone is actively editing, so its budget has to cover a working minute of
 * that, not a click.
 */
const DEFAULT_LIMIT: Record<RateLimitBucket, number> = {
  render: 5,
  audio: 20,
  showcase: 5,
  project: 60,
  // A purchase is a deliberate, once-in-a-while act. The budget exists to stop
  // a loop hammering Dodo on our API key, not to pace a human.
  checkout: 5,
};

function envInt(name: string, fallback: number, min = 1): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= min
    ? Math.floor(parsed)
    : fallback;
}

/** Max requests per window before throttling (bucket capacity). */
function limit(bucket: RateLimitBucket): number {
  return envInt(`${ENV_PREFIX[bucket]}_RATE_LIMIT`, DEFAULT_LIMIT[bucket]);
}

/** Window over which a full bucket refills. */
function windowMs(bucket: RateLimitBucket): number {
  return envInt(`${ENV_PREFIX[bucket]}_RATE_WINDOW_MS`, 60_000);
}

const buckets = new Map<string, Bucket>();

// Evict idle buckets so the map can't grow unbounded from one-off IPs.
const IDLE_EVICT_MS = 60 * 60 * 1000;

/**
 * Consume one token for `ip` in `purpose`'s bucket. Returns true if allowed,
 * false if the bucket is empty (caller should respond 429).
 */
export function checkRateLimit(
  ip: string,
  purpose: RateLimitBucket = "render",
): boolean {
  const cap = limit(purpose);
  // Tokens refilled per ms so a full window restores the whole capacity.
  const ratePerMs = cap / windowMs(purpose);
  const now = Date.now();

  // Namespaced key: one IP holds an independent budget per purpose.
  const key = `${purpose}:${ip}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: cap, updatedAt: now };
    buckets.set(key, bucket);
  } else {
    const elapsed = now - bucket.updatedAt;
    bucket.tokens = Math.min(cap, bucket.tokens + elapsed * ratePerMs);
    bucket.updatedAt = now;
  }

  if (bucket.tokens < 1) {
    return false;
  }

  bucket.tokens -= 1;

  // Opportunistic eviction of long-idle buckets (kept tiny — only on access).
  if (buckets.size > 1000) {
    for (const [key, b] of buckets) {
      if (now - b.updatedAt > IDLE_EVICT_MS) buckets.delete(key);
    }
  }

  return true;
}
