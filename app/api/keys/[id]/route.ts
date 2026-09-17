import { NextResponse } from "next/server";
import { deleteApiKey } from "@/lib/server/api-key";
import { requireUser } from "@/lib/server/projects";
import { checkRateLimit } from "@/lib/server/rate-limit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DELETE /api/keys/:id — revoke one of the owner's keys. Immediate: the next
 * install or MCP call with it answers 402. Allowed on any plan, so a lapsed
 * customer can still clean up.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  if (!checkRateLimit(guard.userId, "apiKey")) {
    return NextResponse.json(
      { error: "Too many key changes. Wait a minute and retry." },
      { status: 429 },
    );
  }

  const { id } = await params;
  // Same 404 for a malformed id, someone else's key and one already gone.
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }

  try {
    return (await deleteApiKey(guard.userId, id))
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Key not found." }, { status: 404 });
  } catch (err) {
    console.error("[keys] delete failed:", err);
    return NextResponse.json(
      { error: "Couldn't delete that key. Try again." },
      { status: 500 },
    );
  }
}
