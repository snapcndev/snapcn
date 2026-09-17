import "server-only";
import { unstable_cache } from "next/cache";

/**
 * How many developers installed each component in the last 30 days — the proof
 * on a component page that other people already use it.
 *
 * Read from the install events PostHog already has (`registry_component_fetched`,
 * captured in `middleware.ts`). Nothing new is recorded to make this number.
 *
 * ## What counts
 *
 * Distinct installers whose user agent is the shadcn CLI itself (`shadcn/…`, or
 * `node` from older CLI versions) — a person running `npx shadcn add`. Not
 * browsers: the site's own pages fetch `/r/*.json` to show code. Not curl,
 * scripts or requests with no user agent: over 30 days those were another ~400
 * "installers" that are mostly agents and scripts sweeping the index. Not
 * `shadcn-registry-health`, the registry directory's uptime probe. What is left
 * is a slight undercount of people, which is the honest direction to be wrong in.
 *
 * ## Why cached for a day
 *
 * A HogQL query per page view would make every docs page wait on an analytics
 * API. The number is a 30-day window, so a day-old copy of it is the same claim.
 *
 * Needs `POSTHOG_PERSONAL_API_KEY` (a personal key with Query read) and
 * `POSTHOG_PROJECT_ID`. Without them this is null and the pages show no badge —
 * never a zero.
 */

const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT = process.env.POSTHOG_PROJECT_ID;
const HOST = (
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com"
).replace(/\/+$/, "");

const INSTALLERS = `
  from events
  where event = 'registry_component_fetched'
    and match(lower(coalesce(properties.user_agent, '')), '^(shadcn|node)')
    and not match(lower(properties.user_agent), 'registry-health')
    and timestamp > now() - interval 30 day`;

async function hogql(query: string): Promise<unknown[][]> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}`);
  return ((await res.json()) as { results?: unknown[][] }).results ?? [];
}

export interface InstallCounts {
  /** Distinct installers of anything — not the sum of the per-component counts. */
  total: number;
  byComponent: Record<string, number>;
}

const load = unstable_cache(
  async (): Promise<InstallCounts | null> => {
    if (!KEY || !PROJECT) return null;
    try {
      const [total, rows] = await Promise.all([
        hogql(`select count(distinct distinct_id) ${INSTALLERS}`),
        hogql(
          `select properties.component, count(distinct distinct_id) ${INSTALLERS} group by properties.component`,
        ),
      ]);
      return {
        total: Number(total[0]?.[0] ?? 0),
        byComponent: Object.fromEntries(
          rows.map(([name, n]) => [String(name), Number(n)]),
        ),
      };
    } catch (err) {
      console.warn("[install-counts] unavailable, showing no badge:", err);
      return null;
    }
  },
  ["install-counts-30d"],
  { revalidate: 86_400 },
);

/**
 * The badge threshold. "Installed by 3 developers" is proof of the opposite, so
 * a component below this shows nothing rather than a small number.
 */
export const MIN_SHOWN = 20;

export async function installCounts(): Promise<InstallCounts | null> {
  return load();
}
