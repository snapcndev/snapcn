import {
  Captions,
  Clapperboard,
  Hexagon,
  type LucideIcon,
  Monitor,
  Sparkles,
  Type,
  Users,
} from "lucide-react";

/**
 * Single source of truth for the components gallery (`/docs/components`).
 *
 * This module replaces the hand-authored card literals that used to live in
 * `content/docs/components.mdx`. The gallery route, the top-bar count, the
 * filter pills, and the llms.txt components index all derive from here — so the
 * component count on the page is computed (`GALLERY_ITEMS.length`), never a
 * hardcoded number that can silently drift from reality. (Naming the current
 * total in this comment would recreate exactly that drift, so it doesn't.)
 */

export type CategoryId =
  | "text"
  | "captions"
  | "logos"
  | "screens"
  | "social"
  | "scenes"
  | "ai-input";

export interface GalleryCategory {
  id: CategoryId;
  label: string;
}

/** Order == "Curated" order; mirrors the old CategoryPillNav literal. */
export const GALLERY_CATEGORIES: GalleryCategory[] = [
  { id: "text", label: "Text & Titles" },
  { id: "captions", label: "Captions" },
  { id: "logos", label: "Logos" },
  { id: "screens", label: "Screens & Devices" },
  { id: "social", label: "Social Proof" },
  { id: "scenes", label: "Scenes" },
  { id: "ai-input", label: "AI Chat Input" },
];

/** Icon shown in each card's bottom-left "category coin" overlay. */
export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  text: Type,
  captions: Captions,
  logos: Hexagon,
  screens: Monitor,
  social: Users,
  scenes: Clapperboard,
  "ai-input": Sparkles,
};

/**
 * Card tile shapes. Nearly every source composition is 1280×720 (16:9), so the
 * reference gallery's varied-height masonry rhythm is manufactured: each card
 * is assigned a deterministic tile shape, and its 16:9 preview is centered
 * (never cropped) on the card's flat gray mat.
 */
export type TileShape = "video" | "square" | "portrait" | "tall" | "wide";

export const TILE_RATIOS: Record<TileShape, string> = {
  video: "16 / 9",
  square: "1 / 1",
  portrait: "4 / 5",
  tall: "3 / 4",
  wide: "2 / 1",
};

export interface GalleryItem {
  name: string;
  description: string;
  category: CategoryId;
  href: string;
  /** Explicit override; otherwise a stable shape is derived by master index. */
  tile?: TileShape;
  /** ISO date the component landed. Only set on recent arrivals — it exists to
   *  feed the "New" shelf, not to be a complete changelog. See `NEW_ITEMS`. */
  added?: string;
}

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    name: "Text Reveal",
    description:
      "A cinematic zoom-out title reveal — the lead word appears large, then scales down and slides into place as the sentence sweeps in and settles",
    category: "text",
    href: "/docs/text/text-reveal",
  },
  {
    name: "Text Swell",
    description:
      "The lead word floats toward you and hangs there while the sentence assembles around it, letters bouncing up off the baseline — then the whole line falls back",
    category: "text",
    href: "/docs/text/text-swell",
  },
  {
    name: "Text Highlight",
    description:
      "Animated emphasis on one span inside a static sentence — marker, color, underline, strikethrough, or shimmer",
    category: "text",
    href: "/docs/text/text-highlight",
  },
  {
    name: "Text Swap",
    description:
      "Replace one line of text with another using exit-then-enter scheduling and five transition presets",
    category: "text",
    href: "/docs/text/text-swap",
  },
  {
    name: "Text Build",
    description:
      "Words enter one at a time while the already-placed words reflow to stay centered — as a line or a stack",
    category: "text",
    href: "/docs/text/text-build",
  },
  {
    name: "Word Flip",
    description:
      "A headline types itself out, then one word cycles on a 3D flip — anticipation dip, motion-blurred throw, zero reflow",
    category: "text",
    href: "/docs/text/word-flip",
  },
  {
    name: "Word Captions",
    description:
      "Burned-in captions in the styles big channels use — the YouTube box by default (white Roboto on a per-line black box), plus outlined and accent presets",
    category: "captions",
    href: "/docs/captions/word-captions",
    tile: "tall",
  },
  {
    name: "Karaoke Captions",
    description:
      "A caption line over any footage — the YouTube per-line black box by default, with karaoke fill, highlight-bar, and pill presets",
    category: "captions",
    href: "/docs/captions/karaoke-captions",
  },
  {
    name: "Logo Assemble",
    description:
      "A ring of image cards revolves and drains to the centre, giving birth to a simple logo that slides left as the brand name reveals to its right",
    category: "logos",
    href: "/docs/logos/logo-assemble",
    tile: "wide",
  },
  {
    name: "Logo Flicker",
    description:
      "Images flip across the screen very fast, the flicker decelerates and fades, and the logo and brand name resolve underneath",
    category: "logos",
    href: "/docs/logos/logo-flicker",
    tile: "wide",
  },
  {
    name: "Phone Frame",
    description:
      "iPhone-style device frame with a dynamic island — sways in 3D showing off a glowing ride-summary map that draws itself",
    category: "screens",
    href: "/docs/screens/phone-frame",
    tile: "tall",
  },
  {
    name: "Laptop Frame",
    description:
      "MacBook that opens, runs a notch notification, then dives into the screen until an image or video fills the frame",
    category: "screens",
    href: "/docs/screens/laptop-frame",
    tile: "wide",
  },
  {
    name: "Terminal Simulator",
    description:
      "Terminal window with chunked command playback, freeze-frame pauses, step scrolling, and an optional cursor-pinned zoom",
    category: "screens",
    href: "/docs/screens/terminal-simulator",
  },
  {
    name: "Follower Rush",
    description:
      "An X-style follower notification that piles up — avatars stack in and the count explodes, then the row bends into an undulating wave of faces",
    category: "social",
    href: "/docs/social/follower-rush",
  },
  {
    name: "Announce Title",
    description:
      "A four-shot launch title — the eyebrow rushes past the camera on a receding type plane, the name assembles on paper, and a macro pan cuts wide as the tagline builds itself last word first",
    category: "scenes",
    href: "/docs/scenes/announce-title",
    added: "2026-08-20",
  },
  {
    name: "Status Cycle",
    description:
      "A status pill whose label rolls behind a hard clip while its width springs past the target and back, then the field crossfades to a column of chips stepping up from below",
    category: "scenes",
    href: "/docs/scenes/status-cycle",
    added: "2026-08-20",
  },
  {
    name: "Product Hero",
    description:
      "Cinematic product-launch hero — two cards slide into formation as the headline reveals above",
    category: "scenes",
    href: "/docs/scenes/hero-launch",
  },
  {
    name: "Orbit Gallery",
    description:
      "A ring of feature cards orbits a central product mark, each rotating upright as it swings to the front",
    category: "scenes",
    href: "/docs/scenes/orbit-gallery",
  },
  {
    name: "Moodboard Reveal",
    description:
      "A kinetic headline with a swapping inline image, then a scattered photo gallery flies in and the camera pushes through it — dark to light — onto a hero image",
    category: "scenes",
    href: "/docs/scenes/moodboard-reveal",
    tile: "wide",
  },
  {
    name: "Search Typing",
    description:
      "A search field wider than the shot — it comes forward, types across its left half, then pages to its right half",
    category: "ai-input",
    href: "/docs/ai-input/search-typing",
  },
  {
    name: "Prompt Zoom",
    description:
      "An assistant landing screen that offers its suggestions, then cuts hard into the caret — a measured 2.547× push anchored on the text insertion point — where the prompt types itself",
    category: "ai-input",
    href: "/docs/ai-input/prompt-zoom",
    added: "2026-07-26",
  },
  {
    name: "Answer Stream",
    description:
      "The beat after send — a macro shot on the button cuts hard to the answer building itself, while the camera pulls back about a focal point above the frame to keep up with it",
    category: "ai-input",
    href: "/docs/ai-input/answer-stream",
    added: "2026-07-28",
    tile: "wide",
  },
];

export const GALLERY_COUNT = GALLERY_ITEMS.length;

/** How many components the "New" shelf holds. */
export const NEW_COUNT = 6;

/**
 * The "New" shelf — the most recently added components, newest first.
 *
 * Deliberately a *rank*, not a "within the last N days" window. A window needs
 * today's date, which the server render and the client hydration can disagree
 * about across a midnight boundary; and on a repo this young a 30-day window
 * matches every component, which is the same as matching none. A fixed count is
 * always populated, never stale, and needs no clock.
 */
export const NEW_ITEMS: GalleryItem[] = GALLERY_ITEMS.filter(
  (item) => item.added,
)
  .sort((a, b) => (b.added ?? "").localeCompare(a.added ?? ""))
  .slice(0, NEW_COUNT);

/**
 * Deterministic tile shape per card, stable regardless of the active filter or
 * sort. Explicit `item.tile` wins; otherwise a card's shape is derived from its
 * position in the master list. Cycle length 13 (coprime with the 1–4 column
 * counts) so no column ever fills with one repeated shape.
 */
const TILE_CYCLE: TileShape[] = [
  "portrait",
  "video",
  "tall",
  "square",
  "video",
  "wide",
  "portrait",
  "tall",
  "video",
  "square",
  "portrait",
  "video",
  "tall",
];

const TILE_BY_HREF = new Map<string, TileShape>(
  GALLERY_ITEMS.map((item, index) => [
    item.href,
    item.tile ?? TILE_CYCLE[index % TILE_CYCLE.length],
  ]),
);

export function resolveTile(item: GalleryItem): TileShape {
  return TILE_BY_HREF.get(item.href) ?? "video";
}

/** The last non-empty path segment of an item href, e.g. "text-reveal". */
export function slugFromHref(href: string): string {
  return href.split("/").filter(Boolean).pop() ?? "";
}

export type SortMode = "curated" | "az" | "category";

/** What the pill bar can select: a real category, the "New" shelf, or nothing. */
export type GalleryFilter = CategoryId | "new";

const CATEGORY_RANK = new Map(GALLERY_CATEGORIES.map((c, i) => [c.id, i]));

/**
 * The single source of truth for the on-screen ordered list — shared by the
 * grid (which cards to render) and the detail overlay (what prev/next walks),
 * so the two never disagree. A stable JS sort keeps curated order within groups.
 */
export function getFilteredSortedItems(
  filter: GalleryFilter | null,
  sort: SortMode,
): GalleryItem[] {
  const filtered =
    filter === "new"
      ? NEW_ITEMS
      : filter
        ? GALLERY_ITEMS.filter((item) => item.category === filter)
        : GALLERY_ITEMS;

  if (sort === "az") {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "category") {
    return [...filtered].sort(
      (a, b) =>
        (CATEGORY_RANK.get(a.category) ?? 0) -
        (CATEGORY_RANK.get(b.category) ?? 0),
    );
  }
  return filtered;
}

/** slug → item, so a deep-linked ?item= opens even when filtered out. */
export const ITEM_BY_SLUG = new Map<string, GalleryItem>(
  GALLERY_ITEMS.map((item) => [slugFromHref(item.href), item]),
);

/**
 * Every component's canonical docs path. Components no longer have standalone
 * pages — their docs render inline in the `/docs/components` overlay — so these
 * paths redirect there (see the docs catch-all route) and are kept out of the
 * sitemap.
 */
export const GALLERY_HREFS = new Set<string>(
  GALLERY_ITEMS.map((item) => item.href),
);
