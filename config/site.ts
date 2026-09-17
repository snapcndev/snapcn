import { CATALOGUE_PRICE, CATALOGUE_PROMISE } from "@/lib/plans";
import proCatalogue from "@/lib/pro-catalogue.json";
import builtRegistry from "@/public/r/registry.json";
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

export interface ProItem {
  name: string;
  title: string;
  description: string;
  /** Day it joined the catalogue, when that was after the tier was first listed. */
  added?: string;
}

/**
 * The paid components.
 *
 * Read off two committed files, never off the pro manifest: `registry/snap-cn-pro/`
 * is gitignored, so a public checkout does not have it and an import of it would
 * not compile.
 *
 * `lib/pro-catalogue.json` is written by `scripts/pro-demos.mts` and lists every
 * paid component that has a demo video — that is the live list. `public/r/registry.json`
 * is the older source: correct, but only as current as the last build that ran
 * with `SNAPCN_PRO_PUBLIC=1`, which is how this came to advertise 14 of 35.
 *
 * Title and description come along because `/pro` has to describe what somebody
 * just failed to install. Carrying them is safe for the same reason listing the
 * row is: the built index has no `files[].content`, so this is the
 * advertisement and not the source.
 */
export const PRO_ITEMS: ProItem[] = (() => {
  const byName = new Map<string, ProItem>();
  // The catalogue first: it is written from the pro manifest itself and is the
  // only list that is current. The built index is a snapshot of whichever build
  // last ran with SNAPCN_PRO_PUBLIC=1, and it had drifted to 14 of 35 — so it
  // fills gaps here rather than deciding the set.
  for (const item of proCatalogue as ProItem[]) byName.set(item.name, item);
  for (const i of builtRegistry.items) {
    if ((i as { meta?: { access?: string } }).meta?.access !== "pro") continue;
    if (byName.has(i.name)) continue;
    byName.set(i.name, {
      name: i.name,
      title: (i as { title?: string }).title ?? i.name,
      description: (i as { description?: string }).description ?? "",
    });
  }
  return [...byName.values()];
})();

/** The same list, as bare names — what every gate and lookup actually wants. */
export const PRO_NAMES: string[] = PRO_ITEMS.map((i) => i.name);

/**
 * Every name that resolves to something, free or paid.
 *
 * Deliberately *not* `INSTALL_ALL_NAMES`. A pro component has to be a name the
 * site admits exists — the middleware's unknown-name 404 fires before the route
 * that would answer 402, so without this a paying customer's `shadcn add` is
 * told the component was never real. But it must stay out of the install-all
 * command, which would otherwise hand every free reader a line that fails
 * halfway through.
 */
export const ALL_COMPONENT_NAMES: string[] = [
  ...INSTALL_ALL_NAMES,
  ...PRO_NAMES,
];

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
  /**
   * A short flag rendered beside the label — "New", "Beta".
   *
   * Deliberately a plain string rather than a date the nav can expire on its
   * own: `NAV_LINKS` is a module const read on both sides of the render, so
   * anything that reads a clock here is a hydration mismatch waiting to
   * happen. It comes off by hand. See the note on the entry that carries it.
   */
  badge?: string;
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
// editor, and other people's work. Templates stay out until they land, the same
// rule the footer keeps. Docs sits last because it is where you go once one of the first three
// has convinced you.
export const NAV_LINKS: NavLink[] = [
  { href: "/docs/components", label: "Components" },
  // The editor shipped and nothing on the site said so: it is a nav item that
  // reads exactly like the four-year-old one next to it. The flag is the whole
  // announcement. **Take it off once the editor stops being news** — a "New"
  // that outlives its release teaches people to stop reading flags.
  { href: "/docs/video-editor", label: "Video Editor", badge: "New" },
  { href: "/docs/pricing", label: "Pricing" },
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
  mcp: {
    title: "MCP Server",
    description:
      "Add the snapcn MCP server to Claude Code, Cursor, VS Code, Codex, Windsurf or Gemini CLI. Your agent searches the registry, reads real props and plans a Remotion video from a one-line brief. Included with snapcn Pro.",
  },
  pricing: {
    title: "Pricing",
    description: `The free components stay free and MIT. Pro is every Pro component, the MCP server and watermark-free 1080p exports — ${CATALOGUE_PRICE.annual} a year, ${CATALOGUE_PRICE.lifetime} once, or ${CATALOGUE_PRICE.commercial} for a team.`,
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
    description: `Around ten finished videos land on ${CATALOGUE_PROMISE.templatesOn} — a launch film, a feature walkthrough, a changelog clip — composed from the registry and ready to render with your own copy. Every one is included in Pro, and the early-bird prices run until then.`,
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

/**
 * The site-level footer columns.
 *
 * No "Components" column any more: the footer lists every component by name
 * above these, under its category, and a column of seven category links sat
 * directly above the same seven categories as headings.
 */
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Documentation",
    links: [
      { href: "/docs", label: "All docs" },
      { href: "/docs/getting-started/introduction", label: "Introduction" },
      { href: "/docs/getting-started/installation", label: "Installation" },
      { href: "/docs/getting-started/agent-skill", label: "Agent skill" },
      { href: "/docs/mcp", label: "MCP server" },
    ],
  },
  {
    // Was "Browse", and it held the docs index next to the editor while the
    // pricing page — the only page on this site that takes money — was in no
    // column at all. These are the things you can go and use.
    title: "Product",
    links: [
      { href: "/docs/components", label: "All components" },
      { href: "/docs/pricing", label: "Pricing" },
      { href: "/docs/video-editor", label: "Video editor" },
      { href: "/docs/templates", label: "Templates" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "/docs/roadmap", label: "Roadmap" },
      { href: "/docs/changelog", label: "Changelog" },
      { href: GITHUB_URL, label: "GitHub" },
      { href: `${GITHUB_URL}/issues`, label: "Issues" },
      { href: `${GITHUB_URL}/blob/main/LICENSE`, label: "MIT license" },
      { href: X_URL, label: "X" },
    ],
  },
];
