import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { deleteJobFile } from "@/lib/server/cleanup";
import { RENDER_WORK_DIR } from "@/lib/server/paths";
import { getJob } from "@/lib/server/render-queue";

// Node runtime: streams a file off disk via node:fs.
export const runtime = "nodejs";

/** Job ids are crypto.randomUUID()s — accept only that exact shape. */
const JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/render/[jobId]/download
 *
 * Streams the finished MP4 (Content-Type video/mp4, attachment), then schedules
 * the file for deletion. 404 if the job/file is unknown; 410 if the render isn't
 * done yet or the file has already been swept.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  // Path-traversal guard: build the path from a validated id only.
  if (!JOB_ID_RE.test(jobId)) {
    return jsonError(404, "Unknown render job.", "not_found");
  }

  const job = getJob(jobId);
  if (!job) {
    return jsonError(404, "Unknown render job.", "not_found");
  }
  if (job.status !== "done") {
    return jsonError(410, "Render is not ready for download.", "not_ready");
  }

  const filePath = path.join(RENDER_WORK_DIR, `${jobId}.mp4`);
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return jsonError(410, "Render file has expired.", "expired");
  }

  const nodeStream = createReadStream(filePath);
  // `end`, not `close`. `close` fires on *any* teardown — including the client
  // aborting or the connection dropping mid-transfer — so the previous version
  // deleted the MP4 out from under a download that had failed, and the retry
  // 404'd on a render the user had waited minutes for. `end` fires only when
  // the source has been read to completion; a cancelled read destroys the
  // stream without it, and the TTL sweep reclaims the file instead.
  nodeStream.on("end", () => {
    void deleteJobFile(jobId);
  });

  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${sanitizeFileName(job.fileName)}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Belt-and-suspenders: strip anything that could break the header. */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 100);
  return cleaned || "snapcn-video.mp4";
}

function jsonError(status: number, error: string, code: string): Response {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
