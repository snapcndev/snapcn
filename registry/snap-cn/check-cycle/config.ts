import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const checkCycleConfig: ComponentConfig = {
  componentName: "CheckCycle",
  importPath: "@/components/snap-cn/check-cycle",
  controls: {
    headline: { type: "text", default: "Create your own", label: "Lead-in" },
    words: {
      type: "text",
      default: "Intros, Demos, Launches, Changelogs, Tutorials, And more",
      label: "Words (comma separated)",
    },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Theme",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // Six words: five rolls, "And more" holds, steps back to 0.8 and rests —
  // 4.504s, frame 136.
  durationInFrames: 136,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
