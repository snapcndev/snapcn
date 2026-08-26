import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import { AUDIO_EXTS } from "@/lib/video-editor/types";
import { AUDIO_WORK_DIR } from "./paths";

/**
 * Is this upload still on disk?
 *
 * The id carries no extension — `/api/audio` stores `<uuid>.<ext>` and hands
 * back only the uuid — so the check probes the handful it could be, the same
 * way the streaming route does.
 *
 * Two callers want this and both used to assume the answer was yes: the export,
 * which pointed the renderer at a URL that could 404 and shipped a silent video
 * without saying so, and the editor, which restored a track row for a file that
 * was gone.
 */
export async function audioUploadExists(id: string): Promise<boolean> {
  const hits = await Promise.all(
    AUDIO_EXTS.map(async (ext) => {
      try {
        return (await stat(path.join(AUDIO_WORK_DIR, `${id}.${ext}`))).isFile();
      } catch {
        return false;
      }
    }),
  );
  return hits.some(Boolean);
}
