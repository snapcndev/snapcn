import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * The stack, and the two lists that time it.
 *
 * They are parallel: one entry per shot in `sizes` and `holds`. Neither series
 * is geometric and neither is a duration divided by a count — the reference
 * winds itself up, giving each shot less room than the last, and the only honest
 * way to carry that is two lists of literals the Studio can see and edit.
 *
 * The shots are the registry's own preview posters, so the sting says the thing
 * snapcn says: a great many scenes, and one library they all came out of.
 */
const SHOTS =
  "https://media.snapcn.dev/demos/posters/count-grid.webp|https://media.snapcn.dev/demos/posters/moodboard-reveal.webp|https://media.snapcn.dev/demos/posters/orbit-gallery.webp|https://media.snapcn.dev/demos/posters/hero-launch.webp|https://media.snapcn.dev/demos/posters/phone-frame.webp|https://media.snapcn.dev/demos/posters/terminal-simulator.webp";

export const logoCollapseConfig: ComponentConfig = {
  componentName: "LogoCollapse",
  importPath: "@/components/snap-cn/logo-collapse",
  controls: {
    images: { type: "text", default: SHOTS, label: "Shots (| separated)" },
    sizes: {
      type: "text",
      default:
        "0.82x0.461,0.72x0.405,0.63x0.354,0.55x0.309,0.46x0.259,0.36x0.203",
      label: "Card size (share of height, w or wxh)",
    },
    holds: { type: "text", default: "1,5,5,4,2,5", label: "Frames per shot" },
    mark: { type: "image", default: "/logo/snapcn.png", label: "Mark" },
    wordmark: { type: "text", default: "snapcn", label: "Wordmark" },
    background: { type: "image", default: "", label: "Backplate" },
    accent: { type: "color", default: "", label: "Bracket colour" },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Theme",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // The stack runs out on 22, the word lands on 31 and the second bracket on 42.
  // 52 leaves the finished lockup up for a third of a second.
  durationInFrames: 52,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
