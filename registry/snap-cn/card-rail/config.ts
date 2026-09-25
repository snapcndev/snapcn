import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * The rail's cards, in the string form the component takes for this one-line
 * control: `picture > title > small print > tag`, `|` between cards. The same
 * nine as the component's `DEFAULT_CARDS` — the registry's own scenes, because
 * the thing a rail of cards is for is showing there are more where those came
 * from. Written out rather than imported: that module loads a font at import,
 * and the manifest scripts read this file in plain Node.
 */
const CARDS = (
  [
    ["orbit-gallery", "Orbit Gallery", 300],
    ["moodboard-reveal", "Moodboard Reveal", 150],
    ["hero-launch", "Hero Launch", 170],
    ["phone-frame", "Phone Frame", 240],
    ["count-grid", "Count Grid", 47],
    ["terminal-simulator", "Terminal Simulator", 200],
    ["logo-flicker", "Logo Flicker", 100],
    ["laptop-frame", "Laptop Frame", 240],
    ["announce-title", "Announce Title", 170],
  ] as const
)
  .map(
    ([slug, title, frames]) =>
      `https://media.snapcn.dev/demos/posters/${slug}.webp > ${title} > Scene · ${frames} frames > @snapcn/${slug}`,
  )
  .join(" | ");

export const cardRailConfig: ComponentConfig = {
  componentName: "CardRail",
  importPath: "@/components/snap-cn/card-rail",
  controls: {
    heading: { type: "text", default: "Browse scenes", label: "Title" },
    cards: {
      type: "text",
      default: CARDS,
      label: "Cards (picture > title > small print > tag | …)",
    },
    offset: {
      type: "number",
      default: 0,
      min: -400,
      max: 400,
      step: 1,
      label: "Rail start (px)",
    },
    flicks: {
      type: "number",
      default: 3,
      min: 1,
      max: 8,
      step: 1,
      label: "Flicks",
    },
    every: {
      type: "number",
      default: 30,
      min: 10,
      max: 90,
      step: 1,
      label: "Frames between flicks",
    },
    from: {
      type: "number",
      default: 0,
      min: -30,
      max: 60,
      step: 1,
      label: "Flick starts (frame)",
    },
    backdrop: { type: "text", default: "", label: "Backdrop stops (| two)" },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Theme",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // Three flicks at thirty frames apart start on 0, 30 and 60, and the last one
  // is still arriving at a second and a third — 108 lets it land and holds the
  // settled rail for a beat.
  durationInFrames: 108,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
