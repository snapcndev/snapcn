import { CATALOGUE_COUNT, GALLERY_COUNT } from "@/lib/gallery-data";

/**
 * The roadmap, as data.
 *
 * It lived inside the page component, which meant the only way to read it was
 * to render the page — so `/llms.txt` could not carry it, and an agent asked
 * "does snapcn do templates yet?" had nothing to answer from. It is the most
 * answerable page on the site and it was the one nothing could quote.
 */
export type Stage = "shipped" | "building" | "next" | "exploring";

export const STAGE_LABEL: Record<Stage, string> = {
  shipped: "Shipped",
  building: "Building",
  next: "Next",
  exploring: "Exploring",
};

/**
 * Dates only on `building`.
 *
 * A date on something not yet started is a guess, and the first guess missed
 * costs more trust than the whole page buys. A date on something already in
 * progress is a commitment someone can hold us to — which is the only kind
 * worth printing. The line at the top of the page says which rule is in force,
 * so the *absence* of a date reads as discipline rather than evasion.
 * `Exploring` means exactly that: it may never ship.
 *
 * Every `href` here must resolve. A roadmap that links to a 404 reads as a dead
 * project, which is the opposite of the point — link the Coming Soon page.
 */
export interface RoadmapEntry {
  stage: Stage;
  title: string;
  body: string;
  href?: string;
  /** ISO date. Only ever set on a `building` entry — see the note above. */
  due?: string;
}

export const ROADMAP: RoadmapEntry[] = [
  {
    stage: "shipped",
    title: "The component registry",
    body: `${GALLERY_COUNT} free components — text animators, captions, logo stings, device frames, social proof and full scenes — installable with one shadcn command. Listed in the shadcn registry directory, so the CLI resolves @snapcn with nothing to configure.`,
    href: "/docs/components",
  },
  {
    stage: "shipped",
    title: "snap-cn-ui primitives",
    body: "Timeline-driven versions of the shadcn atoms — input, caret, and the theme and colour core the scenes paint from — so a component drops in next to your own Input and Button and belongs there.",
    href: "/docs/getting-started/installation",
  },
  {
    stage: "shipped",
    title: "The agent skill",
    body: "A reference an AI coding agent can read: every component, its props, and the archetypes they compose into. Point Claude at it and ask for a product demo.",
    href: "/docs/getting-started/agent-skill",
  },
  {
    stage: "shipped",
    title: "The pro catalogue",
    body: `${CATALOGUE_COUNT - GALLERY_COUNT} paid components on top of the free ${GALLERY_COUNT}, shown in the same grid and playing the same way — you can watch every one of them before deciding. Bought whole, never per component: a year of the catalogue, or the catalogue outright.`,
    href: "/docs/pricing",
  },
  {
    stage: "building",
    title: "A new clip every day",
    body: "The registry is the product and it is not finished. One new clip, published every day — the gap between what a demo video needs and what is in here closes by cadence rather than in batches. The changelog is the receipt.",
    href: "/docs/changelog",
  },
  {
    stage: "building",
    due: "2026-10-20",
    title: "Templates",
    body: "Whole videos rather than single scenes — a launch film, a feature walkthrough, a changelog clip — composed from the registry and ready to render once you drop your own copy in. Around ten land on 20 October, included in Pro.",
    href: "/docs/templates",
  },
  {
    stage: "shipped",
    title: "Video editor",
    body: "Compose a video from snapcn components in the browser — add clips, edit the text and images, export an MP4. No install and no account needed to try it.",
    href: "/docs/video-editor",
  },
  {
    stage: "next",
    title: "Code export from the editor",
    body: "Leave the editor with a Remotion project rather than only a file — the timeline you built, emitted as a <Composition> and the components it uses, in your repo. The editor composes and renders today; what it cannot yet do is hand you the source.",
    href: "/docs/video-editor",
  },
  {
    stage: "exploring",
    title: "Marketplace",
    body: "A place for components that are not ours — other people's scenes, installed the same way. Only worth building once there are enough authors to fill it.",
  },
];
