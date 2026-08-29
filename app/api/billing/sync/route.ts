import { type NextRequest, NextResponse } from "next/server";
import { planForProduct } from "@/lib/plans";
import { dodoConfigured, findActiveSubscription } from "@/lib/server/dodo";
import { activatePlan } from "@/lib/server/entitlements";
import { requireUser } from "@/lib/server/projects";

export const runtime = "nodejs";

/**
 * Where Dodo sends someone after they pay — and the reconcile path for every
 * webhook that never arrives.
 *
 * The webhook is the fast path, not the reliable one. It is missed for ordinary
 * reasons: the endpoint was mid-deploy, the retries ran out, the tunnel was not
 * running in development, nobody registered the endpoint. Each of those ends
 * with a person who paid staring at the upgrade button they just used. Asking
 * Dodo directly closes that gap, and it is the same call whether the miss
 * lasted four seconds or four days.
 *
 * A GET that writes, deliberately. This is a browser redirect target — Dodo can
 * only send the buyer here with a navigation — and the write is an idempotent
 * upsert of state we did not author, so a refresh or a prefetch costs one API
 * call and changes nothing. The alternative is a landing page whose only content
 * is a POST it fires at itself.
 */
export async function GET(request: NextRequest) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const next = safeNext(request.nextUrl.searchParams.get("next"));

  if (dodoConfigured()) {
    try {
      const sub = await findActiveSubscription(guard.userId);
      // `findActiveSubscription` already refuses anything this app did not
      // sell, so a subscription in hand is ours. Asking again is how the plan
      // gets *named*: the same tag the webhook reads, so the two paths cannot
      // disagree about what an annual subscription is worth.
      const plan = planForProduct(sub?.metadata?.product);
      if (sub && plan) {
        await activatePlan({
          userId: guard.userId,
          plan,
          subscriptionId: sub.subscription_id,
          customerId: sub.customer?.customer_id ?? null,
          status: "active",
          currentPeriodEnd: sub.next_billing_date
            ? new Date(sub.next_billing_date)
            : null,
        });
      }
    } catch (err) {
      // Never block the redirect. Someone who has just paid should land on the
      // product either way; if this failed, the webhook or their next visit
      // through this route will settle it, and a stack trace is not the first
      // thing they should see after a payment.
      console.warn("[billing] sync failed", err);
    }
  }

  return NextResponse.redirect(new URL(next, request.nextUrl.origin));
}

/**
 * Only ever a path on this site.
 *
 * `next` arrives from a URL we built, but it comes back through the browser via
 * a payment provider, so it is attacker-reachable in practice. An absolute URL
 * here would turn the checkout return into an open redirect — the exact shape
 * phishing wants, because the link genuinely starts on your domain.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/docs/video-editor";
  }
  return raw;
}
