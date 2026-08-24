import { NextResponse } from "next/server";
import {
  createProject,
  listProjects,
  requireUser,
} from "@/lib/server/projects";
import { checkRateLimit } from "@/lib/server/rate-limit";
import {
  DEFAULT_TITLE,
  ProjectInputError,
  parseProjectData,
  parseTitle,
} from "@/lib/video-editor/project";

/**
 * The editor's saved timelines.
 *
 * `GET` is the history — every project this user owns, newest edit first, light
 * enough to send whole (no `data`; that comes from `/api/projects/[id]`).
 * `POST` creates one, which is what the first autosave of a new timeline does.
 *
 * 503 rather than 500 when there is no database: the editor treats that as
 * "projects aren't available here" and falls back to the local draft, which is
 * how the site keeps working with zero setup.
 */

export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  try {
    return NextResponse.json({ projects: await listProjects(guard.userId) });
  } catch (err) {
    console.error("[projects] list failed:", err);
    return NextResponse.json(
      { error: "Couldn't load your videos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

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
    const { id } = await createProject({
      userId: guard.userId,
      title:
        input.title === undefined ? DEFAULT_TITLE : parseTitle(input.title),
      data: parseProjectData(input.data),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof ProjectInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[projects] create failed:", err);
    return NextResponse.json(
      { error: "Couldn't save this video." },
      { status: 500 },
    );
  }
}
