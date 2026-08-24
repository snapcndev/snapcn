import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { SHOWCASE_WORK_DIR } from "@/lib/server/paths";

// Node runtime: streams a file off disk via node:fs.
export const runtime = "nodejs";

/** Ids are the render queue's `crypto.randomUUID()`s — accept only that shape. */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/showcase/video/[id] — stream a submitted video.
 *
 * Read by the public showcase card, the admin review list, and nothing else.
 * The path is built from a validated uuid only, so there is no id a caller can
 * send that escapes the directory.
 *
 * `Accept-Ranges` is not optional here: a `<video>` seeks, and without range
 * support Chrome re-fetches the whole file to do it.
 *
 * ponytail: no submission-status check. The id is an unguessable uuid and is
 * never linked anywhere before approval, so the only way to reach a pending
 * video is to already know its id. A status check would be a database query per
 * range request — and Chrome issues one per seek.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID_RE.test(id)) return new Response("Not found", { status: 404 });

  const filePath = path.join(SHOWCASE_WORK_DIR, `${id}.mp4`);
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });

  // The id names one immutable file: a re-render is a new submission with a new
  // id, so this can be cached hard.
  const headers = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

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
            ...headers,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${info.size}`,
          },
        });
      }
    }
  }

  return new Response(
    Readable.toWeb(createReadStream(filePath)) as ReadableStream,
    { headers: { ...headers, "Content-Length": String(info.size) } },
  );
}
