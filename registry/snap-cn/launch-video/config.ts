import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const launchVideoConfig: ComponentConfig = {
  componentName: "LaunchVideo",
  importPath: "@/components/snap-cn/launch-video",
  controls: {
    headline: { type: "text", default: "Meet Acme Billing", label: "Title" },
    claimBefore: {
      type: "text",
      default: "Invoices that ",
      label: "Claim (before)",
    },
    highlight: {
      type: "text",
      default: "chase themselves",
      label: "Claim (highlighted)",
    },
    claimAfter: { type: "text", default: "", label: "Claim (after)" },
    screenSrc: {
      type: "image",
      default: "/showcase-mobile-videos/boss-energy-roundup.mp4",
      label: "Phone screen (image or video)",
    },
    followerCount: {
      type: "number",
      default: 5000,
      min: 10,
      max: 100000,
      step: 10,
      label: "Follower count",
    },
    wordmark: { type: "text", default: "acme", label: "Wordmark" },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Mode",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // LAUNCH_VIDEO_DURATION in the component: 90 + 66 + 150 + 180 + 150. Repeated
  // rather than imported, because this file is read in plain Node by the
  // manifest scripts and the component pulls in Remotion.
  durationInFrames: 636,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
