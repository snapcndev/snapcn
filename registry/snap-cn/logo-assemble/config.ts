import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const logoAssembleConfig: ComponentConfig = {
  componentName: "LogoAssemble",
  importPath: "@/components/snap-cn/logo-assemble",
  controls: {
    brandName: {
      type: "text",
      default: "snapcn",
      label: "Brand name",
    },
    middleText: {
      type: "text",
      default: "Cinematic components for React",
      label: "Center text",
    },
    logoSrc: {
      type: "image",
      default: "/logo/snapcn-white.png",
      label: "Logo (simple, monochrome)",
      brand: "logo",
    },
    count: {
      type: "number",
      default: 10,
      min: 5,
      max: 16,
      step: 1,
      label: "Ring images",
    },
    background: { type: "color", default: "#050505", label: "Background" },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  durationInFrames: 108,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#050505" },
};
