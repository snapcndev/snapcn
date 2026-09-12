/**
 * The plan table, as data, in one place.
 *
 * Every one of these numbers is a business decision, and each of them wants to
 * leak: the width into a render route, the watermark into a request body, the
 * TTL into a storage key. Once that happens the answer to "what does Pro
 * actually get?" is a grep, and a pricing change is a six-file diff where one
 * file gets missed and a free account quietly renders at 4K.
 *
 * No database, no env var, no admin UI: a plan is a product decision that ships
 * with a deploy, and a table nobody edits at runtime does not need a table.
 *
 * Deliberately dependency-free — zero imports — so a pricing page can import it
 * in the browser and Edge middleware can import it too. The one place it meets
 * the `plan` pgEnum is `limitsFor()`, where indexing `PLANS[plan]` makes the
 * compiler notice if the two ever disagree.
 */

/** Mirrors the `plan` pgEnum in `lib/db/schema.ts`. */
export type PlanName = "free" | "starter" | "pro";

export interface PlanLimits {
  /** Exports per calendar month. The limit the meter's ON CONFLICT enforces. */
  renders: number;
  /** Output width ceiling. The render route clamps to it; it never rejects. */
  maxWidth: number;
  /** Forced onto the spec by the route. Never read from a body. */
  watermark: boolean;
  /** Days a hosted link stays up. Null means permanent. */
  linkTtlDays: number | null;
  /**
   * Whether this plan's API key installs the paid half of the registry.
   *
   * Named, rather than inferred from "is this plan paid?" — which is the
   * question `/r/[file]` used to ask, and the two stop meaning the same thing
   * the moment there is a second paid tier. The editor subscription sells a
   * watermark and a resolution; the components are a separate purchase. A gate
   * that reads "not free" hands every pro component to the cheapest plan on the
   * page, and nobody files a bug about getting more than they paid for.
   */
  components: boolean;
}

/**
 * ## The export count is a fair-use ceiling, not a paywall
 *
 * It used to be the paywall — free got one export a month — and two numbers say
 * that was the wrong wall. Exports per person measured **1.44**, so the second
 * export most people never take was the one being sold; and the watermark fires
 * on **every** export, including the first, which is the only moment the whole
 * funnel reliably reaches.
 *
 * The competitive half matters more. Palmier ships a full multi-track editor
 * that renders and exports without limit, for free, and charges only for AI
 * generation. Against that, "$19 for fifteen renders" is a sentence that loses
 * on sight — and it was defending revenue that was not there.
 *
 * So the counts below are set where an abuse ceiling belongs rather than where
 * a sales wall belongs: high enough that no real person composing product
 * videos will meet one, low enough that a script cannot mine free Chromium
 * time. What is sold is the watermark and the resolution.
 */
export const PLANS: Record<PlanName, PlanLimits> = {
  free: {
    // ~1.7 a day. The busiest human on the site has never come near it.
    renders: 50,
    maxWidth: 1280,
    watermark: true,
    linkTtlDays: 7,
    components: false,
  },
  starter: {
    // Ten a day. Deliberately not `Infinity`: the meter compares this in SQL,
    // and a plan with no ceiling at all is one stuck retry loop away from a
    // compute bill nobody authorised.
    renders: 300,
    maxWidth: 1920,
    watermark: false,
    linkTtlDays: null,
    // The editor subscription. It sells the watermark and the resolution, and
    // that is all it sells.
    components: false,
  },
  pro: {
    renders: 1000,
    maxWidth: 1920,
    watermark: false,
    linkTtlDays: null,
    components: true,
  },
};

/**
 * No session: the free row, on a much shorter leash.
 *
 * Not a fourth plan — an anonymous caller has no durable identity, so the count
 * cannot survive a cleared cookie or a new address anyway, and the key it is
 * metered on is an IP hash rather than a person. The gap between this and the
 * free row is not a sales tactic: it is that an unauthenticated ceiling is the
 * one a script finds first, and 50 free Chromium renders per IP is an invoice
 * waiting to happen.
 *
 * Five is still enough to compose something real, decide the product works, and
 * only then be asked for an account.
 *
 * Spread rather than written out so a change to the free row cannot be applied
 * to signed-in users and silently missed here.
 */
export const ANONYMOUS: PlanLimits = { ...PLANS.free, renders: 5 };

/**
 * Null means "no row in `billing_subscription`", which is the state every user
 * starts in — the webhook writes that row, nothing else does. Treating a
 * missing row as free is what lets the whole paid tier be absent (no Dodo keys,
 * no webhook, no rows) without a single caller needing a second branch.
 *
 * Anonymous callers do NOT come through here; they get `ANONYMOUS` directly,
 * because "no user" and "user on no plan" are different questions.
 */
export function limitsFor(plan: PlanName | null): PlanLimits {
  return plan ? PLANS[plan] : PLANS.free;
}

/* ── Checkout products ──────────────────────────────────────────────────── */

/**
 * The `product` tag our checkout writes into Dodo metadata, and what each tag
 * is worth. One table, because the three consumers used to keep three lists:
 * `/api/checkout` validated against two literals, the Dodo webhook granted on
 * one, and `lib/upgrade.ts` typed three — so `starter_annual` was rejected at
 * checkout with "Unknown product" and, had it got past that, ignored by the
 * webhook as "not ours". TypeScript could not see either gap: a narrower union
 * is still a valid index into a wider map.
 *
 * Adding a product is a row here. Nothing else has a list to forget.
 *
 * `env` is the *name* of the variable holding the Dodo product id, never the id
 * itself — read server-side at call time, for the reason `lib/server/dodo.ts`
 * explains. `plan` is what a paid subscription grants, and `null` marks a
 * one-time purchase that entitles nothing in this app.
 */
export const CHECKOUT_PRODUCTS = {
  starter: {
    env: "DODO_PRODUCT_STARTER",
    plan: "starter",
    kind: "subscription",
  },
  // Annual is a separate Dodo product, not a flag on the monthly one — Dodo
  // snapshots the billing interval onto the subscription at creation. Same
  // plan, different cart.
  starter_annual: {
    env: "DODO_PRODUCT_STARTER_ANNUAL",
    plan: "starter",
    kind: "subscription",
  },
  // The catalogue, annually. `pro` is the only plan whose `components` is true,
  // so this row is the entire difference between paying for the editor and
  // paying for the registry.
  founder: {
    env: "DODO_PRODUCT_FOUNDER",
    plan: "pro",
    kind: "subscription",
  },
  // The catalogue, bought outright. Same plan, no renewal — see `kind`.
  lifetime: { env: "DODO_PRODUCT_LIFETIME", plan: "pro", kind: "once" },
  pack: { env: "DODO_PRODUCT_PACK", plan: null, kind: "once" },
} as const satisfies Record<
  string,
  { env: string; plan: PlanName | null; kind: "subscription" | "once" }
>;

export type CheckoutProduct = keyof typeof CHECKOUT_PRODUCTS;

/**
 * `Object.hasOwn`, not `in`: `in` walks the prototype, so `"toString"` would
 * pass and index the table with a function. The failure would be survivable
 * (an undefined env name 503s) but it is not a check that should need the
 * downstream code to be forgiving.
 */
export function isCheckoutProduct(value: unknown): value is CheckoutProduct {
  return typeof value === "string" && Object.hasOwn(CHECKOUT_PRODUCTS, value);
}

/**
 * The plan a `metadata.product` tag is worth, or null for anything this app did
 * not sell — an untagged cart, a tag we do not recognise, or the one-time pack,
 * which grants no plan.
 *
 * The null case is load-bearing rather than defensive. Both the Dodo webhook and
 * the `/api/billing/sync` reconcile sit on a business account that also sells
 * Ruixen, and both find their subject by `metadata.user_id` alone — so a foreign
 * subscription carrying a colliding id must not move a snapcn entitlement in
 * either direction. Every caller that turns a Dodo payload into a plan goes
 * through here.
 */
export function planForProduct(value: unknown): PlanName | null {
  return isCheckoutProduct(value) ? CHECKOUT_PRODUCTS[value].plan : null;
}

/**
 * The plan a **one-time** purchase grants, or null for everything else.
 *
 * `kind` exists for exactly this call. Dodo reports a lifetime seat as a
 * `payment.succeeded` and never as a subscription event, so the webhook's
 * payment branch has to be able to tell three things apart that all arrive on
 * the same event: a subscription's monthly charge (already granted by its own
 * `subscription.active`, and re-granting on the payment would be harmless right
 * up until the day it is not), a one-time purchase that entitles nothing (the
 * template pack), and a one-time purchase that entitles everything (this).
 *
 * Inferring it instead — "a payment with a plan must be one-time" — is the
 * version that breaks the first time a subscription payment arrives before its
 * activation event, which is a race Dodo makes no promise about.
 */
export function oneTimePlanFor(value: unknown): PlanName | null {
  if (!isCheckoutProduct(value)) return null;
  const row = CHECKOUT_PRODUCTS[value];
  return row.kind === "once" ? row.plan : null;
}

/**
 * How many founder seats exist at the launch price.
 *
 * A number, not a feature flag: the seat counter on the pricing page is the
 * only thing that reads it, and when it runs out the price rises by hand on the
 * date already announced. Enforcing it in the checkout route would mean a buyer
 * who loads the page at seat 50 and pays at seat 51 gets a 400 after entering a
 * card, which is a worse outcome than selling a fifty-first seat.
 */
export const FOUNDER_SEATS = 50;
