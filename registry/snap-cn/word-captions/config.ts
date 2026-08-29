import {
  type ComponentConfig,
  FONT_WEIGHT_OPTIONS,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const wordCaptionsConfig: ComponentConfig = {
  componentName: "WordCaptions",
  importPath: "@/components/snap-cn/word-captions",
  controls: {
    words: {
      type: "text",
      default:
        "You are losing three hours every week to manual invoices and you don\u2019t even notice it",
      label: "Transcript",
    },
    framesPerWord: {
      type: "number",
      default: 14,
      min: 6,
      max: 40,
      step: 1,
      label: "Frames / word",
    },
    preset: {
      type: "select",
      default: "boxed",
      options: ["boxed", "youtube", "beast", "hormozi", "pop", "clean"],
      label: "Preset",
    },
    groupSize: {
      type: "number",
      default: 0,
      min: 0,
      max: 3,
      step: 1,
      label: "Words per beat",
    },
    activeStyle: {
      type: "select",
      default: "pop",
      options: ["pop", "highlight", "color"],
      label: "Active style",
    },
    aspect: {
      type: "select",
      default: "16:9",
      options: ["16:9", "1:1", "9:16"],
      label: "Aspect preset",
    },
    maxWidth: {
      type: "number",
      default: 800,
      min: 300,
      max: 1600,
      step: 20,
      label: "Max width",
    },
    fontSize: {
      type: "number",
      default: 0,
      min: 0,
      max: 120,
      step: 1,
      label: "Font size",
    },
    textColor: { type: "color", default: "#FFFFFF", label: "Text color" },
    pillColor: {
      type: "text",
      default: "rgba(16,24,40,0.55)",
      label: "Pill color (CSS)",
    },
    accentColor: {
      type: "color",
      default: "#FFE81F",
      label: "Accent",
      brand: "accent",
    },
    fontWeight: {
      type: "select",
      default: "0",
      options: FONT_WEIGHT_OPTIONS,
      label: "Font weight",
    },
  },
  durationInFrames: 96,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
  previewBackdrop: { type: "color", value: "#FAFAFA" },
};
