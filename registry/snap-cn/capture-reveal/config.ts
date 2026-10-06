import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const captureRevealConfig: ComponentConfig = {
  componentName: "CaptureReveal",
  importPath: "@/components/snap-cn/capture-reveal",
  controls: {
    headline: {
      type: "text",
      default: "no more | keyframes",
      label: "Headline (| breaks a line)",
    },
    capturing: {
      type: "text",
      default: "Capturing selection...",
      label: "Toast while capturing",
    },
    copied: {
      type: "text",
      default: "Copied to clipboard.",
      label: "Toast when done",
    },
    src: {
      type: "image",
      default: "https://media.snapcn.dev/stills/capture-reveal-window.webp",
      label: "Screenshot",
    },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Theme",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // 104 beats at 24 a second — the lead-in, the recording's 29 frames, the
  // settle and the outro — on a 30fps clock.
  durationInFrames: 130,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
