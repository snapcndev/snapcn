import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * `ControlType` in lib/customizer-config.ts has no array control, so `path` is
 * absent here and `DEMO_PATH` carries the preview — the same way
 * `terminal-simulator` handles `lines: TerminalLine[]`.
 *
 * Colour defaults are the design system's own token values, spelled out. The
 * component derives them from `useSnapCnTheme` when the prop is omitted, so a
 * user who installs it inherits their palette; the customizer needs concrete
 * swatches. `pnpm run check:tokens` does NOT cover a config file, so these want
 * updating when a token moves in globals.css.
 */
const PRIMARY = "#3072db";
const FOREGROUND = "#141414";
const BACKGROUND = "#faf9f6";

export const cursorTrackConfig: ComponentConfig = {
  componentName: "CursorTrack",
  importPath: "@/components/snap-cn/cursor-track",
  controls: {
    variant: {
      type: "select",
      default: "arrow",
      options: ["arrow", "dot"],
      label: "Cursor",
    },
    size: {
      type: "number",
      // 3.9% of 720. Left as an absolute so the slider reads in the same units
      // as every other component's size; omit the prop entirely and the
      // component recomputes it from whatever height it is mounted at.
      default: 28,
      min: 12,
      max: 72,
      step: 1,
      label: "Cursor size",
    },
    color: { type: "color", default: FOREGROUND, label: "Cursor" },
    outlineColor: { type: "color", default: BACKGROUND, label: "Outline" },
    ringColor: {
      type: "color",
      default: PRIMARY,
      label: "Click ring",
      brand: "accent",
    },
    clickFrames: {
      type: "number",
      default: 14,
      min: 6,
      max: 40,
      step: 1,
      label: "Click ring length",
    },
    showBefore: { type: "boolean", default: false, label: "Park before start" },
  },
  // `cursorTrackFrames(DEMO_PATH)`, evaluated. Not the call itself: this module
  // is imported by `registry/__configs__.ts`, which the MCP's
  // `build-manifest.mjs` loads with plain `node` — and node cannot load a
  // `.tsx` at all, with or without flags. A config that imports its own
  // `index.tsx` breaks `pnpm run registry:build`.
  // `registry/__tests__/demo-durations.test.ts` asserts this number against the
  // function, so it cannot go stale when DEMO_PATH changes.
  durationInFrames: 132,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  // The component is an overlay with no surface of its own; the preview needs a
  // page under it for the cursor to read against.
  previewBackdrop: { type: "color", value: "#FAFAFA" },
};
