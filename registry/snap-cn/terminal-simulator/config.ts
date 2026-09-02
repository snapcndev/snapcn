import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const terminalSimulatorConfig: ComponentConfig = {
  componentName: "TerminalSimulator",
  importPath: "@/components/snap-cn/terminal-simulator",
  controls: {
    intro: {
      type: "text",
      default: "*work* one step at a *time.*",
      label: "Intro",
    },
    background: { type: "color", default: "#141417", label: "Panel surface" },
    borderColor: { type: "color", default: "#26272B", label: "Panel hairline" },
    fontSize: {
      type: "number",
      default: 18,
      min: 10,
      max: 32,
      step: 1,
      label: "Font size",
    },
    charsPerFrame: {
      type: "number",
      default: 2,
      min: 0.25,
      max: 6,
      step: 0.25,
      label: "Chars / frame",
    },
    chunkSize: {
      type: "number",
      default: 3,
      min: 1,
      max: 20,
      step: 1,
      label: "Chunk size",
    },
    zoom: { type: "boolean", default: false, label: "Extra zoom" },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  durationInFrames: 200,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#0A0A0B" },
};
