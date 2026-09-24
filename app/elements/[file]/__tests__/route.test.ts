/**
 * A paid Element is the component's whole source. It goes to an account or a
 * key whose plan carries the components and to nobody else — and the refusal
 * tells a signed-out visitor to sign in rather than to buy what they may own.
 *
 * Run with:  pnpm vitest run app/elements
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state: { session: unknown; keyPlan: string | null; body: string | null } =
  {
    session: null,
    keyPlan: null,
    body: '{"type":"remotion-element"}',
  };

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@/lib/server/api-key", () => ({
  bearer: () => "key",
  planForApiKey: async () => state.keyPlan,
}));
vi.mock("@/lib/server/pro-registry", () => ({
  readProElement: async () => state.body,
}));

import { PLANS } from "@/lib/plans";
import PRO_ELEMENTS from "@/lib/studio-elements-pro.json";
import { GET } from "../route";

const paid = Object.entries(PLANS).find(([, p]) => p.components)?.[0] ?? "";
const unpaid = Object.entries(PLANS).find(([, p]) => !p.components)?.[0] ?? "";
const get = (file: string) =>
  GET(new Request(`https://snapcn.dev/elements/${file}`), {
    params: Promise.resolve({ file }),
  });
const name = (PRO_ELEMENTS as string[])[0] ?? "";

beforeEach(() => {
  state.session = null;
  state.keyPlan = null;
  state.body = '{"type":"remotion-element"}';
});

describe("paid Elements", () => {
  it("asks a signed-out visitor to sign in", async () => {
    const res = await get(`${name}.json`);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("sign_in");
  });

  it("sells to a signed-in account without the components", async () => {
    state.session = { user: { id: "u", plan: unpaid } };
    const res = await get(`${name}.json`);
    expect(res.status).toBe(402);
    expect((await res.json()).url).toContain("/docs/pricing");
  });

  it("hands the payload to an owner, privately", async () => {
    state.session = { user: { id: "u", plan: paid } };
    const res = await get(`${name}.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("private");
    expect(await res.json()).toEqual({ type: "remotion-element" });
  });

  it("takes a key when there is no session", async () => {
    state.keyPlan = paid;
    expect((await get(`${name}.json`)).status).toBe(200);
  });

  it("says so when the server has no pro volume", async () => {
    state.session = { user: { id: "u", plan: paid } };
    state.body = null;
    expect((await get(`${name}.json`)).status).toBe(503);
  });

  it("never touches anything that is not a listed Element", async () => {
    state.session = { user: { id: "u", plan: paid } };
    for (const file of [
      "text-reveal.json",
      "../x.json",
      `${name}.js`,
      "nope.json",
    ]) {
      expect((await get(file)).status, file).toBe(404);
    }
  });
});
