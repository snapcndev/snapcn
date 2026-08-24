import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/docs/gallery/coming-soon-page";
import { DOCS_PAGE_META } from "@/config/site";

const { title: TITLE, description: DESCRIPTION } =
  DOCS_PAGE_META["marketplace"];
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/marketplace";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/marketplace" },
  openGraph: {
    type: "website",
    url: "/docs/marketplace",
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

export default function MarketplacePage() {
  return <ComingSoonPage title={TITLE} description={DESCRIPTION} />;
}
