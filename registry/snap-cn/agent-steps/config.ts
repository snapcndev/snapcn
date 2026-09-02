import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * Colour defaults are the design system's own token values, spelled out.
 *
 * The component derives them from `useSnapCnTheme` when the prop is omitted, so
 * a user who installs it inherits their palette. The customizer needs concrete
 * swatches to put in its colour inputs, and these are the same values the light
 * theme resolves to. Change a token in `globals.css` and these want updating
 * with it; `pnpm run check:tokens` does not cover a config file.
 */
const PRIMARY = "#3072db";
const BACKGROUND = "#faf9f6";
const FOREGROUND = "#141414";
const CARD = "#ffffff";
const MUTED_FOREGROUND = "#6e6a63";
/** mixOklch(background, primary, 0.17) — a tint of the page, not a second colour. */
const GLOW = "rgb(228, 230, 240)";

export const agentStepsConfig: ComponentConfig = {
  componentName: "AgentSteps",
  importPath: "@/components/snap-cn/agent-steps",
  controls: {
    query: {
      type: "text",
      default: "A 30-second launch video for a Next.js analytics dashboard",
      label: "Prompt",
    },
    steps: {
      type: "text",
      // `running > done`, `;` between steps, trailing `@globe` for the ones
      // that went out to the network.
      default:
        "Searching the registry… > Searched the registry @globe; Looking up components matching “dashboard”… > Looked up 6 matching components; Reading the docs… > Read 4 component docs @globe; Checking available props… > Checked available props; Building the timeline… > Set 9 scene timings; Rendering frames… > Rendered frames",
      label: "Steps (running > done; …)",
    },
    result: { type: "text", default: "Rendered 900 frames", label: "Result" },
    stepHold: {
      type: "number",
      default: 0.45,
      min: 0.15,
      max: 2,
      step: 0.05,
      label: "Seconds per step",
    },
    queryHold: {
      type: "number",
      default: 0.683,
      min: 0.2,
      max: 3,
      step: 0.05,
      label: "Prompt hold",
    },
    finalHold: {
      type: "number",
      default: 0.283,
      min: 0.1,
      max: 2,
      step: 0.05,
      label: "Last step hold",
    },
    paperColor: { type: "color", default: BACKGROUND, label: "Page" },
    glowColor: { type: "color", default: GLOW, label: "Wash", brand: "accent" },
    glowRadius: {
      type: "number",
      default: 0.465,
      min: 0,
      max: 1.2,
      step: 0.005,
      label: "Wash radius",
    },
    pillColor: { type: "color", default: CARD, label: "Pill" },
    inkColor: { type: "color", default: FOREGROUND, label: "Prompt ink" },
    stepColor: { type: "color", default: MUTED_FOREGROUND, label: "Step ink" },
    accentColor: {
      type: "color",
      default: PRIMARY,
      label: "Check",
      brand: "accent",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // 0.683 prompt + six steps (0.45 x 5 + 0.283) + 0.75 to the result + a beat
  // on it, on the 30fps clock. The reference runs 5.2s end to end.
  durationInFrames: 160,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
