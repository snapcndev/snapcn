import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const heroLaunchConfig: ComponentConfig = {
  componentName: "HeroLaunch",
  importPath: "@/components/snap-cn/hero-launch",
  controls: {
    image1: {
      type: "image",
      default: "/demos/moodboard-reveal.mp4",
      label: "Left card (image/video)",
    },
    image2: {
      type: "image",
      default: "/demos/orbit-gallery.mp4",
      label: "Right card (image/video)",
    },
    heading: {
      type: "text",
      default: "npx shadcn add @snapcn",
      label: "Headline",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  durationInFrames: 170,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#050505" },
};
