import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDbConfigured } from "@/lib/server/db";
import { claimRender } from "@/lib/server/hosted-video";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getJob } from "@/lib/server/render-queue";
import {
  createSharedVideo,
  normalizeShareInput,
} from "@/lib/server/shared-video";

/**
 * POST /api/share — turn a finished render into a permanent page at `/v/<id>`.
 *
 * This is where the sign-in wall lives now, and deliberately not one step
 * earlier. Export runs signed-out and the file reaches the user's disk either
 * way; an account is what is needed to *keep the link*, because a permanent URL
 * needs an owner who can delete it and because that account is the only thing
 * that carries the upgrade later. Gating the export instead lost two of every
 * three people at the moment they had nothing yet — 3 sign-ins opened, 1
 * completed, measured over the editor's first month.
 *
 * The file is claimed before the row is written, same ordering as the showcase
 * route and for the same reason: the export pipeline deletes the MP4 on
 * download and sweeps it after ten minutes, so a row written first can end up
 * naming a file that is already gone.
 */
export async function POST(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json(
      { error: "Share links aren't configured yet." },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to keep a link to this video." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const { jobId, title, componentsUsed } = (body ?? {}) as {
    jobId?: unknown;
    title?: unknown;
    componentsUsed?: unknown;
  };

  if (typeof jobId !== "string" || !jobId) {
    return NextResponse.json({ error: "Missing render." }, { status: 400 });
  }

  // Keyed on the user rather than the IP: the route is authenticated, and each
  // call keeps a multi-megabyte file forever. The budget is the disk, not abuse.
  if (!checkRateLimit(session.user.id, "showcase")) {
    return NextResponse.json(
      { error: "Too many links. Please wait and retry." },
      { status: 429 },
    );
  }

  const job = getJob(jobId);
  if (job?.status !== "done") {
    return NextResponse.json(
      { error: "That render isn't finished. Export it again and retry." },
      { status: 409 },
    );
  }

  if (!(await claimRender(jobId))) {
    return NextResponse.json(
      { error: "That video has expired. Export it again and retry." },
      { status: 409 },
    );
  }

  try {
    const { id } = await createSharedVideo({
      userId: session.user.id,
      jobId,
      ...normalizeShareInput({ title, componentsUsed }),
    });

    return NextResponse.json({ id, url: `/v/${id}` }, { status: 201 });
  } catch (err) {
    console.error("[share] create failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
