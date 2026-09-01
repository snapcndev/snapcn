import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { billingSubscriptions } from "@/lib/db/schema";
import type { PlanName } from "@/lib/plans";
import { getDb, isDbConfigured } from "@/lib/server/db";

/**
 * The API key: what turns a `shadcn add @snapcn/<pro>` from a 402 into a file.
 *
 * One prefix, one length, one lookup. There is no scope system and no
 * expiry — a key answers exactly one question ("which plan is this?"), and a
 * permission model for a single permission is a table nobody reads.
 */

/** `sk_` so it is greppable in a leaked config; 32 bytes so it is not guessable. */
export function newApiKey(): string {
  return `sk_${randomBytes(32).toString("base64url")}`;
}

/**
 * The plan a key buys, or null if it buys nothing.
 *
 * Null covers every failure with the same answer on purpose — unknown key,
 * cancelled subscription, no database at all. The caller's next line is the
 * same 402 in every case, and distinguishing them out loud only tells someone
 * probing keys which of their guesses was a real customer.
 *
 * `status` is Dodo's vocabulary (see the schema note); anything but `active`
 * has stopped paying, and a key that outlives the subscription is a free tier
 * with extra steps.
 */
export async function planForApiKey(
  key: string | null | undefined,
): Promise<PlanName | null> {
  if (!key?.startsWith("sk_") || !isDbConfigured) return null;

  try {
    const [row] = await getDb()
      .select({
        plan: billingSubscriptions.plan,
        status: billingSubscriptions.status,
      })
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.apiKey, key))
      .limit(1);

    if (!row || row.status !== "active" || row.plan === "free") return null;
    return row.plan;
  } catch (error) {
    /**
     * A database that is unreachable must not become a 500 on the registry.
     *
     * Failing *closed* is the only safe direction here: "cannot verify this
     * key" and "this key buys nothing" have to give the same answer, or a
     * connection blip is a route that leaks paid source. The cost is that a
     * paying customer sees a 402 during an outage, which is a retry; the
     * alternative is giving the component away, which is not.
     *
     * Logged rather than swallowed, because a 402 that is really an outage
     * looks exactly like a billing bug from the outside.
     */
    console.error("[api-key] lookup failed, denying:", error);
    return null;
  }
}

/** `Authorization: Bearer sk_…` → the key, or null. Case-insensitive scheme. */
export function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
