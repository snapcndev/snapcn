import "server-only";
import { desc, eq } from "drizzle-orm";
import { sharedVideos, users } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";

/**
 * Share links: a finished export kept at a permanent URL.
 *
 * The point of the feature, in one line: today an export is an MP4 someone
 * attaches somewhere, and that view happens on Slack's servers. A link means
 * every person who watches it lands here instead, on a page that says what made
 * it. Every export becomes a piece of distribution that costs nothing to run.
 *
 * There is no listing query and no "all shares" read. A share is reachable by
 * its id or by its owner, and that is the whole access model — see the note on
 * {@link sharedVideos} for why this is not a showcase submission.
 */

/** Longest title we will store. Past this it is not a title, it is a body. */
export const MAX_TITLE = 120;

/**
 * What a client sent, reduced to what we are willing to store.
 *
 * Exported for test (same convention as `buildSpec` in app/api/render): this is
 * a trust boundary — the values arrive from a `fetch` body — and the two rules
 * that matter are easier to prove here than through a mocked route. The slug
 * filter is the one with teeth: `componentsUsed` ends up rendered as text and as
 * `href`s on a public page, so anything that is not a registry slug shape is
 * dropped rather than escaped.
 */
export function normalizeShareInput(input: {
  title?: unknown;
  componentsUsed?: unknown;
}): { title: string; componentsUsed: string[] | undefined } {
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim().slice(0, MAX_TITLE)
      : "Untitled video";

  const componentsUsed = Array.isArray(input.componentsUsed)
    ? input.componentsUsed.filter(
        (slug): slug is string =>
          typeof slug === "string" && /^[a-z0-9-]+$/.test(slug),
      )
    : undefined;

  return { title, componentsUsed };
}

export type SharedVideo = {
  id: string;
  jobId: string;
  title: string;
  componentsUsed: string[] | null;
  createdAt: Date;
  authorName: string | null;
  authorImage: string | null;
};

export async function createSharedVideo(input: {
  userId: string;
  jobId: string;
  title: string;
  componentsUsed?: string[];
}): Promise<{ id: string }> {
  const [row] = await getDb()
    .insert(sharedVideos)
    .values({
      userId: input.userId,
      jobId: input.jobId,
      title: input.title,
      componentsUsed: input.componentsUsed ?? null,
    })
    .returning({ id: sharedVideos.id });
  return row;
}

/**
 * One share, by the id in its URL. `null` for anything else.
 *
 * Joined to `users` so the page can credit whoever made it; a left join because
 * the author row can be gone (account deleted cascades the share, but not in the
 * window between the two) and a missing name is a byline we skip, not a 500.
 */
export async function getSharedVideo(id: string): Promise<SharedVideo | null> {
  if (!isDbConfigured) return null;
  try {
    const [row] = await getDb()
      .select({
        id: sharedVideos.id,
        jobId: sharedVideos.jobId,
        title: sharedVideos.title,
        componentsUsed: sharedVideos.componentsUsed,
        createdAt: sharedVideos.createdAt,
        authorName: users.name,
        authorImage: users.image,
      })
      .from(sharedVideos)
      .leftJoin(users, eq(sharedVideos.userId, users.id))
      .where(eq(sharedVideos.id, id))
      .limit(1);
    return row ?? null;
  } catch (err) {
    console.error("[share] getSharedVideo failed:", err);
    return null;
  }
}

/** Somebody's own links, newest first. Backs "my links" in the account menu. */
export async function getSharedVideosForUser(
  userId: string,
): Promise<SharedVideo[]> {
  if (!isDbConfigured) return [];
  try {
    return await getDb()
      .select({
        id: sharedVideos.id,
        jobId: sharedVideos.jobId,
        title: sharedVideos.title,
        componentsUsed: sharedVideos.componentsUsed,
        createdAt: sharedVideos.createdAt,
        authorName: users.name,
        authorImage: users.image,
      })
      .from(sharedVideos)
      .leftJoin(users, eq(sharedVideos.userId, users.id))
      .where(eq(sharedVideos.userId, userId))
      .orderBy(desc(sharedVideos.createdAt));
  } catch (err) {
    console.error("[share] getSharedVideosForUser failed:", err);
    return [];
  }
}
