import type { Metadata } from "next";
import { auth } from "@/auth";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { DOCS_PAGE_META } from "@/config/site";
import { FOUNDER_SEATS } from "@/lib/plans";
import { planFor, seatsTaken } from "@/lib/server/entitlements";
import { docsBreadcrumb, JsonLd } from "@/lib/structured-data";
import { PricingPlans } from "./pricing-plans";

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META.pricing;
const OG_IMAGE = "/og/pricing";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/pricing" },
  openGraph: {
    type: "website",
    url: "/docs/pricing",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "snapcn",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const jsonLd = [docsBreadcrumb(TITLE, "/docs/pricing")];

/**
 * The copy, as data. Deliberately prose rather than numbers pulled out of
 * `PLANS`: what a buyer reads is "1080p instead of 720p", not a pixel ceiling,
 * and deriving that sentence from `maxWidth` would be a conversion nobody can
 * check at a glance.
 *
 * The cost is that a pricing change is two files. `lib/plans.ts` is the one
 * that decides what anybody actually gets — this page only describes it, so a
 * drift here is wrong copy rather than a wrong entitlement.
 */
const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "",
    blurb: "The editor, in full. No card, no account needed to start.",
    features: [
      "Export as many videos as you need",
      "720p, with a small snapcn mark",
      "All 33 components, MIT",
      "Saved projects once you sign in",
    ],
    cta: "No card needed",
  },
  {
    name: "Starter",
    price: "$19",
    cadence: "/mo",
    blurb: "Your video, your brand, nobody else's mark on it.",
    features: [
      "No watermark",
      "1080p instead of 720p",
      "Hosted links that never expire",
      "Soundtrack uploads and saved projects",
    ],
    product: "starter" as const,
    annual: {
      product: "starter_annual" as const,
      label: "or $190 a year — two months free",
    },
    cta: "Remove the watermark",
  },
  // The catalogue. These two are the only tiers whose plan has `components:
  // true`, which is the whole of the entitlement — everything above sells the
  // editor, and the registry is a separate purchase.
  {
    name: "Founder",
    price: "$99",
    cadence: "/year",
    blurb:
      "Every pro component, and every one that ships while your year runs.",
    features: [
      "The whole pro catalogue",
      "New components as they land",
      "Installed with the shadcn CLI you already use",
      "Yours outright — the files are copied into your project",
    ],
    product: "founder" as const,
    cta: "Take a founder seat",
    featured: true,
  },
  {
    name: "Lifetime",
    price: "$199",
    cadence: " once",
    blurb: "The same catalogue, bought outright. Nothing to renew.",
    features: [
      "The whole pro catalogue",
      "Every component that ships from here on",
      "One payment, no renewal",
      "Yours outright — the files are copied into your project",
    ],
    product: "lifetime" as const,
    cta: "Buy it outright",
  },
  // The Template Pack tier is deliberately absent until the templates exist.
  // `pack` stays in CHECKOUT_PRODUCTS and the webhook still recognises it, so
  // putting the card back is re-adding this block and nothing else — but a buy
  // button is a promise, and today `payment.succeeded` for a pack logs a line
  // and delivers nothing. Selling $199 of files with no delivery path is a
  // refund queue, not revenue.
];

export default async function PricingPage() {
  const session = await auth().catch(() => null);
  const { plan } = await planFor(session?.user?.id ?? null);
  // Read at render, not baked at build: the whole point of a seat counter is
  // that it is smaller than it was the last time you looked.
  const taken = await seatsTaken();
  const left = Math.max(0, FOUNDER_SEATS - taken);
  const tiers = TIERS.map((tier) =>
    tier.product === "founder"
      ? {
          ...tier,
          note:
            left > 0
              ? `${left} of ${FOUNDER_SEATS} founder seats left · $149 from 30 Sep`
              : "Founder seats are gone · $149 from 30 Sep",
        }
      : tier.product === "lifetime"
        ? { ...tier, note: "$299 from 20 Oct" }
        : tier,
  );

  return (
    <GalleryFrame>
      <JsonLd graph={jsonLd} />
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
        <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
          {TITLE}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground text-sm">
          {DESCRIPTION}
        </p>

        <div className="mt-8">
          <PricingPlans
            tiers={tiers}
            signedIn={Boolean(session?.user)}
            currentPlan={plan}
          />
        </div>

        {/* The question every developer reading this page is actually asking.
            Answering it plainly is cheaper than having it asked in a Show HN
            thread — and the answer is genuinely good for us: the components
            being free is why anybody is on this page at all. */}
        <p className="mt-8 max-w-2xl text-muted-foreground text-xs leading-relaxed">
          The components are MIT and always will be — install them, render
          locally with <code>npx remotion render</code>, and you never owe us
          anything. What a plan buys is our machines doing the rendering, and
          the hosting of what comes out.
        </p>
      </div>
    </GalleryFrame>
  );
}
