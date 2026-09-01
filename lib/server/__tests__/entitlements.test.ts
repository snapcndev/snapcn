/**
 * Unit tests for lib/server/entitlements.ts
 *
 * Run with:  pnpm exec vitest run lib/server/__tests__/entitlements.test.ts
 *
 * No database. The one statement that genuinely needs Postgres — the upsert
 * whose `setWhere` decides whether a render is charged — is the one thing a
 * mock cannot honestly simulate, so it is not simulated: the fake returns
 * either a row or nothing, and the tests below cover what this module does with
 * each answer. What IS tested here is every decision made in TypeScript, which
 * is where the money bugs live. A wrong answer from `planFor` hands a churned
 * customer a paid tier forever; a wrong period key gives everyone a second
 * allowance at a month boundary; a missing zero-allowance guard leaks one free
 * render per key per month. None of those need a database to go wrong.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hoisted because `vi.mock` factories run before the imports below — the state
 * has to exist before the module under test is even loaded.
 */
const db = vi.hoisted(() => {
  const state = {
    /** What planFor's SELECT finds. Null means "no billing row", the default. */
    subscription: null as Record<string, unknown> | null,
    /**
     * What the meter's upsert returns. Null stands for the `setWhere` having
     * blocked the update — Postgres wrote nothing, so `.returning()` is empty.
     */
    charged: null as { rendersUsed: number } | null,
    /** Every `values()` payload written, so the period key can be asserted. */
    inserted: [] as Record<string, unknown>[],
    /** The last `onConflictDoUpdate()` argument, to prove `setWhere` is there. */
    conflict: null as Record<string, unknown> | null,
  };

  const getDb = vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (state.subscription ? [state.subscription] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        state.inserted.push(values);
        return {
          onConflictDoUpdate: (conflict: Record<string, unknown>) => {
            state.conflict = conflict;
            return {
              returning: async () => (state.charged ? [state.charged] : []),
            };
          },
        };
      },
    }),
  }));

  return { state, getDb };
});

vi.mock("@/lib/server/db", () => ({
  getDb: db.getDb,
  isDbConfigured: true,
}));

import { ANONYMOUS, PLANS } from "@/lib/plans";
import {
  consumeRender,
  planFor,
  QuotaExceededError,
  usageCutoff,
} from "@/lib/server/entitlements";

const DAY = 86_400_000;

beforeEach(() => {
  db.state.subscription = null;
  db.state.charged = null;
  db.state.inserted = [];
  db.state.conflict = null;
  db.getDb.mockClear();
});

describe("planFor", () => {
  it("downgrades to free once the period has ended", () => {
    // The row still says "pro" and still says "active" — Dodo has simply not
    // told us anything since. Honouring the plan column alone is how a lapsed
    // subscription keeps paying out.
    db.state.subscription = {
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date(Date.now() - DAY),
    };
    return expect(planFor("u1")).resolves.toEqual({
      plan: "free",
      limits: PLANS.free,
    });
  });

  it("keeps a cancelled plan until the paid period actually ends", () => {
    // Cancelling is not a refund. The month is paid for, so it is served — the
    // alternative takes back something already bought, which is the shape of
    // wrong that comes back as a chargeback.
    db.state.subscription = {
      plan: "pro",
      status: "cancelled",
      currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    };
    return expect(planFor("u1")).resolves.toEqual({
      plan: "pro",
      limits: PLANS.pro,
    });
  });

  it("drops a cancelled plan once its period end passes, with no further event", () => {
    // What makes the rule above safe without a cron: the row itself expires.
    db.state.subscription = {
      plan: "pro",
      status: "cancelled",
      currentPeriodEnd: new Date(Date.now() - DAY),
    };
    return expect(planFor("u1")).resolves.toEqual({
      plan: "free",
      limits: PLANS.free,
    });
  });

  it("drops a failed payment immediately, period end or not", () => {
    // `cancelled` means paid-and-leaving; `failed` means the money never
    // arrived. Only the first one earns the rest of the month.
    db.state.subscription = {
      plan: "starter",
      status: "failed",
      currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    };
    return expect(planFor("u1")).resolves.toEqual({
      plan: "free",
      limits: PLANS.free,
    });
  });

  it("gives an active starter row the starter limits", () => {
    db.state.subscription = {
      plan: "starter",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + DAY),
    };
    return expect(planFor("u1")).resolves.toEqual({
      plan: "starter",
      limits: PLANS.starter,
    });
  });

  it("treats a status it has never seen as not paying", () => {
    // Dodo owns this vocabulary and can add to it. An unknown word arriving as
    // a free upgrade for every user is not an acceptable way to find out.
    db.state.subscription = {
      plan: "pro",
      status: "grace_period",
      currentPeriodEnd: new Date(Date.now() + DAY),
    };
    return expect(planFor("u1")).resolves.toEqual({
      plan: "free",
      limits: PLANS.free,
    });
  });

  it("gives an anonymous caller one render and never touches the database", async () => {
    await expect(planFor(null)).resolves.toEqual({
      plan: "anonymous",
      limits: ANONYMOUS,
    });
    // The specific number is a product decision and will move. What must not
    // move is the direction: an unauthenticated ceiling is the one a script
    // finds first, so it stays strictly tighter than the signed-in free row.
    expect(ANONYMOUS.renders).toBeLessThan(PLANS.free.renders);
    expect(ANONYMOUS.renders).toBeGreaterThan(0);
    expect(db.getDb).not.toHaveBeenCalled();
  });
});

describe("consumeRender", () => {
  it("refuses a zero allowance before it can write anything", async () => {
    // The INSERT branch writes `renders_used: 1` unconditionally, so reaching
    // the statement at all with a zero allowance leaks one render a month. The
    // assertion that matters is the second one.
    await expect(
      consumeRender("k", { ...PLANS.free, renders: 0 }),
    ).rejects.toBeInstanceOf(QuotaExceededError);
    expect(db.getDb).not.toHaveBeenCalled();
  });

  it("charges the render when the upsert comes back with a row", async () => {
    db.state.charged = { rendersUsed: 3 };
    await expect(consumeRender("k", PLANS.starter)).resolves.toBeUndefined();
    expect(db.state.inserted).toHaveLength(1);
  });

  it("refuses when the upsert returns nothing, which is the whole check", async () => {
    // Empty `.returning()` means `setWhere` blocked the update: the allowance
    // was spent and nothing was written, so there is no refund to get wrong.
    db.state.charged = null;
    const err = await consumeRender("k", PLANS.starter).catch((e) => e);
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.code).toBe("quota_exceeded");
    expect(err.reason).toBe("monthly_cap");
    expect(err.used).toBe(PLANS.starter.renders);
    expect(err.limit).toBe(PLANS.starter.renders);
  });

  it("still passes a setWhere to the upsert", async () => {
    // Cheap guard against the one edit that silently breaks everything: drop
    // `setWhere` and the meter counts forever without refusing anything, and
    // every test that only asserts "it charged" goes on passing.
    db.state.charged = { rendersUsed: 1 };
    await consumeRender("k", PLANS.starter);
    expect(db.state.conflict?.setWhere).toBeTruthy();
  });

  it("buckets on the UTC month, not the local one", async () => {
    // Two instants, one either side of UTC, so this fails wherever the runner
    // happens to be: 00:30Z on the 1st is still last month in the Americas, and
    // 23:30Z on the 31st is already next month in Asia. A `getMonth()`-based
    // implementation gets exactly one of these wrong no matter the TZ.
    vi.useFakeTimers();
    try {
      db.state.charged = { rendersUsed: 1 };

      vi.setSystemTime(new Date("2026-03-01T00:30:00Z"));
      await consumeRender("k", PLANS.starter);
      expect(db.state.inserted.at(-1)?.periodMonth).toBe("2026-03");

      vi.setSystemTime(new Date("2026-03-31T23:30:00Z"));
      await consumeRender("k", PLANS.starter);
      expect(db.state.inserted.at(-1)?.periodMonth).toBe("2026-03");

      // And it does roll over — otherwise a hard-coded string passes the above.
      vi.setSystemTime(new Date("2026-04-01T00:30:00Z"));
      await consumeRender("k", PLANS.starter);
      expect(db.state.inserted.at(-1)?.periodMonth).toBe("2026-04");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("usageCutoff", () => {
  it("keeps the current month and the one before it", () => {
    // A row written at 23:59 on the last of the month is still being read at
    // 00:01 on the first of the next, so the cutoff is the month before last —
    // never the current one.
    expect(usageCutoff(new Date("2026-03-15T12:00:00Z"))).toBe("2026-02");
  });

  it("crosses a year boundary instead of asking for month zero", () => {
    // The reason this is `Date.UTC` and not `month - 1`: the naive form yields
    // "2026-00", which matches nothing and prunes nothing, forever, silently.
    expect(usageCutoff(new Date("2026-01-04T00:00:00Z"))).toBe("2025-12");
  });

  it("is computed in UTC, like the period key it is compared against", () => {
    // 1 March 00:30 UTC is still 28 February in a western zone. If either side
    // of the comparison used local time, a machine in that zone would delete a
    // month that was still being written to.
    expect(usageCutoff(new Date("2026-03-01T00:30:00Z"))).toBe("2026-02");
  });
});
