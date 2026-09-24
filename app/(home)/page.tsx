import type { Metadata } from "next";
import { preload } from "react-dom";
import { PRO_ITEMS } from "@/config/catalogue";
import {
  RENDERED_DEMOS,
  renderedDemoPoster,
  renderedDemoSrc,
} from "@/lib/demo-urls";
import {
  GALLERY_CATEGORIES,
  GALLERY_COUNT,
  GALLERY_ITEMS,
} from "@/lib/gallery-data";
import { FAQ_ITEMS, Faq } from "./components/sections/faq";
import { Hero } from "./components/sections/hero";
import { HowItWorks } from "./components/sections/how-it-works";
import { Newsletter } from "./components/sections/newsletter";
import {
  ShowcaseCarousel,
  type ShowcaseSlide,
} from "./components/sections/showcase-carousel";
import { startSlot } from "./components/sections/showcase-wall";
import { WallOfLove } from "./components/sections/wall-of-love";
import { WhatYouGet } from "./components/sections/what-you-get";

const SITE_URL = "https://snapcn.dev";

/**
 * The wall's cards: the components that already have a **rendered mp4** — not
 * live `<Player>`s. Eleven Remotion players on the landing page is the whole
 * page's JS budget, and the file is what the reader actually ships anyway (see
 * `lib/rendered-demos`).
 *
 * Titles, blurbs and hrefs come from `GALLERY_ITEMS` so this section cannot
 * drift from `/docs/components`. Worked out here, on the server, and handed to
 * the (client) wall as data: the catalogue stays out of the page's JavaScript.
 */
const SLIDES: ShowcaseSlide[] = RENDERED_DEMOS.flatMap((slug) => {
  const item = GALLERY_ITEMS.find((i) => i.href.endsWith(`/${slug}`));
  const src = renderedDemoSrc(slug);
  if (!item || !src) return [];
  return [
    {
      slug,
      src,
      poster: renderedDemoPoster(slug),
      href: item.href,
      name: item.name,
      description: item.description,
    },
  ];
});

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
  // The wall is on the first screen, and its first cards show their posters
  // until the videos start. As plain `<video poster>`s they were fetched last,
  // behind every script, and read as empty boxes for the first few seconds on a
  // slow phone. A few KB each; asked for up front.
  // The row runs backwards (see `startSlot`): the cards on screen first are the
  // last four.
  for (const [i, slide] of SLIDES.entries()) {
    const slot = startSlot(i, SLIDES.length);
    if (slot >= 0 && slot < 4 && slide.poster) {
      preload(slide.poster, { as: "image", fetchPriority: "high" });
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD built from constants
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero proCount={PRO_ITEMS.length} />
      <ShowcaseCarousel slides={SLIDES} />
      <WhatYouGet />
      <HowItWorks />
      <Faq />
      <WallOfLove />
      <Newsletter />
    </>
  );
}
