import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * The snapcn mark, as a path string so the customizer can edit it in a text
 * field. It repeats the component's own `MARK_PATH` default rather than
 * importing it: this file is data the site reads on every page that lists
 * controls, and importing it would pull a whole Remotion scene along with it.
 */
const MARK_PATH =
  "M15.757 15.459c-3.324 0.816 -6.07 2.966 -7.563 5.911 -1.194 2.388 -1.174 1.672 -1.174 24.66 0 19.982 0.02 21.077 0.378 22.132 0.955 2.926 2.946 4.498 6.588 5.215 1.99 0.398 2.528 0.657 3.702 1.732 1.055 0.975 1.473 2.169 1.473 4.219 0.02 2.408 0.836 3.901 2.647 4.856l1.035 0.537 19.505 0.06c17.574 0.06 19.624 0.02 20.739 -0.259 1.493 -0.418 2.647 -1.333 3.403 -2.766l0.537 -1.015 0.06 -6.269c0.04 -3.443 0.04 -6.807 0 -7.444l-0.06 -1.194 -0.617 0.995c-0.717 1.174 -2.01 2.289 -3.383 2.906l-0.975 0.458 -16.121 0.06c-11.763 0.04 -16.42 -0 -17.216 -0.159 -2.548 -0.557 -5.135 -2.408 -6.468 -4.657 -1.294 -2.189 -1.314 -2.548 -1.254 -16.44l0.06 -12.439 0.478 -1.154c0.876 -2.209 2.926 -4.18 5.374 -5.155l1.115 -0.458 16.519 -0.06c16.101 -0.04 16.539 -0.04 17.813 0.358 1.592 0.498 2.966 1.473 3.941 2.826l0.736 1.035 0.06 -6.648c0.06 -7.304 -0.06 -8.319 -1.115 -9.832 -0.597 -0.876 -1.95 -1.811 -3.025 -2.11 -0.438 -0.119 -9.096 -0.199 -23.386 -0.179 -18.37 0.02 -22.908 0.06 -23.804 0.279zM79.665 31.819c-6.508 3.901 -11.902 7.185 -11.981 7.304 -0.08 0.119 -0.139 5.055 -0.1 10.947l0.04 10.748 2.886 1.811c1.592 0.995 4.14 2.587 5.672 3.523 1.533 0.935 5.632 3.463 9.096 5.613 3.463 2.15 6.488 3.901 6.707 3.901 0.219 -0 0.537 -0.139 0.697 -0.318 0.279 -0.279 0.318 -2.806 0.318 -24.958 0 -15.544 -0.08 -24.839 -0.199 -25.157 -0.139 -0.398 -0.318 -0.517 -0.736 -0.517 -0.358 0.02 -4.617 2.448 -12.399 7.105z";

export const announceTitleConfig: ComponentConfig = {
  componentName: "AnnounceTitle",
  importPath: "@/components/snap-cn/announce-title",
  controls: {
    eyebrow: { type: "text", default: "Introducing", label: "Eyebrow" },
    title: { type: "text", default: "snapcn 1.0", label: "Title" },
    tagline: {
      type: "text",
      default: "Ready-made scenes for Remotion, in one command.",
      label: "Tagline",
    },
    symbolPath: { type: "text", default: MARK_PATH, label: "Symbol path" },
    symbolColors: {
      type: "text",
      default: "",
      label: "Symbol colours (comma-separated)",
    },
    symbolScale: {
      type: "number",
      default: 1,
      min: 0,
      max: 3,
      step: 0.05,
      label: "Symbol size",
    },
    fieldColor: {
      type: "color",
      default: "#5600f5",
      label: "Colour field",
      brand: "accent",
    },
    titleColor: { type: "color", default: "#4800c9", label: "Title ink" },
    paperColor: { type: "color", default: "#fcfcfa", label: "Title paper" },
    voidColor: { type: "color", default: "#100022", label: "Opening ground" },
    nightColor: { type: "color", default: "#000028", label: "Closing ground" },
    glowColor: { type: "color", default: "#08ff4b", label: "Closing glow" },
    glowStrength: {
      type: "number",
      default: 0.139,
      min: 0,
      max: 0.4,
      step: 0.005,
      label: "Glow strength",
    },
    taglineColor: { type: "color", default: "#f2f8ff", label: "Tagline ink" },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  durationInFrames: 170,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#000028" },
};
