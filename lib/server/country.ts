import "server-only";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import path from "node:path";
import { Reader, type Response } from "mmdb-lib";

/**
 * The visitor's country — to *show* a regional price.
 *
 * Never to charge one. Dodo prices from the billing country at checkout, so a
 * VPN, a spoofed header or a wrong guess changes what the page says and nothing
 * about what the card is charged. That is why every step below fails soft, and
 * why the chain is allowed to trust headers a client could forge.
 *
 * The chain, first answer wins:
 *
 *  1. **A test country** (`?country=BR` or `?country=Brazil`), in development
 *     only.
 *  2. **A CDN's own country header** — Cloudflare, Vercel, CloudFront. Computed
 *     from the real client address by the edge, so better than our lookup.
 *  3. **Every client IP the request carries**, looked up in a local CC0
 *     database (`@ip-location-db/geo-whois-asn-country-mmdb`): the
 *     `x-forwarded-for` hops right to left, then `x-real-ip` and the platform
 *     client-IP headers, then RFC 7239 `forwarded`. Private and loopback hops
 *     are skipped rather than ending the search — a proxy appending its own
 *     10.x address after the client's is ordinary, and reading only the last
 *     hop turned every visitor into "unknown". IPv4-mapped IPv6
 *     (`::ffff:49.36.0.1`), ports and brackets are normalised first.
 *  4. **This machine's public IP**, in development only. On a laptop every
 *     request is `::1`, so without this the regional price can never be seen
 *     locally. Re-asked every ten seconds, so a system VPN switched on shows.
 *  5. **The browser's language region** (`pt-BR` → BR). Weak — `en-US` is the
 *     default in a lot of places that are not the US — so only when no address
 *     placed the visitor at all.
 *
 * No visitor address leaves the server: the lookup is a file read.
 *
 * ponytail: the database is as fresh as the installed package. Country-level
 * allocations barely move; bump the package when a quarter has gone by.
 */

export type CountrySource =
  | "test"
  | "header"
  | "ip"
  | "dev-public-ip"
  | "accept-language";

export interface ResolvedCountry {
  country: string | null;
  source: CountrySource | null;
  /** The address that placed the visitor, when one did — for the dev log. */
  ip?: string;
}

// Typed for MaxMind's own schema; this database stores `{ country_code }`.
let reader: Reader<Response> | null | undefined;

function open() {
  if (reader === undefined) {
    try {
      reader = new Reader(
        readFileSync(
          path.join(
            process.cwd(),
            "node_modules/@ip-location-db/geo-whois-asn-country-mmdb/geo-whois-asn-country.mmdb",
          ),
        ),
      );
    } catch (err) {
      console.warn("[country] no IP database, showing list prices", err);
      reader = null;
    }
  }
  return reader;
}

const ISO = /^[A-Z]{2}$/;

/** A two-letter country code, or null for anything else ("XX", "T1", junk). */
function code(value: string | null | undefined): string | null {
  const upper = value?.trim().toUpperCase();
  // XX: unknown to Cloudflare. T1: Tor. EU/AP: continent placeholders.
  if (!upper || !ISO.test(upper) || ["XX", "T1", "EU", "AP"].includes(upper))
    return null;
  return upper;
}

/**
 * A country from what a person types into `?country=`: a code (`br`) or its
 * English name (`Brazil`, `turkiye`). Only ever used for the development test
 * override, so the name table is built on first use and never in production.
 */
let byName: Map<string, string> | undefined;
function countryFromInput(value: string | null | undefined): string | null {
  const direct = code(value);
  if (direct || !value) return direct;
  if (!byName) {
    // The names people still type that Intl no longer uses.
    byName = new Map([
      ["turkey", "TR"],
      ["usa", "US"],
      ["america", "US"],
      ["uk", "GB"],
      ["england", "GB"],
    ]);
    const names = new Intl.DisplayNames("en", { type: "region" });
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const a of letters) {
      for (const b of letters) {
        const name = names.of(a + b);
        if (name && name !== a + b) byName.set(fold(name), a + b);
      }
    }
  }
  return code(byName.get(fold(value)));
}

/** Case and accents out, so "Türkiye", "turkiye" and "TURKIYE" all match. */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

/**
 * An address as a header spells it, reduced to what `isIP` accepts — or null.
 * `"[2001:db8::1]:443"`, `"49.36.0.1:52341"`, `"::ffff:49.36.0.1"`,
 * `"fe80::1%en0"` and `"\"1.2.3.4\""` all come out usable.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  let ip = raw?.trim().replace(/^"|"$/g, "");
  if (!ip) return null;
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(":")[0];
  ip = ip.replace(/%.*$/, "");
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) ip = mapped[1];
  return isIP(ip) ? ip : null;
}

/** Loopback, private, link-local, CGNAT and unspecified — nowhere on a map. */
export function isPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = ip.toLowerCase();
  return !(
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  );
}

/** ISO 3166 alpha-2 for an IP address, or null for private, local or unknown. */
export function countryForIp(ip: string): string | null {
  const normal = normalizeIp(ip);
  if (!normal || !isPublicIp(normal)) return null;
  const row = open()?.get(normal) as
    | { country_code?: string }
    | null
    | undefined;
  return code(row?.country_code);
}

/** Every public client address the headers carry, most trustworthy first. */
export function candidateIps(headers: Headers): string[] {
  const raw: string[] = [];
  // Right to left: the last hop is the one our own proxy appended, the first
  // is whatever the client claimed.
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) raw.push(...forwarded.split(",").reverse());
  for (const name of [
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "fly-client-ip",
    "x-client-ip",
  ]) {
    const value = headers.get(name);
    if (value) raw.push(value);
  }
  for (const match of headers.get("forwarded")?.matchAll(/for=([^;,]+)/gi) ??
    []) {
    raw.push(match[1]);
  }
  const seen = new Set<string>();
  for (const value of raw) {
    const ip = normalizeIp(value);
    if (ip && isPublicIp(ip)) seen.add(ip);
  }
  return [...seen];
}

/** The region of the most preferred language tag that has one. */
export function countryFromLanguage(header: string | null): string | null {
  if (!header) return null;
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag, q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((t) => t.tag && Number.isFinite(t.q))
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    // pt-BR, en-IN, zh-Hant-TW: the region is the last two-letter subtag.
    const region = tag
      .split("-")
      .slice(1)
      .reverse()
      .find((part) => part.length === 2);
    const found = code(region);
    if (found) return found;
  }
  return null;
}

/**
 * This machine's own public address, for development — asked of two echo
 * services in turn and remembered for ten seconds.
 *
 * Ten seconds and not the life of the process: it used to be looked up once,
 * so a laptop that loaded the page before switching a VPN on kept showing its
 * home country until the dev server restarted, and VPN testing looked broken.
 * A browser-extension VPN still cannot move this — it tunnels the browser, not
 * this server's own requests — which is what `?country=` is for.
 */
const PUBLIC_IP_TTL_MS = 10_000;
let publicIp: { at: number; ip: Promise<string | null> } | undefined;

function devPublicIp(): Promise<string | null> {
  if (!publicIp || Date.now() - publicIp.at > PUBLIC_IP_TTL_MS) {
    publicIp = {
      at: Date.now(),
      ip: (async () => {
        for (const url of [
          "https://api.ipify.org",
          "https://checkip.amazonaws.com",
        ]) {
          try {
            const res = await fetch(url, {
              signal: AbortSignal.timeout(1500),
            });
            const ip = normalizeIp((await res.text()).trim());
            if (res.ok && ip) return ip;
          } catch {
            // next service
          }
        }
        return null;
      })(),
    };
  }
  return publicIp.ip;
}

/**
 * Where this request is from, and how we know. See the chain at the top.
 *
 * `options` exist for tests: the environment, and the public-IP lookup so a
 * test never reaches the network.
 */
export async function resolveCountry(
  headers: Headers,
  options: {
    testCountry?: string | null;
    env?: string;
    lookupPublicIp?: () => Promise<string | null>;
  } = {},
): Promise<ResolvedCountry> {
  const development = (options.env ?? process.env.NODE_ENV) === "development";

  const test = development ? countryFromInput(options.testCountry) : null;
  if (test) return { country: test, source: "test" };

  for (const name of [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "cloudfront-viewer-country",
  ]) {
    const country = code(headers.get(name));
    if (country) return { country, source: "header" };
  }

  const ips = candidateIps(headers);
  for (const ip of ips) {
    const country = countryForIp(ip);
    if (country) return { country, source: "ip", ip };
  }

  if (development && ips.length === 0) {
    const ip = await (options.lookupPublicIp ?? devPublicIp)();
    const country = ip ? countryForIp(ip) : null;
    if (country && ip) return { country, source: "dev-public-ip", ip };
  }

  if (ips.length === 0) {
    const country = countryFromLanguage(headers.get("accept-language"));
    if (country) return { country, source: "accept-language" };
  }

  return { country: null, source: null };
}
