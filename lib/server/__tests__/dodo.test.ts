import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveSubscription, verifyWebhookSignature } from "../dodo";

vi.mock("server-only", () => ({}));

/**
 * Only the verifier is tested here, and that is on purpose: it is the one piece
 * of the billing feature that decides whether a request is allowed to grant a
 * paid plan. `createCheckout` is a `fetch` and a JSON body — mocking it would
 * only assert that the mock was called with what we typed two lines above, and
 * the field names it exists to protect are the ones Dodo silently ignores, so
 * no local test can catch a typo there anyway. Only a real call can.
 *
 * Every fixture is signed here, with `node:crypto`, from the same spec the
 * verifier implements. A hardcoded signature blob would pass forever regardless
 * of what the code does with the key, and hides the one detail worth pinning:
 * the secret is base64 and the HMAC runs over its *decoded bytes*.
 */

/** A realistic secret: `whsec_` on the front, base64 key bytes behind it. */
const KEY = randomBytes(32);
const SECRET = `whsec_${KEY.toString("base64")}`;

const BODY = JSON.stringify({
  type: "subscription.active",
  data: { subscription_id: "sub_123", status: "active" },
});

function now(): number {
  return Math.floor(Date.now() / 1000);
}

/** Signs exactly as Standard Webhooks does: HMAC over `id.timestamp.body`. */
function sign(id: string, timestamp: number, body: string): string {
  return createHmac("sha256", KEY)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}

function headersFor(
  id: string,
  timestamp: number,
  signatureHeader: string,
): Headers {
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": signatureHeader,
  });
}

describe("verifyWebhookSignature", () => {
  it("accepts a signature we generated ourselves", () => {
    const ts = now();
    const headers = headersFor("msg_1", ts, `v1,${sign("msg_1", ts, BODY)}`);

    expect(verifyWebhookSignature(BODY, headers, SECRET)).toBe(true);
  });

  it("rejects a body edited after signing", () => {
    // The whole point of the scheme: the signature covers the bytes, so
    // rewriting the plan in the payload has to invalidate it.
    const ts = now();
    const headers = headersFor("msg_1", ts, `v1,${sign("msg_1", ts, BODY)}`);
    const tampered = BODY.replace("sub_123", "sub_evil");

    expect(verifyWebhookSignature(tampered, headers, SECRET)).toBe(false);
  });

  it("rejects a signature that is ten minutes old", () => {
    // Correctly signed — the timestamp is the only thing wrong with it. Without
    // the tolerance check a captured request replays forever.
    const ts = now() - 600;
    const headers = headersFor("msg_1", ts, `v1,${sign("msg_1", ts, BODY)}`);

    expect(verifyWebhookSignature(BODY, headers, SECRET)).toBe(false);
  });

  it("rejects a timestamp too far in the future", () => {
    // A forward-dated request is the same replay window pointed the other way,
    // so the tolerance is checked on both sides of now.
    const ts = now() + 600;
    const headers = headersFor("msg_1", ts, `v1,${sign("msg_1", ts, BODY)}`);

    expect(verifyWebhookSignature(BODY, headers, SECRET)).toBe(false);
  });

  it("accepts when a later entry in the header matches", () => {
    // What a secret rotation looks like on the wire: the old key's signature
    // still rides along in front of the current one.
    const ts = now();
    const stale = createHmac("sha256", randomBytes(32))
      .update(`msg_1.${ts}.${BODY}`)
      .digest("base64");
    const headers = headersFor(
      "msg_1",
      ts,
      `v1,${stale} v1,${sign("msg_1", ts, BODY)}`,
    );

    expect(verifyWebhookSignature(BODY, headers, SECRET)).toBe(true);
  });

  it("returns false rather than throwing when a header is missing", () => {
    // An unsigned POST is an ordinary 401. If this threw, a caller without a
    // try/catch would answer 500 — which Dodo treats as retryable.
    const bare = new Headers({ "content-type": "application/json" });

    expect(() => verifyWebhookSignature(BODY, bare, SECRET)).not.toThrow();
    expect(verifyWebhookSignature(BODY, bare, SECRET)).toBe(false);
  });

  it("rejects a truncated signature instead of throwing", () => {
    // `timingSafeEqual` throws on a length mismatch, and the length here is
    // attacker-controlled.
    const ts = now();
    const short = sign("msg_1", ts, BODY).slice(0, 10);
    const headers = headersFor("msg_1", ts, `v1,${short}`);

    expect(verifyWebhookSignature(BODY, headers, SECRET)).toBe(false);
  });

  it("rejects a signature made from the undecoded secret string", () => {
    // The mistake this whole scheme invites: HMAC-ing the printable `whsec_…`
    // instead of its decoded bytes produces a stable digest that is always
    // wrong. Pinned so nobody "fixes" the verifier into accepting it.
    const ts = now();
    const wrong = createHmac("sha256", SECRET)
      .update(`msg_1.${ts}.${BODY}`)
      .digest("base64");
    const headers = headersFor("msg_1", ts, `v1,${wrong}`);

    expect(verifyWebhookSignature(BODY, headers, SECRET)).toBe(false);
  });
});

/**
 * `/api/billing/sync` finds the subscription to honour by listing every active
 * subscription on the business account — which also sells Ruixen. These cover
 * the two ways that goes wrong: granting on a foreign subscription that happens
 * to carry a colliding `user_id`, and letting one end the search before the
 * real snapcn subscription further down the list is ever reached.
 */
describe("findActiveSubscription", () => {
  const UID = "user-1";
  const sub = (metadata: Record<string, string>, id = "sub_x") => ({
    subscription_id: id,
    status: "active",
    product_id: "pdt_x",
    metadata,
  });
  const pages = (...p: unknown[][]) => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      const n = Number(new URL(url).searchParams.get("page_number"));
      return { ok: true, json: async () => ({ items: p[n] ?? [] }) };
    });
    return calls;
  };
  // The function returns null with no key before it ever lists anything.
  beforeEach(() => vi.stubEnv("DODO_API_KEY", "sk_test"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns the user's own snapcn subscription", async () => {
    pages([sub({ user_id: UID, product: "starter" }, "sub_ours")]);
    expect((await findActiveSubscription(UID))?.subscription_id).toBe(
      "sub_ours",
    );
  });

  it("honours an annual subscription, not just the monthly product", async () => {
    pages([sub({ user_id: UID, product: "starter_annual" }, "sub_yr")]);
    expect((await findActiveSubscription(UID))?.subscription_id).toBe("sub_yr");
  });

  it("never grants on a foreign product with a colliding user_id", async () => {
    pages([
      sub({ user_id: UID, product: "ruixen-pro" }),
      sub({ user_id: UID }),
    ]);
    expect(await findActiveSubscription(UID)).toBeNull();
  });

  it("steps over a foreign subscription instead of stopping at it", async () => {
    pages([
      sub({ user_id: UID, product: "ruixen-pro" }, "sub_theirs"),
      sub({ user_id: UID, product: "starter" }, "sub_ours"),
    ]);
    expect((await findActiveSubscription(UID))?.subscription_id).toBe(
      "sub_ours",
    );
  });

  it("keeps paging while pages come back full", async () => {
    const full = Array.from({ length: 100 }, () => sub({ user_id: "someone" }));
    const calls = pages(full, [
      sub({ user_id: UID, product: "starter" }, "p2"),
    ]);
    expect((await findActiveSubscription(UID))?.subscription_id).toBe("p2");
    expect(calls).toHaveLength(2);
  });

  it("stops at the first short page", async () => {
    const calls = pages([sub({ user_id: "someone", product: "starter" })]);
    expect(await findActiveSubscription(UID)).toBeNull();
    expect(calls).toHaveLength(1);
  });
});
