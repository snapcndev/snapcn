import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * 60fps, not the shared 30: this is a slow dolly plus a fast pan, and both are
 * exactly where the extra frames show. Every duration is in *seconds* and is
 * converted against `useVideoConfig().fps`, so the choreography is identical at
 * either rate.
 */
export const searchTypingConfig: ComponentConfig = {
  componentName: "SearchTyping",
  importPath: "@/components/snap-cn/search-typing",
  controls: {
    text: {
      type: "text",
      default: "How do I make my product demo actually look expensive?",
      label: "Text",
    },
    charsPerSecond: {
      type: "number",
      default: 14,
      min: 4,
      max: 40,
      step: 1,
      label: "Chars / second",
    },
    humanize: {
      type: "number",
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.05,
      label: "Humanize",
    },
    wordPause: {
      type: "number",
      default: 1.55,
      min: 1,
      max: 4,
      step: 0.05,
      label: "Word pause",
    },
    punctuationPause: {
      type: "number",
      default: 2.2,
      min: 1,
      max: 6,
      step: 0.1,
      label: "Punctuation pause",
    },
    startDelay: {
      type: "number",
      default: 0.5,
      min: 0,
      max: 4,
      step: 0.1,
      label: "Start delay (s)",
    },
    dollyDuration: {
      type: "number",
      default: 0.8,
      min: 0.1,
      max: 4,
      step: 0.1,
      label: "Comes forward (s)",
    },
    panDuration: {
      type: "number",
      default: 0.5,
      min: 0.1,
      max: 3,
      step: 0.05,
      label: "Pan to right half (s)",
    },
    holdAfter: {
      type: "number",
      default: 0.9,
      min: 0,
      max: 6,
      step: 0.1,
      label: "Hold at front (s)",
    },
    recedeDuration: {
      type: "number",
      default: 1.2,
      min: 0,
      max: 4,
      step: 0.1,
      label: "Goes back (s)",
    },
    dolly: {
      type: "number",
      default: 1.25,
      min: 1,
      max: 2,
      step: 0.01,
      label: "Dolly (measured: 1.25)",
    },
    fieldHeight: {
      type: "number",
      default: 0.27,
      min: 0.12,
      max: 0.45,
      step: 0.005,
      label: "Field height (× frame)",
    },
    frontVisible: {
      type: "number",
      default: 0.56,
      min: 0.3,
      max: 1,
      step: 0.01,
      label: "In frame at the front",
    },
    edgeInset: {
      type: "number",
      default: 40,
      min: 0,
      max: 160,
      step: 4,
      label: "Edge inset (px)",
    },
    caretBlinksPerSecond: {
      type: "number",
      default: 1,
      min: 0,
      max: 4,
      step: 0.1,
      label: "Caret blinks / second",
    },
    caret: { type: "boolean", default: true, label: "Caret" },
    surface: {
      type: "select",
      default: "shadcn",
      options: ["shadcn", "glass"],
      label: "Surface",
    },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Mode",
    },
    icon: {
      type: "select",
      default: "search",
      options: ["search", "sparkle", "none"],
      label: "Icon",
    },
    fontWeight: {
      type: "number",
      default: 300,
      min: 100,
      max: 700,
      step: 100,
      label: "Font weight",
    },
    seed: { type: "text", default: "search-typing", label: "Seed" },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  durationInFrames: 420,
  fps: 60,
  compositionWidth: W,
  compositionHeight: H,
  // Plain white. The reference's violet is Slack's brand, not this component's —
  // and the component itself renders no background at all, so this is only what
  // the docs preview stands it on. The field reads on white off its shadow.
  // The design system's page white (#FAFAFA). The field is a #FFFFFF card on top of
  // it — that half-step is how shadcn separates a control from the page without
  // resorting to a heavy shadow.
  previewBackdrop: { type: "color", value: "#FAFAFA" },
};
