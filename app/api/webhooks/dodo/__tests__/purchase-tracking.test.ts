/**
 * Does a sale reach PostHog?
 *
 * Run with:  pnpm vitest run app/api/webhooks/dodo/__tests__
 *
 * This endpoint is the only place in the product that knows money moved, and
 * until `purchase_completed` was added it told PostHog nothing — `upgrade_started`
 * is a *click* on a pricing button, so revenue was invisible and 224 paywall
 * hits had no third number after them.
 *
 * The risk is not that the event is malformed. It is that it fires in the wrong
 * places: this one URL also receives cancellations, failed payments, refunds
 * and a different brand's events, every one of them correctly signed. A sale
 * counted on a cancellation is worse than no sale counted at all, so most of
 * what is asserted below is silence.
 */

import { createHmac, randomBytes } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  captured: [] as Array<{ event: string; id: string; props: unknown }>,
}));

vi.mock("@/lib/analytics-server", () => ({
  captureServer: async (event: string, id: string, props: unknown) => {
    h.captured.push({ event, id, props });
  },
}));

vi.mock("@/lib/server/db", () => ({ isDbConfigured: true }));
vi.mock("@/lib/server/entitlements", () => ({
  activatePlan: async () => {},
  userIdForEmail: async () => "user_guest",
}));
vi.mock("@/lib/server/email", () => ({
  sendEmail: async () => {},
  proReadyEmail: () => ({}),
}));

import { POST } from "@/app/api/webhooks/dodo/route";

const KEY = randomBytes(32);
const SECRET = `whsec_${KEY.toString("base64")}`;

function signed(body: unknown): Request {
  const raw = JSON.stringify(body);
  const id = "msg_1";
  const ts = Math.floor(Date.now() / 1000);
  const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key)
    .update(`${id}.${ts}.${raw}`)
    .digest("base64");
  return new Request("https://snapcn.dev/api/webhooks/dodo", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(ts),
      "webhook-signature": `v1,${sig}`,
    },
    body: raw,
  });
}

const event = (type: string, product: string, extra = {}) => ({
  type,
  data: {
    metadata: { user_id: "user_1", product },
    customer: { email: "buyer@example.com", customer_id: "cus_1" },
    subscription_id: "sub_1",
    next_billing_date: "2027-09-18T00:00:00Z",
    total_amount: 12900,
    currency: "USD",
    ...extra,
  },
});

const sales = () => h.captured.filter((c) => c.event === "purchase_completed");

beforeEach(() => {
  h.captured.length = 0;
  process.env.DODO_WEBHOOK_SECRET = SECRET;
});

it("reports a subscription as a sale, with the amount", async () => {
  await POST(signed(event("subscription.active", "everything_annual")));
  expect(sales()).toHaveLength(1);
  expect(sales()[0].id).toBe("user_1");
  expect(sales()[0].props).toMatchObject({
    kind: "subscription",
    plan: "pro",
    renewal: false,
    product: "everything_annual",
    amount: 12900,
    currency: "USD",
  });
});

it("marks a renewal as one — revenue, but not a new customer", async () => {
  await POST(signed(event("subscription.renewed", "everything_annual")));
  expect(sales()[0].props).toMatchObject({ renewal: true });
});

it("reports a bought-outright seat as a lifetime sale", async () => {
  await POST(signed(event("payment.succeeded", "lifetime")));
  expect(sales()).toHaveLength(1);
  expect(sales()[0].props).toMatchObject({ kind: "lifetime", plan: "pro" });
});

it("reports the template pack, which grants nothing in this app", async () => {
  await POST(signed(event("payment.succeeded", "pack")));
  expect(sales()[0].props).toMatchObject({ kind: "pack" });
});

it("counts no sale on a cancellation, expiry or failure", async () => {
  for (const type of [
    "subscription.cancelled",
    "subscription.expired",
    "subscription.failed",
    "subscription.on_hold",
    "subscription.paused",
  ]) {
    await POST(signed(event(type, "everything_annual")));
  }
  expect(sales()).toHaveLength(0);
});

it("counts no sale for another brand on the same Dodo account", async () => {
  // A signed, parseable `subscription.active` whose product tag is not ours.
  // It already could not grant a plan; it must not book revenue either.
  await POST(signed(event("subscription.active", "some-other-product")));
  await POST(signed(event("payment.succeeded", "some-other-product")));
  expect(sales()).toHaveLength(0);
});

it("counts no sale on a refund or dispute", async () => {
  await POST(signed(event("payment.refunded", "lifetime")));
  await POST(signed(event("dispute.opened", "lifetime")));
  expect(sales()).toHaveLength(0);
});

it("reports an unknown amount as null, never as zero", async () => {
  // `Number(undefined)` is NaN and `Number("")` is 0 — a free sale is a wrong
  // answer that looks like a real one on a revenue chart.
  await POST(
    signed(event("payment.succeeded", "lifetime", { total_amount: undefined })),
  );
  expect(sales()[0].props).toMatchObject({ amount: null });
});
