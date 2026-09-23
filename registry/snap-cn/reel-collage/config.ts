import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const reelCollageConfig: ComponentConfig = {
  componentName: "ReelCollage",
  importPath: "@/components/snap-cn/reel-collage",
  controls: {
    topLine: { type: "text", default: "The videos", label: "Top caption" },
    bottomLine: {
      type: "text",
      default: "That you ship",
      label: "Bottom caption",
    },
    swapTop: {
      type: "text",
      default: "Especially on",
      label: "Swap, first line",
    },
    swapBottom: {
      type: "text",
      default: "Launch day",
      label: "Swap, second line",
    },
    background: { type: "color", default: "#f5f4f2", label: "Page" },
    glowColor: { type: "color", default: "#dfe7e3", label: "Glow" },
    flushColor: {
      type: "color",
      default: "#fdc7bc",
      label: "Flush",
      brand: "accent",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // The reference runs 78 frames; the rest holds the landed collage.
  durationInFrames: 96,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#f5f4f2" },
};
