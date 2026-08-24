const GITHUB_REPO = "snapcndev/snapcn";

/**
 * Fetches the repository star count from the GitHub REST API.
 * Cached at the edge for an hour so we never hammer the (unauthenticated)
 * rate limit. Returns `null` on any failure so callers can degrade
 * gracefully to a bare GitHub link.
 */
export async function getGitHubStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
      // Both callers are awaited inside a page render, so a GitHub outage — or a
      // connection that resets rather than refusing — used to hold the whole
      // route open until the socket gave up. The catch below already degrades to
      // a bare link; this is what makes it degrade *quickly*. Same 5s budget
      // `fetchOgImage` uses in lib/server/showcase.ts.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

/** 1234 → "1.2k", 980 → "980". */
export function formatStars(count: number): string {
  if (count < 1000) return String(count);
  const k = count / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * Fetches the repository's last-push timestamp (ISO string) from the same
 * cached GitHub endpoint as {@link getGitHubStars}. Powers the gallery top
 * bar's honest "Updated Xh ago" line. Returns `null` on any failure so the
 * caller can fall back to static copy.
 */
export async function getGitHubUpdatedAt(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
      // Both callers are awaited inside a page render, so a GitHub outage — or a
      // connection that resets rather than refusing — used to hold the whole
      // route open until the socket gave up. The catch below already degrades to
      // a bare link; this is what makes it degrade *quickly*. Same 5s budget
      // `fetchOgImage` uses in lib/server/showcase.ts.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { pushed_at?: string };
    return typeof data.pushed_at === "string" ? data.pushed_at : null;
  } catch {
    return null;
  }
}

/**
 * "2026-07-08T…Z" → "Updated 11h ago". Computed on the server at render time
 * (the page is ISR-revalidated hourly), so the string is deterministic HTML —
 * no client clock, no hydration mismatch. Returns `null` for a missing/invalid
 * timestamp so callers can degrade to static copy.
 */
export function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMinutes = Math.floor((Date.now() - then) / 60000);
  if (diffMinutes < 2) return "Updated just now";
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Updated ${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Updated ${months}mo ago`;
  return `Updated ${Math.floor(days / 365)}y ago`;
}
