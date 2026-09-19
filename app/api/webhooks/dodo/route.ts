import { NextResponse } from "next/server";
import { captureServer } from "@/lib/analytics-server";
import { oneTimePlanFor, planForProduct } from "@/lib/plans";
import { isDbConfigured } from "@/lib/server/db";
import { type DodoEvent, verifyWebhookSignature } from "@/lib/server/dodo";
import { proReadyEmail, sendEmail } from "@/lib/server/email";
import { activatePlan, userIdForEmail } from "@/lib/server/entitlements";

// Node runtime: the signature check is an HMAC through `node:crypto` and a
// `timingSafeEqual`, neither of which exists on the Edge runtime.
export const runtime = "nodejs";

/**
 * POST /api/webhooks/dodo — the only thing in this app that grants a paid plan.
 *
 * `/api/checkout` hands out a link and learns nothing; a subscription created
 * there is `pending` until the money moves. Everything a user is entitled to is
 * decided by an event that arrives here, which makes this file the trust
 * boundary for the whole paid tier: a request that gets past the signature
 * check can give itself Starter for free.
 *
 * Two rules follow from that, and both are easy to break by accident:
 *
 *  1. Verify the *raw* bytes, before parsing (see below).
 *  2. Never skip verification because the secret is missing.
 *
 * Everything else is about retries. Dodo re-sends any event that does not get a
 * 2xx, with backoff, for days — so the status code here is not decoration, it
 * is the decision "should this be tried again?". Answer it wrong in the
 * generous direction and one unprocessable event is redelivered forever;
 * answer it wrong in the other direction and a paid subscription silently
 * never activates.
 */

export async function POST(request: Request) {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) {
    // The tempting branch here is "no secret configured, so accept the event" —
    // it makes local testing pleasant and it is a hole with a two-year fuse. It
    // works perfectly in dev, and the first time the variable is missing from a
    // production deploy the endpoint starts handing out plans to whoever posts
    // a plausible JSON body. Failing loudly costs a retry; a delayed
    // activation is recoverable and a forged one is not.
    return NextResponse.json(
      { error: "Billing webhooks aren't configured yet." },
      { status: 503 },
    );
  }

  // The signature covers these exact bytes, so they are what gets verified.
  // `await request.json()` first and then re-stringifying looks equivalent and
  // is not: JSON.stringify reorders nothing but drops the sender's whitespace,
  // re-escapes unicode, and renders numbers its own way — all invisible in the
  // parsed object, all fatal to an HMAC. Read the text once, verify it, parse
  // it after. There is no second chance to read the body.
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // `Partial`, because the type describes what Dodo sends and this is a body
  // that has only been proven *signed* — the fields are still read one at a
  // time below rather than trusted wholesale.
  let event: Partial<DodoEvent>;
  try {
    event = (JSON.parse(raw) ?? {}) as Partial<DodoEvent>;
  } catch {
    // Signed but unparseable means the sender is broken in a way retrying
    // cannot fix, and 400 stops the redelivery loop.
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const type = typeof event.type === "string" ? event.type : "";
  const data = event.data ?? {};
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  // A guest checkout carries no user id — only the email typed on Dodo's page,
  // which is the account (`userIdForEmail`). Only for our own products: this
  // endpoint also hears the other brand on the Dodo account, and its events
  // must never create a snapcn user.
  const guestEmail = str(
    (data.customer as { email?: unknown } | undefined)?.email,
  );
  const ours = Boolean(
    planForProduct(metadata.product) || oneTimePlanFor(metadata.product),
  );

  if (!str(metadata.user_id) && !(ours && guestEmail)) {
    // 200, deliberately, on an event this app cannot use. A 4xx would put it
    // back in Dodo's retry queue and it would return for days — but no number
    // of redeliveries will ever add a `user_id` that was never set. Events
    // reach this branch legitimately: a subscription created by hand in the
    // Dodo dashboard, or another integration sharing the same business
    // account. Acknowledge, log, move on.
    console.warn(`[dodo] ${type || "event"} with no metadata.user_id, ignored`);
    return NextResponse.json({ ok: true });
  }

  if (!isDbConfigured) {
    // Nowhere to write the entitlement. 503 keeps the event in Dodo's retry
    // queue rather than acknowledging a payment that left no trace — this is
    // the one unconfigured case where dropping the request is worse than
    // failing it.
    return NextResponse.json(
      { error: "Billing isn't configured yet." },
      { status: 503 },
    );
  }

  // Activation creates a guest's account; any other event only finds one, so a
  // failed first payment does not leave an empty account behind.
  let resolved = str(metadata.user_id);
  if (!resolved && guestEmail) {
    const activates =
      type === "subscription.active" ||
      type === "subscription.renewed" ||
      type === "payment.succeeded";
    try {
      resolved = await userIdForEmail(guestEmail, { create: activates });
    } catch (err) {
      console.error(`[dodo] ${type} could not resolve the buyer:`, err);
      return NextResponse.json({ error: "Retry." }, { status: 500 });
    }
  }
  if (!resolved) {
    console.warn(`[dodo] ${type} for a guest with no account, ignored`);
    return NextResponse.json({ ok: true });
  }
  const userId = resolved;
  // A guest has no session to land in, so the address they paid with is told
  // where the plan is. `sendEmail` never throws.
  const tellGuest = async () => {
    if (!str(metadata.user_id) && guestEmail) {
      await sendEmail(proReadyEmail(guestEmail));
    }
  };

  /**
   * The sale, reported once, from the branch that granted it.
   *
   * Not at the top of the handler: this endpoint also hears cancellations,
   * failures and another brand's events, and every one of them is a signed,
   * parseable payload. Only a branch that actually handed something over knows
   * money moved. `captureServer` never throws and is awaited so the lambda is
   * not killed before the request leaves.
   */
  const reportSale = async (
    kind: "subscription" | "lifetime" | "pack",
    plan: string,
    renewal = false,
  ) => {
    await captureServer("purchase_completed", userId, {
      kind,
      plan,
      renewal,
      product: str(metadata.product) ?? null,
      // Dodo reports minor units. Both names appear across its payloads, so
      // read either rather than guess which product sent this one.
      amount: num(data.total_amount) ?? num(data.amount) ?? null,
      currency: str(data.currency) ?? null,
    });
  };

  try {
    switch (type) {
      // There is no `subscription.created` in Dodo's vocabulary, and there
      // should not be one here either: `active` is the first event that means
      // the money arrived.
      case "subscription.active":
      case "subscription.renewed": {
        // The comment above says other integrations on the same Dodo business
        // account legitimately reach this endpoint — and this business account
        // also sells Ruixen. A signed `subscription.active` from a *different*
        // product whose metadata happens to carry a `user_id` must not hand out
        // snapcn Starter, so the grant is keyed on the product tag that
        // `/api/checkout` writes, not on the event type alone.
        const plan = planForProduct(metadata.product);
        if (!plan) {
          console.warn(
            `[dodo] ${type} for product ${str(metadata.product) || "(untagged)"}, not ours — ignored`,
          );
          break;
        }
        await activatePlan({
          userId,
          plan,
          subscriptionId: str(data.subscription_id),
          customerId: str(
            (data.customer as { customer_id?: unknown } | undefined)
              ?.customer_id,
          ),
          status: "active",
          // Dodo has no `current_period_end` — `next_billing_date` is the
          // renewal instant, and `expires_at` (null on an open-ended sub) is
          // the end of the whole term, which is a different question.
          currentPeriodEnd: date(data.next_billing_date),
        });
        if (type === "subscription.active") await tellGuest();
        await reportSale("subscription", plan, type === "subscription.renewed");
        break;
      }

      case "subscription.cancelled":
      case "subscription.expired":
      case "subscription.failed":
      case "subscription.on_hold":
      case "subscription.paused": {
        // The same product guard as the activation above, for the same reason:
        // this business account also sells Ruixen, and a foreign subscription
        // being cancelled must not write a `cancelled` row over somebody's live
        // snapcn plan. The grant was guarded and the revoke was not.
        const plan = planForProduct(metadata.product);
        if (!plan) {
          console.warn(
            `[dodo] ${type} for product ${str(metadata.product) || "(untagged)"}, not ours — ignored`,
          );
          break;
        }
        // The plan itself does not change here and only the status moves.
        // `planFor` is the single place that decides what a non-active status
        // is worth, so honouring a cancelled subscription until its paid month
        // runs out is a rule this handler never needs to know. Writing `free`
        // here instead would revoke a paid month the instant someone clicks
        // cancel, which is both wrong and the kind of wrong that arrives as a
        // chargeback.
        await activatePlan({
          userId,
          plan,
          subscriptionId: str(data.subscription_id),
          // Dodo's own word for the state, with the event type as the fallback
          // for a payload that omits it. Recorded verbatim: the column is text
          // precisely so a status we have never seen cannot break the write.
          status: str(data.status) ?? type.slice("subscription.".length),
          currentPeriodEnd: date(data.next_billing_date),
        });
        break;
      }

      case "payment.succeeded": {
        // A lifetime seat arrives here and nowhere else: Dodo reports a
        // one-time purchase as a payment and never as a subscription, so this
        // is the only branch that can grant it.
        //
        // `currentPeriodEnd: null` is the entitlement. `planFor` treats a null
        // period as never-expiring — a bought-outright seat has no renewal to
        // miss — and `subscriptionId: null` records the truth that there is no
        // subscription behind it rather than inventing one. The row is the same
        // `billing_subscription` row everything else writes, so every reader,
        // every gate and the API key mint all work unchanged.
        const outright = oneTimePlanFor(metadata.product);
        if (outright) {
          await activatePlan({
            userId,
            plan: outright,
            subscriptionId: null,
            customerId: str(
              (data.customer as { customer_id?: unknown } | undefined)
                ?.customer_id,
            ),
            status: "active",
            currentPeriodEnd: null,
          });
          await tellGuest();
          await reportSale("lifetime", outright);
          console.info(`[dodo] ${metadata.product} granted to ${userId}`);
          break;
        }

        // Subscription payments land here too, and the events above already
        // handled those. Re-activating on both would mostly be harmless — but
        // "buying the template pack renewed your subscription" is the version
        // of it that is not, so only a cart our own checkout tagged `pack`
        // counts as a pack purchase.
        if (metadata.product !== "pack") break;
        // ponytail: the pack is template files delivered by Dodo's receipt, so
        // there is nothing in this app behind a gate and nowhere to record it —
        // the log line is the whole entitlement, and it is enough to answer
        // "did this person buy it" by hand. Give it a table (and a read in
        // `planFor`) the day a pack asset lives behind a login.
        await reportSale("pack", "pack");
        console.info(`[dodo] template pack purchased by ${userId}`);
        break;
      }

      default:
        // Everything else Dodo sends — payment failures, refunds, disputes,
        // customer updates — is real, and none of it changes what this app
        // lets someone do. 200 so it is not redelivered.
        break;
    }
  } catch (err) {
    // The opposite call from the missing-`user_id` case above: this event *is*
    // processable and the write itself failed (database down, a deploy
    // mid-flight). 500 puts it back in Dodo's retry queue, which is exactly
    // what should happen — and `activatePlan` upserts, so an event that arrives
    // three times costs nothing but three writes.
    console.error(`[dodo] ${type} failed for ${userId}:`, err);
    return NextResponse.json({ error: "Retry." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Non-empty string, or null — Dodo omits fields rather than nulling them. */
function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * A finite number, or null.
 *
 * Dodo sends amounts as minor units, and has sent them as a numeric string on
 * at least one product — `Number(null)` is 0 and `Number("")` is 0, either of
 * which would report a free sale rather than an unknown one, so both are
 * rejected before the coercion.
 */
function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = str(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A date, or null — never an `Invalid Date`.
 *
 * `new Date(undefined)` is NaN-valued and passes every truthiness check, then
 * throws at the driver on the way into a `timestamptz`. Turning a missing or
 * malformed renewal date into a null column keeps a badly-shaped payload from
 * failing an activation that is otherwise perfectly good.
 */
function date(value: unknown): Date | null {
  const raw = str(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
