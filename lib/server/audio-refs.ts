import "server-only";
import { sql } from "drizzle-orm";
import { videoProjects } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";

/**
 * The upload ids that a saved project still points at.
 *
 * This exists because two lifetimes were in direct contradiction. A project is
 * a row in Postgres with no expiry — it is there until its owner deletes it —
 * and the soundtrack it references was a file on disk with a six-hour TTL. So
 * every saved project with audio was guaranteed to lose it, and the failure was
 * silent at both ends: the editor restored the track row from the saved draft
 * (name, volume, trim and all) with nothing behind it, and the exporter pointed
 * the renderer at a 404 and shipped a video with no sound.
 *
 * The TTL itself is right — `/api/audio` needs no account, so uploads nobody
 * ever used cannot sit on the disk forever. What was wrong is that it applied
 * to files something still owned. So the sweep now reclaims *orphans* only.
 *
 * With no database configured nothing is persisted server-side at all, so there
 * is nothing to protect and the TTL stands on its own.
 *
 * `-> 'audio' ->> 'uploadId'` is deliberately not guarded by a `jsonb_typeof`
 * check the way `listProjects` guards `jsonb_array_length`. Verified against
 * Postgres 14 with rows whose `audio` is an object, `null`, absent entirely,
 * and a bare string: the arrow operators return NULL for all but the first and
 * none of them throw, so an old-shaped row cannot take the sweep down — which
 * matters more here than anywhere, because a sweep that throws is a sweep that
 * skips, and a sweep that skips forever fills the disk.
 */
export async function referencedAudioIds(): Promise<ReadonlySet<string>> {
  if (!isDbConfigured) return new Set();

  const expr = sql<
    string | null
  >`${videoProjects.data} -> 'audio' ->> 'uploadId'`;
  const rows = await getDb()
    .select({ id: expr })
    .from(videoProjects)
    .where(sql`${expr} is not null`);

  return new Set(rows.map((r) => r.id).filter((id): id is string => !!id));
}
