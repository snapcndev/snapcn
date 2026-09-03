import "server-only";
import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { RENDER_WORK_DIR, SHOWCASE_WORK_DIR } from "@/lib/server/paths";

/**
 * Keeping a finished render instead of letting the export pipeline delete it.
 *
 * Two features need this and they need exactly the same thing: a showcase
 * submission and a `/v/<id>` share link. It lives here rather than in either
 * one so neither imports the other, and so there is one copy of the rename —
 * the part with the filesystem edge case in it.
 */

/**
 * Take a finished render out of the scratch dir and keep it.
 *
 * The export pipeline deletes an MP4 the moment its download stream ends and
 * sweeps anything left after ten minutes — correct for an export, fatal for
 * anything with a permanent URL. Moving the file is what turns one into the
 * other, and a rename is the whole operation: same filesystem, atomic, no copy
 * of a multi-megabyte file, and no window where the sweep can take it
 * mid-flight.
 *
 * Returns false when there is nothing to claim — a jobId from a previous
 * process, one already swept, or one that was never real. The caller must treat
 * that as a failure rather than storing a row pointing at nothing.
 */
export async function claimRender(jobId: string): Promise<boolean> {
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
