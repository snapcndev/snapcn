/**
 * What the pricing cards say for a visitor from each market — tiers.ts.
 *
 * Run with:  pnpm vitest run "app/docs/(gallery)/pricing/__tests__/tiers.test.ts"
 *
 * The amounts must be the ones Dodo charges (PPP_PRICES, in minor units), in
 * that currency's own spelling, and the USD-only facts — the "Save $50" chip
 * and the dated rises — must not appear beside a price in rupees.
 */
import { describe, expect, it } from "vitest";
import { pricingFor } from "../tiers";

type Card = {
  price: string;
  caption: string;
  badge?: string;
  note?: string;
  cta: string;
};

/** Mid-window, so the dated rise shows whatever day the suite runs. */
const DAYS_LEFT = 33;

const card = (
  country: string | null,
  name: string,
  quotes: Parameters<typeof pricingFor>[3] = null,
) =>
  pricingFor(country, 50, "ip", quotes, DAYS_LEFT).tiers.find(
    (t) => t.name === name,
  ) as Card | undefined;

describe("pricingFor", () => {
  it("shows the list price, the saving and the rises where there is no regional price", () => {
    for (const country of ["US", "DE", null]) {
      expect(card(country, "Pro")?.price, String(country)).toBe("$129");
      expect(card(country, "Pro")?.badge).toBe("Save $50");
      expect(card(country, "Pro")?.note).toBe("Goes to $179/yr on 20 Oct");
      expect(card(country, "Pro")?.cta).toBe("Lock in $129/yr");
      expect(card(country, "Lifetime")?.price).toBe("$249");
      expect(card(country, "Lifetime")?.note).toBe("Goes to $299 on 20 Oct");
      expect(card(country, "Lifetime")?.cta).toBe("Own it for $249");
    }
    expect(pricingFor("US", 50).footnote).toMatch(
      /^Lower prices for Pro and Lifetime in/,
    );
  });

  it("shows each market the amount Dodo charges, in its own currency", () => {
    const expected: Record<string, [string, string]> = {
      IN: ["₹4,699", "₹9,499"],
      BR: ["R$249", "R$499"],
      AR: ["$49", "$99"],
      TR: ["₺2,399", "₺4,799"],
      VN: ["₫1,249,000", "₫2,549,000"],
      // Intl separates the rupiah symbol with a no-break space.
      ID: ["Rp\u00a0849,000", "Rp\u00a01,749,000"],
    };
    for (const [country, [annual, lifetime]] of Object.entries(expected)) {
      expect(card(country, "Pro")?.price, country).toBe(annual);
      expect(card(country, "Lifetime")?.price, country).toBe(lifetime);
    }
  });

  it("drops the USD-only facts beside a regional price, and says where it applies", () => {
    const pro = card("IN", "Pro");
    expect(pro?.badge).toBeUndefined();
    expect(pro?.caption).toBe("Per year · your price in India");
    expect(pro?.note).toBe("Renews at this price");
    expect(pro?.cta).toBe("Lock in ₹4,699/yr");
    expect(card("IN", "Lifetime")?.note).toBeUndefined();
    expect(pricingFor("IN", 50).footnote).toBe(
      "Prices for India, from your connection. Checkout confirms them from your billing country.",
    );
    expect(pricingFor("BR", 50, "accept-language").footnote).toContain(
      "from your browser's language",
    );
  });

  it("shows seats only once one has sold, and drops the rise once the window closes", () => {
    const tier = (seatsLeft: number, days: number, name: string) =>
      pricingFor("US", seatsLeft, "ip", null, days).tiers.find(
        (t) => t.name === name,
      ) as Card | undefined;
    expect(tier(42, DAYS_LEFT, "Pro")?.note).toBe(
      "42 of 50 left at this price",
    );
    expect(tier(0, DAYS_LEFT, "Pro")?.note).toBe("Goes to $179/yr on 20 Oct");
    expect(tier(50, 0, "Pro")?.note).toBeUndefined();
    expect(tier(50, 0, "Lifetime")?.note).toBeUndefined();
  });

  it("leads with Lifetime in India, and nowhere else", () => {
    const names = (country: string) =>
      pricingFor(country, 50, "ip", null, DAYS_LEFT).tiers.map((t) => t.name);
    const featured = (country: string) =>
      pricingFor(country, 50, "ip", null, DAYS_LEFT).tiers.find(
        (t) => (t as { featured?: boolean }).featured,
      )?.name;
    expect(names("IN")).toEqual(["Free", "Lifetime", "Pro", "Commercial"]);
    expect(featured("IN")).toBe("Lifetime");
    expect(names("BR")).toEqual(["Free", "Pro", "Lifetime", "Commercial"]);
    expect(featured("US")).toBe("Pro");
  });

  it("never regionalises Commercial or Free", () => {
    expect(card("IN", "Commercial")?.price).toBe("$499");
    expect(card("IN", "Free")?.price).toBe("$0");
  });

  describe("with Dodo's checkout preview", () => {
    // Real preview responses from test mode, 2026-09-17.
    const india = {
      everything_annual: {
        currency: "INR",
        subtotal: 469900,
        tax: 84582,
        total: 554482,
      },
      lifetime: {
        currency: "INR",
        subtotal: 949900,
        tax: 170982,
        total: 1120882,
      },
      commercial: {
        currency: "INR",
        subtotal: 4926706,
        tax: 886807,
        total: 5813513,
      },
    };
    const germany = {
      everything_annual: {
        currency: "EUR",
        subtotal: 11226,
        tax: 2133,
        total: 13359,
      },
      lifetime: { currency: "EUR", subtotal: 21669, tax: 4117, total: 25786 },
      commercial: { currency: "EUR", subtotal: 43425, tax: 8251, total: 51676 },
    };
    const us = {
      everything_annual: {
        currency: "USD",
        subtotal: 12900,
        tax: 0,
        total: 12900,
      },
      lifetime: { currency: "USD", subtotal: 24900, tax: 0, total: 24900 },
      commercial: { currency: "USD", subtotal: 49900, tax: 0, total: 49900 },
    };

    it("shows what checkout charges, with the taxed total beside it", () => {
      expect(card("IN", "Pro", india)?.price).toBe("₹4,699");
      expect(card("IN", "Pro", india)?.caption).toBe(
        "Per year · ₹5,544.82 with tax",
      );
      expect(card("IN", "Commercial", india)?.price).toBe("₹49,267.06");
      expect(card("IN", "Pro", india)?.badge).toBeUndefined();
    });

    it("converts a country with no regional price into its own currency", () => {
      expect(card("DE", "Pro", germany)?.price).toBe("€112.26");
      expect(card("DE", "Lifetime", germany)?.caption).toBe(
        "One payment · €257.86 with tax",
      );
      expect(pricingFor("DE", 50, "ip", germany).footnote).toBe(
        "Prices for Germany, from your connection — the amounts checkout charges. Your billing country decides the final price.",
      );
    });

    it("keeps the list price, the saving and the rises where Dodo charges the list price", () => {
      expect(card("US", "Pro", us)?.price).toBe("$129");
      expect(card("US", "Pro", us)?.badge).toBe("Save $50");
      expect(card("US", "Pro", us)?.note).toBe("Goes to $179/yr on 20 Oct");
      expect(pricingFor("US", 50, "ip", us).footnote).toMatch(
        /^Lower prices for Pro and Lifetime in/,
      );
    });

    it("uses a partial answer where it has one and the table for the rest", () => {
      const onlyAnnual = { everything_annual: india.everything_annual };
      expect(card("IN", "Pro", onlyAnnual)?.caption).toContain("with tax");
      expect(card("IN", "Lifetime", onlyAnnual)?.price).toBe("₹9,499");
      expect(card("IN", "Commercial", onlyAnnual)?.price).toBe("$499");
    });
  });
});
