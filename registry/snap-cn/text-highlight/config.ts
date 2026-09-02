import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FONT_WEIGHT_OPTIONS,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const textHighlightConfig: ComponentConfig = {
  componentName: "TextHighlight",
  importPath: "@/components/snap-cn/text-highlight",
  controls: {
    before: { type: "text", default: "Powered by ", label: "Before" },
    highlight: {
      type: "text",
      default: "Northwind",
      label: "Highlight / wordmark",
    },
    after: { type: "text", default: "", label: "After" },
    preset: {
      type: "select",
      default: "logo-wipe",
      options: [
        "logo-wipe",
        "marker",
        "color",
        "underline",
        "strikethrough",
        "shimmer",
      ],
      label: "Preset",
    },
    baseColor: { type: "color", default: "#101828", label: "Base color" },
    accentColor: {
      type: "color",
      default: "#266DF0",
      label: "Accent color",
      brand: "accent",
    },
    highlightedTextColor: {
      type: "color",
      default: "#101828",
      label: "Highlighted text color",
    },
    replaceWith: {
      type: "text",
      default: "Acme",
      label: "Replace with (strikethrough)",
    },
    startAt: {
      type: "number",
      default: 6,
      min: 0,
      max: 120,
      step: 1,
      label: "Start at (frames)",
    },
    drawDuration: {
      type: "number",
      default: 14,
      min: 5,
      max: 120,
      step: 1,
      label: "Draw duration (frames)",
    },
    thickness: {
      type: "number",
      default: 4,
      min: 1,
      max: 20,
      step: 1,
      label: "Line thickness",
    },
    shineColor: {
      type: "color",
      default: "#FAFAFA",
      label: "Shine color (shimmer)",
    },
    logoSrc: {
      // Empty on purpose: the component falls back to its built-in vector mark,
      // which is what the reader should see first — a raster placeholder here
      // only demonstrates the thing the rush is worst at. Paste or upload to
      // swap in your own.
      type: "image",
      default: "",
      label: "Logo URL",
      // The CTA is where a video signs its name, so this follows the brand kit
      // like the two logo stings do. Empty by default, so a timeline with no kit
      // keeps the built-in mark.
      brand: "logo",
    },
    logoScale: {
      type: "number",
      default: 1.05,
      min: 0.4,
      max: 3,
      step: 0.05,
      label: "Mark size (× font)",
    },
    spinTurns: {
      type: "number",
      default: 1,
      min: 0,
      max: 4,
      step: 0.25,
      label: "Mark spin (turns)",
    },
    holdDuration: {
      type: "number",
      default: 12,
      min: 0,
      max: 60,
      step: 1,
      label: "Lockup hold",
    },
    rushDuration: {
      type: "number",
      // 24, not 16. A perspective rush is back-loaded by nature — at 16 the mark spends
      // twelve frames barely moving and then does all of its growing, all of its swing
      // and all of its ink in the last three. Measured: 22% of the frame covered, then
      // 85%, then 100%. The extra frames do not slow the blow-up down, they give it
      // somewhere to happen.
      default: 24,
      min: 6,
      max: 80,
      step: 1,
      label: "Rush duration",
    },
    rushScale: {
      type: "number",
      // The floor that matters is ~22x, not 2x: below the point where the mark's own body
      // overruns the frame, its ink cannot close the left of the screen and the ending
      // has nowhere to get that colour from. The slider goes lower because a small mark
      // flying past a wordmark is a legitimate (quieter) thing to want — it just is not
      // an ending.
      default: 42,
      min: 2,
      max: 80,
      step: 1,
      label: "Rush scale (× mark)",
    },
    rushDrift: {
      type: "number",
      // Where the swing ends up. Positive is right, across the frame and out.
      default: 0.55,
      min: -0.8,
      max: 0.8,
      step: 0.05,
      label: "Swing across (× width)",
    },
    swingOut: {
      type: "number",
      // The bow — how far it arcs left on the way. Capped at a third of the width: the
      // mark rests at the left end of a centred lockup, so a long wordmark starts it near
      // the left edge already, and a bigger bow walks it off the side. A mark that leaves
      // the frame has to come back, and coming back is the one thing this must not do.
      default: 0.25,
      min: 0,
      max: 0.33,
      step: 0.01,
      label: "Swing arc (× width)",
    },
    coverColor: {
      type: "color",
      default: "#266DF0",
      label: "Ink color (end of rush)",
    },
    fontSize: {
      type: "number",
      default: 56,
      min: 12,
      max: 160,
      step: 1,
      label: "Font size",
    },
    fontWeight: {
      type: "select",
      default: "600",
      options: FONT_WEIGHT_OPTIONS,
      label: "Font weight",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // 6 start + 14 wipe + 12 hold + 24 rush. The ink closes over the last of the backdrop
  // three frames before the rush formally ends, and that is all the flat colour this
  // wants — a colour frame held for ten frames is its own kind of stuck, and was.
  durationInFrames: 56,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#FAFAFA" },
};
