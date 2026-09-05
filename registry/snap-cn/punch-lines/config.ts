import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * The default script, and the three lists that describe it.
 *
 * They are parallel on purpose: one card per `|`, one entry per card in each
 * list, and the last entry of a list repeats — so `styles` only has to name the
 * point at which the sequence settles into its hero look.
 */
const SCRIPT =
  "Ready-made scenes / for Remotion. | One command. Own it. | snapcn.";

/**
 * A title card is display type, so it starts a step up from the 500 the rest of
 * the text tier sets body copy in — but only a step. 800 reads as a shout.
 * `text-rewrite` is the reference for the face and the register: Inter, and no
 * heavier than it has to be.
 */
const WEIGHTS = ["400", "500", "600", "700"];

export const punchLinesConfig: ComponentConfig = {
  componentName: "PunchLines",
  importPath: "@/components/snap-cn/punch-lines",
  controls: {
    script: { type: "text", default: SCRIPT, label: "Script (| card, / line)" },
    styles: { type: "text", default: "slide,punch", label: "Card looks" },
    sizes: { type: "text", default: "1,0.945,2.7", label: "Card sizes" },
    holds: {
      type: "text",
      default: "48",
      label: "Card lengths (frames)",
    },
    accentBeat: {
      type: "number",
      default: 3,
      min: 0,
      max: 8,
      step: 1,
      label: "Accent card",
    },
    fontSize: {
      type: "number",
      default: 93,
      min: 24,
      max: 200,
      step: 1,
      label: "Font size",
    },
    fontWeight: {
      type: "select",
      default: "600",
      options: WEIGHTS,
      label: "Font weight",
    },
    lineHeight: {
      type: "number",
      default: 0.89,
      min: 0.7,
      max: 1.6,
      step: 0.005,
      label: "Line height (em)",
    },
    letterSpacing: {
      type: "text",
      default: "-0.022em",
      label: "Letter spacing",
    },
    wordSpacing: {
      type: "text",
      default: "-0.02em",
      label: "Word spacing",
    },
    // Mirrors `background` / `foreground` in `globals.css`, which is what the
    // component falls back to when these are unset.
    ground: { type: "color", default: "#faf9f6", label: "Ground" },
    ink: { type: "color", default: "#141414", label: "Type" },
    accentColor: {
      type: "color",
      default: "#ff1c8e",
      label: "Accent",
      brand: "accent",
    },
    lead: {
      type: "number",
      default: 4,
      min: 0,
      max: 30,
      step: 1,
      label: "Entrance lead",
    },
    slideFrom: {
      type: "number",
      default: -0.737,
      min: -3,
      max: 0,
      step: 0.01,
      label: "Slide from (em)",
    },
    slideKick: {
      type: "number",
      default: 7.34,
      min: 0,
      max: 20,
      step: 0.1,
      label: "Slide kick (em/s)",
    },
    slideSettle: {
      type: "number",
      default: 2.846,
      min: 0.5,
      max: 8,
      step: 0.05,
      label: "Slide settle",
    },
    lineStagger: {
      type: "number",
      default: 3.5,
      min: 0,
      max: 20,
      step: 0.5,
      label: "Line stagger",
    },
    slideDrop: {
      type: "number",
      default: 0.313,
      min: -1,
      max: 1,
      step: 0.01,
      label: "Slide drop (em)",
    },
    motionBlur: {
      type: "number",
      default: 1,
      min: 0,
      max: 1,
      step: 0.05,
      label: "Motion blur",
    },
    punchFrom: {
      type: "number",
      default: 0.32,
      min: 0.05,
      max: 1,
      step: 0.01,
      label: "Punch from",
    },
    punchFrames: {
      type: "number",
      default: 15,
      min: 2,
      max: 40,
      step: 0.5,
      label: "Punch",
    },
    wordStagger: {
      type: "number",
      default: 2.8,
      min: 0,
      max: 12,
      step: 0.1,
      label: "Word stagger",
    },
    pushFrom: {
      type: "number",
      default: 0.778,
      min: 0.3,
      max: 1,
      step: 0.005,
      label: "Push from",
    },
    pushRate: {
      type: "number",
      default: 0.205,
      min: 0,
      max: 1,
      step: 0.005,
      label: "Push per second",
    },
    rushLead: {
      type: "number",
      default: 12.2,
      min: 0,
      max: 40,
      step: 0.2,
      label: "Rush lead",
    },
    rushFrames: {
      type: "number",
      default: 18,
      min: 4,
      max: 60,
      step: 1,
      label: "Rush",
    },
    rushTravel: {
      type: "number",
      default: 0.85,
      min: 0.2,
      max: 0.95,
      step: 0.01,
      label: "Rush travel",
    },
    fit: {
      type: "number",
      default: 0.92,
      min: 0.4,
      max: 1,
      step: 0.01,
      label: "Fit width",
    },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Mode",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // The sum of `holds` — three cards of 48. `holds` is time on screen, so there
  // is nothing to subtract; `punchLinesDuration()` is the same arithmetic.
  durationInFrames: 144,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#faf9f6" },
};
