import type { Metadata } from "next";
import { auth, getConfiguredProviders, isEmailSignInConfigured } from "@/auth";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { VideoEditor } from "@/components/video-editor/video-editor";
import { DOCS_PAGE_META } from "@/config/site";
import { planFor } from "@/lib/server/entitlements";
import {
  docsBreadcrumb,
  JsonLd,
  PUBLISHER,
  SITE_URL,
} from "@/lib/structured-data";
import { CANVAS, MAX_CLIPS, MAX_TOTAL_FRAMES } from "@/lib/video-editor/types";

const { title: TITLE, description: DESCRIPTION } =
  DOCS_PAGE_META["video-editor"];
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/video-editor";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/video-editor" },
  openGraph: {
    type: "website",
    url: "/docs/video-editor",
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

// `GalleryFrame fill`: the same rail every other /docs route gets, so the site
// nav is defined and rendered in exactly one place — but handed the viewport
// instead of a scrolling prose column, because the editor is an application.
// The rail's own collapse control is there when the canvas needs the width.
// Session is read here rather than through a client `useSession` — the page is
// already a server component, so there is no provider to mount and no loading
// flash where the editor briefly claims the export will be watermarked. After
// an OAuth round-trip the callback lands back on this URL and it simply
// re-renders with the session in hand.
/**
 * A `WebApplication`, not an article: this route is a tool, and the facts worth
 * making machine-readable are the ones a reader would otherwise have to open it
 * to learn — that it is free, needs nothing installed, and what it can render.
 * Every figure comes from the constants the editor itself enforces.
 */
const jsonLd = [
  {
    "@type": "WebApplication",
    "@id": `${SITE_URL}/docs/video-editor#app`,
    name: "snapcn Video Editor",
    url: `${SITE_URL}/docs/video-editor`,
    description: DESCRIPTION,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Compose a timeline from snapcn components",
      "Edit each clip's text, images, colours and length",
      "Add and trim a soundtrack",
      `Export an MP4 at ${CANVAS.width}×${CANVAS.height}, ${CANVAS.fps}fps`,
      `Up to ${MAX_CLIPS} clips and ${MAX_TOTAL_FRAMES / CANVAS.fps} seconds`,
      "Save and reopen projects when signed in",
    ],
    publisher: PUBLISHER,
  },
  docsBreadcrumb(TITLE, "/docs/video-editor"),
];

export default async function VideoEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // `?clip=<slug>` — the gallery's "Make a video with this" lands here, and the
  // component someone was already looking at is on the timeline before they
  // touch anything. An editor that opens empty asks a newcomer to pick from
  // thirty-three things they have not seen move; this one opens mid-thought.
  // Validated in the editor against the real registry, so a hand-typed slug is
  // ignored rather than trusted.
  const clip = (await searchParams).clip;
  const initialClip = typeof clip === "string" ? clip : undefined;
  const session = await auth().catch(() => null);
  // The plan is resolved here rather than plumbed through the session, because
  // this is the one page that needs it and a session callback would pay for the
  // lookup on every authenticated request in the app. `signedIn` still travels
  // separately: it decides whether the badge offers a sign-in or an upgrade.
  const { limits } = await planFor(session?.user?.id ?? null);

  return (
    <GalleryFrame fill>
      <JsonLd graph={jsonLd} />
      <VideoEditor
        signedIn={Boolean(session?.user)}
        canRemoveWatermark={!limits.watermark}
        initialClip={initialClip}
        providers={getConfiguredProviders()}
        emailEnabled={isEmailSignInConfigured()}
      />
    </GalleryFrame>
  );
}
