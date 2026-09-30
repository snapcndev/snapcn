/**
 * Commercial licence and team seats, end to end, against a real Postgres.
 *
 * Skipped unless `E2E_DATABASE_URL` points at a THROWAWAY database with the
 * migrations applied — it truncates the user, billing, key and team tables.
 * Never point it at production.
 *
 *   initdb -D /tmp/pg -U postgres -A trust
 *   pg_ctl -D /tmp/pg -o "-p 55432 -h 127.0.0.1" start
 *   createdb -h 127.0.0.1 -p 55432 -U postgres snapcn_test
 *   for f in drizzle/*.sql; do psql -h 127.0.0.1 -p 55432 -U postgres -d snapcn_test -f $f; done
 *   E2E_DATABASE_URL=postgres://postgres@127.0.0.1:55432/snapcn_test \
 *     pnpm vitest run lib/server/__tests__/team-licence.e2e.test.ts
 *
 * What it proves, through the real webhook, API routes, entitlement reads,
 * key gate and registry route: a Commercial purchase is recorded as one and
 * can invite; Lifetime and free cannot; the seat cap, self and duplicate
 * invites are refused; an invitee has Pro everywhere the moment they sign in,
 * and loses it — keys included — the moment they are removed; the September
 * offer survives renewals and lapses with its owner.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  if (process.env.E2E_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
  }
  delete process.env.RESEND_API_KEY;
  process.env.API_KEY_RATE_LIMIT = "1000";
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const bytes = Buffer.from("snapcn-e2e-webhook-secret-32bytes!");
  process.env.DODO_WEBHOOK_SECRET = `whsec_${bytes.toString("base64")}`;
  return { bytes, as: "" };
});

vi.mock("@/lib/analytics-server", () => ({ captureServer: async () => {} }));
vi.mock("@/lib/server/projects", () => ({
  requireUser: async () => ({ userId: h.as }),
}));

import { sql } from "drizzle-orm";
import { POST as keysPOST } from "@/app/api/keys/route";
import { DELETE as teamDELETE } from "@/app/api/team/[id]/route";
import { GET as teamGET, POST as teamPOST } from "@/app/api/team/route";
import { POST as webhook } from "@/app/api/webhooks/dodo/route";
import { GET as registryGET } from "@/app/r/[file]/route";
import { PRO_NAMES } from "@/config/catalogue";
import { planForApiKey } from "@/lib/server/api-key";
import { getDb } from "@/lib/server/db";
import { billingFor, planFor } from "@/lib/server/entitlements";
import { canInvite, teamPlanFor } from "@/lib/server/team";

const PRO = [...PRO_NAMES][0] as string;
const DAY = 86_400_000;
const future = (d: number) => new Date(Date.now() + d * DAY).toISOString();

async function send(type: string, data: Record<string, unknown>) {
  const body = JSON.stringify({ type, data });
  const id = `msg_${randomBytes(6).toString("hex")}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", h.bytes)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return (
    await webhook(
      new Request("http://x/api/webhooks/dodo", {
        method: "POST",
        body,
        headers: {
          "webhook-id": id,
          "webhook-timestamp": ts,
          "webhook-signature": `v1,${sig}`,
        },
      }),
    )
  ).status;
}

async function user(email: string) {
  const id = randomUUID();
  await getDb().execute(
    sql`insert into "user" (id, email) values (${id}, ${email})`,
  );
  return id;
}

const post = (email: string) =>
  teamPOST(
    new Request("http://x/api/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );

async function cli(userId: string) {
  h.as = userId;
  const res = await keysPOST(
    new Request("http://x/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "laptop" }),
    }),
  );
  if (res.status !== 201)
    return { keyStatus: res.status, gate: null, registry: null };
  const { key } = (await res.json()) as { key: string };
  const gate = await planForApiKey(key);
  const reg = await registryGET(
    new Request(`http://x/r/${PRO}.json`, {
      headers: { authorization: `Bearer ${key}` },
    }),
    { params: Promise.resolve({ file: `${PRO}.json` }) },
  );
  return { keyStatus: 201, gate, registry: reg.status, key };
}

const tag = randomUUID().slice(0, 6);

const enabled = Boolean(process.env.E2E_DATABASE_URL);

beforeAll(async () => {
  if (!enabled) return;
  await getDb().execute(
    sql`truncate "user", billing_subscription, api_key, team_member cascade`,
  );
});

describe.skipIf(!enabled)(
  "Commercial licence and team seats, end to end",
  () => {
    let owner = "";
    let memberId = "";
    let memberUser = "";
    let memberKey = "";

    it("a Commercial purchase is recorded as a Commercial licence", async () => {
      owner = await user(`owner-${tag}@co.test`);
      expect(
        await send("payment.succeeded", {
          payment_id: "p_c",
          metadata: { user_id: owner, product: "commercial" },
        }),
      ).toBe(200);
      expect((await billingFor(owner))?.licence).toBe("commercial");
      expect(await canInvite(owner)).toBe(true);
    });

    it("a Lifetime purchase is personal and cannot invite", async () => {
      const lt = await user(`lifetime-${tag}@x.test`);
      await send("payment.succeeded", {
        payment_id: "p_l",
        metadata: { user_id: lt, product: "lifetime" },
      });
      expect((await billingFor(lt))?.licence).toBe("personal");
      h.as = lt;
      const res = await post("friend@x.test");
      expect(res.status).toBe(403);
    });

    it("a free user cannot invite", async () => {
      h.as = await user(`free-${tag}@x.test`);
      expect((await post("friend@x.test")).status).toBe(403);
    });

    it("owner invites: validation, self, duplicate, and the seat cap", async () => {
      h.as = owner;
      expect((await post("not-an-email")).status).toBe(400);
      expect((await post(`OWNER-${tag}@co.test`)).status).toBe(400); // self, any case
      const first = await post(`Mem1-${tag}@Co.Test`);
      expect(first.status).toBe(201);
      const m = (await first.json()) as {
        id: string;
        email: string;
        joined: boolean;
      };
      expect(m.email).toBe(`mem1-${tag}@co.test`);
      expect(m.joined).toBe(false);
      memberId = m.id;
      expect((await post(`mem1-${tag}@co.test`)).status).toBe(409); // duplicate
      for (const n of [2, 3, 4])
        expect((await post(`mem${n}-${tag}@co.test`)).status).toBe(201);
      const fifth = await post(`mem5-${tag}@co.test`);
      expect(fifth.status).toBe(409); // owner + 4 = 5 seats
      const list = (await (await teamGET()).json()) as unknown[];
      expect(list).toHaveLength(4);
    });

    it("an invitee who signs in with the address has Pro everywhere", async () => {
      memberUser = await user(`MEM1-${tag}@co.test`); // signs up in a different case
      expect((await planFor(memberUser)).plan).toBe("pro");
      const t = await teamPlanFor(memberUser);
      expect(t.plan).toBe("pro");
      expect(t.ownerEmail).toBe(`owner-${tag}@co.test`);
      const c = await cli(memberUser);
      expect(c).toMatchObject({ keyStatus: 201, gate: "pro", registry: 200 });
      memberKey = c.key as string;
      h.as = owner;
      const list = (await (await teamGET()).json()) as Array<{
        email: string;
        joined: boolean;
      }>;
      expect(list.find((r) => r.email === `mem1-${tag}@co.test`)?.joined).toBe(
        true,
      );
    });

    it("someone not invited gets nothing from the team", async () => {
      const stranger = await user(`stranger-${tag}@co.test`);
      expect((await planFor(stranger)).plan).toBe("free");
      expect((await cli(stranger)).keyStatus).toBe(403);
    });

    it("another owner cannot remove my teammate", async () => {
      h.as = await user(`other-${tag}@co.test`);
      const res = await teamDELETE(new Request("http://x"), {
        params: Promise.resolve({ id: memberId }),
      });
      expect(res.status).toBe(404);
      expect((await planFor(memberUser)).plan).toBe("pro");
    });

    it("removing a teammate ends their Pro and their keys at once", async () => {
      h.as = owner;
      const res = await teamDELETE(new Request("http://x"), {
        params: Promise.resolve({ id: memberId }),
      });
      expect(res.status).toBe(204);
      expect((await planFor(memberUser)).plan).toBe("free");
      expect(await planForApiKey(memberKey)).toBeNull();
      const reg = await registryGET(
        new Request(`http://x/r/${PRO}.json`, {
          headers: { authorization: `Bearer ${memberKey}` },
        }),
        { params: Promise.resolve({ file: `${PRO}.json` }) },
      );
      expect(reg.status).toBe(402);
      // and the freed seat can be used again
      expect((await post(`mem5-${tag}@co.test`)).status).toBe(201);
    });

    it("an upgrade Lifetime → Commercial turns the licence commercial", async () => {
      const u = await user(`upgrade-${tag}@x.test`);
      await send("payment.succeeded", {
        payment_id: "p_u1",
        metadata: { user_id: u, product: "lifetime" },
      });
      await send("payment.succeeded", {
        payment_id: "p_u2",
        metadata: { user_id: u, product: "commercial" },
      });
      expect((await billingFor(u))?.licence).toBe("commercial");
      expect(await canInvite(u)).toBe(true);
    });

    it("September offer: an annual bought in September keeps Commercial through renewals, and its team lapses with it", async () => {
      const u = await user(`sept-${tag}@x.test`);
      await send("subscription.active", {
        subscription_id: "sub_s",
        next_billing_date: future(360),
        metadata: { user_id: u, product: "everything_annual" },
      });
      // what migration 0008 does to a row from September
      await getDb().execute(
        sql`update billing_subscription set created_at = '2026-09-20T00:00:00Z' where user_id = ${u}`,
      );
      await getDb().execute(
        sql`update billing_subscription set licence = 'commercial' where plan <> 'free' and created_at < '2026-10-01T12:00:00Z' and user_id = ${u}`,
      );
      await send("subscription.renewed", {
        subscription_id: "sub_s",
        next_billing_date: future(720),
        metadata: { user_id: u, product: "everything_annual" },
      });
      expect((await billingFor(u))?.licence).toBe("commercial"); // renewal did not downgrade it
      h.as = u;
      expect((await post(`sept-mate-${tag}@x.test`)).status).toBe(201);
      const mate = await user(`sept-mate-${tag}@x.test`);
      expect((await planFor(mate)).plan).toBe("pro");
      // the owner's subscription fails → owner and team drop together
      await send("subscription.failed", {
        subscription_id: "sub_s",
        status: "failed",
        next_billing_date: future(720),
        metadata: { user_id: u, product: "everything_annual" },
      });
      expect((await planFor(u)).plan).toBe("free");
      expect((await planFor(mate)).plan).toBe("free");
      expect((await post(`another-${tag}@x.test`)).status).toBe(403);
    });

    it("a teammate who buys their own plan keeps it after being removed", async () => {
      const owner2 = await user(`owner2-${tag}@co.test`);
      await send("payment.succeeded", {
        payment_id: "p_c2",
        metadata: { user_id: owner2, product: "commercial" },
      });
      h.as = owner2;
      const mate = await user(`buyer-mate-${tag}@x.test`);
      const res = await post(`buyer-mate-${tag}@x.test`);
      expect(res.status).toBe(201);
      const { id } = (await res.json()) as { id: string };
      await send("payment.succeeded", {
        payment_id: "p_bm",
        metadata: { user_id: mate, product: "lifetime" },
      });
      h.as = owner2;
      await teamDELETE(new Request("http://x"), {
        params: Promise.resolve({ id }),
      });
      expect((await planFor(mate)).plan).toBe("pro");
    });
  },
);
