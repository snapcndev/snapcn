import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";
import { totalFrames } from "./timeline";

export const typeMorphConfig: ComponentConfig = {
  componentName: "TypeMorph",
  importPath: "@/components/snap-cn/type-morph",
  controls: {
    lead: { type: "text", default: "Not just ", label: "Lead (cut away)" },
    emphasis: { type: "text", default: "communicator.", label: "Emphasis" },
    morphTo: { type: "text", default: "something more.", label: "Morphs into" },
    finally_: { type: "text", default: "more.", label: "Final word" },
    // The reference's violet, not the design system's accent. The component
    // itself defaults `accent` to `theme.primary` so it belongs in whatever
    // project installs it; the preview quotes the measured colour so the demo
    // reproduces the reference frame for frame.
    accent: { type: "color", default: "#b3a9f9", label: "Caret & hot glyphs" },
    // The reference's paper, not the theme's warm off-white.
    background: { type: "color", default: "#ffffff", label: "Page" },
    ink: { type: "color", default: "#000000", label: "Text" },
  },
  durationInFrames: totalFrames(false),
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
