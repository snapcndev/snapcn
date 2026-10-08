import type { Metadata } from "next";
import { ComponentsGallery } from "@/components/docs/gallery/components-gallery";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { GALLERY_ITEMS } from "@/lib/gallery-data";
import { PageJsonLd } from "@/lib/page-json-ld";

const SITE_URL = "https://snapcn.dev";
const TITLE = "Components";
const DESCRIPTION =
  "Every Remotion component in snapcn — text animations, captions, logo stings, device frames and full scenes — installed with the shadcn CLI.";
/** The `<title>`; `TITLE` is the page's own label, and the schema headline. */
const SEO_TITLE = "Remotion Components — animations, captions, scenes";

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/components" },
  openGraph: {
    type: "article",
    url: "/docs/components",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "snapcn",
    images: [{ url: "/og/components", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og/components"],
  },
};

// The card faces carry no visible text (name/description live in aria-labels),
// so an ItemList keeps every component name + URL machine-readable on this URL,
// alongside the TechArticle + breadcrumb graph the catch-all used to emit.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      headline: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/docs/components`,
      image: `${SITE_URL}/og/components`,
      author: {
        "@type": "Person",
        name: "Sri Nath",
        url: "https://x.com/SriNath693",
      },
      publisher: { "@type": "Organization", name: "snapcn", url: SITE_URL },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Docs",
          item: `${SITE_URL}/docs`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: TITLE,
          item: `${SITE_URL}/docs/components`,
        },
      ],
    },
    {
      "@type": "ItemList",
      itemListElement: GALLERY_ITEMS.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        url: `${SITE_URL}${item.href}`,
      })),
    },
  ],
};

export default function ComponentsGalleryPage() {
  return (
    <>
      <PageJsonLd graph={jsonLd["@graph"]} path="/docs/components" />
      <GalleryFrame>
        <ComponentsGallery />
      </GalleryFrame>
    </>
  );
}
