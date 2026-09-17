import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { apiKeys, billingSubscriptions } from "@/lib/db/schema";
import type { PlanName } from "@/lib/plans";
import { getDb, isDbConfigured } from "@/lib/server/db";

/**
 * The API key: what turns a `shadcn add @snapcn/<pro>` from a 402 into a file.
 *
 * One prefix, one length, one lookup. There is no scope system and no
 * expiry — a key answers exactly one question ("which plan is this?"), and a
 * permission model for a single permission is a table nobody reads. An owner
 * can hold several (see `apiKeys` in the schema) and delete any of them.
 */

/** `sk_` so it is greppable in a leaked config; 32 bytes so it is not guessable. */
export function newApiKey(): string {
  return `sk_${randomBytes(32).toString("base64url")}`;
}

/**
 * The plan a key buys, or null if it buys nothing.
 *
 * Null covers every failure with the same answer on purpose — unknown key,
 * deleted key, cancelled subscription, no database at all. The caller's next
 * line is the same 402 in every case, and distinguishing them out loud only
 * tells someone probing keys which of their guesses was a real customer.
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
      .from(apiKeys)
      .innerJoin(
        billingSubscriptions,
        eq(billingSubscriptions.userId, apiKeys.userId),
      )
      .where(eq(apiKeys.key, key))
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

/**
 * How many keys one account may hold. Enough for Commercial's five seats plus
 * a CI runner and a spare laptop; few enough that a script cannot fill a table.
 */
export const MAX_API_KEYS = 10;

export interface ApiKeyRow {
  id: string;
  name: string;
  key: string;
  createdAt: Date;
}

/**
 * An owner's keys, oldest first — so "Default", the one minted at purchase,
 * stays at the top. Only ever called with the signed-in user's own id.
 */
export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  if (!isDbConfigured) return [];
  return getDb()
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      key: apiKeys.key,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(asc(apiKeys.createdAt));
}

/**
 * A new key for its owner, or null at the cap.
 *
 * ponytail: count-then-insert, so two requests in the same instant can both
 * pass at nine and leave eleven. The cap is a tidiness limit, not a security
 * one; a constraint is the fix if it ever has to be exact.
 */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<ApiKeyRow | null> {
  const db = getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
  if (n >= MAX_API_KEYS) return null;
  const [row] = await db
    .insert(apiKeys)
    .values({ userId, name, key: newApiKey() })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      key: apiKeys.key,
      createdAt: apiKeys.createdAt,
    });
  return row ?? null;
}

/**
 * Delete one of the owner's keys. Scoped by user as well as id, so a guessed id
 * belonging to someone else deletes nothing. True when a row went.
 */
export async function deleteApiKey(
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });
  return deleted.length > 0;
}

/**
 * The first key, minted when a plan is granted — only if the owner has none.
 *
 * Never on renewal and never alongside an existing key: a new key on every
 * `subscription.renewed` would be harmless but would pile up, and replacing one
 * would break every install that already uses it. A deleted-them-all owner gets
 * a fresh one on their next grant, or creates one on the account page.
 */
export async function ensureApiKey(userId: string): Promise<void> {
  await getDb().execute(sql`
    insert into ${apiKeys} (user_id, key, name)
    select ${userId}, ${newApiKey()}, 'Default'
    where not exists (select 1 from ${apiKeys} where user_id = ${userId})
  `);
}

/** `Authorization: Bearer sk_…` → the key, or null. Case-insensitive scheme. */
export function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
