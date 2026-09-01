import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { billingSubscriptions, renderUsage } from "@/lib/db/schema";
import { ANONYMOUS, PLANS, type PlanLimits, type PlanName } from "@/lib/plans";
import { newApiKey } from "@/lib/server/api-key";
import { getDb, isDbConfigured } from "@/lib/server/db";

/**
 * The meter. Every export on every surface goes through `consumeRender`, and
 * every "what does this caller get?" question goes through `planFor`.
 *
 * Two functions and not a check per route, because the alternative has been
 * tried by everyone who ever shipped a metered API: the browser route gets the
 * check, then the CLI ships with its own copy that forgets one limb, then some
 * internal caller skips it because it is "internal", and the free tier is
 * unbounded through the third door nobody audited. The cost of a leak here is
 * not a bug report, it is a compute bill — and the leak is invisible until it
 * is expensive.
 *
 * Ported from the video product's `lib/meter.ts`, monthly-cap limb only. The
 * concurrency limb did NOT come across on purpose: snap-cn's queue is an
 * in-memory Map in `lib/server/render-queue.ts` with its own status vocabulary
 * ("queued" | "rendering" | "done" | "error") and a process-global `p-limit`
 * semaphore that already caps parallel Chromium. There is no `render_job`
 * table to count in-flight rows in, so a per-user concurrency cap would have to
 * be invented here rather than ported. It is not missing by oversight.
 */

/**
 * Refusal by the meter, distinct from every other way a render can fail.
 *
 * `code` is the family and `reason` says which wall was hit; today there is one
 * wall, and it is named anyway so the client's handling ("upgrade", never
 * "retry") is keyed on a string that survives the trip rather than on prose in
 * a message. A concurrency limb added later gets a second reason, and no
 * existing client silently starts retrying a spent monthly allowance.
 */
export class QuotaExceededError extends Error {
  readonly code = "quota_exceeded";
  readonly reason = "monthly_cap";

  constructor(
    message: string,
    readonly used: number,
    readonly limit: number,
  ) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

/* ── planFor ────────────────────────────────────────────────────────────── */

export interface ResolvedPlan {
  plan: PlanName | "anonymous";
  limits: PlanLimits;
}

/**
 * The caller's entitlement, defaulting to free.
 *
 * A `billing_subscription` row exists for the whole life of the relationship,
 * including after it ends, so the row's `plan` column is not the entitlement on
 * its own — `status` and `current_period_end` are. A cancelled Pro row still
 * says "pro". Reading only the plan column is how a churned customer keeps
 * exporting at 1920 with no watermark forever, and the report never comes,
 * because nobody files a ticket about getting more than they paid for.
 *
 * Status is Dodo's vocabulary (`pending`, `active`, `on_hold`, `paused`,
 * `cancelled`, `failed`, `expired`), matched by exact equality against the one
 * paying state rather than by listing the non-paying ones. A status word we
 * have not seen before is far more likely to mean "not paying" than "paying",
 * and a Dodo release that adds one must not hand out a free upgrade.
 *
 * `pending` matters here specifically: a new subscription is `pending` until
 * the payment lands, so this is the second line of defence behind the rule that
 * access is granted on the webhook and never on the checkout-create response.
 *
 * With no DATABASE_URL this returns free instead of throwing — reading an
 * entitlement with no database has a safe answer, and it is the least
 * privileged one. `consumeRender` deliberately does NOT do the same; see there.
 */
interface PlanRow {
  plan: PlanName;
  status: string;
  currentPeriodEnd: Date | null;
}

export async function planFor(userId: string | null): Promise<ResolvedPlan> {
  // "No user" and "user on no plan" are different questions with different
  // answers: an anonymous caller has no durable identity to count against, so
  // it gets its own bucket rather than being folded into free.
  if (!userId) return { plan: "anonymous", limits: ANONYMOUS };

  if (!isDbConfigured) return { plan: "free", limits: PLANS.free };

  // Fails soft, deliberately.
  //
  // This runs during the render of the editor page, so an exception here is a
  // 500 on the product itself — and the first way it happened was the most
  // boring one possible: the migration had not been run yet, so the table did
  // not exist. A billing *read* can only ever widen or narrow what someone is
  // allowed to do, and narrowing is the safe direction, so a lookup that cannot
  // answer returns the free row instead of taking the page down with it.
  //
  // Note this is the read path only. `consumeRender` still throws when the DB is
  // unreachable, because a meter that fails open is not a meter.
  let row: PlanRow | undefined;
  try {
    [row] = await getDb()
      .select({
        plan: billingSubscriptions.plan,
        status: billingSubscriptions.status,
        currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      })
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.userId, userId))
      .limit(1);
  } catch (err) {
    console.warn("[entitlements] plan lookup failed, serving free", err);
    return { plan: "free", limits: PLANS.free };
  }

  // No row is the state every user starts in — only the webhook writes here, so
  // the entire paid tier can be absent (no Dodo keys, no webhook, no rows) and
  // this still answers correctly.
  if (!row) return { plan: "free", limits: PLANS.free };

  const lapsed =
    row.currentPeriodEnd !== null &&
    row.currentPeriodEnd.getTime() <= Date.now();

  // `cancelled` is not `revoked`. Someone who cancels on day 3 has paid for the
  // month and keeps it until `current_period_end` passes — revoking the instant
  // the webhook lands takes back something already paid for, which is both
  // wrong and the shape of wrong that comes back as a chargeback. Every other
  // non-active status (`failed`, `on_hold`, `paused`, `expired`) means the money
  // did *not* arrive, so those do drop immediately.
  //
  // The `lapsed` check is what makes this safe without a cron: a cancelled row
  // stops entitling anything the moment its period end passes, whether or not a
  // further event ever arrives.
  const entitled =
    row.status === "active" || (row.status === "cancelled" && !lapsed);
  if (!entitled || lapsed) {
    return { plan: "free", limits: PLANS.free };
  }

  // `PLANS[row.plan]` is the one place the `plan` pgEnum and the plan table
  // meet: add a plan to the enum without adding it to PLANS and this line stops
  // compiling, which is the only reason the two can be trusted to agree.
  return { plan: row.plan, limits: PLANS[row.plan] };
}

/* ── pruneUsage ─────────────────────────────────────────────────────────── */

/**
 * How many whole months of meter rows to keep besides the current one.
 *
 * One, not zero. A row written at 23:59 on the last of the month is read at
 * 00:01 on the first of the next by a request that started before midnight, and
 * a retention that keeps only the current month would delete it mid-flight.
 * Nothing reads further back than that — the meter only ever asks about now.
 */
const KEEP_MONTHS = 1;

/**
 * The oldest `period_month` worth keeping — everything strictly before it goes.
 *
 * Separated from the delete because this is the whole of the logic and the
 * `DELETE` is drizzle's. `Date.UTC` is what makes the year boundary correct
 * without a special case: month `-1` of 2026 is December 2025, where a
 * hand-rolled `month - 1` produces the string "2026-00" and silently matches
 * nothing forever.
 */
export function usageCutoff(now: Date, keepMonths = KEEP_MONTHS): string {
  return periodMonth(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - keepMonths, 1)),
  );
}

/**
 * Drop meter rows for months nobody will ask about again.
 *
 * The table has one row per meter key per month and never shed any of them.
 * Signed-in users are bounded by the user count; anonymous keys are an IP hash,
 * so the anonymous half grows with *visitors × months* and has no ceiling at
 * all — every crawler that ever rendered keeps a row forever.
 *
 * `period_month` is text in `YYYY-MM`, which is why this can be a plain string
 * comparison: that format sorts lexicographically the same way it sorts
 * chronologically, and a date column would have needed a truncation on every
 * read to answer the only question the meter asks.
 *
 * Returns the number deleted so the caller can log something that is not zero.
 */
export async function pruneUsage(now = new Date()): Promise<number> {
  if (!isDbConfigured) return 0;
  const cutoff = usageCutoff(now);
  try {
    const gone = await getDb()
      .delete(renderUsage)
      .where(lt(renderUsage.periodMonth, cutoff))
      .returning({ key: renderUsage.meterKey });
    return gone.length;
  } catch (err) {
    // A sweep, not a request. Housekeeping that fails is retried on the next
    // tick; throwing here would take out the file sweep it shares a pass with.
    console.warn("[entitlements] pruneUsage failed", err);
    return 0;
  }
}

/* ── releaseRender ──────────────────────────────────────────────────────── */

/**
 * Give a render back.
 *
 * `consumeRender` charges at enqueue, which is right — the CPU is spent whether
 * or not anyone downloads the file. But a render that *never produced a file*
 * spent nothing the user asked for, and a crash loop that ate an anonymous
 * caller's five would answer their retry with "you've used 5 of 5". That is a
 * user who never comes back, over a failure that was ours.
 *
 * Deliberately floored at zero and deliberately silent: this runs on the render
 * worker's error path, where throwing would replace a render failure the user
 * can retry with an unhandled rejection they cannot. A lost decrement
 * over-charges by one; a thrown one loses the job.
 */
export async function releaseRender(meterKey: string): Promise<void> {
  if (!isDbConfigured) return;
  try {
    await getDb()
      .update(renderUsage)
      .set({
        rendersUsed: sql`greatest(${renderUsage.rendersUsed} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(renderUsage.meterKey, meterKey),
          eq(renderUsage.periodMonth, periodMonth()),
        ),
      );
  } catch (err) {
    console.warn("[entitlements] releaseRender failed", err);
  }
}

/* ── consumeRender ──────────────────────────────────────────────────────── */

/**
 * The meter's bucket. UTC, because a billing boundary is not local noon — and
 * because a server that moves region must not hand a user a second allowance
 * for the same month. `toISOString()` is the whole implementation for exactly
 * this reason: it cannot read a local calendar even by accident.
 */
function periodMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Charge one render against `meterKey`'s allowance for this calendar month, or
 * throw `QuotaExceededError` if it is spent.
 *
 * `meterKey` is a user id for a signed-in caller and an anonymous (IP-derived)
 * hash otherwise — `render_usage.meter_key` is deliberately not a foreign key
 * so both fit in one meter rather than one meter plus a special case.
 *
 * Not guarded by `isDbConfigured`: `getDb()` throwing is the correct outcome
 * with no database. Reading an entitlement without one has a safe answer (free)
 * but charging a meter without one does not — a silent no-op here is an
 * unlimited meter, which is precisely the failure this module exists to
 * prevent. Routes check `isDbConfigured` and return 503 before they get here,
 * and the throw is a plain Error, so it can never be mistaken for a refusal.
 */
export async function consumeRender(
  meterKey: string,
  limits: PlanLimits,
): Promise<void> {
  if (limits.renders <= 0) {
    // Must be refused BEFORE the statement below. The INSERT branch writes
    // `renders_used: 1` unconditionally — a first render of the month has no
    // existing row for `setWhere` to test against — so falling through with a
    // zero allowance leaks exactly one render per key per month.
    throw new QuotaExceededError(
      "This plan includes no renders.",
      0,
      limits.renders,
    );
  }

  const period = periodMonth();

  // Check and charge in ONE statement. A SELECT then an UPDATE loses an
  // increment whenever two renders arrive in the same second, which is the
  // normal case and not the edge one — and a lost increment is a free render on
  // a paid plan.
  //
  // `setWhere` IS the check, not a nicety on top of one: Postgres skips the
  // update when the allowance is spent, so nothing is written and `.returning()`
  // comes back empty. Delete that one clause and this becomes an unlimited
  // meter that counts forever without ever refusing anything, and the tests
  // that only assert "it counted" still pass.
  const [charged] = await getDb()
    .insert(renderUsage)
    .values({ meterKey, periodMonth: period, rendersUsed: 1 })
    .onConflictDoUpdate({
      target: [renderUsage.meterKey, renderUsage.periodMonth],
      set: {
        rendersUsed: sql`${renderUsage.rendersUsed} + 1`,
        updatedAt: new Date(),
      },
      setWhere: lt(renderUsage.rendersUsed, limits.renders),
    })
    .returning({ rendersUsed: renderUsage.rendersUsed });

  if (!charged) {
    // Nothing was written, so there is no refund to get wrong. `used` is the
    // limit rather than a second round trip to look it up: the only way to
    // reach here is `renders_used >= limits.renders`, and `setWhere` is the
    // sole path that ever increments the column, so it can never have passed
    // the limit — the two numbers are provably equal.
    throw new QuotaExceededError(
      `This month's ${limits.renders} renders are used.`,
      limits.renders,
      limits.renders,
    );
  }
}

/* ── activatePlan ───────────────────────────────────────────────────────── */

/**
 * Write the entitlement the webhook just learned about.
 *
 * One row per user, upserted on the `user_id` primary key, because this table
 * holds the *entitlement* and not the billing history — Dodo keeps the history,
 * and duplicating it here only creates a second thing to reconcile when the two
 * disagree.
 *
 * `status` is stored verbatim rather than mapped to a boolean: `planFor` needs
 * to distinguish "cancelled but paid through the month" from "on hold", and a
 * status flattened on write cannot be un-flattened on read. `currentPeriodEnd`
 * is Dodo's `next_billing_date` under a processor-neutral name — Dodo has no
 * `current_period_end` field at all.
 */
export async function activatePlan(args: {
  userId: string;
  plan: PlanName;
  subscriptionId: string | null;
  /**
   * Dodo's customer id.
   *
   * The column existed and nothing ever wrote it, which cost two things: a
   * support question ("who is this in Dodo?") could only be answered by
   * scanning subscriptions for a matching `metadata.user_id`, and the reconcile
   * in `findActiveSubscription` has to page through active subscriptions for
   * the same reason rather than asking `?customer_id=`. Optional because a
   * lapse event may not carry the customer object, and a missing value must not
   * blank one we already have.
   */
  customerId?: string | null;
  status: string;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  /**
   * Minted here and never rotated. `coalesce` rather than a plain assignment
   * because both paths have to end with a key and only one of them may write:
   * a brand-new row gets this one, an existing row keeps whatever it already
   * handed out. Overwriting on renewal would silently break every MCP config
   * the customer has pasted on every machine, once a month, for as long as
   * they pay — the failure mode is a support ticket that reads like a bug in
   * the gate.
   *
   * A free row upgrading to paid takes the same branch and mints for the first
   * time, which is why the null case has to be handled in SQL and not in a
   * read-then-write above.
   */
  const mintedKey = newApiKey();

  const row = {
    plan: args.plan,
    status: args.status,
    dodoSubscriptionId: args.subscriptionId,
    currentPeriodEnd: args.currentPeriodEnd,
    apiKey: sql`coalesce(${billingSubscriptions.apiKey}, ${mintedKey})`,
    updatedAt: new Date(),
    // Spread, so an event without a customer leaves the stored one alone —
    // `undefined` in a drizzle `set` omits the column, `null` would erase it.
    ...(args.customerId ? { dodoCustomerId: args.customerId } : {}),
  };

  await getDb()
    .insert(billingSubscriptions)
    .values({ userId: args.userId, ...row, apiKey: mintedKey })
    .onConflictDoUpdate({ target: billingSubscriptions.userId, set: row });
}
