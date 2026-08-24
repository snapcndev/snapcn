import { after, NextResponse } from "next/server";
import { z } from "zod";
import { subscribers } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";
import { sendEmail, welcomeSubscriberEmail } from "@/lib/server/email";

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
    // `returning()` is what makes the welcome mail correct: with
    // `onConflictDoNothing` a re-subscribe is a successful no-op, and an empty
    // array is the only way to tell "new address" from "already had it". Send
    // on the insert, not on the request, or someone who taps the button twice
    // gets welcomed twice.
    const inserted = await getDb()
      .insert(subscribers)
      .values({
        email: parsed.data.email,
        source: parsed.data.source ?? "home",
      })
      .onConflictDoNothing({ target: subscribers.email })
      .returning({ id: subscribers.id });

    if (inserted.length > 0) {
      // After the response: the reader should not wait on an SMTP round-trip
      // to find out their address was accepted, and a mail failure must not
      // turn a stored subscription into an error.
      after(() => sendEmail(welcomeSubscriberEmail(parsed.data.email)));
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[subscribe] insert failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
