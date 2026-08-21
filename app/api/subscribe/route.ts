import { NextResponse } from "next/server";
import { z } from "zod";
import { subscribers } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";

const inputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That email doesn't look right."),
  source: z.string().trim().max(40).optional(),
});

/**
 * Join the launch list. Re-submitting an address is a success, not an error —
 * someone who signs up twice has told us they want in twice, and an "already
 * subscribed" error reads as a rejection for no gain.
 */
export async function POST(req: Request) {
  if (!isDbConfigured) {
    return NextResponse.json(
      { error: "The list isn't configured yet." },
      { status: 503 },
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

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid email." },
      { status: 400 },
    );
  }

  try {
    await getDb()
      .insert(subscribers)
      .values({
        email: parsed.data.email,
        source: parsed.data.source ?? "home",
      })
      .onConflictDoNothing({ target: subscribers.email });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[subscribe] insert failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
