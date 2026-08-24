import "server-only";
import os from "node:os";
import path from "node:path";

/**
 * Shared filesystem location for rendered MP4s. A single dir owned by the Node
 * process; the queue writes `${jobId}.mp4` here, the download route streams from
 * it, and the cleanup sweep prunes it. Overridable via `RENDER_WORK_DIR` (e.g.
 * a tmpfs/volume on the box); defaults to the OS temp dir.
 */
export const RENDER_WORK_DIR =
  process.env.RENDER_WORK_DIR?.trim() ||
  path.join(os.tmpdir(), "snapcn-renders");

/**
 * Uploaded soundtracks, waiting to be pulled into a render.
 *
 * Separate from the renders dir so the TTL sweep can give them a longer life:
 * an MP4 is dead the moment it is downloaded, but an audio file has to outlive
 * the whole editing session that will eventually reference it.
 */
export const AUDIO_WORK_DIR =
  process.env.AUDIO_WORK_DIR?.trim() || path.join(os.tmpdir(), "snapcn-audio");

/**
 * Videos submitted to the showcase.
 *
 * A third dir, and the distinction is the whole point: the other two are
 * scratch — an export is dead once downloaded, an upload once the session ends,
 * and the sweep reclaims both. This one is a *library*. Nothing here is ever
 * swept; a file leaves only when its submission is rejected.
 *
 * `os.tmpdir()` is the wrong default for that and is only a default. Point
 * `SHOWCASE_WORK_DIR` at a mounted volume in production or every approved
 * video 404s after the next deploy.
 */
export const SHOWCASE_WORK_DIR =
  process.env.SHOWCASE_WORK_DIR?.trim() ||
  path.join(os.tmpdir(), "snapcn-showcase");

// Said out loud, once, at boot. The comment above has been true and unread the
// whole time: on a container host the default puts the library on the writable
// layer, so every redeploy silently deletes videos people were told we would
// keep. A log line is the only warning anyone gets before the 404s.
if (
  process.env.NODE_ENV === "production" &&
  SHOWCASE_WORK_DIR.startsWith(os.tmpdir())
) {
  console.warn(
    `[snapcn] SHOWCASE_WORK_DIR is unset — approved showcase videos are being written to ${SHOWCASE_WORK_DIR} and will be lost on redeploy. Mount a volume and set SHOWCASE_WORK_DIR (see SHOWCASE_SETUP.md).`,
  );
}
