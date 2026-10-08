import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

export const fontShuffleConfig: ComponentConfig = {
  componentName: "FontShuffle",
  importPath: "@/components/snap-cn/font-shuffle",
  controls: {
    lead: { type: "text", default: "Introducing", label: "Lead (stays serif)" },
    subject: { type: "text", default: "snapcn Pro", label: "Subject (tries on fonts)" },
    accent: { type: "color", default: "#9b8ed3", label: "Accent" },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Theme",
    },
  },
  // `SCENE_FRAMES`: eleven face swaps, then a 1.5s hold on the last face.
  durationInFrames: 115,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
