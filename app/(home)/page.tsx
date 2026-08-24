import type { Metadata } from "next";
import { GALLERY_CATEGORIES, GALLERY_COUNT } from "@/lib/gallery-data";
import { FAQ_ITEMS, Faq } from "./components/sections/faq";
import { Hero } from "./components/sections/hero";
import { HowItWorks } from "./components/sections/how-it-works";
import { Newsletter } from "./components/sections/newsletter";
import { ShowcaseCarousel } from "./components/sections/showcase-carousel";
import { WallOfLove } from "./components/sections/wall-of-love";
import { WhatYouGet } from "./components/sections/what-you-get";

const SITE_URL = "https://snapcn.dev";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * The FAQ answers are serialised from `FAQ_ITEMS` — the same array the section
 * renders — so the structured data cannot drift from the visible text. Google
 * drops a FAQPage where the two disagree, and an assistant quoting the markup
 * would be quoting a page that no longer says it.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      name: "snapcn",
      url: SITE_URL,
      description:
        "Remotion components for product demo videos: streaming AI answers, terminal sessions, device frames, captions, logo stings and full scenes.",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}#software`,
      name: "snapcn",
      url: SITE_URL,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      // The category list must match `GALLERY_CATEGORIES`. It previously named
      // lower thirds and transitions, both of which were removed from the
      // registry — structured data claiming components that cannot be installed.
      description: `A shadcn-style registry of ${GALLERY_COUNT} Remotion components for product demo videos — text reveals, captions, AI chat input, device frames, terminal sessions, logo stings and full scenes — installed with the shadcn CLI and copied into your project as code you own.`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/license/mit",
      isAccessibleForFree: true,
      softwareRequirements: "Remotion, React, Node.js",
      author: {
        "@type": "Person",
        name: "Sri Nath",
        url: "https://x.com/SriNath693",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}#faq`,
      mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    {
      "@type": "ItemList",
      "@id": `${SITE_URL}#categories`,
      name: "snapcn component categories",
      itemListElement: GALLERY_CATEGORIES.map(({ id, label }, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: label,
        url: `${SITE_URL}/docs/${id}`,
      })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD built from constants
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <ShowcaseCarousel />
      <WhatYouGet />
      <HowItWorks />
      <Faq />
      <WallOfLove />
      <Newsletter />
    </>
  );
}
