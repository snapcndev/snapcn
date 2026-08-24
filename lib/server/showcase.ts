import "server-only";
import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { showcaseSubmissions, users } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";
import { RENDER_WORK_DIR, SHOWCASE_WORK_DIR } from "@/lib/server/paths";
import {
  detectPlatform,
  isHostedVideo,
  type Platform,
} from "@/lib/showcase/platform";

export { isHostedVideo, showcaseVideoUrl } from "@/lib/showcase/platform";

/**
 * Take a finished render out of the scratch dir and keep it.
 *
 * The export pipeline deletes an MP4 the moment its download stream ends and
 * sweeps anything left after ten minutes — correct for an export, fatal for a
 * submission. Moving the file is what turns one into the other, and a rename is
 * the whole operation: same filesystem, atomic, no copy of a multi-megabyte
 * file, and no window where the sweep can take it mid-flight.
 *
 * Returns false when there is nothing to claim — a jobId from a previous
 * process, one already swept, or one that was never real. The caller must treat
 * that as a failed submission rather than storing a row pointing at nothing.
 */
export async function claimRenderForShowcase(jobId: string): Promise<boolean> {
  const from = path.join(RENDER_WORK_DIR, `${jobId}.mp4`);
  const to = path.join(SHOWCASE_WORK_DIR, `${jobId}.mp4`);

  try {
    if (!(await stat(from)).isFile()) return false;
  } catch {
    return false;
  }

  await mkdir(SHOWCASE_WORK_DIR, { recursive: true });
  try {
    await rename(from, to);
  } catch (err) {
    // ponytail: EXDEV only — the two dirs are on different filesystems, which
    // happens the moment SHOWCASE_WORK_DIR is a mounted volume and the renders
    // stay on tmpfs. Copy then unlink. Put both dirs on the same volume and
    // this branch never runs.
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
    await copyFile(from, to);
    await rm(from, { force: true });
  }
  return true;
}

/** Drop a hosted video. Called when its submission is rejected. */
export async function discardShowcaseVideo(jobId: string): Promise<void> {
  await rm(path.join(SHOWCASE_WORK_DIR, `${jobId}.mp4`), { force: true });
}

export type ShowcaseItem = {
  id: string;
  title: string;
  postUrl: string;
  platform: Platform;
  description: string | null;
  thumbnailUrl: string | null;
  createdAt: Date;
  authorName: string | null;
  authorImage: string | null;
};

const selectFields = {
  id: showcaseSubmissions.id,
  title: showcaseSubmissions.title,
  postUrl: showcaseSubmissions.postUrl,
  platform: showcaseSubmissions.platform,
  description: showcaseSubmissions.description,
  thumbnailUrl: showcaseSubmissions.thumbnailUrl,
  createdAt: showcaseSubmissions.createdAt,
  authorName: users.name,
  authorImage: users.image,
};

export async function getApprovedSubmissions(): Promise<ShowcaseItem[]> {
  if (!isDbConfigured) return [];
  try {
    return await getDb()
      .select(selectFields)
      .from(showcaseSubmissions)
      .leftJoin(users, eq(showcaseSubmissions.userId, users.id))
      .where(eq(showcaseSubmissions.status, "approved"))
      .orderBy(
        desc(showcaseSubmissions.featured),
        desc(showcaseSubmissions.createdAt),
      );
  } catch (err) {
    console.error("[showcase] getApprovedSubmissions failed:", err);
    return [];
  }
}

export async function getPendingSubmissions(): Promise<ShowcaseItem[]> {
  if (!isDbConfigured) return [];
  try {
    return await getDb()
      .select(selectFields)
      .from(showcaseSubmissions)
      .leftJoin(users, eq(showcaseSubmissions.userId, users.id))
      .where(eq(showcaseSubmissions.status, "pending"))
      .orderBy(desc(showcaseSubmissions.createdAt));
  } catch (err) {
    console.error("[showcase] getPendingSubmissions failed:", err);
    return [];
  }
}

export async function createSubmission(input: {
  userId: string;
  title: string;
  postUrl: string;
  description?: string;
}): Promise<{ id: string }> {
  // A hosted video is our own relative path, so there is no platform to detect
  // and nothing to scrape — and `fetchOgImage` would throw on `new URL()` for a
  // relative one. Guarding here rather than at the caller keeps the one insert.
  const hosted = isHostedVideo(input.postUrl);
  const platform = hosted ? "other" : detectPlatform(input.postUrl);
  const thumbnailUrl = hosted ? null : await fetchOgImage(input.postUrl);

  const [row] = await getDb()
    .insert(showcaseSubmissions)
    .values({
      userId: input.userId,
      title: input.title,
      postUrl: input.postUrl,
      platform,
      description: input.description ?? null,
      thumbnailUrl,
    })
    .returning({ id: showcaseSubmissions.id });
  return row;
}

export async function moderateSubmission(
  id: string,
  action: "approve" | "reject",
): Promise<void> {
  await getDb()
    .update(showcaseSubmissions)
    .set({
      status: action === "approve" ? "approved" : "rejected",
      updatedAt: new Date(),
    })
    .where(eq(showcaseSubmissions.id, id));
}

/**
 * Best-effort scrape of the post's og:image for a card thumbnail. Many social
 * sites block this (return a login wall / non-200) — in which case we return
 * null and the card falls back to a platform-branded tile. Failure-tolerant by
 * design, mirroring `lib/github.ts`.
 */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; snap-cn/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(
        /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
      );
    const src = match?.[1];
    if (!src) return null;
    return /^https?:\/\//i.test(src) ? src : null;
  } catch {
    return null;
  }
}
