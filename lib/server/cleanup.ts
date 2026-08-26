import "server-only";
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { AUDIO_EXTS } from "@/lib/video-editor/types";
import { referencedAudioIds } from "./audio-refs";
import { AUDIO_WORK_DIR, RENDER_WORK_DIR } from "./paths";
import { deleteJob } from "./render-queue";

/**
 * Disk hygiene for the render work dir. Two mechanisms:
 *  - `deleteJobFile` removes a single MP4 right after it's been downloaded.
 *  - a guarded `setInterval` TTL sweep deletes any leftover files older than
 *    the TTL (downloads that never happened, crashed renders) so the disk can't
 *    fill up.
 */

/**
 * How long an *orphaned* upload may sit — one nothing points at.
 *
 * Much longer than a render's: an MP4 is dead the moment it is downloaded, but
 * audio has to outlive the whole editing session that will eventually reference
 * it — reclaim it early and the export silently comes out with no soundtrack.
 *
 * It used to be measured from the upload and nothing ever reset it, so the six
 * hours ran whether the file was in daily use or had never been touched again.
 * Two things changed: a file a saved project references is not swept at all
 * (see {@link referencedAudioIds}), and `/api/audio/[id]` refreshes the mtime
 * on read, so the clock now measures time since last *use*.
 */
function audioTtlMs(): number {
  const parsed = Number(process.env.AUDIO_FILE_TTL_MS);
  return Number.isFinite(parsed) && parsed >= 1000
    ? Math.floor(parsed)
    : 6 * 60 * 60_000;
}

/** How long a finished file may sit before the sweep reclaims it. */
function ttlMs(): number {
  const parsed = Number(process.env.RENDER_FILE_TTL_MS);
  return Number.isFinite(parsed) && parsed >= 1000
    ? Math.floor(parsed)
    : 600_000;
}

/** How often the sweep runs — derived from the TTL (at least once a minute). */
function sweepIntervalMs(): number {
  return Math.max(60_000, ttlMs());
}

/** Delete a single job's MP4 (best-effort) and drop it from the registry. */
export async function deleteJobFile(jobId: string): Promise<void> {
  const filePath = path.join(RENDER_WORK_DIR, `${jobId}.mp4`);
  try {
    await rm(filePath, { force: true });
  } finally {
    deleteJob(jobId);
  }
}

/**
 * Remove every file in `dir` with one of `exts` that is older than `ttl`.
 *
 * `onDelete` runs for each reclaimed file's basename — the renders dir uses it
 * to drop the job from the registry; the audio dir has no registry.
 */
async function sweepDir(
  dir: string,
  ttl: number,
  exts: readonly string[],
  onDelete?: (basename: string) => void,
  keep?: (basename: string) => boolean,
): Promise<void> {
  const now = Date.now();

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return; // dir not created yet — nothing to sweep
  }

  await Promise.all(
    entries
      .filter((name) => exts.some((ext) => name.endsWith(`.${ext}`)))
      .filter((name) => !keep?.(name.replace(/\.[^.]+$/, "")))
      .map(async (name) => {
        const filePath = path.join(dir, name);
        try {
          const info = await stat(filePath);
          if (now - info.mtimeMs > ttl) {
            await rm(filePath, { force: true });
            onDelete?.(name.replace(/\.[^.]+$/, ""));
          }
        } catch {
          // File vanished between readdir and stat — ignore.
        }
      }),
  );
}

/**
 * One pass over both work dirs. Exported for test — the sweep is otherwise
 * only reachable through a `setInterval` installed once per process.
 *
 *
 * The audio dir was previously never swept at all — `paths.ts` documented a
 * longer TTL for it that nothing implemented, so every soundtrack anyone ever
 * uploaded stayed on disk forever, from an endpoint that needs no account.
 */
export async function sweepOnce(): Promise<void> {
  await Promise.all([
    sweepDir(RENDER_WORK_DIR, ttlMs(), ["mp4"], deleteJob),
    sweepAudio(),
  ]);
}

/**
 * The audio sweep, which has to know what is still owned before it deletes
 * anything.
 *
 * If the referenced set cannot be read the sweep is **skipped entirely**. The
 * two failure costs are not symmetrical: skipping leaks disk until the next
 * pass, deleting anyway destroys a soundtrack somebody cannot get back. Ten
 * minutes of extra files is the cheaper mistake every time.
 */
async function sweepAudio(): Promise<void> {
  let referenced: ReadonlySet<string>;
  try {
    referenced = await referencedAudioIds();
  } catch (error) {
    console.warn(
      "[snapcn] audio sweep skipped — could not read which uploads are still referenced:",
      error,
    );
    return;
  }

  await sweepDir(AUDIO_WORK_DIR, audioTtlMs(), AUDIO_EXTS, undefined, (id) =>
    referenced.has(id),
  );
}

// Module-level guard: ensure the sweep timer is installed exactly once per
// process, even if multiple routes import this module.
let sweepStarted = false;

/** Start the periodic TTL sweep (idempotent). */
export function ensureCleanupSweep(): void {
  if (sweepStarted) return;
  sweepStarted = true;

  const timer = setInterval(() => {
    void sweepOnce();
  }, sweepIntervalMs());
  // Don't keep the process alive just for the sweep.
  timer.unref?.();
}
