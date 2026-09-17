/**
 * Where a visitor is from, for the regional price — lib/server/country.ts.
 *
 * Run with:  pnpm vitest run lib/server/__tests__/country.test.ts
 *
 * The bugs this pins: every local request is `::1` so the regional price could
 * never be seen in development; a proxy's own private hop after the client's
 * address ended the search; and an IPv4-mapped `::ffff:` address, a port or a
 * bracketed IPv6 made a perfectly good address unreadable.
 */
import { describe, expect, it, vi } from "vitest";
import {
  candidateIps,
  countryForIp,
  countryFromLanguage,
  isPublicIp,
  normalizeIp,
  resolveCountry,
} from "@/lib/server/country";

// Addresses whose registry country is stable: Reliance Jio (IN), NIC.br (BR),
// Google DNS (US), and one each for the other regional markets.
const IN = "49.36.0.1";
const BR = "200.160.2.3";
const US = "8.8.8.8";

const h = (init: Record<string, string>) => new Headers(init);
const never = vi.fn(async () => {
  throw new Error("must not look up the public IP");
});

describe("countryForIp", () => {
  it("places every regional-price market", () => {
    expect(countryForIp(IN)).toBe("IN");
    expect(countryForIp(BR)).toBe("BR");
    expect(countryForIp("181.13.0.1")).toBe("AR");
    expect(countryForIp("88.255.0.1")).toBe("TR");
    expect(countryForIp("14.160.0.1")).toBe("VN");
    expect(countryForIp("36.66.0.1")).toBe("ID");
    expect(countryForIp(US)).toBe("US");
    expect(countryForIp("2001:4860:4860::8888")).toBe("US");
  });

  it("answers null, never throws, for anything it cannot place", () => {
    for (const ip of [
      "127.0.0.1",
      "::1",
      "10.0.0.5",
      "unknown",
      "",
      "999.1.1.1",
    ])
      expect(countryForIp(ip), ip).toBeNull();
  });
});

describe("normalizeIp", () => {
  it("reads the shapes proxies and runtimes actually send", () => {
    expect(normalizeIp("::ffff:49.36.0.1")).toBe(IN);
    expect(normalizeIp("49.36.0.1:52341")).toBe(IN);
    expect(normalizeIp("[2001:4860:4860::8888]:443")).toBe(
      "2001:4860:4860::8888",
    );
    expect(normalizeIp(' "49.36.0.1" ')).toBe(IN);
    expect(normalizeIp("fe80::1%en0")).toBe("fe80::1");
    expect(normalizeIp("not-an-ip")).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });
});

describe("isPublicIp", () => {
  it("skips everything that is not somewhere on a map", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
    ])
      expect(isPublicIp(ip), ip).toBe(false);
    for (const ip of [IN, US, "172.32.0.1", "2001:4860:4860::8888"])
      expect(isPublicIp(ip), ip).toBe(true);
  });
});

describe("candidateIps", () => {
  it("walks x-forwarded-for right to left, stepping over private hops", () => {
    expect(
      candidateIps(h({ "x-forwarded-for": `${US}, ${IN}, 10.0.0.2` })),
    ).toEqual([IN, US]);
  });

  it("falls back to the other client-IP headers and RFC 7239", () => {
    expect(candidateIps(h({ "x-real-ip": BR }))).toEqual([BR]);
    expect(candidateIps(h({ "cf-connecting-ip": IN }))).toEqual([IN]);
    expect(
      candidateIps(
        h({ forwarded: `for="[2001:4860:4860::8888]:443";proto=https` }),
      ),
    ).toEqual(["2001:4860:4860::8888"]);
    expect(
      candidateIps(h({ "x-forwarded-for": "::1", "x-real-ip": IN })),
    ).toEqual([IN]);
  });
});

describe("countryFromLanguage", () => {
  it("takes the region of the most preferred tag that has one", () => {
    expect(countryFromLanguage("pt-BR,pt;q=0.9,en;q=0.8")).toBe("BR");
    expect(countryFromLanguage("en;q=0.5, hi-IN;q=0.9")).toBe("IN");
    expect(countryFromLanguage("zh-Hant-TW")).toBe("TW");
    expect(countryFromLanguage("en")).toBeNull();
    expect(countryFromLanguage("*")).toBeNull();
    expect(countryFromLanguage(null)).toBeNull();
  });
});

describe("resolveCountry — the fallback chain", () => {
  const prod = { env: "production", lookupPublicIp: never };
  const dev = (ip: string | null) => ({
    env: "development",
    lookupPublicIp: async () => ip,
  });

  it("trusts a CDN country header before our own lookup", async () => {
    expect(
      await resolveCountry(
        h({ "cf-ipcountry": "br", "x-forwarded-for": US }),
        prod,
      ),
    ).toEqual({ country: "BR", source: "header" });
    expect(
      await resolveCountry(h({ "x-vercel-ip-country": "IN" }), prod),
    ).toEqual({ country: "IN", source: "header" });
    // Cloudflare's "unknown" and "Tor" codes are not countries.
    expect(
      await resolveCountry(
        h({ "cf-ipcountry": "XX", "x-forwarded-for": IN }),
        prod,
      ),
    ).toEqual({ country: "IN", source: "ip", ip: IN });
  });

  it("finds the client behind a proxy that appended its own private hop", async () => {
    expect(
      await resolveCountry(h({ "x-forwarded-for": `${IN}, 10.0.1.7` }), prod),
    ).toEqual({ country: "IN", source: "ip", ip: IN });
    expect(
      await resolveCountry(h({ "x-forwarded-for": "::ffff:49.36.0.1" }), prod),
    ).toEqual({ country: "IN", source: "ip", ip: IN });
  });

  it("uses this machine's public IP only in development, and only when every hop is local", async () => {
    const local = h({ "x-forwarded-for": "::1" });
    expect(await resolveCountry(local, dev(IN))).toEqual({
      country: "IN",
      source: "dev-public-ip",
      ip: IN,
    });
    expect(await resolveCountry(local, prod)).toEqual({
      country: null,
      source: null,
    });
    expect(never).not.toHaveBeenCalled();
    // A real address present: no reason to ask about the machine.
    const lookup = vi.fn(async () => IN);
    await resolveCountry(h({ "x-forwarded-for": US }), {
      env: "development",
      lookupPublicIp: lookup,
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("falls back to the browser's language when no address placed the visitor", async () => {
    expect(
      await resolveCountry(
        h({ "x-forwarded-for": "10.0.0.1", "accept-language": "pt-BR" }),
        prod,
      ),
    ).toEqual({ country: "BR", source: "accept-language" });
    // Not when an address did: a US address with a Brazilian browser is in the US.
    expect(
      await resolveCountry(
        h({ "x-forwarded-for": US, "accept-language": "pt-BR" }),
        prod,
      ),
    ).toEqual({ country: "US", source: "ip", ip: US });
  });

  it("honours ?country= in development and ignores it in production", async () => {
    const headers = h({ "x-forwarded-for": US });
    expect(
      await resolveCountry(headers, { ...dev(null), testCountry: "vn" }),
    ).toEqual({ country: "VN", source: "test" });
    // A name works as well as a code — people type what they see.
    for (const typed of ["Brazil", "brazil", "BR", "br"])
      expect(
        await resolveCountry(headers, { ...dev(null), testCountry: typed }),
        typed,
      ).toEqual({ country: "BR", source: "test" });
    for (const typed of ["turkiye", "Türkiye", "Turkey"])
      expect(
        await resolveCountry(headers, { ...dev(null), testCountry: typed }),
        typed,
      ).toEqual({ country: "TR", source: "test" });
    expect(
      await resolveCountry(headers, { ...prod, testCountry: "VN" }),
    ).toEqual({ country: "US", source: "ip", ip: US });
    expect(
      await resolveCountry(headers, { ...dev(null), testCountry: "<script>" }),
    ).toEqual({ country: "US", source: "ip", ip: US });
  });

  it("gives up cleanly when nothing says anything", async () => {
    expect(await resolveCountry(h({}), prod)).toEqual({
      country: null,
      source: null,
    });
    expect(await resolveCountry(h({}), dev(null))).toEqual({
      country: null,
      source: null,
    });
  });

  it("notices a VPN switched on mid-session instead of keeping the first address", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let egress = IN;
    vi.stubGlobal("fetch", async () => new Response(`${egress}\n`));
    const local = h({ "x-forwarded-for": "::1" });
    try {
      expect(
        (await resolveCountry(local, { env: "development" })).country,
      ).toBe("IN");
      egress = BR; // the VPN comes on
      expect(
        (await resolveCountry(local, { env: "development" })).country,
      ).toBe("IN"); // inside the ten-second window
      vi.setSystemTime(Date.now() + 11_000);
      expect(await resolveCountry(local, { env: "development" })).toEqual({
        country: "BR",
        source: "dev-public-ip",
        ip: BR,
      });
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
