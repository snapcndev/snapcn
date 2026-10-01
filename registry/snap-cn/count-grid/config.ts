import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

export const countGridConfig: ComponentConfig = {
  componentName: "CountGrid",
  importPath: "@/components/snap-cn/count-grid",
  controls: {
    from: { type: "text", default: "5", label: "Count before" },
    to: { type: "text", default: "500", label: "Count after" },
    noun: { type: "text", default: "clips", label: "Noun" },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Mode",
    },
    speed: {
      type: "number",
      default: 1,
      min: 0.4,
      max: 2,
      step: 0.05,
      label: "Speed",
    },
  },
  durationInFrames: 47,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#FDFDFD" },
};
