/**
 * Unit tests for lib/server/pro-sample.ts
 *
 * Run with:  pnpm vitest run lib/server/__tests__/pro-sample.test.ts
 *
 * The free-component link is the one URL on the site that hands out paid
 * source without a key, so the only thing worth pinning is that a link we did
 * not sign installs nothing — and never even reaches the database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Chain, called, drizzleChain } from "@/test/stubs/drizzle-chain";

vi.mock("server-only", () => ({}));
vi.stubEnv("AUTH_SECRET", "test-secret");

let chain: Chain;
vi.mock("@/lib/server/db", () => ({
  isDbConfigured: true,
  getDb: () => chain.db,
}));

const { sampleInstallUrl, subscriberForSampleToken } = await import(
  "@/lib/server/pro-sample"
);

const ID = "9b2f7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b";
const tokenOf = (url: string | null) => url?.split("/").pop() ?? "";

beforeEach(() => {
  chain = drizzleChain([{ id: ID }]);
});

describe("pro sample link", () => {
  it("installs for the subscriber it was signed for", async () => {
    const url = sampleInstallUrl(ID);
    expect(url).toMatch(/\/api\/pro-sample\/[0-9a-f-]{36}\.[\w-]{32}$/);
    expect(await subscriberForSampleToken(tokenOf(url))).toBe(ID);
  });

  it("refuses a forged or altered link without touching the database", async () => {
    const good = tokenOf(sampleInstallUrl(ID));
    const other = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    for (const bad of [
      `${other}.${good.split(".")[1]}`, // someone else's id, this signature
      `${ID}.${"A".repeat(32)}`,
      `${ID}.`,
      ID,
      "",
      `../../etc/passwd.${good.split(".")[1]}`,
    ]) {
      chain = drizzleChain([{ id: ID }]);
      expect(await subscriberForSampleToken(bad), bad).toBeNull();
      expect(called(chain, "select"), bad).toBe(false);
    }
  });

  it("stops working once the address is no longer a confirmed subscriber", async () => {
    chain = drizzleChain([]);
    expect(
      await subscriberForSampleToken(tokenOf(sampleInstallUrl(ID))),
    ).toBeNull();
  });
});
