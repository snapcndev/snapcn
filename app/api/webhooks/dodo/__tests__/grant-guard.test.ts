/**
 * A subscription event must not take away an outright grant.
 *
 * Run with:  pnpm vitest run app/api/webhooks/dodo/__tests__/grant-guard.test.ts
 *
 * One billing row per account, so every event writes over what is there. On a
 * local database, annual → Lifetime → the annual cancelled took Pro away from a
 * Lifetime buyer; annual → Lifetime → the annual expired took it away at once.
 * These pin the guard with the row mocked: the question is only whether the
 * handler writes, and what.
 */
import { createHmac, randomBytes } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  row: null as null | {
    plan: string;
    status: string;
    currentPeriodEnd: Date | null;
    subscriptionId: string | null;
  },
  writes: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/analytics-server", () => ({ captureServer: async () => {} }));
vi.mock("@/lib/server/db", () => ({ isDbConfigured: true }));
vi.mock("@/lib/server/email", () => ({
  sendEmail: async () => {},
  proReadyEmail: () => ({}),
}));
vi.mock("@/lib/server/entitlements", () => ({
  activatePlan: async (args: Record<string, unknown>) => {
    h.writes.push(args);
  },
  billingFor: async () => h.row,
  userIdForEmail: async () => "user_1",
}));

import { POST } from "@/app/api/webhooks/dodo/route";

const KEY = randomBytes(32);

function send(type: string, product: string, subscriptionId = "sub_1") {
  const raw = JSON.stringify({
    type,
    data: {
      metadata: { user_id: "user_1", product },
      subscription_id: subscriptionId,
      status: type.split(".")[1],
      next_billing_date: "2027-09-18T00:00:00Z",
    },
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", KEY)
    .update(`msg_1.${ts}.${raw}`)
    .digest("base64");
  return POST(
    new Request("https://snapcn.dev/api/webhooks/dodo", {
      method: "POST",
      headers: {
        "webhook-id": "msg_1",
        "webhook-timestamp": ts,
        "webhook-signature": `v1,${sig}`,
      },
      body: raw,
    }),
  );
}

const LIFETIME = {
  plan: "pro",
  status: "active",
  currentPeriodEnd: null,
  subscriptionId: null,
};

beforeEach(() => {
  h.row = null;
  h.writes.length = 0;
  process.env.DODO_WEBHOOK_SECRET = `whsec_${KEY.toString("base64")}`;
});

it("never lets an old subscription's lapse overwrite a Lifetime grant", async () => {
  h.row = LIFETIME;
  for (const type of [
    "subscription.cancelled",
    "subscription.expired",
    "subscription.failed",
    "subscription.on_hold",
  ]) {
    expect((await send(type, "everything_annual")).status).toBe(200);
  }
  expect(h.writes).toEqual([]);
});

it("never turns a Lifetime grant back into a subscription on a renewal", async () => {
  h.row = LIFETIME;
  await send("subscription.renewed", "everything_annual");
  await send("subscription.active", "everything_annual");
  expect(h.writes).toEqual([]);
});

it("ignores a lapse for a subscription the row no longer holds", async () => {
  h.row = {
    plan: "pro",
    status: "active",
    currentPeriodEnd: new Date("2027-09-18T00:00:00Z"),
    subscriptionId: "sub_new",
  };
  await send("subscription.cancelled", "everything_annual", "sub_old");
  expect(h.writes).toEqual([]);
  await send("subscription.cancelled", "everything_annual", "sub_new");
  expect(h.writes).toHaveLength(1);
  expect(h.writes[0]).toMatchObject({ status: "cancelled" });
});

it("still grants a first subscription, and a Lifetime over a subscription", async () => {
  await send("subscription.active", "everything_annual");
  expect(h.writes[0]).toMatchObject({ plan: "pro", status: "active" });
  h.row = {
    plan: "pro",
    status: "active",
    currentPeriodEnd: new Date("2027-09-18T00:00:00Z"),
    subscriptionId: "sub_1",
  };
  await send("payment.succeeded", "lifetime");
  expect(h.writes[1]).toMatchObject({
    subscriptionId: null,
    currentPeriodEnd: null,
    status: "active",
  });
});
