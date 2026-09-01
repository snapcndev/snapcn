import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * The reference clip is 1.078s and stops mid-word — it cuts at 0.81s and is still
 * typing "Get…" when it ends. So the duration here is the choreography's own:
 * the default prompt finishes typing at ~2.3s, plus a hold long enough to read
 * the finished line.
 */
export const promptZoomConfig: ComponentConfig = {
  componentName: "PromptZoom",
  importPath: "@/components/snap-cn/prompt-zoom",
  controls: {
    greeting: { type: "text", default: "Up late?", label: "Greeting" },
    text: {
      type: "text",
      default: "Get me a plan for tomorrow",
      label: "Prompt",
    },
    placeholder: {
      type: "text",
      default: "How can I help you today?",
      label: "Placeholder",
    },
    model: { type: "text", default: "Auto", label: "Model" },
    effort: { type: "text", default: "Medium", label: "Effort" },
    typeStart: {
      type: "number",
      default: 0.35,
      min: 0,
      max: 4,
      step: 0.01,
      label: "Type at (s)",
    },
    cutAt: {
      type: "number",
      default: 1.0,
      min: 0.1,
      max: 3,
      step: 0.01,
      label: "Cut at (s)",
    },
    zoom: {
      type: "number",
      default: 2.547,
      min: 1,
      max: 5,
      step: 0.01,
      label: "Zoom",
    },
    charsPerSecond: {
      type: "number",
      default: 18,
      min: 4,
      max: 40,
      step: 1,
      label: "Chars / second",
    },
    focusX: {
      type: "number",
      default: 0.27,
      min: 0,
      max: 1,
      step: 0.005,
      label: "Focus X",
    },
    focusY: {
      type: "number",
      default: 0.516,
      min: 0,
      max: 1,
      step: 0.005,
      label: "Focus Y",
    },
    accentColor: {
      type: "color",
      default: "#266DF0",
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
  // `chips` is an array → not a control, and defaults to none.
  durationInFrames: 90,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
