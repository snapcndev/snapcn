/**
 * Make Dodo's products agree with the price table.
 *
 *     DODO_API_KEY=… node scripts/dodo-products.mts test|live
 *
 * `CHECKOUT_PRODUCTS` and `PPP_PRICES` in lib/plans.ts are the prices; this
 * writes them. Run it once per mode, and again after a price moves (the $299
 * lifetime on 20 Oct is a one-number edit and a re-run). Prints the env lines
 * the checkout route reads.
 *
 * A product is found by `metadata.snapcn` — the same tag the checkout writes —
 * never by name, so a rename in the dashboard does not mint a duplicate. Found
 * means patched in place: a billing interval is snapshotted when a product is
 * created, so the annual row must never be deleted and re-created.
 *
 * On the `snapcn` brand, not the business default: that one is Ruixen UI, and
 * a snapcn buyer reading "Ruixen UI" on the card form is a chargeback.
 */
import {
  CATALOGUE_PROMISE,
  CHECKOUT_PRODUCTS,
  PPP_PRICES,
} from "../lib/plans.ts";

const mode = process.argv[2];
const key = process.env.DODO_API_KEY;
if ((mode !== "test" && mode !== "live") || !key) {
  console.error(
    "usage: DODO_API_KEY=… node scripts/dodo-products.mts test|live",
  );
  process.exit(1);
}

const { components, templates } = CATALOGUE_PROMISE;

const SOLD = {
  everything_annual: {
    name: "snapcn Pro — annual",
    description: `Every snapcn Pro component — growing to ${components} — ${templates} video templates as they ship, and the snapcn MCP server, plus everything that ships while your year runs. Installed with the shadcn CLI you already use; the files are copied into your project and stay yours if you stop renewing.`,
  },
  lifetime: {
    name: "snapcn Pro — lifetime",
    description: `Every snapcn Pro component, bought once — including all ${components} to come and ${templates} video templates — plus the snapcn MCP server. Installed with the shadcn CLI; the files are copied into your project and are yours.`,
  },
  commercial: {
    name: "snapcn Commercial",
    description: `snapcn Pro for a company: every Pro component (growing to ${components}), ${templates} video templates and the MCP server, licensed for client and company work by up to five people. One payment.`,
  },
} as const;

type Tag = keyof typeof SOLD;

async function dodo(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://${mode}.dodopayments.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Dodo's edge 403s some routes without one — see lib/server/dodo.ts.
      "User-Agent": "snapcn-server/1.0 (+https://snapcn.dev)",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const brand = (await dodo("GET", "/brands")).items.find(
  (b: { name: string }) => b.name === "snapcn",
);
if (!brand) throw new Error(`no "snapcn" brand in ${mode} — create it first`);

// ponytail: one page of 100. The account holds a dozen products across both
// brands; page it when that stops being true.
const products: { product_id: string; metadata?: { snapcn?: string } }[] = (
  await dodo("GET", "/products?page_size=100")
).items;

for (const tag of Object.keys(SOLD) as Tag[]) {
  const row = CHECKOUT_PRODUCTS[tag];
  const regional = Object.entries(PPP_PRICES).filter(([, p]) => tag in p) as [
    string,
    { currency: string } & Partial<Record<Tag, number>>,
  ][];

  const body = {
    ...SOLD[tag],
    tax_category: "saas",
    brand_id: brand.brand_id,
    metadata: { snapcn: tag },
    ...(regional.length ? { pricing_mode: "by_country" } : {}),
    price:
      row.kind === "subscription"
        ? {
            type: "recurring_price",
            price: row.cents,
            currency: "USD",
            discount: 0,
            purchasing_power_parity: false,
            tax_inclusive: false,
            payment_frequency_count: 1,
            payment_frequency_interval: "Year",
            subscription_period_count: 20,
            subscription_period_interval: "Year",
            trial_period_days: 0,
          }
        : {
            type: "one_time_price",
            price: row.cents,
            currency: "USD",
            discount: 0,
            purchasing_power_parity: false,
            tax_inclusive: false,
          },
  };

  const found = products.find((p) => p.metadata?.snapcn === tag);
  if (found) await dodo("PATCH", `/products/${found.product_id}`, body);
  const id: string =
    found?.product_id ?? (await dodo("POST", "/products", body)).product_id;

  // The rules follow the table exactly: changed amounts patched, a changed
  // currency replaced, a country dropped from the table removed.
  const rules: {
    id: string;
    country_code: string;
    currency: string;
    amount: number;
  }[] = (await dodo("GET", `/products/${id}/localized-prices`)).items;
  for (const rule of rules) {
    const want = regional.find(([c]) => c === rule.country_code)?.[1];
    if (!want || want.currency !== rule.currency) {
      await dodo("DELETE", `/products/${id}/localized-prices/${rule.id}`);
    } else if (want[tag] !== rule.amount) {
      await dodo("PATCH", `/products/${id}/localized-prices/${rule.id}`, {
        amount: want[tag],
      });
    }
  }
  for (const [country, want] of regional) {
    const kept = rules.find(
      (r) => r.country_code === country && r.currency === want.currency,
    );
    if (kept) continue;
    await dodo("POST", `/products/${id}/localized-prices`, {
      currency: want.currency,
      country_code: country,
      amount: want[tag],
    });
  }

  console.log(`${row.env}=${id}`);
}
