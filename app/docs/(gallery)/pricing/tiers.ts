import "server-only";
import { headers } from "next/headers";
import { PRO_ITEMS } from "@/config/site";
import { GALLERY_COUNT } from "@/lib/gallery-data";
import {
  CATALOGUE_PRICE,
  CATALOGUE_PROMISE,
  CHECKOUT_PRODUCTS,
  FOUNDER_SEATS,
  PPP_PRICES,
} from "@/lib/plans";
import {
  checkoutQuotes,
  type QuotedProduct,
  type Quotes,
} from "@/lib/server/checkout-quotes";
import { type CountrySource, resolveCountry } from "@/lib/server/country";
import { seatsTaken } from "@/lib/server/entitlements";

/**
 * The copy, as data. Deliberately prose rather than numbers pulled out of
 * `PLANS`: what a buyer reads is "1080p instead of 720p", not a pixel ceiling,
 * and deriving that sentence from `maxWidth` would be a conversion nobody can
 * check at a glance.
 *
 * The cost is that a pricing change is two files. `lib/plans.ts` is the one
 * that decides what anybody actually gets — this page only describes it, so a
 * drift here is wrong copy rather than a wrong entitlement. The amounts are
 * not copy: they come from `CATALOGUE_PRICE`, the same numbers Dodo charges.
 *
 * Its own module because two pages sell from it: `/docs/pricing` shows all of
 * them, `/pro` shows the ones with a product.
 *
 * Shape D (PLAN_SEP09_NOV20, 2026-09-12): one thing for sale — the catalogue,
 * with the MCP and the unmarked editor inside it — bought three ways. The $19
 * Starter and the $29 MCP tier are gone; neither sold, and the MCP only serves
 * the catalogue it would have been sold without.
 */
/**
 * The dated rises, announced with the price rather than on the day — a reason
 * to decide this month instead of next is the whole point of them. In cents, so
 * the "Save $50" chip on each card is arithmetic rather than a second number to
 * keep in step.
 */
const RISE = { annual: 17900, lifetime: 29900 } as const;
const LIFETIME_RISE_DATE = "20 Oct";

const saving = (product: "everything_annual" | "lifetime") =>
  `Save $${(RISE[product === "lifetime" ? "lifetime" : "annual"] - CHECKOUT_PRODUCTS[product].cents) / 100}`;

const TIERS = [
  {
    name: "Free",
    price: "$0",
    caption: "Free forever, no card",
    audience: "For trying snapcn on a real video",
    features: [
      `All ${GALLERY_COUNT} free components, MIT`,
      "Unlimited editor exports at 720p",
      "A small snapcn mark on exports",
      "Saved projects once you sign in",
    ],
    href: "/docs/components",
    cta: "Browse free components",
  },
  // `name` is compared with the user's plan to mark "Your plan", so the annual
  // tier is the one called "Pro".
  {
    name: "Pro",
    price: CATALOGUE_PRICE.annual,
    caption: "Per year, renews annually",
    badge: saving("everything_annual"),
    audience: "For builders shipping product videos",
    features: [
      `All ${PRO_ITEMS.length} Pro components today`,
      `Growing to ${CATALOGUE_PROMISE.components} Pro components`,
      `${CATALOGUE_PROMISE.templates} video templates from ${CATALOGUE_PROMISE.templatesOn}`,
      "The snapcn MCP server for your agent",
      "No watermark, 1080p exports",
    ],
    product: "everything_annual" as const,
    cta: "Get Pro",
    featured: true,
  },
  {
    name: "Lifetime",
    price: CATALOGUE_PRICE.lifetime,
    caption: "One payment, never renews",
    badge: saving("lifetime"),
    audience: "For builders who would rather own it",
    features: [
      "Everything in Pro, for good",
      `Every one of the ${CATALOGUE_PROMISE.components} components to come`,
      `Every one of the ${CATALOGUE_PROMISE.templates} templates`,
      "The MCP server and 1080p exports",
    ],
    product: "lifetime" as const,
    cta: "Buy it outright",
  },
  {
    name: "Commercial",
    price: CATALOGUE_PRICE.commercial,
    caption: "One payment, up to five people",
    audience: "For studios and teams shipping client work",
    features: [
      "Everything in Lifetime",
      "Licensed for client and company work",
      "Up to five people on one licence",
    ],
    product: "commercial" as const,
    cta: "Buy for your team",
  },
  // No Template Pack card: the templates ship inside Pro now (the promise on the
  // cards above). `pack` stays in CHECKOUT_PRODUCTS and the webhook still
  // recognises it, but a buy button is a promise, and `payment.succeeded` for a
  // pack logs a line and delivers nothing.
];

/** The headline over the cards on `/docs/pricing`. */
export const PRICING_INTRO = {
  title: "Own the whole catalogue.",
  description: `${PRO_ITEMS.length} Pro components today, growing to ${CATALOGUE_PROMISE.components}, and ${CATALOGUE_PROMISE.templates} video templates — installed with the shadcn CLI you already use.`,
};

const regionName = (country: string) =>
  new Intl.DisplayNames("en", { type: "region" }).of(country) ?? country;

/** The footnote for a visitor with no regional price: where one exists. */
const REGIONAL_NOTE = `Lower prices for Pro and Lifetime in ${new Intl.ListFormat(
  "en",
).format(
  Object.keys(PPP_PRICES).map(regionName),
)}, applied at checkout from your billing country.`;

/**
 * An amount as its own currency writes it — "₹4,699", "€112.26",
 * "Rp 849,000". Dodo counts in the currency's minor unit, and Intl knows how
 * many digits that is (IDR has two, VND and JPY none), so the two cannot
 * disagree. Cents only when there are some.
 */
function money(minor: number, currency: string): string {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const value = minor / 10 ** digits;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(value);
}

const CADENCE: Record<QuotedProduct, string> = {
  everything_annual: "Per year",
  lifetime: "One payment",
  // "Five people" is already in its features; the caption has to fit one line.
  commercial: "One payment",
};

/**
 * The tiers as a visitor from `country` should see them, and the line under
 * them. Pure — no request, no database — so a test can check every market.
 *
 * `quotes` are Dodo's own checkout preview for that country, and when they are
 * here they are the truth: the card shows exactly what the checkout will
 * charge — the regional price, or the conversion into the visitor's currency —
 * with the total including tax beside it where there is tax (India's GST, EU
 * VAT). What Netflix and Spotify do, with the number coming from the payment
 * processor rather than a second copy of it.
 *
 * Without quotes (Dodo not configured, or it could not answer) the page falls
 * back to `PPP_PRICES`, which is what `scripts/dodo-products.mts` wrote to
 * Dodo, so the fallback says the same thing minus the tax.
 *
 * The "Save $50" chip and the dated rises are USD facts, so they stay only on
 * a card still showing the USD list price.
 */
export function pricingFor(
  country: string | null,
  seatsLeft: number,
  source: CountrySource | null = "ip",
  quotes: Quotes | null = null,
) {
  const place = country ? regionName(country) : null;
  const regional =
    country && Object.hasOwn(PPP_PRICES, country)
      ? PPP_PRICES[country as keyof typeof PPP_PRICES]
      : null;
  const seats =
    seatsLeft > 0 ? `${seatsLeft} of ${FOUNDER_SEATS} seats left` : "";
  let localised = false;

  const tiers = TIERS.map((tier) => {
    const product = tier.product;
    if (!product) return tier;
    const annual = product === "everything_annual";
    const listNote = annual
      ? seats
        ? `${seats} · then $${RISE.annual / 100}`
        : `Rises to $${RISE.annual / 100} a year`
      : product === "lifetime"
        ? `$${RISE.lifetime / 100} from ${LIFETIME_RISE_DATE}`
        : undefined;

    const quote = quotes?.[product];
    if (quote) {
      const list =
        quote.currency === "USD" &&
        quote.subtotal === CHECKOUT_PRODUCTS[product].cents;
      const tail =
        quote.tax > 0
          ? `${money(quote.total, quote.currency)} with tax`
          : `your price in ${place}`;
      if (list) {
        // The list price. Only the tax line is news.
        return quote.tax > 0
          ? {
              ...tier,
              caption: `${CADENCE[product]} · ${tail}`,
              note: listNote,
            }
          : { ...tier, note: listNote };
      }
      localised = true;
      return {
        ...tier,
        price: money(quote.subtotal, quote.currency),
        caption: `${CADENCE[product]} · ${tail}`,
        badge: undefined,
        note: annual ? seats : undefined,
      };
    }

    if (regional && place && (annual || product === "lifetime")) {
      localised = true;
      return {
        ...tier,
        price: money(regional[product], regional.currency),
        caption: `${CADENCE[product]} · your price in ${place}`,
        badge: undefined,
        note: annual ? seats : undefined,
      };
    }
    return { ...tier, note: listNote };
  });

  const how =
    source === "test"
      ? "set by ?country= (development only)"
      : source === "accept-language"
        ? "from your browser's language"
        : "from your connection";
  const footnote =
    localised && place
      ? quotes
        ? `Prices for ${place}, ${how} — the amounts checkout charges. Your billing country decides the final price.`
        : `Prices for ${place}, ${how}. Checkout confirms them from your billing country.`
      : REGIONAL_NOTE;

  return { tiers, footnote };
}

/**
 * `pricingFor` for this request: the seat count read live, the country from
 * `resolveCountry`, and that country's prices from Dodo's checkout preview.
 * `testCountry` is `?country=` and only counts in development.
 */
export async function pricing(options: { testCountry?: string | null } = {}) {
  const [taken, requestHeaders] = await Promise.all([seatsTaken(), headers()]);
  const { country, source, ip } = await resolveCountry(requestHeaders, options);
  const quotes = country ? await checkoutQuotes(country) : null;
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[pricing] country ${country ?? "none"} from ${source ?? "nothing"}${ip ? ` ${ip}` : ""}` +
        (options.testCountry ? ` (?country=${options.testCountry})` : "") +
        `, prices from ${quotes ? "Dodo" : "the table"}`,
    );
  }
  return pricingFor(
    country,
    Math.max(0, FOUNDER_SEATS - taken),
    source,
    quotes,
  );
}
