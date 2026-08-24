import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { AUDIO_WORK_DIR } from "@/lib/server/paths";
import { AUDIO_EXTS, AUDIO_TYPE_FOR } from "@/lib/video-editor/types";

// Node runtime: streams a file off disk via node:fs.
export const runtime = "nodejs";

/** Ids are `crypto.randomUUID()`s — accept only that exact shape. */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Find the upload by probing the handful of extensions it could have been
 * stored under, in parallel.
 *
 * This used to `readdir` the whole directory and scan for the prefix — on every
 * request, and Chrome issues a range request per seek while a render decodes
 * the file. That is a directory listing per range request, growing with the
 * number of uploads on the box (which now sit for six hours). Six stats is a
 * fixed cost and no larger than the one stat this already had to do.
 */
async function findUpload(id: string) {
  const hits = await Promise.all(
    AUDIO_EXTS.map(async (ext) => {
      const filePath = path.join(AUDIO_WORK_DIR, `${id}.${ext}`);
      try {
        const info = await stat(filePath);
        return info.isFile()
          ? { filePath, info, type: AUDIO_TYPE_FOR[ext] }
          : null;
      } catch {
        return null;
      }
    }),
  );
  return hits.find((h) => h !== null) ?? null;
}

/**
 * GET /api/audio/[id] — stream an uploaded soundtrack.
 *
 * Read by two clients: the headless Chrome doing a render, and the editor when
 * it reloads a track it no longer holds a `blob:` for.
 *
 * The extension is discovered server-side rather than taken from the URL, so
 * the caller supplies only a uuid and there is nothing in the path they
 * control. `Accept-Ranges` matters more than it looks — Chrome seeks within
 * audio, and without range support it re-fetches the whole file.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID_RE.test(id)) return new Response("Not found", { status: 404 });

  const found = await findUpload(id);
  if (!found) return new Response("Not found", { status: 404 });
  const { filePath, info, type } = found;

  const range = request.headers.get("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : info.size - 1;
      if (start <= end && end < info.size) {
        const stream = createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            "Content-Type": type,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${info.size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }
  }

  return new Response(
    Readable.toWeb(createReadStream(filePath)) as ReadableStream,
    {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    },
  );
}
