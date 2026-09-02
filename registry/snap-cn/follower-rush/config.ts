import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const followerRushConfig: ComponentConfig = {
  componentName: "FollowerRush",
  importPath: "@/components/snap-cn/follower-rush",
  controls: {
    totalFollowers: {
      type: "number-input",
      default: 5000,
      min: 10,
      max: 1000000,
      step: 100,
      label: "Total followers",
    },
    accentColor: {
      type: "color",
      default: "#266DF0",
      label: "Accent",
      brand: "accent",
    },
    theme: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Theme",
    },
    orientation: {
      type: "select",
      default: "horizontal",
      options: ["horizontal", "vertical"],
      label: "Orientation",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // `speed` is appended from SHARED_CONTROLS in registry/__index__.tsx.
  // `followers` is an array → not a control; the preview uses SAMPLE_FOLLOWERS.
  durationInFrames: 300,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  // Stands in for the timeline/notification surface the pile-up sits on.
  previewBackdrop: { type: "color", value: "#FAFAFA" },
};
