/**
 * Unit tests for lib/server/subscription.ts
 *
 * Run with:  pnpm vitest run lib/server/__tests__/subscription.test.ts
 *
 * The three statements a subscriber's token can run. The one worth reading is
 * `confirmSubscription`: its two branches decide whether a welcome mail is
 * sent, so "already confirmed" returning a row would mail somebody every time
 * they refresh the tab.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Chain, called, drizzleChain } from "@/test/stubs/drizzle-chain";

vi.mock("server-only", () => ({}));

let configured = true;
let chain: Chain;

vi.mock("@/lib/server/db", () => ({
  get isDbConfigured() {
    return configured;
  },
  getDb: () => chain.db,
}));

import {
  addressForToken,
  confirmSubscription,
  TOKEN_RE,
  unsubscribeByToken,
} from "@/lib/server/subscription";

const TOKEN = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const ID = "9b2f7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b";

/** Values that must never reach the database. */
const JUNK = [
  "",
  "   ",
  "not-a-token",
  "3f2504e0-4f89-11d3-9a0c-0305e82c330",
  `${TOKEN}'--`,
  `${TOKEN} OR 1=1`,
  "../../etc/passwd",
];

beforeEach(() => {
  configured = true;
  chain = drizzleChain([]);
});

describe("TOKEN_RE", () => {
  it("accepts a uuid in either case and nothing else", () => {
    expect(TOKEN_RE.test(TOKEN)).toBe(true);
    expect(TOKEN_RE.test(TOKEN.toUpperCase())).toBe(true);
    for (const junk of JUNK) expect(TOKEN_RE.test(junk), junk).toBe(false);
  });
});

describe("confirmSubscription", () => {
  it("reports 'confirmed' and hands back what the welcome mail needs", async () => {
    chain = drizzleChain([{ id: ID, email: "ada@example.com", token: TOKEN }]);
    expect(await confirmSubscription(TOKEN)).toEqual({
      outcome: "confirmed",
      id: ID,
      email: "ada@example.com",
      token: TOKEN,
    });
    // One statement, and it both reads and writes — that is what makes the
    // welcome mail exactly-once.
    expect(chain.calls[0]?.name).toBe("update");
    expect(called(chain, "returning")).toBe(true);
  });

  it("clears unsubscribed_at, so leaving and coming back works", async () => {
    chain = drizzleChain([{ email: "ada@example.com", token: TOKEN }]);
    await confirmSubscription(TOKEN);
    const set = chain.calls.find((c) => c.name === "set")?.args[0] as {
      confirmedAt: Date;
      unsubscribedAt: null;
    };
    expect(set.unsubscribedAt).toBeNull();
    expect(set.confirmedAt).toBeInstanceOf(Date);
  });

  it("reports 'already' when the update matched nothing but the row exists", async () => {
    // The refresh case. No row from the update means no welcome mail, and the
    // follow-up select is the only thing that separates this from a bad link.
    chain = drizzleChain([], [{ id: ID }]);
    // The id comes back so the page can hand out the free-component link again.
    expect(await confirmSubscription(TOKEN)).toEqual({
      outcome: "already",
      id: ID,
    });
    expect(called(chain, "select")).toBe(true);
  });

  it("reports 'unknown' when there is no such token", async () => {
    chain = drizzleChain([], []);
    expect(await confirmSubscription(TOKEN)).toEqual({ outcome: "unknown" });
  });

  it("never queries on a token that cannot exist", async () => {
    for (const junk of [...JUNK, TOKEN]) {
      chain = drizzleChain([], []);
      // The last entry is a *valid* token with no database — same outcome,
      // different reason, and neither may reach a query.
      configured = junk !== TOKEN;
      expect(await confirmSubscription(junk), junk).toEqual({
        outcome: "unknown",
      });
      expect(chain.calls, junk).toHaveLength(0);
    }
  });
});

describe("unsubscribeByToken", () => {
  it("writes once and only for a row that is still subscribed", async () => {
    await unsubscribeByToken(TOKEN);
    expect(chain.calls[0]?.name).toBe("update");
    const set = chain.calls.find((c) => c.name === "set")?.args[0] as {
      unsubscribedAt: Date;
    };
    expect(set.unsubscribedAt).toBeInstanceOf(Date);
    // The `isNull` guard is what stops Gmail's duplicate one-click POST from
    // moving a date somebody may later have to prove.
    expect(called(chain, "where")).toBe(true);
  });

  it("does nothing at all for a token that cannot exist", async () => {
    for (const junk of JUNK) {
      chain = drizzleChain([]);
      await unsubscribeByToken(junk);
      expect(chain.calls, junk).toHaveLength(0);
    }
  });

  it("does nothing with no database configured", async () => {
    configured = false;
    await unsubscribeByToken(TOKEN);
    expect(chain.calls).toHaveLength(0);
  });
});

describe("addressForToken", () => {
  it("returns the address behind a token", async () => {
    chain = drizzleChain([{ email: "ada@example.com" }]);
    expect(await addressForToken(TOKEN)).toBe("ada@example.com");
  });

  it("returns null for an unknown token, a junk one, and no database", async () => {
    chain = drizzleChain([]);
    expect(await addressForToken(TOKEN)).toBeNull();
    for (const junk of JUNK)
      expect(await addressForToken(junk), junk).toBeNull();
    configured = false;
    expect(await addressForToken(TOKEN)).toBeNull();
  });
});
