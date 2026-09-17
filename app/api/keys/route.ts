import { NextResponse } from "next/server";
import { createApiKey, MAX_API_KEYS } from "@/lib/server/api-key";
import { planFor } from "@/lib/server/entitlements";
import { requireUser } from "@/lib/server/projects";
import { checkRateLimit } from "@/lib/server/rate-limit";

/**
 * POST /api/keys — a new API key for the signed-in owner. `{ name }`, answered
 * with the key row, so the account page can show it without a reload.
 *
 * Only for a plan that installs components: a key on any other plan opens
 * nothing, and handing one out would read as "this will work".
 */
export async function POST(request: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  if (!checkRateLimit(guard.userId, "apiKey")) {
    return NextResponse.json(
      { error: "Too many key changes. Wait a minute and retry." },
      { status: 429 },
    );
  }

  const { limits } = await planFor(guard.userId);
  if (!limits.components) {
    return NextResponse.json(
      { error: "Keys come with Pro. See /docs/pricing." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  // Trimmed and capped, never rejected: a label is for the owner to recognise
  // the key by, and "" or a pasted paragraph both have an obvious fix.
  const name =
    (typeof body?.name === "string" ? body.name.trim() : "").slice(0, 40) ||
    "Untitled key";

  try {
    const key = await createApiKey(guard.userId, name);
    if (!key) {
      return NextResponse.json(
        {
          error: `You have ${MAX_API_KEYS} keys, the most one account can hold. Delete one first.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(key, { status: 201 });
  } catch (err) {
    console.error("[keys] create failed:", err);
    return NextResponse.json(
      { error: "Couldn't create a key. Try again." },
      { status: 500 },
    );
  }
}
