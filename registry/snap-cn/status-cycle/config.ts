import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FONT_WEIGHT_OPTIONS,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * Colour defaults are the design system's own token values, spelled out.
 *
 * The component derives them from `useSnapCnTheme` when the prop is omitted, so
 * a user who installs it inherits their palette. The customizer needs concrete
 * swatches to put in its colour inputs, and these are the same values the light
 * theme resolves to — `primary`, `background`, `foreground`, `card`, and the two
 * mixes the component would compute. Change a token in `globals.css` and these
 * want updating with it; `pnpm run check:tokens` does not cover a config file.
 */
const PRIMARY = "#3577e0";
const BACKGROUND = "#faf9f6";
const FOREGROUND = "#141414";
/** mixOklch(PRIMARY, card, 0.62) — a pale tint of the field. */
const PILL_LABEL = "rgb(178, 205, 247)";
/** card, mixOklch(card, PRIMARY, 0.14), PRIMARY — the reference's period-3 cycle. */
const CHIP_FILLS = "#ffffff, rgb(226, 236, 253), #3577e0";

export const statusCycleConfig: ComponentConfig = {
  componentName: "StatusCycle",
  importPath: "@/components/snap-cn/status-cycle",
  controls: {
    prefix: { type: "text", default: "snapcn is", label: "Prefix" },
    statuses: {
      type: "text",
      default: "animating, transitioning, rendering a scene, installed",
      label: "Statuses (comma-separated)",
    },
    chips: {
      type: "text",
      default:
        "text-reveal, phone-frame, answer-stream, word-flip, orbit-gallery",
      label: "Chips (comma-separated)",
    },
    fieldColor: { type: "color", default: PRIMARY, label: "Field (act 1)" },
    pageColor: { type: "color", default: BACKGROUND, label: "Page (act 2)" },
    pillColor: { type: "color", default: FOREGROUND, label: "Pill" },
    pillLabelColor: { type: "color", default: PILL_LABEL, label: "Pill label" },
    prefixColor: { type: "color", default: FOREGROUND, label: "Prefix ink" },
    chipFills: {
      type: "text",
      default: CHIP_FILLS,
      label: "Chip fills (comma-separated)",
    },
    chipTextColor: { type: "color", default: FOREGROUND, label: "Chip ink" },
    chipBorderColor: {
      type: "color",
      // mixOklch(border, foreground, 0.28) — the design system's own recipe for
      // carrying a hairline token up to a surface this size.
      default: "rgb(160, 160, 160)",
      label: "Chip hairline",
    },
    fontWeight: {
      type: "select",
      default: "400",
      options: FONT_WEIGHT_OPTIONS,
      label: "Status weight",
    },
    chipFontWeight: {
      type: "select",
      default: "400",
      options: FONT_WEIGHT_OPTIONS,
      label: "Chip weight",
    },
    fontSize: {
      type: "number",
      // 8.7% of 720. Left as an absolute so the slider reads in the same units
      // as every other component's font size; omit the prop entirely and the
      // component recomputes it from whatever height it is mounted at.
      default: 63,
      min: 24,
      max: 140,
      step: 1,
      label: "Status size",
    },
    chipFontSize: {
      type: "number",
      // 22.2% of 720.
      default: 160,
      min: 48,
      max: 260,
      step: 2,
      label: "Chip size",
    },
    introFrames: {
      type: "number",
      default: 24,
      min: 8,
      max: 60,
      step: 1,
      label: "Intro length",
    },
    statusHold: {
      type: "number",
      // 14 frames on the reference's 24fps clock. The width morph alone is 18
      // frames at 30, so the next swap starts while the last one is still
      // settling — that overlap is the reference's cadence, not a mistake.
      default: 18,
      min: 10,
      max: 60,
      step: 1,
      label: "Status hold",
    },
    chipStagger: {
      type: "number",
      // 0.25s is 7.5 frames at 30, which is not a frame. 8 runs the cadence 7%
      // slow; the alternative is running the whole scene at 24fps.
      default: 8,
      min: 4,
      max: 30,
      step: 1,
      label: "Chip stagger",
    },
    pillCenterY: {
      type: "number",
      // 0.5164 — the reference's lockup rides 1.6% below the frame's centre.
      default: 0.516,
      min: 0.2,
      max: 0.8,
      step: 0.004,
      label: "Lockup height",
    },
    startAt: {
      type: "number",
      default: 0,
      min: 0,
      max: 60,
      step: 1,
      label: "Start at (frames)",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // The last chip lands at frame 115 and its step settles by ~124; the rest is
  // the hold the field needs to read as finished rather than cut.
  durationInFrames: 150,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
