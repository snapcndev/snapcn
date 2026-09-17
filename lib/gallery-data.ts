import {
  Captions,
  ChartColumn,
  Clapperboard,
  Hexagon,
  type LucideIcon,
  Monitor,
  Sparkles,
  Type,
  Users,
} from "lucide-react";
import { PRO_ITEMS } from "@/config/site";
import { PRO_DEMO_BASE } from "@/lib/pro-demos";

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
  | "charts"
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
  { id: "charts", label: "Charts & Stats" },
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
  charts: ChartColumn,
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
  /** ISO date the component landed, from the commit that introduced it. Set on
   *  every item: it feeds both the "New" shelf and `/docs/changelog`, and a
   *  changelog with holes in it is worse than no changelog. */
  added?: string;
  /**
   * A paid component. Its card plays a video off the CDN and nothing else —
   * there is no registry entry to mount a `<Player>` from, no doc page, and no
   * install command that would resolve. See `PRO_GALLERY_ITEMS`.
   */
  pro?: boolean;
}

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    name: "Launch Video",
    description:
      "A whole product launch video in one install — a title, a highlighted claim, your app on a phone, a follower count and a wordmark outro, five components cut together into 21 seconds",
    category: "scenes",
    href: "/docs/scenes/launch-video",
    added: "2026-09-15",
  },
  {
    name: "Card Rail",
    description:
      "A rail of cards flicked sideways across a tilted plane — pushed three times, each flick leaving at speed and decelerating for over a second into the next, while the plane's foot runs a fifth wider than its head",
    category: "scenes",
    href: "/docs/scenes/card-rail",
    added: "2026-09-12",
  },
  {
    name: "Logo Collapse",
    description:
      "A stack of shots flicked through, collapsing into your mark, and the wordmark landing beside it — each card smaller and held for less time than the last, cutting rather than tweening, until the stack resolves into a logo",
    category: "logos",
    href: "/docs/logos/logo-collapse",
    added: "2026-09-12",
  },
  {
    name: "Channel Thread",
    description:
      "A work chat filling itself in — faces, a name in bold, a quiet timestamp and messages as plain lines on a dark stage; three dots hold a line until the words arrive, and the transcript scrolls once per arrival and is perfectly still in between",
    category: "social",
    href: "/docs/social/channel-thread",
    added: "2026-09-12",
  },
  {
    name: "Word Wheel",
    description:
      "A column of words that spins like a reel and stops on one of them — the lead-in holds the left of the line while the answer rolls into the slot beside it, decelerating over a second and three quarters",
    category: "text",
    href: "/docs/text/word-wheel",
    added: "2026-09-12",
  },
  {
    name: "Word Gather",
    description:
      "A sentence that arrives one word at a time, out of order, and gathers — the first word holds the frame alone, then the rest drop in around it in the accent colour and slide the last of the way home",
    category: "text",
    href: "/docs/text/word-gather",
    added: "2026-09-11",
  },
  {
    name: "Type Morph",
    description:
      "A headline that types itself under a glowing caret, sheds its lead, morphs letter by letter, and ends under a colour flood",
    category: "text",
    href: "/docs/text/type-morph",
    added: "2026-08-25",
  },
  {
    name: "Text Reveal",
    description:
      "A cinematic zoom-out title reveal — the lead word appears large, then scales down and slides into place as the sentence sweeps in and settles",
    category: "text",
    href: "/docs/text/text-reveal",
    added: "2026-07-24",
  },
  {
    name: "Punch Lines",
    description:
      "Full-frame title cards that cut hard between beats — a statement flicked in line by line and rushed past the camera, then a hero line whose words punch up from a third of their size",
    category: "text",
    href: "/docs/text/punch-lines",
    added: "2026-09-03",
  },
  {
    name: "Text Swell",
    description:
      "The lead word floats toward you and hangs there while the sentence assembles around it, letters bouncing up off the baseline — then the whole line falls back",
    category: "text",
    href: "/docs/text/text-swell",
    added: "2026-07-24",
  },
  {
    name: "Text Highlight",
    description:
      "Animated emphasis on one span inside a static sentence — marker, color, underline, strikethrough, or shimmer",
    category: "text",
    href: "/docs/text/text-highlight",
    added: "2026-07-24",
  },
  {
    name: "Text Rewrite",
    description:
      "A line writes itself, is selected, then has its opening swept away by a clip that cuts letters in half — and a new ending written on while it slides to its new centre",
    category: "text",
    href: "/docs/text/text-rewrite",
    added: "2026-08-26",
  },
  {
    name: "Text Select",
    description:
      "A line that writes itself a word at a time — each arriving in the accent and cooling a beat later, so one word is ever coloured — then pushes forward to full size and gets selected under a shining gradient",
    category: "text",
    href: "/docs/text/text-select",
    added: "2026-08-26",
  },
  {
    name: "Text Swap",
    description:
      "Replace one line of text with another using exit-then-enter scheduling and five transition presets",
    category: "text",
    href: "/docs/text/text-swap",
    added: "2026-07-24",
  },
  {
    name: "Text Build",
    description:
      "Words enter one at a time while the already-placed words reflow to stay centered — as a line or a stack",
    category: "text",
    href: "/docs/text/text-build",
    added: "2026-07-24",
  },
  {
    name: "Word Flip",
    description:
      "A headline types itself out, then one word cycles on a 3D flip — anticipation dip, motion-blurred throw, zero reflow",
    category: "text",
    href: "/docs/text/word-flip",
    added: "2026-07-24",
  },
  {
    name: "Word Captions",
    description:
      "Burned-in captions in the styles big channels use — the YouTube box by default (white Roboto on a per-line black box), plus outlined and accent presets",
    category: "captions",
    href: "/docs/captions/word-captions",
    added: "2026-07-24",
    tile: "tall",
  },
  {
    name: "Karaoke Captions",
    description:
      "A caption line over any footage — the YouTube per-line black box by default, with karaoke fill, highlight-bar, and pill presets",
    category: "captions",
    href: "/docs/captions/karaoke-captions",
    added: "2026-07-24",
  },
  {
    name: "Logo Drift",
    description:
      "A field of stack tiles drifting past a headline while the camera pulls steadily back, so the wall of things-it-works-with keeps arriving from every edge",
    category: "logos",
    href: "/docs/logos/logo-drift",
    added: "2026-08-26",
    tile: "wide",
  },
  {
    name: "Logo Assemble",
    description:
      "A ring of image cards revolves and drains to the centre, giving birth to a simple logo that slides left as the brand name reveals to its right",
    category: "logos",
    href: "/docs/logos/logo-assemble",
    added: "2026-07-24",
    tile: "wide",
  },
  {
    name: "Logo Flicker",
    description:
      "Images flip across the screen very fast, the flicker decelerates and fades, and the logo and brand name resolve underneath",
    category: "logos",
    href: "/docs/logos/logo-flicker",
    added: "2026-07-24",
    tile: "wide",
  },
  {
    name: "Block Wordmark",
    description:
      "A square scales in, a deck of coloured cards fans out around it and winds back, then the stack stretches into one block per letter and each block flashes a colour and swaps for its real letterform",
    category: "logos",
    href: "/docs/logos/block-wordmark",
    added: "2026-08-23",
    tile: "wide",
  },
  {
    name: "Phone Frame",
    description:
      "iPhone-style device frame with a dynamic island — sways in 3D showing off a glowing ride-summary map that draws itself",
    category: "screens",
    href: "/docs/screens/phone-frame",
    added: "2026-07-24",
    tile: "tall",
  },
  {
    name: "Laptop Frame",
    description:
      "MacBook that opens, runs a notch notification, then dives into the screen until an image or video fills the frame",
    category: "screens",
    href: "/docs/screens/laptop-frame",
    added: "2026-07-24",
    tile: "wide",
  },
  {
    name: "Terminal Simulator",
    description:
      "Terminal window with chunked command playback, freeze-frame pauses, step scrolling, and an optional cursor-pinned zoom",
    category: "screens",
    href: "/docs/screens/terminal-simulator",
    added: "2026-07-24",
  },
  {
    name: "Screen Recording",
    description:
      "Crops the browser and OS chrome off a raw screen capture, fits what is left to the frame, and runs a keyframed camera that pushes in on whatever matters",
    category: "screens",
    href: "/docs/screens/screen-recording",
    added: "2026-08-29",
    tile: "wide",
  },
  {
    name: "Cursor Track",
    description:
      "A synthetic cursor that walks a path of waypoints over any children and pulses a click ring on arrival — for sims, and for recordings whose cursor never made the file",
    category: "screens",
    href: "/docs/screens/cursor-track",
    added: "2026-08-29",
  },
  {
    name: "Follower Rush",
    description:
      "An X-style follower notification that piles up — avatars stack in and the count explodes, then the row bends into an undulating wave of faces",
    category: "social",
    href: "/docs/social/follower-rush",
    added: "2026-07-24",
  },
  {
    name: "Count Grid",
    description:
      "A grid of cards rushes in under a horizontal smear and settles on five, then the camera pulls back a fraction while every empty cell fills in from the middle out and the count jumps from five to five hundred",
    category: "scenes",
    href: "/docs/scenes/count-grid",
    added: "2026-09-06",
    tile: "wide",
  },
  {
    name: "Roster Grant",
    description:
      "Three rows of roster cards stream past a call to action, a pointer walks in and clicks it, and the monograms start turning to the accent one every seven frames — top, middle, bottom, top, bottom, middle",
    category: "scenes",
    href: "/docs/scenes/roster-grant",
    added: "2026-09-07",
  },
  {
    name: "Wordmark Cut",
    description:
      "A wordmark twice the width of the frame, cooling from a lit gradient to ink as it settles, then a hard cut onto its last letters and the dot — nearer, shallower, and pushing in",
    category: "scenes",
    href: "/docs/scenes/wordmark-cut",
    added: "2026-09-07",
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
    added: "2026-07-24",
  },
  {
    name: "Orbit Gallery",
    description:
      "A ring of feature cards orbits a central product mark, each rotating upright as it swings to the front",
    category: "scenes",
    href: "/docs/scenes/orbit-gallery",
    added: "2026-07-24",
  },
  {
    name: "Moodboard Reveal",
    description:
      "A kinetic headline with a swapping inline image, then a scattered photo gallery flies in and the camera pushes through it — dark to light — onto a hero image",
    category: "scenes",
    href: "/docs/scenes/moodboard-reveal",
    added: "2026-07-24",
    tile: "wide",
  },
  {
    name: "Search Typing",
    description:
      "A search field wider than the shot — it comes forward, types across its left half, then pages to its right half",
    category: "ai-input",
    href: "/docs/ai-input/search-typing",
    added: "2026-07-24",
  },
  {
    name: "Prompt Send",
    description:
      "A composer that unrolls from a hairline, writes a brief while the camera cuts in and rides the caret, then cuts back out as a pointer arrives and sends it — with typing that eases in and out instead of ticking",
    category: "ai-input",
    href: "/docs/ai-input/prompt-send",
    added: "2026-08-26",
    tile: "wide",
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
  {
    name: "Answer Highlight",
    description:
      "A question, an answer that writes itself a word at a time, then a caret lands mid-sentence and drags a selection across the one statement that matters — and settles onto one word inside it",
    category: "ai-input",
    href: "/docs/ai-input/answer-highlight",
    added: "2026-08-28",
    tile: "wide",
  },
  {
    name: "Agent Steps",
    description:
      "An agent narrating its own work — a log that writes itself one line at a time, always on the centre line, then swells and clears until only the answer is left",
    category: "ai-input",
    href: "/docs/ai-input/agent-steps",
    added: "2026-08-28",
    tile: "wide",
  },
];

export const GALLERY_COUNT = GALLERY_ITEMS.length;

/**
 * The categories the free catalogue actually fills — for the surfaces that
 * count or play installable components (the landing page's tiles, the video
 * editor's library, the llms install table).
 *
 * "Charts & Stats" is paid-only today, so in those lists it would be an empty
 * tab or a "0". It still has a docs index and pages; it is only the free-only
 * lists it stays out of. Derived rather than hand-listed, so the day a free
 * chart ships it appears in them without anyone coming back here.
 */
export const FREE_CATEGORIES = GALLERY_CATEGORIES.filter((category) =>
  GALLERY_ITEMS.some((item) => item.category === category.id),
);

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

/**
 * Which shelf each paid component belongs on.
 *
 * The built registry carries a pro component's name and description (see
 * `PRO_ITEMS`) but not its category — nothing server-side needed one until the
 * gallery started listing them beside the free work. Fourteen literals rather
 * than a guess off the slug: "lcd-type" is a screen, not type, and no rule
 * derived from the name gets that right.
 */
const PRO_CATEGORY: Record<string, CategoryId> = {
  // Text & titles
  manifesto: "text",
  "read-through": "text",
  "word-settle": "text",
  "sentence-set": "text",
  "phrase-swarm": "text",
  "word-rush": "text",
  "stretch-word": "text",
  "say-it": "text",
  "focus-pull": "text",
  "cross-out": "text",
  "wall-cut": "text",
  "pack-up": "text",
  // Logos
  "lockup-reveal": "logos",
  // Screens & devices
  "lcd-type": "screens",
  "app-reveal": "screens",
  "picker-commit": "screens",
  "build-out": "screens",
  "gallery-push": "screens",
  "phone-pitch": "screens",
  "brief-send": "screens",
  "string-hero": "screens",
  "tap-through": "screens",
  "screen-wall": "screens",
  "laptop-open": "screens",
  "checkout-push": "screens",
  // Charts & stats — sorted off the rendered frames, not the names. Each one's
  // subject is a plot or a number: a scatter plot, a hex unit chart, a line
  // chart, a bar histogram, a payout figure, and a balance (on a phone, but the
  // phone never moves; the number is the shot).
  "scatter-bloom": "charts",
  "hex-tally": "charts",
  "ticker-climb": "charts",
  "metric-morph": "charts",
  "tally-rise": "charts",
  "vault-count": "charts",
  // Scenes
  "showcase-drift": "scenes",
  "version-drop": "scenes",
  "render-wall": "scenes",
  "proof-line": "scenes",
  "word-montage": "scenes",
  "orbit-flow": "scenes",
  "library-flight": "scenes",
  "wire-feed": "scenes",
  // Social proof
  "chat-thread": "social",
  "comment-storm": "social",
  "thank-you-swarm": "social",
  // AI chat input
  "agent-chat": "ai-input",
  "agent-open": "ai-input",
  "agent-run": "ai-input",
  "agent-tools": "ai-input",
  "prompt-dive": "ai-input",
  "files-drop": "ai-input",
};

/**
 * The paid components, as gallery cards.
 *
 * Deliberately NOT part of `GALLERY_ITEMS`. That list is the free, MIT,
 * installable catalogue and half the site counts it — the landing page's
 * headline number, the FAQ, the changelog, the sitemap, llms.txt, the "related
 * components" rail. A paid component belongs in none of those: it is not
 * free, not MIT, and its install command answers 402 without a key. It belongs in exactly one place, the shop window,
 * and `CATALOGUE_ITEMS` below is that window.
 *
 * Name and description come from the built registry, which has published them
 * since the tier shipped, so there is no second copy to keep in step.
 *
 * The card links to `/docs/<category>/<slug>`, a page of its own: the video, the
 * description, the price and a FAQ. It used to be `/pro/<slug>`, a redirect to
 * pricing — forty-four components nobody could find by searching for what they
 * do, and a 404 behind every `docs` link the pro registry hands the CLI.
 *
 * Empty when there is no CDN — see `PRO_DEMO_BASE`. A pro card with no video is
 * just a grey box that cannot be bought.
 */
/** The day the paid catalogue went into the grid. */
const PRO_LISTED = "2026-09-12";

export const PRO_GALLERY_ITEMS: GalleryItem[] = PRO_DEMO_BASE
  ? PRO_ITEMS.filter((item) => PRO_CATEGORY[item.name]).map((item) => ({
      name: item.title,
      description: item.description,
      category: PRO_CATEGORY[item.name],
      href: `/docs/${PRO_CATEGORY[item.name]}/${item.name}`,
      pro: true,
      // The day the catalogue became visible, not the day each component was
      // written — which is the honest date for a tier that was finished and
      // unlisted. It is what the changelog groups them under. A component that
      // joined later carries its own day, or it would be backdated to this one.
      added: item.added ?? PRO_LISTED,
    }))
  : [];

/**
 * The free catalogue with the paid one spread evenly through it.
 *
 * Interleaved rather than appended, and rather than given a shelf of its own:
 * a "Pro" pill is a thing to not click, and a block of paid cards at the bottom
 * of a long grid is a block nobody scrolls to. Spread through the curated order
 * they are seen by someone already looking at the free work, which is the only
 * moment the price is an easy question.
 *
 * The spacing is computed, not authored: free length over paid count plus one,
 * so the gap scales as either list grows and no position here goes stale the
 * next time a component ships.
 *
 * A fractional gap, rounded per card — not a whole-number modulo. With 41 free
 * and 14 paid the true gap is 2.73, and flooring it to 2 put all fourteen paid
 * cards inside the first 42 slots and left the last third of the grid without
 * one. The rounding spreads them over the whole list instead.
 *
 * Walked as one merge, each slot going to whichever list is further behind its
 * share, so it still holds once the paid tier outgrows the free one (44 to 41):
 * a slot-per-paid-card scheme had two cards wanting one slot and parked the
 * losers together at the end of the grid.
 */
function withPro(free: GalleryItem[], paid: GalleryItem[]): GalleryItem[] {
  if (paid.length === 0) return free;
  const total = free.length + paid.length;
  const out: GalleryItem[] = [];
  let f = 0;
  let p = 0;
  for (let i = 0; i < total; i++) {
    // Whichever list has got through less of itself goes next; free wins a tie.
    const takePaid =
      p < paid.length &&
      (f >= free.length ||
        (p + 1) / (paid.length + 1) < (f + 1) / (free.length + 1));
    const item = takePaid ? paid[p++] : free[f++];
    if (item) out.push(item);
  }
  return out;
}

/** Everything the gallery shows, free and paid, in curated order. */
export const CATALOGUE_ITEMS: GalleryItem[] = withPro(
  GALLERY_ITEMS,
  PRO_GALLERY_ITEMS,
);

/**
 * How many cards the grid holds — free and paid.
 *
 * Deliberately separate from `GALLERY_COUNT`, which is the free, MIT,
 * installable count and is what the landing page, the FAQ and the roadmap
 * claim. This one exists for surfaces that label the grid itself, where saying
 * 41 above 76 cards is just wrong.
 */
export const CATALOGUE_COUNT = CATALOGUE_ITEMS.length;

/** What the pill bar can select: a real category, the "New" shelf, or nothing. */
export type GalleryFilter = CategoryId | "new";

/**
 * The single source of truth for the on-screen ordered list — shared by the
 * grid (which cards to render) and the detail overlay (what prev/next walks),
 * so the two never disagree. Order is always the curated one: a sort control
 * shipped alongside this and 2,546 of 2,593 uses left it on "curated", so the
 * two alternatives were deleted rather than kept as a setting nobody moved.
 */
export function getFilteredItems(filter: GalleryFilter | null): GalleryItem[] {
  return filter === "new"
    ? NEW_ITEMS
    : filter
      ? CATALOGUE_ITEMS.filter((item) => item.category === filter)
      : CATALOGUE_ITEMS;
}

/**
 * The changelog: every component grouped by the day it landed, newest first.
 *
 * Derived from the same `added` field the "New" shelf ranks on, so there is one
 * date per component and no second list to keep in step. A component with no
 * `added` is omitted rather than bucketed under "unknown" — the gap is visible
 * in the count on the page, which is the pressure to go and date it.
 *
 * Defaults to the free list because the RSS feed promises things you can go and
 * install; the changelog page passes `CATALOGUE_ITEMS` and labels the paid ones,
 * because "what shipped, and when" is a worse page for leaving out half of it.
 */
export function itemsByReleaseDate(
  items: GalleryItem[] = GALLERY_ITEMS,
): { date: string; items: GalleryItem[] }[] {
  const buckets = new Map<string, GalleryItem[]>();
  for (const item of items) {
    if (!item.added) continue;
    const bucket = buckets.get(item.added);
    if (bucket) bucket.push(item);
    else buckets.set(item.added, [item]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

/** slug → item, so a deep-linked ?item= opens even when filtered out. */
export const ITEM_BY_SLUG = new Map<string, GalleryItem>(
  CATALOGUE_ITEMS.map((item) => [slugFromHref(item.href), item]),
);

/**
 * The item behind a docs URL, or null for a page that is not a component.
 *
 * The docs route uses it to enrich a component's page with the two facts only
 * this file knows: the day it shipped (`datePublished`) and the demo mp4 that
 * belongs to it (`VideoObject`).
 */
export function galleryItemByHref(href: string): GalleryItem | null {
  return GALLERY_ITEMS.find((item) => item.href === href) ?? null;
}

/**
 * The paid item behind `/docs/<category>/<slug>`, matched on the slug alone.
 *
 * The category is not checked on purpose: the pro registry's `docs` links were
 * written before the categories were sorted (36 of them say `scenes`), and they
 * are baked into what buyers' CLIs print. The page redirects any of those to the
 * item's own `href`.
 */
export function proItemBySlugs(slugs: string[] = []): GalleryItem | null {
  const item = slugs.length === 2 ? ITEM_BY_SLUG.get(slugs[1]) : undefined;
  return item?.pro ? item : null;
}
