import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { videoProjects } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";
import {
  MAX_PROJECTS,
  ProjectInputError,
  type ProjectSummary,
} from "@/lib/video-editor/project";

/**
 * Saved timelines, per user.
 *
 * Every query is keyed on `userId` as well as the id — the ownership check *is*
 * the where clause, so there is no path where a caller reads or writes someone
 * else's project by guessing a uuid.
 */

/**
 * `jsonb_array_length` throws on anything that is not an array, so the type is
 * checked first: a row written by an older build must make the list render a
 * zero, not 500 the whole request.
 */
const clipCount = sql<number>`case when jsonb_typeof(${videoProjects.data} -> 'clips') = 'array'
  then jsonb_array_length(${videoProjects.data} -> 'clips') else 0 end`;

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const rows = await getDb()
    .select({
      id: videoProjects.id,
      title: videoProjects.title,
      clipCount,
      updatedAt: videoProjects.updatedAt,
    })
    .from(videoProjects)
    .where(eq(videoProjects.userId, userId))
    .orderBy(desc(videoProjects.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    clipCount: Number(row.clipCount),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getProject(
  id: string,
  userId: string,
): Promise<{ id: string; title: string; data: unknown } | null> {
  const [row] = await getDb()
    .select({
      id: videoProjects.id,
      title: videoProjects.title,
      data: videoProjects.data,
    })
    .from(videoProjects)
    .where(and(eq(videoProjects.id, id), eq(videoProjects.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createProject(input: {
  userId: string;
  title: string;
  data: unknown;
}): Promise<{ id: string }> {
  const [{ value: existing }] = await getDb()
    .select({ value: count() })
    .from(videoProjects)
    .where(eq(videoProjects.userId, input.userId));

  if (existing >= MAX_PROJECTS) {
    throw new ProjectInputError(
      `You've reached ${MAX_PROJECTS} saved videos. Delete one to make room.`,
      409,
    );
  }

  const [row] = await getDb()
    .insert(videoProjects)
    .values({ userId: input.userId, title: input.title, data: input.data })
    .returning({ id: videoProjects.id });
  return row;
}

/** Returns false when the id isn't this user's (or no longer exists). */
export async function updateProject(input: {
  id: string;
  userId: string;
  title?: string;
  data?: unknown;
}): Promise<boolean> {
  const patch: { title?: string; data?: unknown; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.data !== undefined) patch.data = input.data;

  const rows = await getDb()
    .update(videoProjects)
    .set(patch)
    .where(
      and(
        eq(videoProjects.id, input.id),
        eq(videoProjects.userId, input.userId),
      ),
    )
    .returning({ id: videoProjects.id });
  return rows.length > 0;
}

export async function deleteProject(
  id: string,
  userId: string,
): Promise<boolean> {
  const rows = await getDb()
    .delete(videoProjects)
    .where(and(eq(videoProjects.id, id), eq(videoProjects.userId, userId)))
    .returning({ id: videoProjects.id });
  return rows.length > 0;
}

/**
 * Session + database, or the response to send instead — the same two checks at
 * the top of every projects route, in one place so neither can be forgotten.
 *
 * 503 rather than 500 when there is no `DATABASE_URL`: the editor reads that as
 * "projects aren't available here" and keeps its local draft, which is how the
 * site still works on a deployment with zero setup.
 */
export async function requireUser(): Promise<
  { userId: string } | { response: NextResponse }
> {
  if (!isDbConfigured) {
    return {
      response: NextResponse.json(
        { error: "Saved videos aren't configured yet." },
        { status: 503 },
      ),
    };
  }
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return {
      response: NextResponse.json(
        { error: "Sign in to keep your videos." },
        { status: 401 },
      ),
    };
  }
  return { userId: session.user.id };
}
