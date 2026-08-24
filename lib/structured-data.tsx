import type { ReactElement } from "react";

/**
 * The JSON-LD boilerplate, once.
 *
 * The MDX docs route and the components gallery each build a `@graph` and
 * hand-roll the same `<script type="application/ld+json">` around it. The four
 * bespoke `(gallery)` routes emitted nothing at all — a video editor, a video
 * gallery, a dated changelog and a roadmap, none of them machine-readable. This
 * is what they now share.
 */

export const SITE_URL = "https://snapcn.dev";

export const PUBLISHER = {
  "@type": "Organization",
  name: "snapcn",
  url: SITE_URL,
} as const;

/**
 * Docs → Page. Two levels, because that is what these routes are — a flat
 * section under `/docs`, not a nested tree.
 */
export function docsBreadcrumb(title: string, path: string) {
  return {
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
        name: title,
        item: `${SITE_URL}${path}`,
      },
    ],
  };
}

export function JsonLd({
  graph,
}: {
  graph: Record<string, unknown>[];
}): ReactElement {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized JSON, not markup
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}
