import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * The rail, and the three lists that fill it.
 *
 * They are parallel: one entry per card. The rail repeats the list rather than
 * running out, so five cards are enough to carry a flick of any length — and the
 * default five are the registry's own scenes, because the thing a rail of cards
 * is for is showing that there are more where those came from.
 */
const SHOTS =
  "https://media.snapcn.dev/demos/posters/orbit-gallery.webp|https://media.snapcn.dev/demos/posters/moodboard-reveal.webp|https://media.snapcn.dev/demos/posters/hero-launch.webp|https://media.snapcn.dev/demos/posters/phone-frame.webp|https://media.snapcn.dev/demos/posters/count-grid.webp|https://media.snapcn.dev/demos/posters/terminal-simulator.webp|https://media.snapcn.dev/demos/posters/logo-flicker.webp|https://media.snapcn.dev/demos/posters/laptop-frame.webp|https://media.snapcn.dev/demos/posters/announce-title.webp";

export const cardRailConfig: ComponentConfig = {
  componentName: "CardRail",
  importPath: "@/components/snap-cn/card-rail",
  controls: {
    heading: { type: "text", default: "Browse scenes", label: "Title" },
    images: { type: "text", default: SHOTS, label: "Pictures (| separated)" },
    titles: {
      type: "text",
      default:
        "Orbit Gallery|Moodboard Reveal|Hero Launch|Phone Frame|Count Grid|Terminal Simulator|Logo Flicker|Laptop Frame|Announce Title",
      label: "Card titles",
    },
    notes: {
      type: "text",
      default:
        "Scene · 300 frames|Scene · 150 frames|Scene · 170 frames|Scene · 240 frames|Scene · 47 frames|Scene · 200 frames|Scene · 100 frames|Scene · 240 frames|Scene · 170 frames",
      label: "Card small print",
    },
    tags: {
      type: "text",
      default:
        "@snapcn/orbit-gallery|@snapcn/moodboard-reveal|@snapcn/hero-launch|@snapcn/phone-frame|@snapcn/count-grid|@snapcn/terminal-simulator|@snapcn/logo-flicker|@snapcn/laptop-frame|@snapcn/announce-title",
      label: "Card tags",
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
