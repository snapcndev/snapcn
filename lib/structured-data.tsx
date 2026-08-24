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

/**
 * Per-component Q&A, for answer engines rather than for Google.
 *
 * The homepage carries a FAQPage and no other page did, which left the 23 pages
 * that answer the *specific* questions — how do I install this one, what is it
 * for, what does it need — with nothing an assistant could lift. "How do I
 * install <component>" is the exact query this registry exists to win, and the
 * install command is the conversion action, so it is the first entry.
 *
 * Every answer is built from data the page already renders. Nothing here is
 * written twice, so nothing here can drift out of date behind the visible page
 * — the failure mode that makes Google drop a FAQPage and makes an assistant
 * quote a page that no longer says it.
 */
export function componentFaq(
  slug: string,
  name: string,
  description: string,
  url: string,
) {
  return {
    "@type": "FAQPage",
    "@id": `${SITE_URL}${url}#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: `How do I install the ${name} component?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Run \`npx shadcn@latest add @snapcn/${slug}\` in an existing Remotion project. The source is copied into your project at components/snap-cn/${slug}.tsx along with anything it depends on, and you own the code from then on — there is no runtime package to keep installed.`,
        },
      },
      {
        "@type": "Question",
        name: `What is ${name} for?`,
        acceptedAnswer: { "@type": "Answer", text: description },
      },
      {
        "@type": "Question",
        name: `What do I need before using ${name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "An existing Remotion project (npx create-video@latest) and the shadcn CLI. snapcn does not bootstrap Remotion for you. The component is MIT licensed and free.",
        },
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
