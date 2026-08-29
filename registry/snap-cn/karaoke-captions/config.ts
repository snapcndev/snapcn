import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

export const karaokeCaptionsConfig: ComponentConfig = {
  componentName: "KaraokeCaptions",
  importPath: "@/components/snap-cn/karaoke-captions",
  controls: {
    text: {
      type: "text",
      default: "Acme reconciles every transaction automatically",
      label: "Line text",
    },
    emphasize: {
      type: "text",
      default: "automatically",
      label: "Emphasized words (comma-separated)",
    },
    preset: {
      type: "select",
      default: "boxed",
      options: ["boxed", "karaoke", "highlight", "clean"],
      label: "Preset",
    },
    theme: {
      type: "select",
      default: "dark",
      options: ["light", "dark"],
      label: "Theme",
    },
    accentColor: {
      type: "color",
      default: "#FFE81F",
      label: "Accent",
      brand: "accent",
    },
    fontSize: {
      type: "number",
      default: 0,
      min: 0,
      max: 96,
      step: 1,
      label: "Font size",
    },
    fontWeight: {
      type: "select",
      default: "0",
      options: ["400", "500", "600", "700"],
      label: "Font weight",
    },
    aspect: {
      type: "select",
      default: "landscape",
      options: ["landscape", "portrait", "square"],
      label: "Safe area",
    },

    emphasisScale: {
      type: "number",
      default: 1.08,
      min: 1,
      max: 1.2,
      step: 0.01,
      label: "Emphasis scale",
    },
  },
  durationInFrames: 150,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#FAFAFA" },
};
