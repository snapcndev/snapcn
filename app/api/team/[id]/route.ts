import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/projects";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { removeTeamMember } from "@/lib/server/team";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DELETE /api/team/:id — take someone off the owner's licence. Their Pro access
 * and every key they made stop at once: access is read from this table on each
 * use, so there is nothing else to revoke.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  if (!checkRateLimit(guard.userId, "apiKey")) {
    return NextResponse.json(
      { error: "Too many changes. Wait a minute and retry." },
      { status: 429 },
    );
  }

  const { id } = await params;
  // Same 404 for a malformed id, someone else's teammate and one already gone.
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not on your team." }, { status: 404 });
  }
  try {
    return (await removeTeamMember(guard.userId, id))
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Not on your team." }, { status: 404 });
  } catch (err) {
    console.error("[team] remove failed:", err);
    return NextResponse.json(
      { error: "Couldn't remove them. Try again." },
      { status: 500 },
    );
  }
}
