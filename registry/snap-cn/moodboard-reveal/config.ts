import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const moodboardRevealConfig: ComponentConfig = {
  componentName: "MoodboardReveal",
  importPath: "@/components/snap-cn/moodboard-reveal",
  controls: {
    leadIn: {
      type: "text",
      default: "that lets you",
      label: "Lead-in",
    },
    emphasis: {
      type: "text",
      default: "filter",
      label: "Emphasis word",
    },
    tailIn: {
      type: "text",
      default: "out AI.",
      label: "Tail",
    },
    heroImage: {
      type: "image",
      default: "/showcase-assets/821d815affa6496c39cbdeeec7a84603.jpg",
      label: "Hero image",
    },
    darkColor: { type: "color", default: "#0A0A0A", label: "Start background" },
    lightColor: { type: "color", default: "#E7E7E7", label: "End background" },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  durationInFrames: 150,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#0A0A0A" },
};
