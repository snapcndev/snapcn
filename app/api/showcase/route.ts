import { after, NextResponse } from "next/server";
import { adminEmails, auth } from "@/auth";
import { isDbConfigured } from "@/lib/server/db";
import { sendEmail, showcaseReviewEmail } from "@/lib/server/email";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getJob } from "@/lib/server/render-queue";
import {
  claimRenderForShowcase,
  createSubmission,
  showcaseVideoUrl,
} from "@/lib/server/showcase";
import { submissionInputSchema } from "@/lib/showcase/validation";

/** Create a showcase submission (auth required; lands as `pending`). */
export async function POST(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json(
      { error: "Showcase isn't configured yet." },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to submit your video." },
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

  const parsed = submissionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid submission." },
      { status: 400 },
    );
  }

  // Keyed on the user, not the IP: the route is already authenticated, and
  // every submission now mails every admin — which makes an unlimited endpoint
  // a way to flood their inbox.
  if (!checkRateLimit(session.user.id, "showcase")) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait and retry." },
      { status: 429 },
    );
  }

  const { jobId, title, description } = parsed.data;
  let postUrl = parsed.data.postUrl;

  // An editor submission names a render instead of a link. Move the MP4 out of
  // the scratch dir *before* the row exists: the export pipeline deletes it on
  // download and sweeps it after ten minutes, so a row written first could end
  // up pointing at a file that is already gone.
  if (jobId) {
    const job = getJob(jobId);
    if (job?.status !== "done") {
      return NextResponse.json(
        { error: "That render isn't finished. Export it again and retry." },
        { status: 409 },
      );
    }
    if (!(await claimRenderForShowcase(jobId))) {
      return NextResponse.json(
        { error: "That video has expired. Export it again and retry." },
        { status: 409 },
      );
    }
    postUrl = showcaseVideoUrl(jobId);
  }

  try {
    const { id } = await createSubmission({
      userId: session.user.id,
      title,
      description,
      // One of the two is always set — the schema refuses a body with neither.
      postUrl: postUrl as string,
    });

    notifyAdmins({
      title,
      description,
      postUrl: postUrl as string,
      hosted: Boolean(jobId),
      authorName: session.user.name ?? session.user.email ?? "someone",
    });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[showcase] create failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * Tell the admins, after the response.
 *
 * Deferred rather than awaited for the reason that matters: the row is already
 * stored, so a Resend round-trip must not be something the submitter waits on,
 * and a mail failure must not turn a stored submission into a 500. Same
 * reasoning as `app/api/subscribe/route.ts`.
 *
 * One send per admin — `Email.to` is a single address. With `ADMIN_EMAILS`
 * unset the list is empty and nothing is sent, which is the silent case worth
 * knowing about: submissions still land, nobody is told.
 */
function notifyAdmins(submission: {
  title: string;
  description?: string;
  postUrl: string;
  hosted: boolean;
  authorName: string;
}) {
  for (const to of adminEmails()) {
    after(() => sendEmail(showcaseReviewEmail(to, submission)));
  }
}
