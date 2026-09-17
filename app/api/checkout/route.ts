import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  CHECKOUT_PRODUCTS,
  type CheckoutProduct,
  isCheckoutProduct,
  PLANS,
} from "@/lib/plans";
import { clientIp } from "@/lib/server/client-ip";
import { isDbConfigured } from "@/lib/server/db";
import { createCheckout, dodoConfigured } from "@/lib/server/dodo";
import { checkRateLimit } from "@/lib/server/rate-limit";

/**
 * POST /api/checkout — hand back a Dodo checkout URL for one product.
 *
 * Payload: `{ product: "everything_annual" | "lifetime" | … }` — any
 * `CHECKOUT_PRODUCTS` key. Response: `{ checkoutUrl }`.
 *
 * Nothing here grants anything. What comes back is a link to a page on Dodo's
 * domain, and a subscription created through it is `pending` until the money
 * actually moves — so the only thing that ever moves a user onto a paid plan is
 * `/api/webhooks/dodo`. Trusting this response instead would sell Pro to
 * anyone who can POST and then abandon the card form.
 *
 * Sign-in is **not** required. It was, so `metadata.user_id` would link every
 * payment to a person — and half of everyone who opened sign-in never finished
 * it, which put the wall in front of the card at exactly the wrong moment. A
 * signed-in buyer still gets `user_id`; a guest's payment carries the email
 * they typed on Dodo's page, and the webhook puts the plan on that address's
 * account, creating it if needed (`userIdForEmail`). Signing in with the same
 * address finds it.
 */

export async function POST(request: Request) {
  // 503, not 500: a deployment with no Dodo keys is unconfigured, not broken —
  // the editor, the renders and the whole site work without a single one of
  // them, and the pricing UI reads this as "you can't buy here" rather than
  // showing a crash.
  if (!dodoConfigured()) {
    return NextResponse.json(
      { error: "Checkout isn't configured yet." },
      { status: 503 },
    );
  }

  // The webhook has to write the plan somewhere, guest or not.
  if (!isDbConfigured) {
    return NextResponse.json(
      { error: "Checkout isn't configured yet." },
      { status: 503 },
    );
  }

  const user = (await auth().catch(() => null))?.user;
  const userId = user?.id ?? null;

  // Keyed on the user when there is one: an office behind one NAT should not
  // share a purchase budget. A guest has only the address.
  if (!checkRateLimit(userId ?? `ip:${clientIp(request)}`, "checkout")) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait and retry." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  // Checked against the shared table, never against literals repeated here.
  // The literal version silently rejected `starter_annual` for as long as the
  // annual plan existed — the key was in the product map, the pricing page and
  // the env, and this guard was the one list nobody updated. TypeScript could
  // not catch it: a narrower union is still a valid index into a wider map.
  const { product } = body as { product?: unknown };
  if (!isCheckoutProduct(product)) {
    return NextResponse.json(
      { error: "Unknown product.", code: "unknown_product" },
      { status: 400 },
    );
  }

  // Ids are configuration, not code: the test and live dashboards mint
  // entirely different ones, so a hardcoded id means whichever mode it did not
  // come from fails at Dodo with a 404 that looks like an outage.
  const productId = process.env[CHECKOUT_PRODUCTS[product].env];
  if (!productId) {
    // Half-configured: an API key but no product ids. Dodo answers an empty
    // cart with an error nobody on this side can act on, so name it here.
    return NextResponse.json(
      { error: "That plan isn't available yet." },
      { status: 503 },
    );
  }

  try {
    const { checkoutUrl } = await createCheckout({
      productId,
      email: user?.email ?? undefined,
      name: user?.name ?? undefined,
      // The whole point of the round trip. Dodo echoes metadata back on every
      // event for this purchase, so this is what the webhook reads to know
      // whose plan to activate — and `product` is what tells a one-time pack
      // payment apart from a subscription payment on the way back in. Values
      // must be strings; Dodo silently drops anything it does not understand.
      metadata: userId ? { user_id: userId, product } : { product },
      // Through the sync route, not straight to the editor. Dodo's redirect is
      // the earliest moment we can be certain the payment happened, and routing
      // it through a reconcile means the plan is already live on the page they
      // land on — rather than depending on a webhook that may still be in
      // flight, or may never have been registered.
      //
      // Where they land depends on what they bought. The editor plans land in
      // the editor. The catalogue lands on `/account`, where a buyer's keys and
      // the lines that put one in `components.json` live — it used to land in
      // the editor, which left somebody who had just paid for components with
      // no key and no way to install one.
      //
      // A guest has no session for the sync route to reconcile, so they land on
      // sign-in, told to use the address they paid with.
      returnUrl: userId
        ? `${publicOrigin(request)}/api/billing/sync?next=${encodeURIComponent(next(product))}`
        : `${publicOrigin(request)}/signin?paid=1&callbackUrl=${encodeURIComponent(next(product))}`,
    });
    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    // 502: the failure is upstream, and saying so keeps a Dodo outage out of
    // this app's own error rate.
    console.error("[checkout] create failed:", err);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 502 },
    );
  }
}

/** Whether a product's plan carries the pro components. A pack has no plan. */
function next(product: CheckoutProduct): string {
  return buysComponents(product)
    ? "/account?checkout=done"
    : "/docs/video-editor?checkout=done";
}

function buysComponents(product: CheckoutProduct): boolean {
  const plan = CHECKOUT_PRODUCTS[product].plan;
  return plan ? PLANS[plan].components : false;
}

/**
 * The origin a *browser* would use — the same problem, and the same fix, as
 * `publicOrigin` in `app/api/render/route.ts`, where the long version of this
 * note lives.
 *
 * It matters more here than there: behind a reverse proxy `request.url` carries
 * the internal host, and a `return_url` built from it drops the buyer on
 * `https://localhost:3000` *after* they have paid. Forwarded headers win when
 * present because only the proxy knows the public name.
 */
function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  if (host) return `${proto || url.protocol.replace(":", "")}://${host}`;
  return url.origin;
}
