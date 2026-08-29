import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHECKOUT_PRODUCTS,
  isCheckoutProduct,
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
