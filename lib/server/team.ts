import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { billingSubscriptions, teamMembers, users } from "@/lib/db/schema";
import { COMMERCIAL_SEATS, entitledPlan, type PlanName } from "@/lib/plans";
import { getDb, isDbConfigured } from "@/lib/server/db";

/**
 * A Commercial licence is for up to `COMMERCIAL_SEATS` people: the owner, and
 * the rest invited by email from `/account`.
 *
 * Imported by both `entitlements` and `api-key`, so it imports neither: the
 * question it answers is only "does a team give this user a plan?", and both of
 * them ask it after their own row has said no.
 */

const lower = (email: string) => email.trim().toLowerCase();

/** A plausible address — the real check is the invitee signing in with it. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The plan a user holds through someone else's Commercial licence, or `free`.
 *
 * Matched on the signed-in address at read time, so an invitee needs no
 * acceptance step and removing the row is the whole of removing them. The best
 * of several teams wins, which is only ever `pro` today.
 */
export async function teamPlanFor(userId: string): Promise<{
  plan: PlanName;
  ownerEmail: string | null;
}> {
  const none = { plan: "free" as PlanName, ownerEmail: null };
  if (!isDbConfigured) return none;
  try {
    const db = getDb();
    const [me] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!me?.email) return none;

    const owners = await db
      .select({
        ownerEmail: users.email,
        plan: billingSubscriptions.plan,
        status: billingSubscriptions.status,
        currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
        licence: billingSubscriptions.licence,
      })
      .from(teamMembers)
      .innerJoin(
        billingSubscriptions,
        eq(billingSubscriptions.userId, teamMembers.ownerId),
      )
      .innerJoin(users, eq(users.id, teamMembers.ownerId))
      .where(eq(teamMembers.email, lower(me.email)));

    for (const o of owners) {
      if (o.licence !== "commercial") continue;
      const plan = entitledPlan(o);
      if (plan !== "free") return { plan, ownerEmail: o.ownerEmail };
    }
    return none;
  } catch (err) {
    // Fails closed, like every other entitlement read: a team seat that cannot
    // be verified is not one.
    console.warn("[team] lookup failed, no team plan", err);
    return none;
  }
}

/** Whether `ownerId` holds a live Commercial licence, which is what invites. */
export async function canInvite(ownerId: string): Promise<boolean> {
  if (!isDbConfigured) return false;
  const [row] = await getDb()
    .select({
      plan: billingSubscriptions.plan,
      status: billingSubscriptions.status,
      currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      licence: billingSubscriptions.licence,
    })
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.userId, ownerId))
    .limit(1);
  return row?.licence === "commercial" && entitledPlan(row) !== "free";
}

export interface TeamMemberRow {
  id: string;
  email: string;
  createdAt: Date;
  /** Whether the address has an account yet — i.e. whether they signed in. */
  joined: boolean;
}

/** An owner's invitees, oldest first. */
export async function listTeam(ownerId: string): Promise<TeamMemberRow[]> {
  if (!isDbConfigured) return [];
  const rows = await getDb()
    .select({
      id: teamMembers.id,
      email: teamMembers.email,
      createdAt: teamMembers.createdAt,
    })
    .from(teamMembers)
    .where(eq(teamMembers.ownerId, ownerId))
    .orderBy(asc(teamMembers.createdAt));
  if (rows.length === 0) return [];
  const joined = new Set(
    (
      await getDb()
        .select({ email: sql<string>`lower(${users.email})` })
        .from(users)
        .where(
          inArray(
            sql`lower(${users.email})`,
            rows.map((r) => r.email),
          ),
        )
    ).map((u) => u.email),
  );
  return rows.map((r) => ({ ...r, joined: joined.has(r.email) }));
}

export type AddResult =
  | { ok: true; member: TeamMemberRow; ownerEmail: string | null }
  | { ok: false; status: number; error: string };

/**
 * Invite `email` onto `ownerId`'s licence. Checked here rather than only in the
 * route, so no caller can skip a rule: a live Commercial licence, a real-looking
 * address that is not the owner's own, not already on the team, and a free seat.
 *
 * ponytail: count-then-insert, so two invites in the same instant at four
 * members can make six people. The seat count is a licence term, not a
 * security boundary; a constraint is the fix if it ever has to be exact.
 */
export async function addTeamMember(
  ownerId: string,
  rawEmail: string,
): Promise<AddResult> {
  const email = lower(rawEmail);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return {
      ok: false,
      status: 400,
      error: "That doesn't look like an email address.",
    };
  }
  if (!(await canInvite(ownerId))) {
    return {
      ok: false,
      status: 403,
      error: "Inviting people comes with the Commercial licence.",
    };
  }
  const db = getDb();
  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  if (owner?.email && lower(owner.email) === email) {
    return {
      ok: false,
      status: 400,
      error: "That's you — you already have a seat.",
    };
  }
  const [{ n }] = await db
    .select({ n: count() })
    .from(teamMembers)
    .where(eq(teamMembers.ownerId, ownerId));
  if (n >= COMMERCIAL_SEATS - 1) {
    return {
      ok: false,
      status: 409,
      error: `All ${COMMERCIAL_SEATS} seats are taken. Remove someone first.`,
    };
  }
  const [row] = await db
    .insert(teamMembers)
    .values({ ownerId, email })
    .onConflictDoNothing()
    .returning({
      id: teamMembers.id,
      email: teamMembers.email,
      createdAt: teamMembers.createdAt,
    });
  if (!row) {
    return { ok: false, status: 409, error: "They're already on your team." };
  }
  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  return {
    ok: true,
    member: { ...row, joined: Boolean(account) },
    ownerEmail: owner?.email ?? null,
  };
}

/** Remove one invitee. Their access, and every key they made, ends with it. */
export async function removeTeamMember(
  ownerId: string,
  id: string,
): Promise<boolean> {
  const rows = await getDb()
    .delete(teamMembers)
    .where(and(eq(teamMembers.id, id), eq(teamMembers.ownerId, ownerId)))
    .returning({ id: teamMembers.id });
  return rows.length > 0;
}
