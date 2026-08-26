import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * The reference clip is 5.02s and ends while the send bloom is still opening.
 * 165 frames is that clip plus half a second, so the beat the click buys you
 * actually resolves on screen instead of being cut off mid-bloom.
 *
 * Not every prop is a control. The customizer surfaces what changes the shot —
 * the copy, the four sizes the layout is derived from, the beats and the cuts.
 * The rest (`outX`/`outY`, `revealDuration`, `sendIcon`, `fontFamily`, `theme`)
 * is still a prop; it is just not something you reach for with a slider.
 */
export const promptSendConfig: ComponentConfig = {
  componentName: "PromptSend",
  importPath: "@/components/snap-cn/prompt-send",
  controls: {
    text: {
      type: "text",
      default:
        "Add a text reveal, a soft blur transition, and a gradient background",
      label: "Prompt",
    },
    placeholder: {
      type: "text",
      default: "Describe the scene you want…",
      label: "Placeholder",
    },
    chips: {
      type: "text",
      default:
        "Add a text reveal, Try a blur transition, Pick a background, Assemble a scene",
      label: "Suggestions",
    },
    width: {
      type: "number",
      default: 636.2,
      min: 240,
      max: 890,
      step: 1,
      label: "Panel width",
    },
    fieldHeight: {
      type: "number",
      default: 121.2,
      min: 40,
      max: 260,
      step: 1,
      label: "Field height",
    },
    fontSize: {
      type: "number",
      default: 14,
      min: 8,
      max: 32,
      step: 0.5,
      label: "Prompt size",
    },
    chipFontSize: {
      type: "number",
      default: 12.3,
      min: 7,
      max: 24,
      step: 0.1,
      label: "Chip size",
    },
    radius: {
      type: "number",
      default: 22,
      min: 0,
      max: 48,
      step: 1,
      label: "Radius",
    },
    typeStart: {
      type: "number",
      default: 0.915,
      min: 0,
      max: 4,
      step: 0.01,
      label: "Type at (s)",
    },
    typeDuration: {
      type: "number",
      default: 3.025,
      min: 0.5,
      max: 8,
      step: 0.01,
      label: "Type over (s)",
    },
    chipsAt: {
      type: "number",
      default: 0.545,
      min: 0,
      max: 4,
      step: 0.01,
      label: "Chips at (s)",
    },
    chipStagger: {
      type: "number",
      default: 0.1,
      min: 0,
      max: 0.6,
      step: 0.01,
      label: "Chip stagger (s)",
    },
    cutInAt: {
      type: "number",
      default: 1.975,
      min: 0.1,
      max: 6,
      step: 0.01,
      label: "Cut in at (s)",
    },
    cutOutAt: {
      type: "number",
      default: 4.008,
      min: 0.2,
      max: 8,
      step: 0.01,
      label: "Cut out at (s)",
    },
    zoomIn: {
      type: "number",
      default: 2.327,
      min: 1,
      max: 5,
      step: 0.001,
      label: "Zoom in",
    },
    zoomOut: {
      type: "number",
      default: 1.44,
      min: 1,
      max: 3,
      step: 0.001,
      label: "Zoom out",
    },
    focusX: {
      type: "number",
      default: 0.573,
      min: 0,
      max: 1,
      step: 0.001,
      label: "Caret X",
    },
    focusY: {
      type: "number",
      default: 0.4881,
      min: 0,
      max: 1,
      step: 0.001,
      label: "Caret Y",
    },
    clickAt: {
      type: "number",
      default: 4.658,
      min: 0.5,
      max: 8,
      step: 0.01,
      label: "Click at (s)",
    },
    cursor: { type: "boolean", default: true, label: "Pointer" },
    accentColor: { type: "color", default: "#3072db", label: "Accent" },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Mode",
    },
  },
  // `speed` is appended from SHARED_CONTROLS in registry/__index__.tsx.
  durationInFrames: 165,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
