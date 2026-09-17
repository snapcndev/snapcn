import "server-only";
import { planForProduct } from "@/lib/plans";

/**
 * Dodo Payments — checkout creation and webhook verification, over `fetch`.
 *
 * Same reasoning as `lib/server/email.ts`: an SDK here buys a dependency, a
 * bundle, and its own retry opinions inside a function that can be frozen the
 * instant it returns. Two endpoints and an HMAC do not need a package.
 *
 * ## Not configured is a valid state
 *
 * With no `DODO_API_KEY` this whole module is inert and `dodoConfigured()` is
 * false, matching `isDbConfigured` — a fresh clone builds and runs with zero
 * env set, and the paid tier is simply absent rather than a crash. Routes are
 * expected to check first and answer **503** ("billing isn't configured yet"),
 * never 500: a missing key is a deployment state, not a bug in the request.
 *
 * ## Everything here is read at call time
 *
 * Deliberately functions, not module-scope constants. Billing keys are the ones
 * most likely to be rotated or flipped from test to live on a running deploy,
 * and a value captured at import time silently keeps the old mode until the
 * process restarts. Reading `process.env` per call costs nothing next to an
 * HTTPS round trip.
 *
 * ## Field names are load-bearing
 *
 * Dodo **silently ignores unknown JSON fields**. A typo'd key is not a 400 —
 * it is dropped, the call succeeds, and the data is just gone (a mistyped
 * `metadata` means a paid webhook arrives with no user to credit). That is why
 * the request body below is written out literally instead of being spread from
 * a caller-shaped object: every key that goes to Dodo is visible in this file
 * and typo'd once, here, where a test or a review can see it.
 */

/**
 * `api.dodopayments.com` does not exist, and there is no `/v1` prefix — the
 * mode *is* the host. Anything other than an explicit `live` resolves to test,
 * because the failure modes are not symmetric: test-when-you-meant-live is a
 * checkout that does not take money, live-when-you-meant-test charges real
 * cards. An unset, misspelled, or empty `DODO_MODE` must land on the harmless
 * one.
 */
function baseUrl(): string {
  return process.env.DODO_MODE === "live"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

/** True when an API key is set. Callers 503 rather than 500 when it is false. */
export function dodoConfigured(): boolean {
  return Boolean(process.env.DODO_API_KEY);
}

/**
 * A non-2xx from Dodo. Carries the HTTP status and Dodo's own `{code,message}`
 * so a route can decide what the user sees — a 4xx is usually our bad product
 * id or a declined card and worth surfacing; a 5xx is theirs and worth
 * retrying — without re-parsing the body or string-matching a message.
 */
export class DodoApiError extends Error {
  readonly status: number;
  /** Dodo's machine-readable code, when the body carried one. */
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "DodoApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * A verified webhook, narrowed only as far as the dispatcher actually needs.
 *
 * `data` stays `Record<string, unknown>`: the payload shape differs per event
 * type and Dodo adds fields without notice, so a hand-written interface here
 * would be a lie the compiler enforces. The handler reads the two or three
 * fields it needs and validates them at that point.
 */
export interface DodoEvent {
  type: string;
  data: Record<string, unknown>;
}

export async function createCheckout(opts: {
  productId: string;
  quantity?: number;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) {
    throw new Error("DODO_API_KEY is not set — cannot create a checkout.");
  }

  // Written key by key rather than assembled, for the reason at the top of the
  // file: an unknown field is dropped in silence, so there is no runtime signal
  // that would catch a rename. `customer` and `metadata` are omitted entirely
  // when empty — Dodo collects the address on the hosted page, and an empty
  // object is not the same thing as "ask them".
  const body: Record<string, unknown> = {
    product_cart: [
      { product_id: opts.productId, quantity: opts.quantity ?? 1 },
    ],
  };
  if (opts.email) body.customer = { email: opts.email, name: opts.name };
  if (opts.metadata && Object.keys(opts.metadata).length > 0) {
    body.metadata = opts.metadata;
  }
  if (opts.returnUrl) body.return_url = opts.returnUrl;

  const res = await fetch(`${baseUrl()}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    // Dodo answers errors as `{code,message}`, but a gateway timeout or a WAF
    // page is plain text or HTML — so the raw body is the fallback message
    // rather than letting a parse failure mask the real status.
    let code: string | null = null;
    let message = text || res.statusText;
    try {
      const parsed = JSON.parse(text) as { code?: string; message?: string };
      code = parsed.code ?? null;
      message = parsed.message ?? message;
    } catch {
      /* not JSON — keep the raw body */
    }
    throw new DodoApiError(res.status, code, `Dodo ${res.status}: ${message}`);
  }

  const json = JSON.parse(text) as {
    session_id?: string;
    checkout_url?: string;
  };
  // Silently-ignored fields cut both ways: if the response shape ever changes,
  // these come back `undefined` and we would hand the browser a redirect to
  // "undefined". Fail here, where the stack still says which call did it.
  if (!json.session_id || !json.checkout_url) {
    throw new DodoApiError(
      res.status,
      null,
      "Dodo checkout response is missing session_id/checkout_url.",
    );
  }

  return { sessionId: json.session_id, checkoutUrl: json.checkout_url };
}

/**
 * What one product costs a buyer in `country`, as Dodo's own checkout will
 * charge it: the regional price or the currency conversion, and the tax, in the
 * currency's minor units.
 *
 * `POST /checkouts/preview` — the same calculation the hosted checkout runs,
 * without creating a session. This is the number the pricing page shows, so
 * the page cannot say one thing and the card form another: a price edited in
 * the Dodo dashboard is on the page without a deploy.
 *
 * Null on anything but a clean answer — no key, a country Dodo will not
 * price, a network blip. The caller falls back to the price table.
 */
export interface CheckoutQuote {
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
}

export async function previewCheckout(
  productId: string,
  country: string,
): Promise<CheckoutQuote | null> {
  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${baseUrl()}/checkouts/preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "snapcn-server/1.0 (+https://snapcn.dev)",
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        billing_address: { country },
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      currency?: unknown;
      current_breakup?: {
        subtotal?: unknown;
        tax?: unknown;
        total_amount?: unknown;
      };
    };
    const b = body.current_breakup;
    // Silently-ignored fields cut both ways here too: a renamed field must read
    // as "no quote", never as a price of zero.
    if (
      typeof body.currency !== "string" ||
      typeof b?.subtotal !== "number" ||
      typeof b.total_amount !== "number"
    ) {
      return null;
    }
    return {
      currency: body.currency,
      subtotal: b.subtotal,
      tax: typeof b.tax === "number" ? b.tax : 0,
      total: b.total_amount,
    };
  } catch {
    return null;
  }
}

/** Dodo's maximum page size for the subscriptions list, which is 0-indexed. */
const PAGE_SIZE = 100;
/**
 * ponytail: 50 pages is 5,000 active subscriptions across every brand on the
 * account — far past anything this app will see, and a bound is what stops a
 * misbehaving list endpoint turning a page render into an infinite loop. Raise
 * it, or filter by `brand_id` (the endpoint does support it), if the account
 * ever grows past that.
 */
const MAX_PAGES = 50;

/**
 * The subscription Dodo believes this user has, if any.
 *
 * The webhook is the fast path and this is the true one. A webhook can be
 * missed for entirely ordinary reasons — the endpoint was mid-deploy, the
 * retries ran out, the tunnel was not running in development, or nobody
 * registered the endpoint at all — and every one of those ends the same way: a
 * person who paid, sitting in front of a free account. Money that has arrived
 * must not depend on a request we happened to receive.
 *
 * Matched on `metadata.user_id`, which `/api/checkout` writes onto every
 * session, rather than on an email — an address can be changed at either end,
 * and matching on one would hand a plan to whoever typed it at checkout.
 *
 * ponytail: scans the active page rather than querying by customer, because we
 * do not store the Dodo customer id until the first sync. Store `customer_id`
 * on the row and query `?customer_id=` when this stops fitting one page.
 */
export async function findActiveSubscription(
  userId: string,
): Promise<DodoSubscription | null> {
  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) return null;

  // Paged, because the list is every active subscription on the *business
  // account* — and this one also sells Ruixen. A single page-one request finds
  // a snapcn subscriber only while the two products together stay under
  // `PAGE_SIZE`; past that a paying customer silently reconciles to nothing,
  // which is the worst possible way for this to fail.
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `${baseUrl()}/subscriptions?status=active&page_size=${PAGE_SIZE}&page_number=${page}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          // Dodo's edge rejects a request with no browser-shaped user-agent on
          // some routes (403, Cloudflare code 1010). Cheap to send, and the
          // failure it prevents is silent.
          "User-Agent": "snapcn-server/1.0 (+https://snapcn.dev)",
        },
      },
    );
    if (!res.ok) {
      throw new DodoApiError(
        res.status,
        null,
        `Dodo ${res.status} listing subscriptions`,
      );
    }
    const items = ((await res.json()) as { items?: unknown[] }).items ?? [];
    for (const raw of items) {
      const sub = raw as DodoSubscription;
      // Two conditions, and both `continue` rather than `return null`. Matching
      // on `user_id` alone was how `/api/billing/sync` came to grant snapcn
      // Starter for any subscription carrying a colliding id; adding the
      // product check at the *caller* instead would have swapped that bug for a
      // quieter one, where a foreign subscription listed ahead of a real
      // snapcn one ends the search and the genuine subscriber gets nothing.
      // The scan has to step over what is not ours and keep looking.
      if (sub.metadata?.user_id !== userId) continue;
      if (!planForProduct(sub.metadata?.product)) continue;
      return sub;
    }
    // No cursor and no total in the envelope — a short page is the only
    // end-of-list signal Dodo gives.
    if (items.length < PAGE_SIZE) break;
  }
  return null;
}

export interface DodoSubscription {
  subscription_id: string;
  status: string;
  product_id: string;
  /** Dodo has no `current_period_end`; this is the renewal instant. */
  next_billing_date?: string | null;
  customer?: { customer_id?: string };
  metadata?: Record<string, string>;
}

/**
 * Re-exported, not re-implemented.
 *
 * The webhook that grants a paid plan and the webhook that reports a bounced
 * address are signed the same way, so the verifier lives in
 * `lib/server/standard-webhooks.ts` and both import it. It is re-exported here
 * because this is where every caller has looked for it since it was written.
 */
export { verifyWebhookSignature } from "@/lib/server/standard-webhooks";
