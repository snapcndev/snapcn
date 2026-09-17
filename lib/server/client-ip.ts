import "server-only";

/**
 * The client address, read from the END of `x-forwarded-for`.
 *
 * This used to take the *first* hop, which is the conventional reading and was
 * fine while the value only fed analytics. It stopped being fine when the same
 * value became a control: `x-forwarded-for` is a request header, so under any
 * proxy that *appends* rather than replaces — nginx's
 * `$proxy_add_x_forwarded_for`, which is what the Dockerfile path here uses —
 * the caller writes the first hop themselves. `X-Forwarded-For: <random>` per
 * request then resets whatever bucket is keyed on it, and the limit is
 * unbounded.
 *
 * Counting from the right fixes that: the last entry is the one *our* proxy
 * appended, and a caller cannot append after us. `TRUSTED_PROXY_HOPS` is how
 * many trailing entries belong to infrastructure we own — 0 (the default) is
 * correct for nginx-append and for any platform that sets a single value; raise
 * it to 1 on a platform that appends its own hop after the client's.
 *
 * ponytail: header-derived, so it is only as good as the proxy in front. A
 * misconfigured deployment that forwards the header untouched still lets a
 * caller pick their own bucket — the rate limiter is the real floor.
 */
export function clientIp(request: { headers: Headers }): string {
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
