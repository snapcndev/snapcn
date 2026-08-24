import type { Metadata } from "next";
import { auth, getConfiguredProviders, isEmailSignInConfigured } from "@/auth";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { ShowcaseGallery } from "@/components/showcase/showcase-gallery";
import { ShowcaseHeader } from "@/components/showcase/showcase-header";
import { DOCS_PAGE_META } from "@/config/site";
import { isDbConfigured } from "@/lib/server/db";
import { getApprovedSubmissions } from "@/lib/server/showcase";
import { isHostedVideo } from "@/lib/showcase/platform";
import {
  docsBreadcrumb,
  JsonLd,
  PUBLISHER,
  SITE_URL,
} from "@/lib/structured-data";

// Reads the session (cookies) + DB per request — never prerendered.
export const dynamic = "force-dynamic";

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META["showcase"];
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/showcase";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/showcase" },
  openGraph: {
    type: "website",
    url: "/docs/showcase",
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

export default async function ShowcasePage() {
  const [items, session] = await Promise.all([
    getApprovedSubmissions(),
    auth(),
  ]);
  const providers = getConfiguredProviders();

  /**
   * The gallery, as data — and only what is true of each entry.
   *
   * A submission we host is a video on this origin, so it is a `VideoObject`
   * with the file, its thumbnail and the day it was approved. A submission that
   * is a link to someone's post is not our video and does not become one: it
   * stays a list item pointing at where it actually lives.
   */
  const jsonLd = [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/docs/showcase#page`,
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/docs/showcase`,
      publisher: PUBLISHER,
    },
    {
      "@type": "ItemList",
      name: "Videos built with snapcn",
      itemListElement: items.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: isHostedVideo(entry.postUrl)
          ? {
              "@type": "VideoObject",
              name: entry.title,
              ...(entry.description ? { description: entry.description } : {}),
              contentUrl: `${SITE_URL}${entry.postUrl}`,
              ...(entry.thumbnailUrl
                ? { thumbnailUrl: entry.thumbnailUrl }
                : {}),
              uploadDate: entry.createdAt.toISOString(),
              ...(entry.authorName
                ? { creator: { "@type": "Person", name: entry.authorName } }
                : {}),
            }
          : {
              "@type": "CreativeWork",
              name: entry.title,
              url: entry.postUrl,
              ...(entry.authorName
                ? { creator: { "@type": "Person", name: entry.authorName } }
                : {}),
            },
      })),
    },
    docsBreadcrumb(TITLE, "/docs/showcase"),
  ];

  return (
    <GalleryFrame>
      <JsonLd graph={jsonLd} />
      <DocsTopBar />
      <ShowcaseHeader
        user={session?.user ?? null}
        providers={providers}
        emailEnabled={isEmailSignInConfigured()}
      />
      <div className="pb-24">
        <ShowcaseGallery items={items} notConfigured={!isDbConfigured} />
      </div>
    </GalleryFrame>
  );
}
