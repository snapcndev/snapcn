import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonPage } from "@/components/docs/gallery/coming-soon-page";
import { buttonVariants } from "@/components/ui/button";
import { DOCS_PAGE_META } from "@/config/site";
import { CATALOGUE_PROMISE } from "@/lib/plans";
import { cn } from "@/lib/utils";

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META["templates"];
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/templates";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/templates" },
  openGraph: {
    type: "website",
    url: "/docs/templates",
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

export default function TemplatesPage() {
  return (
    <ComingSoonPage
      title={TITLE}
      description={DESCRIPTION}
      eyebrow={`Coming ${CATALOGUE_PROMISE.templatesOn}`}
    >
      {/* The page 719 people a month reach for templates that do not exist yet
          — so it sends them to the one thing they can do today. */}
      <Link
        href="/docs/pricing?ref=templates#plans"
        className={cn(buttonVariants({ size: "lg" }), "mt-7 h-11 px-6 text-sm")}
      >
        See early-bird pricing
      </Link>
    </ComingSoonPage>
  );
}
