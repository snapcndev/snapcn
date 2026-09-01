import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * The reference clip runs 3.89s from the macro shot to its last frame. The
 * duration here is that, plus a beat: the pull-back bottoms out at 3.16s and
 * the shot needs to be held long enough afterwards to read the four cards,
 * with the slow idle push still running under them.
 */
export const answerStreamConfig: ComponentConfig = {
  componentName: "AnswerStream",
  importPath: "@/components/snap-cn/answer-stream",
  controls: {
    question: {
      type: "text",
      default: "How do I rank higher in AI answers?",
      label: "Question",
    },
    answer: {
      type: "text",
      default:
        "Analysing your prompt gaps…\nFound 27 prompts you should rank for and don't yet, so your name shows up everywhere AI looks.",
      label: "Answer",
    },
    headline: {
      type: "text",
      default: "Your AI visibility score: 34% — here's how I'd fix it:",
      label: "Headline",
    },
    model: { type: "text", default: "Auto", label: "Model" },
    commitAt: {
      type: "number",
      default: 1.0,
      min: 0,
      max: 3,
      step: 0.01,
      label: "Commit at (s)",
    },
    cutAt: {
      type: "number",
      default: 1.284,
      min: 0.2,
      max: 4,
      step: 0.01,
      label: "Cut at (s)",
    },
    pullbackAt: {
      type: "number",
      default: 1.933,
      min: 0.5,
      max: 5,
      step: 0.01,
      label: "Pull back at (s)",
    },
    pullbackDuration: {
      type: "number",
      default: 1.1,
      min: 0.2,
      max: 3,
      step: 0.05,
      label: "Pull back for (s)",
    },
    pullbackUndershoot: {
      type: "number",
      default: 0.028,
      min: 0,
      max: 0.2,
      step: 0.002,
      label: "Undershoot",
    },
    pullbackFrom: {
      type: "number",
      default: 1.364,
      min: 1,
      max: 3,
      step: 0.005,
      label: "Pull back from",
    },
    focusY: {
      type: "number",
      default: -0.548,
      min: -2,
      max: 1,
      step: 0.005,
      label: "Focus Y",
    },
    macroZoom: {
      type: "number",
      default: 2.36,
      min: 1,
      max: 5,
      step: 0.01,
      label: "Macro zoom",
    },
    wordsPerSecond: {
      type: "number",
      default: 25,
      min: 4,
      max: 60,
      step: 1,
      label: "Words / second",
    },
    coolSeconds: {
      type: "number",
      default: 0.23,
      min: 0,
      max: 1.5,
      step: 0.01,
      label: "Cool over (s)",
    },
    blur: {
      type: "number",
      default: 3,
      min: 0,
      max: 20,
      step: 0.5,
      label: "Motion blur",
    },
    accentColor: {
      type: "color",
      default: "#266DF0",
      label: "Accent",
      brand: "accent",
    },
    mode: {
      type: "select",
      default: "light",
      options: ["light", "dark"],
      label: "Mode",
    },
  },
  // `speed` is appended from SHARED_CONTROLS in registry/__index__.tsx.
  // `cards` is an array → not a control, and defaults to four.
  durationInFrames: 150,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
