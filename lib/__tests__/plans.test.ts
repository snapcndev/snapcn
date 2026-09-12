import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ANONYMOUS,
  CHECKOUT_PRODUCTS,
  isCheckoutProduct,
  oneTimePlanFor,
  PLANS,
  type PlanName,
  planForProduct,
} from "@/lib/plans";

/**
 * The regression these exist for: `starter_annual` was in `CHECKOUT_PRODUCTS`'
 * ancestor map, in the pricing page and in `.env`, but `/api/checkout` compared
 * against two literals and the Dodo webhook granted on one — so the annual plan
 * 400'd at checkout, and would have taken $190 and granted nothing if it had
 * not. The compiler could not see it: a narrower union is still a valid index
 * into a wider map. Nothing here is about a single product; it is about the
 * three lists having been collapsed into one.
 */
describe("CHECKOUT_PRODUCTS", () => {
  const products = Object.keys(CHECKOUT_PRODUCTS) as Array<
    keyof typeof CHECKOUT_PRODUCTS
  >;

  it("accepts every product it defines", () => {
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) expect(isCheckoutProduct(p)).toBe(true);
  });

  it("gives every product an env var name and a real plan or null", () => {
    for (const p of products) {
      const { env, plan } = CHECKOUT_PRODUCTS[p];
      expect(env, p).toMatch(/^DODO_PRODUCT_[A-Z_]+$/);
      if (plan !== null) expect(PLANS[plan as PlanName], p).toBeDefined();
    }
  });

  it("sells annual as the same plan as monthly, and the pack as no plan", () => {
    expect(CHECKOUT_PRODUCTS.starter_annual.plan).toBe(
      CHECKOUT_PRODUCTS.starter.plan,
    );
    expect(CHECKOUT_PRODUCTS.pack.plan).toBeNull();
  });

  it("rejects inherited keys, plan names and junk", () => {
    // `in` would say true for these two — the guard uses Object.hasOwn.
    for (const junk of [
      "toString",
      "constructor",
      "pro",
      "",
      null,
      undefined,
      1,
    ])
      expect(isCheckoutProduct(junk), String(junk)).toBe(false);
  });

  it("documents every product's env var in .env.example", () => {
    const example = readFileSync(".env.example", "utf8");
    for (const p of products)
      expect(example, p).toContain(CHECKOUT_PRODUCTS[p].env);
  });

  it("values a product tag the same way for every caller", () => {
    // The webhook and /api/billing/sync both find their subject by
    // metadata.user_id alone, on an account that also sells Ruixen. Both ask
    // this, so both reject a foreign tag identically.
    expect(planForProduct("starter")).toBe("starter");
    expect(planForProduct("starter_annual")).toBe("starter");
    expect(planForProduct("pack")).toBeNull();
    for (const foreign of ["ruixen-pro", "toString", undefined, null, ""])
      expect(planForProduct(foreign), String(foreign)).toBeNull();
  });
});

/**
 * The regression: `/r/[file]` gated the paid registry on `if (!plan)`, so every
 * plan that was not free unlocked it — the $19 editor subscription installed
 * the components sold separately beside it, and the route could not tell the
 * difference because "paid" and "entitled to components" were the same
 * expression. They are not the same question, and this is the test that stops
 * the next paid tier from silently answering yes to both.
 */
describe("pro component entitlement", () => {
  it("keeps components out of every plan that does not sell them", () => {
    expect(PLANS.free.components).toBe(false);
    expect(PLANS.starter.components).toBe(false);
    expect(ANONYMOUS.components).toBe(false);
  });

  it("names the plans that unlock them, so a new tier has to opt in", () => {
    const unlocked = (Object.keys(PLANS) as PlanName[]).filter(
      (p) => PLANS[p].components,
    );
    expect(unlocked).toEqual(["pro"]);
  });

  it("sells the components through exactly two products, and names them", () => {
    // This used to read "sells no product that grants a components plan yet",
    // which was the right assertion while pro was unlaunched and is the wrong
    // one now that it is for sale. Kept as a named list rather than deleted:
    // the risk it was guarding has not gone away, it has changed shape. Before,
    // any product reaching a components plan was a leak; now, any product
    // *other than these two* reaching one is. A `starter` row that drifted to
    // `pro` would hand the whole catalogue to the $19 editor tier, and nobody
    // files a bug about getting more than they paid for.
    const selling = (
      Object.keys(CHECKOUT_PRODUCTS) as Array<keyof typeof CHECKOUT_PRODUCTS>
    ).filter((p) => {
      const { plan } = CHECKOUT_PRODUCTS[p];
      return plan !== null && PLANS[plan as PlanName].components;
    });
    expect(selling.sort()).toEqual(["founder", "lifetime"]);
  });
});

/**
 * Shape C, the ladder decided 2026-09-11: the editor subscription and the
 * catalogue are different purchases, and only the catalogue carries components.
 *
 * These three are money bugs rather than typos. A `founder` row that resolved to
 * `starter` would take $99 and hand back the editor; a `lifetime` row that went
 * through the subscription branch would be granted and then revoked the first
 * time `planFor` looked at a null `currentPeriodEnd`... which it would not,
 * because the webhook never writes the row at all. And a `starter` that ever
 * answered `oneTimePlanFor` would be re-granted on every monthly charge.
 */
describe("the catalogue ladder", () => {
  it("sells the catalogue as pro and the editor as starter", () => {
    expect(planForProduct("founder")).toBe("pro");
    expect(planForProduct("lifetime")).toBe("pro");
    expect(planForProduct("starter")).toBe("starter");
    expect(planForProduct("starter_annual")).toBe("starter");
    expect(planForProduct("pack")).toBeNull();
  });

  it("gives components to the catalogue plans and to nothing else", () => {
    expect(PLANS.pro.components).toBe(true);
    expect(PLANS.starter.components).toBe(false);
    expect(PLANS.free.components).toBe(false);
  });

  it("grants outright only for one-time products that carry a plan", () => {
    expect(oneTimePlanFor("lifetime")).toBe("pro");
    // The pack is one-time and entitles nothing.
    expect(oneTimePlanFor("pack")).toBeNull();
    // Subscriptions are granted by their own events, never by a payment.
    expect(oneTimePlanFor("founder")).toBeNull();
    expect(oneTimePlanFor("starter")).toBeNull();
    expect(oneTimePlanFor("anything-else")).toBeNull();
  });

  it("names an env var for every product and never repeats one", () => {
    const envs = Object.values(CHECKOUT_PRODUCTS).map((p) => p.env);
    expect(new Set(envs).size).toBe(envs.length);
    for (const e of envs) expect(e).toMatch(/^DODO_PRODUCT_[A-Z_]+$/);
  });
});
