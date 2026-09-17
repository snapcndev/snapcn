import "server-only";
import { CHECKOUT_PRODUCTS } from "@/lib/plans";
import { type CheckoutQuote, previewCheckout } from "@/lib/server/dodo";

/** The products the pricing page prices. The pack has no card. */
export const QUOTED = ["everything_annual", "lifetime", "commercial"] as const;
export type QuotedProduct = (typeof QUOTED)[number];
export type Quotes = Partial<Record<QuotedProduct, CheckoutQuote>>;

/**
 * An hour. A price changed in the Dodo dashboard reaches the page within one;
 * nothing about a price needs to be fresher, and it keeps Dodo out of the
 * request path for every visitor but the first from each country.
 */
const TTL_MS = 60 * 60_000;
/** A failed lookup is retried after a minute, not on every render. */
const FAILED_TTL_MS = 60_000;

const cache = new Map<
  string,
  { at: number; ttl: number; quotes: Promise<Quotes | null> }
>();

/**
 * What each catalogue product costs in `country`, straight from Dodo's
 * checkout preview — or null when Dodo is not configured or could not answer
 * for any of them, which sends the page to its own price table.
 *
 * Keyed by mode as well as country: test and live are different products.
 */
export function checkoutQuotes(country: string): Promise<Quotes | null> {
  const key = `${process.env.DODO_MODE ?? "test"}:${country}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.quotes;

  const entry: { at: number; ttl: number; quotes: Promise<Quotes | null> } = {
    at: Date.now(),
    ttl: TTL_MS,
    quotes: Promise.resolve(null),
  };
  entry.quotes = (async () => {
    const pairs = await Promise.all(
      QUOTED.map(async (product) => {
        const id = process.env[CHECKOUT_PRODUCTS[product].env];
        return [
          product,
          id ? await previewCheckout(id, country) : null,
        ] as const;
      }),
    );
    const quotes: Quotes = {};
    for (const [product, quote] of pairs) if (quote) quotes[product] = quote;
    if (Object.keys(quotes).length === 0) {
      entry.ttl = FAILED_TTL_MS;
      return null;
    }
    return quotes;
  })();
  cache.set(key, entry);
  return entry.quotes;
}
