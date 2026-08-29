import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * The reference clip is 3.37s and cuts while the headline is still blurring out.
 * 108 frames is that clip plus a quarter of a second, so the exit lands instead
 * of being clipped mid-blur.
 *
 * `tiles` is an array of objects → not a control. What the customizer gets
 * instead are the knobs that reshape the *whole* field at once: the pull-back
 * rate, the drift and size multipliers, the fade constant and the corner radius.
 */
export const logoDriftConfig: ComponentConfig = {
  componentName: "LogoDrift",
  importPath: "@/components/snap-cn/logo-drift",
  controls: {
    headline: {
      type: "text",
      default: "Built for the stack you already use.",
      label: "Headline",
    },
    pullback: {
      type: "number",
      default: 0.1762,
      min: 0,
      max: 0.4,
      step: 0.001,
      label: "Pull-back / sec",
    },
    tileSpeed: {
      type: "number",
      default: 1,
      min: 0,
      max: 3,
      step: 0.05,
      label: "Drift",
    },
    tileScale: {
      type: "number",
      default: 1,
      min: 0.3,
      max: 2,
      step: 0.05,
      label: "Tile size",
    },
    tileFade: {
      type: "number",
      default: 0.4,
      min: 0.05,
      max: 2,
      step: 0.01,
      label: "Tile fade τ (s)",
    },
    tileRadius: {
      type: "number",
      default: 0.02,
      min: 0,
      max: 0.5,
      step: 0.01,
      label: "Tile radius",
    },
    glyphScale: {
      type: "number",
      default: 0.34,
      min: 0.1,
      max: 0.7,
      step: 0.01,
      label: "Glyph size",
    },
    wordStagger: {
      type: "number",
      default: 0.15,
      min: 0,
      max: 0.6,
      step: 0.005,
      label: "Word stagger (s)",
    },
    wordDuration: {
      type: "number",
      default: 0.14,
      min: 0.02,
      max: 1,
      step: 0.005,
      label: "Word lands in (s)",
    },
    wordScale: {
      type: "number",
      default: 1.216,
      min: 0.5,
      max: 2,
      step: 0.001,
      label: "Word arrives at",
    },
    wordBlur: {
      type: "number",
      default: 4.3,
      min: 0,
      max: 20,
      step: 0.1,
      label: "Word blur (px)",
    },
    exitAt: {
      type: "number",
      default: 3.13,
      min: 0.5,
      max: 10,
      step: 0.01,
      label: "Exit at (s)",
    },
    exitDuration: {
      type: "number",
      default: 0.34,
      min: 0.05,
      max: 2,
      step: 0.01,
      label: "Exit over (s)",
    },
    fontSize: {
      type: "number",
      default: 20,
      min: 8,
      max: 64,
      step: 0.5,
      label: "Headline size",
    },
    glow: { type: "boolean", default: true, label: "Wash" },
    glowOpacity: {
      type: "number",
      default: 0.07,
      min: 0,
      max: 0.5,
      step: 0.005,
      label: "Wash strength",
    },
    accentColor: {
      type: "color",
      default: "#3072db",
      label: "Accent",
      brand: "accent",
    },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Mode",
    },
  },
  // `speed` is appended from SHARED_CONTROLS in registry/__index__.tsx.
  durationInFrames: 108,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
