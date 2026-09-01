import { type ComponentConfig, FPS, H, W } from "@/lib/customizer-config";

/**
 * Colour defaults are the design system's own token values, spelled out.
 *
 * The component derives them from `useSnapCnTheme` when the prop is omitted, so
 * a user who installs it inherits their palette. The customizer needs concrete
 * swatches to put in its colour inputs, and these are the values the light theme
 * resolves to. Change a token in `globals.css` and these want updating with it;
 * `pnpm run check:tokens` does not cover a config file.
 */
const PRIMARY = "#3072db";
const BACKGROUND = "#faf9f6";
const FOREGROUND = "#141414";
const CARD = "#ffffff";
const MUTED_FOREGROUND = "#6e6a63";

const ANSWER =
  "Build one composition per scene and keep the timeline declarative, " +
  "so the same props always render the same frames. Anything that reads " +
  "the clock at render time is a bug you will find in the export.";

export const answerHighlightConfig: ComponentConfig = {
  componentName: "AnswerHighlight",
  importPath: "@/components/snap-cn/answer-highlight",
  controls: {
    question: {
      type: "text",
      default: "How should we structure the demo video?",
      label: "Question",
    },
    answer: { type: "text", default: ANSWER, label: "Answer" },
    statement: {
      type: "text",
      default: "keep the timeline declarative",
      label: "Statement to select",
    },
    word: {
      type: "text",
      default: "declarative",
      label: "Word to pick out",
    },
    questionHold: {
      type: "number",
      default: 0.6,
      min: 0.2,
      max: 3,
      step: 0.05,
      label: "Question hold",
    },
    wordStep: {
      type: "number",
      default: 0.055,
      min: 0.02,
      max: 0.2,
      step: 0.005,
      label: "Seconds per word",
    },
    beforeDrag: {
      type: "number",
      default: 0.45,
      min: 0,
      max: 2,
      step: 0.05,
      label: "Pause before the drag",
    },
    dragStep: {
      type: "number",
      default: 0.11,
      min: 0.03,
      max: 0.4,
      step: 0.005,
      label: "Drag speed (s/word)",
    },
    beforeWord: {
      type: "number",
      default: 0.6,
      min: 0,
      max: 2,
      step: 0.05,
      label: "Pause before the word",
    },
    paperColor: { type: "color", default: BACKGROUND, label: "Page" },
    pillColor: { type: "color", default: CARD, label: "Question pill" },
    questionColor: {
      type: "color",
      default: MUTED_FOREGROUND,
      label: "Question ink",
    },
    answerColor: { type: "color", default: FOREGROUND, label: "Answer ink" },
    accentColor: {
      type: "color",
      default: PRIMARY,
      label: "Selection",
      brand: "accent",
    },
  },
  // 0.6 question + ~34 words at 0.055 + 0.45 + the drag + 0.6 + the word, on
  // the 30fps clock, then a beat to read the result.
  durationInFrames: 190,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
