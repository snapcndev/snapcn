import { NextResponse } from "next/server";
import { sendEmail, teamInviteEmail } from "@/lib/server/email";
import { requireUser } from "@/lib/server/projects";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { addTeamMember, listTeam } from "@/lib/server/team";

/**
 * GET /api/team — the signed-in owner's invitees.
 * POST /api/team — `{ email }`: invite someone onto the owner's Commercial
 * licence. Every rule (a live Commercial licence, a free seat, not yourself,
 * not twice) lives in `addTeamMember`, so this route cannot skip one.
 */
export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  return NextResponse.json(await listTeam(guard.userId));
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  // The account page's bucket: a person invites a few people, once.
  if (!checkRateLimit(guard.userId, "apiKey")) {
    return NextResponse.json(
      { error: "Too many changes. Wait a minute and retry." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email : "";

  try {
    const result = await addTeamMember(guard.userId, email);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    // Never blocks the invite: the seat is theirs whether or not the mail
    // lands, and signing in with the address is all it takes.
    await sendEmail(teamInviteEmail(result.member.email, result.ownerEmail));
    return NextResponse.json(result.member, { status: 201 });
  } catch (err) {
    console.error("[team] invite failed:", err);
    return NextResponse.json(
      { error: "Couldn't add them. Try again." },
      { status: 500 },
    );
  }
}
