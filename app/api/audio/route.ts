import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { ensureCleanupSweep } from "@/lib/server/cleanup";
import { AUDIO_WORK_DIR } from "@/lib/server/paths";
import { checkRateLimit } from "@/lib/server/rate-limit";
import {
  AUDIO_EXT_FOR,
  AUDIO_MIME,
  MAX_AUDIO_BYTES,
} from "@/lib/video-editor/types";

// Node runtime: writes to disk, and the renderer reads from the same box.
export const runtime = "nodejs";

/**
 * POST /api/audio — park a soundtrack where the renderer can fetch it.
 *
 * The editor holds the picked file as a `blob:` URL, which is what makes it
 * playable the instant you choose it, and is exactly why it could never be
 * exported: a server render runs in a different browser in a different process,
 * where `blob:` means nothing. Something has to put the bytes behind a URL the
 * renderer can GET, and that is this.
 */
export async function POST(request: NextRequest) {
  // This route writes the files the sweep is responsible for, so it has to be
  // the thing that installs it. It used to be installed only by `/api/render`,
  // which meant a box that took uploads but served no renders never pruned a
  // single byte. (Idempotent.)
  ensureCleanupSweep();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Its own bucket: sharing the render bucket meant adding three soundtracks
  // left you two exports for the minute, which reads as a broken editor.
  if (!checkRateLimit(ip, "audio")) {
    return NextResponse.json(
      {
        error: "Too many uploads. Please wait and retry.",
        code: "rate_limited",
      },
      { status: 429 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Expected a file field.", code: "invalid_body" },
      { status: 400 },
    );
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "That file is too large.", code: "too_large" },
      { status: 413 },
    );
  }

  const ext = AUDIO_EXT_FOR[file.type];
  if (!ext || !AUDIO_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "That audio format isn't supported.", code: "invalid_type" },
      { status: 415 },
    );
  }

  const id = randomUUID();
  await mkdir(AUDIO_WORK_DIR, { recursive: true });
  await writeFile(
    path.join(AUDIO_WORK_DIR, `${id}.${ext}`),
    Buffer.from(await file.arrayBuffer()),
  );

  // An id, not a URL. `/api/render` builds the URL from its own origin — a
  // caller-supplied one would let anyone point our renderer at any host.
  return NextResponse.json({ id, ext }, { status: 201 });
}
