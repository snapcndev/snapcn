import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * Colour defaults are the design system's own token values, spelled out.
 *
 * The component resolves them from `useSnapCnTheme` when the prop is omitted, so
 * a user who installs it inherits their palette. The customizer needs concrete
 * swatches for its inputs, and these are what the light theme resolves to —
 * `background`, and `primary` at the head of the accent palette.
 * Change a token in `globals.css` and these want updating with it;
 * `pnpm run check:tokens` does not cover a config file.
 */
/**
 * The wordmark's ink on the site, and the one value here that is deliberately
 * not a token.
 *
 * `useSnapCnTheme` still governs the *component's* default — an installed copy
 * paints in whoever's palette it lands in, which is what makes it a shadcn
 * citizen. This is the preview, the demo mp4 and the customizer's starting
 * point, and those are snapcn's own mark, so they carry snapcn's own blue. A
 * fixed hex does not follow dark mode; the demo renders light, so it does not
 * need to.
 */
const INK = "#0000FF";
const BACKGROUND = "#faf9f6";
/**
 * `primary` and four shades of it — the same ramp `defaultColors()` builds, but
 * frozen to hex because a control value is a plain string. Keep the two in step.
 *
 * Written as hex, not `rgb(...)`: this control is comma-separated and an
 * `rgb(26, 68, 135)` would be split into three broken colours.
 */
const PALETTE = "#3072db, #1a4487, #6b9be8, #092148, #9cbdf2";

export const blockWordmarkConfig: ComponentConfig = {
  componentName: "BlockWordmark",
  importPath: "@/components/snap-cn/block-wordmark",
  controls: {
    text: { type: "text", default: "snapcn", label: "Wordmark" },
    color: { type: "color", default: INK, label: "Ink" },
    colors: {
      type: "text",
      default: PALETTE,
      label: "Deck & flash colours (comma-separated)",
    },
    background: { type: "color", default: BACKGROUND, label: "Background" },
    fontSize: {
      type: "number",
      default: 160,
      min: 48,
      max: 320,
      step: 4,
      label: "Font size",
    },
    // Ultra serves exactly one weight. Offering another gets a browser-
    // synthesised bold in the render — which on a slab this heavy thickens the
    // stems unevenly and smears the serifs — and the canvas measurement is then
    // taken off that fake face, so every block is sized wrong. One option, on
    // purpose.
    fontWeight: {
      type: "select",
      default: "400",
      options: ["400"],
      label: "Font weight",
    },
    blockSizing: {
      type: "select",
      default: "square",
      options: ["square", "glyph"],
      label: "Block sizing",
    },
    blockGap: {
      type: "number",
      default: 0.093,
      min: 0,
      max: 0.4,
      step: 0.005,
      label: "Block gap (× side)",
    },
    // `ascenderRatio` is deliberately *not* a control. `getDefaults` passes every
    // control's default as a prop, so listing it here would pin the tab to one
    // ratio for every glyph and switch off the per-glyph measurement that is the
    // whole point — and 0.40 is the reference face's number, not Inter's 0.345,
    // so the shipped preview would draw every flag too tall and step down 5px at
    // the swap. It stays a prop for a display face that needs it (see the docs).
    cornerRadius: {
      type: "number",
      default: 0.18,
      min: 0,
      max: 0.5,
      step: 0.01,
      label: "Corner radius (× side)",
    },
    cards: {
      type: "number",
      default: 6,
      min: 2,
      max: 12,
      step: 1,
      label: "Deck cards",
    },
    spinDuration: {
      type: "number",
      default: 33,
      min: 12,
      max: 90,
      step: 1,
      label: "Shuffle frames",
    },
    holdDuration: {
      type: "number",
      default: 54,
      min: 0,
      max: 150,
      step: 2,
      label: "Hold before resolve",
    },
  },
  // 94 (the resolve cue) + 10 (the last letter's stagger) + 5 (its swap) and a
  // beat and a half of the finished wordmark holding, which is what the
  // reference does.
  durationInFrames: 150,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: BACKGROUND },
};
