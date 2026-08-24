import { NextResponse } from "next/server";
import {
  deleteProject,
  getProject,
  requireUser,
  updateProject,
} from "@/lib/server/projects";
import { checkRateLimit } from "@/lib/server/rate-limit";
import {
  ProjectInputError,
  parseProjectData,
  parseTitle,
} from "@/lib/video-editor/project";

/**
 * One saved timeline: open it, autosave it, delete it.
 *
 * Ownership is enforced in the query rather than here — every call passes the
 * session's user id alongside the row id, so a missing row and someone else's
 * row are the same 404 and neither leaks the other's existence.
 */

/** Ids are Postgres uuids; anything else is a 404, not a cast error. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();

  try {
    const project = await getProject(id, guard.userId);
    return project ? NextResponse.json(project) : notFound();
  } catch (err) {
    console.error("[projects] read failed:", err);
    return NextResponse.json(
      { error: "Couldn't open this video." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();

  if (!checkRateLimit(guard.userId, "project")) {
    return NextResponse.json(
      { error: "Too many saves. Please wait and retry." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const input = body as { title?: unknown; data?: unknown };

  try {
    const ok = await updateProject({
      id,
      userId: guard.userId,
      // Both optional and independent: a rename sends only a title, an autosave
      // only the timeline. `undefined` means "leave it alone", which is why the
      // parsers are called lazily rather than on a defaulted value.
      title: input.title === undefined ? undefined : parseTitle(input.title),
      data: input.data === undefined ? undefined : parseProjectData(input.data),
    });
    return ok ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    if (err instanceof ProjectInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[projects] update failed:", err);
    return NextResponse.json(
      { error: "Couldn't save this video." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();

  try {
    const ok = await deleteProject(id, guard.userId);
    return ok ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    console.error("[projects] delete failed:", err);
    return NextResponse.json(
      { error: "Couldn't delete this video." },
      { status: 500 },
    );
  }
}

function notFound() {
  return NextResponse.json({ error: "Video not found." }, { status: 404 });
}
