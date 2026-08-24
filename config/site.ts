import snapCnRegistry from "@/registry/snap-cn/registry.json";
import snapCnUiRegistry from "@/registry/snap-cn-ui/registry.json";

// Pastel palette used only inside demo/sample video content (code snippet
// accents). Site chrome sticks to the snapcn design system tokens — neutral
// surfaces with a single blue accent (see app/globals.css).
export const PEACH = "#FFB38E";
export const LAVENDER = "#D4B3FF";
export const MINT = "#A1EEBD";

export const GITHUB_URL = "https://github.com/snapcndev/snapcn";
export const X_URL = "https://x.com/snapcndev";

/**
 * The one place the install command is spelled.
 *
 * `@snapcn` is in the shadcn registry directory (added in shadcn-ui/ui#11386,
 * renamed from the hyphenated `@snap-cn` in #11471), so the CLI resolves the
 * namespace on its own: no `registries`
 * entry in the reader's `components.json`, no registry-item URL. Every item —
 * both `registry/*` tiers — publishes to the same flat `/r/<name>.json`, so
 * `@snapcn/<name>` addresses all of them. There is no `@snapcn-ui` namespace.
 */
export const installCommand = (name: string) =>
  `npx shadcn@latest add @snapcn/${name}`;

/** Canonical example install command shown on the landing page. */
export const INSTALL_COMMAND = installCommand("text-reveal");

export const INSTALL_ALL_NAMES: string[] = [
  ...snapCnRegistry.items,
  ...snapCnUiRegistry.items,
].map((item) => item.name);

export const INSTALL_ALL_COMMAND = `npx shadcn@latest add ${INSTALL_ALL_NAMES.map(
  (name) => `@snapcn/${name}`,
).join(" ")}`;

// snapcn design system motion: fast, subtle ease-out tweens — no bounce or
// overshoot anywhere in the site chrome.
export const EASE_OUT = {
  type: "tween" as const,
  duration: 0.2,
  ease: "easeOut" as const,
};
export const EASE_OUT_SOFT = {
  type: "tween" as const,
  duration: 0.15,
  ease: "easeOut" as const,
};

export type NavLink = {
  href: string;
  label: string;
  /** Hidden on mobile (matches the existing `hidden sm:inline` pattern). */
  smOnly?: boolean;
};

// Single source of truth for the landing page's top navigation.
//
// "Components" points at the gallery, not at `/docs/text`. It used to open the
// Text & Titles category index, so the header's Components link answered with
// one of seven categories and no sign of the rest.
//
// The list had drifted to two items while the site grew to eight sections. The
// docs rail (`DOCS_SECTIONS`) lists all of them because a rail is a roadmap —
// this is a header, and it carries what has actually shipped: the gallery, the
// editor, and other people's work. Templates and Marketplace are still
// `ComingSoonPage`s and stay out until they are not, the same rule the footer
// keeps. Docs sits last because it is where you go once one of the first three
// has convinced you.
export const NAV_LINKS: NavLink[] = [
  { href: "/docs/components", label: "Components" },
  { href: "/docs/video-editor", label: "Video Editor" },
  { href: "/docs/showcase", label: "Showcase" },
  { href: "/docs", label: "Docs" },
];

/**
 * The `(gallery)` routes' SEO copy, in one place.
 *
 * These six pages are bespoke React routes, not MDX — so `source.getPage()`
 * cannot see them, and everything that reads a page's title and description
 * from the docs source silently skipped them. The OG card renderer fell back to
 * the generic site card, `llms.txt` omitted them entirely, and each page kept a
 * private copy of the two strings.
 *
 * One record, four consumers: the page's own `metadata`, `/og/<slug>`,
 * `llms.txt`, and the JSON-LD each page emits.
 */
export interface DocsPageMeta {
  title: string;
  description: string;
}

export const DOCS_PAGE_META: Record<string, DocsPageMeta> = {
  "video-editor": {
    title: "Video Editor",
    description:
      "Compose a video from snapcn components — add clips, edit text and images, and export an MP4.",
  },
  showcase: {
    title: "Showcase",
    description: "Videos built with snapcn, submitted by the community.",
  },
  changelog: {
    title: "Changelog",
    description: "Every component in snapcn, by the day it landed.",
  },
  roadmap: {
    title: "Roadmap",
    description:
      "What snapcn is, what is being built next, and what is only an idea so far.",
  },
  templates: {
    title: "Templates",
    description:
      "Whole videos, composed from the registry and ready to render — drop in your copy and export.",
  },
  marketplace: {
    title: "Marketplace",
    description:
      "Premium blocks and full scenes from the community, installed with the same shadcn CLI as everything else.",
  },
};

/**
 * The footer, by column. Single source of truth, like `NAV_LINKS`.
 *
 * Every href here is a route that exists — the component sections come from the
 * per-section `meta.json` files under `content/docs`, the gallery ones from
 * `app/docs/(gallery)`. A footer is the easiest place in a site to accumulate
 * links to pages nobody ever built, so nothing unshipped goes in this list.
 */
export type FooterColumn = { title: string; links: NavLink[] };

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Components",
    links: [
      { href: "/docs/text", label: "Text & Titles" },
      { href: "/docs/captions", label: "Captions" },
      { href: "/docs/logos", label: "Logos" },
      { href: "/docs/screens", label: "Screens & Devices" },
      { href: "/docs/social", label: "Social Proof" },
      { href: "/docs/scenes", label: "Scenes" },
      { href: "/docs/ai-input", label: "AI Chat Input" },
    ],
  },
  {
    title: "Documentation",
    links: [
      { href: "/docs/getting-started/introduction", label: "Introduction" },
      { href: "/docs/getting-started/installation", label: "Installation" },
      { href: "/docs/getting-started/agent-skill", label: "Agent skill" },
    ],
  },
  {
    title: "Browse",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/components", label: "All components" },
      // The editor shipped; the note that used to sit here calling it a
      // coming-soon page outlived the page it described. Templates and
      // Marketplace are the ones still unbuilt, and they are still absent.
      { href: "/docs/video-editor", label: "Video editor" },
      { href: "/docs/showcase", label: "Showcase" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: GITHUB_URL, label: "GitHub" },
      { href: `${GITHUB_URL}/blob/main/LICENSE`, label: "MIT license" },
      { href: `${GITHUB_URL}/issues`, label: "Issues" },
      { href: X_URL, label: "X" },
    ],
  },
];
