import "server-only";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { subscribers } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";

/**
 * Everything a subscriber's token can do, in one place.
 *
 * Three files reach for these — the confirm page, the unsubscribe page and the
 * one-click endpoint — and each of them is otherwise just markup or a status
 * code. Keeping the statements here is what makes them testable at all: a
 * Next.js page is not something this test setup can render, and the interesting
 * part of both pages is the query, not the paragraph.
 */

/** Tokens are `gen_random_uuid()`; anything else is not worth a round trip. */
export const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConfirmOutcome =
  /** This request flipped the row. The caller owes them a welcome mail. */
  | { outcome: "confirmed"; id: string; email: string; token: string }
  /**
   * A real token, but the row was already confirmed. Send nothing. The id is
   * there so the page can still hand back the free-component link — a second
   * click on the confirm mail is usually somebody looking for it.
   */
  | { outcome: "already"; id: string }
  /** No such token, a malformed one, or no database. */
  | { outcome: "unknown" };

/**
 * Complete a double opt-in.
 *
 * The update is one conditional statement and that is the whole trick: with
 * `RETURNING` behind `WHERE confirmed_at IS NULL OR unsubscribed_at IS NOT
 * NULL`, a row comes back **only when this call is the one that flipped it**.
 * A second click, a browser prefetch and a refresh all match zero rows, which
 * is what makes the welcome mail exactly-once without a second column to track
 * it. Reading the row first and deciding in JavaScript would send two.
 *
 * Confirming also clears `unsubscribed_at`, so somebody who left and signed up
 * again comes back rather than staying silently muted.
 */
export async function confirmSubscription(
  token: string,
): Promise<ConfirmOutcome> {
  if (!isDbConfigured || !TOKEN_RE.test(token)) return { outcome: "unknown" };

  const db = getDb();
  const flipped = await db
    .update(subscribers)
    .set({ confirmedAt: new Date(), unsubscribedAt: null })
    .where(
      and(
        eq(subscribers.token, token),
        or(
          isNull(subscribers.confirmedAt),
          isNotNull(subscribers.unsubscribedAt),
        ),
      ),
    )
    .returning({
      id: subscribers.id,
      email: subscribers.email,
      token: subscribers.token,
    });

  const row = flipped[0];
  if (row) return { outcome: "confirmed", ...row };

  // Zero rows means one of two very different things and the reader deserves to
  // be told which. Only this branch pays for the extra query.
  const [existing] = await db
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(eq(subscribers.token, token))
    .limit(1);
  return existing
    ? { outcome: "already", id: existing.id }
    : { outcome: "unknown" };
}

/**
 * Switch a subscription off. Idempotent, and only the first call writes: Gmail
 * posts one-click twice often enough that this matters, and `unsubscribed_at`
 * is a date somebody may later have to prove.
 */
export async function unsubscribeByToken(token: string): Promise<void> {
  if (!isDbConfigured || !TOKEN_RE.test(token)) return;
  await getDb()
    .update(subscribers)
    .set({ unsubscribedAt: new Date() })
    .where(
      and(eq(subscribers.token, token), isNull(subscribers.unsubscribedAt)),
    );
}

/**
 * The address behind a token, or null.
 *
 * Shown back to the reader on the unsubscribe page: the token only ever existed
 * in that mailbox, so it tells nobody anything they did not already have — and
 * being shown *which* address is about to stop is what makes the button safe to
 * press for somebody with several.
 */
export async function addressForToken(token: string): Promise<string | null> {
  if (!isDbConfigured || !TOKEN_RE.test(token)) return null;
  const rows = await getDb()
    .select({ email: subscribers.email })
    .from(subscribers)
    .where(eq(subscribers.token, token))
    .limit(1);
  return rows[0]?.email ?? null;
}
