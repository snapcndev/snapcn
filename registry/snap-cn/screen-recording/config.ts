import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * Colour defaults are the design system's own token values, spelled out.
 *
 * The component derives them from `useSnapCnTheme` when the prop is omitted, so
 * a user who installs it inherits their palette. The customizer needs a
 * concrete swatch to put in its colour input, and this is the value the light
 * theme's `background` resolves to. Change a token in `globals.css` and this
 * wants updating with it; `pnpm run check:tokens` does not cover a config file.
 */
const BACKGROUND = "#faf9f6";

/**
 * `camera` is absent on purpose: `ControlType` in lib/customizer-config.ts has
 * no array or object control, so the track stays a prop and `DEMO_CAMERA`
 * carries the demo — exactly how `terminal-simulator` handles `lines`. The crop
 * is four number controls for the same reason, one per edge.
 */
export const screenRecordingConfig: ComponentConfig = {
  componentName: "ScreenRecording",
  importPath: "@/components/snap-cn/screen-recording",
  controls: {
    src: {
      type: "image",
      default: "/demos/answer-stream.mp4",
      label: "Recording",
    },
    cropTop: {
      type: "number",
      default: 0,
      min: 0,
      max: 0.4,
      step: 0.005,
      label: "Crop top",
    },
    cropRight: {
      type: "number",
      default: 0,
      min: 0,
      max: 0.4,
      step: 0.005,
      label: "Crop right",
    },
    cropBottom: {
      type: "number",
      default: 0,
      min: 0,
      max: 0.4,
      step: 0.005,
      label: "Crop bottom",
    },
    cropLeft: {
      type: "number",
      default: 0,
      min: 0,
      max: 0.4,
      step: 0.005,
      label: "Crop left",
    },
    fit: {
      type: "select",
      default: "cover",
      options: ["cover", "contain"],
      label: "Fit",
    },
    backdropColor: { type: "color", default: BACKGROUND, label: "Letterbox" },
    entrance: {
      type: "select",
      default: "fade",
      options: ["fade", "none"],
      label: "Entrance",
    },
    radius: {
      type: "number",
      default: 0,
      min: 0,
      max: 48,
      step: 1,
      label: "Corner radius",
    },
    trimBefore: {
      type: "number",
      default: 0,
      min: 0,
      max: 300,
      step: 1,
      label: "Trim in",
    },
    audio: { type: "boolean", default: false, label: "Audio" },
  },
  // `screenRecordingFrames(DEMO_CAMERA)`, evaluated. Not the call itself: this
  // module is imported by `registry/__configs__.ts`, which the MCP's
  // `build-manifest.mjs` loads with plain `node` — and node cannot load a
  // `.tsx` at all (not with type stripping, not with any flag). A config that
  // imports its own `index.tsx` therefore breaks `pnpm run registry:build`.
  // `registry/__tests__/demo-durations.test.ts` asserts this number against the
  // function, so it cannot go stale when DEMO_CAMERA changes.
  durationInFrames: 139,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
