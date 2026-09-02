"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

// Loaded through @remotion/google-fonts, never a CSS variable — a Remotion
// bundle has none of the app's CSS, so a `var(--font-…)` gets you the right face
// in the Player and a fallback in the mp4 (design-system rule 4).
const { fontFamily: SANS } = loadSans("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

// ---------------------------------------------------------------------------
// Proportions
//
// Fractions of the composition height, never pixels, so the scene holds its
// shape at 720p, 1080p or a vertical crop.
//
// The question pill's numbers are the same ones `agent-steps` carries, measured
// off the same 718x398 recording by the mass of the pill's fill and by
// cross-correlating its column ink under a scale sweep. They are repeated here
// rather than imported because a registry file is copied whole into somebody's
// project — a shared constants module would be a dependency they did not ask
// for. If you change one, change the other.
// ---------------------------------------------------------------------------

/** Question pill height. 22.0px of 398. */
const PILL_H = 0.0553;
/** Corner radius as a fraction of pill height. Not a stadium — that would be 0.5. */
const PILL_R = 0.28;
/** Pill padding either side of the label, as a fraction of pill height. */
const PILL_PAD = 0.42;
/** Question type size, as a fraction of composition height. */
const QUESTION_FONT = 0.0223;
/** Answer type size. Bigger than the question: the question is a caption on the
 *  thing you are here to read. */
const ANSWER_FONT = 0.0385;
/**
 * Answer line height, as a multiple of its own type size.
 *
 * Looser than a paragraph would normally want. The selection band fills its
 * line box the way a browser's does, so at 1.5 the band on one line sits
 * against the type on the next and the whole thing reads as a solid block of
 * colour instead of as two selected lines.
 */
const ANSWER_LEADING = 1.64;
/** Answer measure, as a fraction of frame width. Long enough for three or four
 *  lines of a real answer, short enough that the eye does not lose the line. */
const MEASURE = 0.6;
/** Gap between the pill's bottom and the answer's first baseline box. */
const PILL_GAP = 0.075;

/** Selection band padding above and below the type, as a fraction of the answer
 *  type size — a browser's own selection sits a little proud of the leading. */
const BAND_PAD_Y = 0.18;
/** Band corner radius, as a fraction of the answer type size. */
const BAND_R = 0.1;
/** The caret at the leading edge of the drag, as a fraction of the type size. */
const CARET_W = 0.06;

// ---------------------------------------------------------------------------
// Motion
//
// The pill's entrance is measured (see `agent-steps`). Everything below it is
// *chosen*, not fitted — there is no reference recording for this scene — so the
// numbers say what they are for rather than quoting an rms.
// ---------------------------------------------------------------------------

/** The question's entrance: scale, blur and opacity, in seconds. */
const INTRO_S = 0.375;
const INTRO_BLUR_S = 0.2;
const INTRO_SCALE = 1.31;
/** Blur at t=0, as a fraction of composition height. */
const INTRO_BLUR = 0.0141;

/**
 * One word of the answer's arrival, in seconds, and the gap between two of them.
 *
 * The stagger is the read: at 0.055s a 30-word answer takes 1.65s, which is fast
 * enough to feel generated and slow enough that the eye can start reading before
 * it finishes. Each word takes longer to arrive (0.22s) than the gap between two
 * — so four or five words are always mid-arrival, which is what stops it looking
 * like a ticker.
 */
const WORD_IN_S = 0.22;
const WORD_STEP_S = 0.055;
/** How far a word rises as it arrives, as a fraction of its own type size. */
const WORD_RISE = 0.34;

/**
 * Seconds the drag spends on each word of the statement.
 *
 * A selection is not a fade. The band is painted as a gradient with a hard stop
 * inside the word the drag is currently crossing, so the leading edge moves
 * *through* a word rather than jumping over it — at 30fps a per-word step would
 * advance the edge three whole words a second and read as four chips appearing,
 * not as a hand pulling across the line.
 *
 * 0.11s is a real drag: four words in a little under half a second.
 */
const BAND_STEP_S = 0.11;

/** The word inside the statement, once the statement is selected. */
const WORD_BAND_S = 0.2;
/** Word gap, as an em of the answer type. Padding, not margin — see the span. */
const WORD_GAP = 0.28;

// ---------------------------------------------------------------------------

export interface AnswerHighlightProps {
  /** The prompt, in the pill at the top. */
  question?: string;
  /** The answer. It writes itself a word at a time; line breaks are the
   *  browser's, so write a paragraph and let `measure` set the rag. */
  answer?: string;
  /**
   * The run inside `answer` that gets selected — word for word, as written.
   * A run that is not found simply never highlights, which is the signal that
   * the two strings have drifted apart.
   */
  statement?: string;
  /** The one word inside `statement` that takes the second, stronger band. */
  word?: string;
  /** Seconds the question holds alone before the answer starts. */
  questionHold?: number;
  /** Seconds between the answer finishing and the drag starting. */
  beforeDrag?: number;
  /** Seconds the selected statement holds before the word is picked out. */
  beforeWord?: number;
  /** Seconds per word of the answer's arrival, and of the drag. */
  wordStep?: number;
  dragStep?: number;
  /** Page behind the scene. Defaults to `theme.background`. */
  paperColor?: string;
  /** Pill fill. Defaults to `theme.card`. */
  pillColor?: string;
  /** Question ink. Defaults to `theme.mutedForeground`. */
  questionColor?: string;
  /** Answer ink. Defaults to `theme.foreground`. */
  answerColor?: string;
  /** The selection, the caret and the picked word. Defaults to `theme.primary`. */
  accentColor?: string;
  /** Where the lockup sits, as a fraction of frame height. */
  centerY?: number;
  fontFamily?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  speed?: number;
}

// --- Pure helpers (unit-tested) -------------------------------------------

/**
 * The answer, as the tokens the scene actually animates.
 *
 * Split on whitespace and *keep the punctuation attached to its word*, because
 * the selection band is painted per token: a comma that is its own token gets
 * its own band and its own arrival, and the band comes apart at every clause.
 */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * A token with its outer punctuation taken off, for matching only.
 *
 * So that `statement="keep the timeline declarative"` finds the answer's
 * `declarative,` — writing the comma into the prop to make the match land is
 * the kind of thing nobody remembers and everybody debugs twice.
 */
export function bare(wordToken: string): string {
  return wordToken.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * Where `phrase` sits in `words`, as a half-open [start, end) word range.
 *
 * Matched on the joined text rather than word by word so that a phrase written
 * with its own internal spacing still lands. Returns null when it is not there —
 * the caller draws no band, which makes a drifted prop visible instead of
 * highlighting some near-miss run of words.
 */
export function findRun(
  words: string[],
  phrase: string,
): [number, number] | null {
  const target = splitWords(phrase).map(bare);
  if (target.length === 0) return null;
  const wanted = target.join(" ");
  const haystack = words.map(bare);
  for (let i = 0; i + target.length <= words.length; i += 1) {
    if (haystack.slice(i, i + target.length).join(" ") === wanted) {
      return [i, i + target.length];
    }
  }
  return null;
}

/**
 * The selection band on one word, as a CSS background.
 *
 * `across` is how far the drag has crossed this word: nothing at 0, a solid
 * band at 1, and in between a hard-edged gradient with the caret sitting just
 * past the stop. Returned as `undefined` when there is nothing to paint so the
 * span keeps its cheap "no background" path.
 */
export function paintBand(
  across: number,
  fill: string,
  caret: string,
  caretWidth: number,
): string | undefined {
  if (across <= 0) return undefined;
  if (across >= 1) return fill;
  const stop = `${(across * 100).toFixed(2)}%`;
  return (
    `linear-gradient(to right, ${fill} 0 ${stop}, ` +
    `${caret} ${stop}, ${caret} calc(${stop} + ${caretWidth.toFixed(2)}px), ` +
    `transparent calc(${stop} + ${caretWidth.toFixed(2)}px))`
  );
}

/** Progress of a value that starts at `at` and takes `dur` frames. */
export function ramp(fc: number, at: number, dur: number): number {
  if (dur <= 0) return fc >= at ? 1 : 0;
  return Math.max(0, Math.min(1, (fc - at) / dur));
}

/**
 * The frame the drag's leading edge is on, as a fractional word index.
 *
 * Fractional on purpose: the caret is drawn on `floor(edge)` and the band on
 * everything behind it, so the edge can sit between two words and the bar does
 * not jump a whole word at a time on a 30fps clock.
 */
export function dragEdge(
  fc: number,
  at: number,
  stepF: number,
  count: number,
): number {
  if (stepF <= 0) return fc >= at ? count : 0;
  return Math.max(0, Math.min(count, (fc - at) / stepF));
}

// --- Defaults --------------------------------------------------------------

const DEFAULT_ANSWER =
  "Build one composition per scene and keep the timeline declarative, " +
  "so the same props always render the same frames. Anything that reads " +
  "the clock at render time is a bug you will find in the export.";

// ---------------------------------------------------------------------------

export function AnswerHighlight({
  question = "How should we structure the demo video?",
  answer = DEFAULT_ANSWER,
  statement = "keep the timeline declarative",
  word = "declarative",
  questionHold = 0.6,
  beforeDrag = 0.45,
  beforeWord = 0.6,
  wordStep = WORD_STEP_S,
  dragStep = BAND_STEP_S,
  paperColor,
  pillColor,
  questionColor,
  answerColor,
  accentColor,
  centerY = 0.5,
  fontFamily,
  theme: themeOverride,
  mode,
  speed = 1,
}: AnswerHighlightProps) {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const t = useSnapCnTheme(themeOverride, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? SANS;

  const fc = frame * speed;
  const paper = paperColor ?? t.background;
  const pill = pillColor ?? t.card;
  const askInk = questionColor ?? t.mutedForeground;
  const ink = answerColor ?? t.foreground;
  const accent = accentColor ?? t.primary;

  // A selection is a *tint of the page*, never the accent at full strength.
  // Primary behind body type at any real opacity puts white-on-blue in the
  // middle of a paragraph and the line stops being readable — which is exactly
  // why a browser's own selection is pale until the window loses focus.
  //
  // Alpha, not `mixOklch`. Mixing a warm off-white (#faf9f6) toward a blue in
  // oklch takes the short way round the hue wheel and passes through green: the
  // first cut of this scene highlighted the answer in pale mint. A tint of a
  // colour over paper is an alpha composite, not a hue interpolation.
  const band = withAlpha(accent, 0.16);

  const font = ANSWER_FONT * height;
  const words = splitWords(answer);
  const run = findRun(words, statement);
  const wordRun = run ? findRun(words, word) : null;
  // Only a word *inside* the selected statement is picked out. One that happens
  // to appear earlier in the answer is not the one meant.
  const picked =
    wordRun && run && wordRun[0] >= run[0] && wordRun[1] <= run[1]
      ? wordRun
      : null;

  // --- the clock -----------------------------------------------------------

  const answerAt = questionHold * fps;
  const stepF = wordStep * fps;
  const answerDone = answerAt + (words.length - 1) * stepF + WORD_IN_S * fps;
  const dragAt = answerDone + beforeDrag * fps;
  const dragStepF = dragStep * fps;
  const runLen = run ? run[1] - run[0] : 0;
  const dragDone = dragAt + runLen * dragStepF;
  const wordAt = dragDone + beforeWord * fps;

  const edge = run ? dragEdge(fc, dragAt, dragStepF, runLen) : 0;
  const wordIn = Easing.out(Easing.cubic)(ramp(fc, wordAt, WORD_BAND_S * fps));

  const intro = Easing.out(Easing.cubic)(ramp(fc, 0, INTRO_S * fps));
  const introBlur =
    INTRO_BLUR *
    height *
    (1 - Easing.out(Easing.cubic)(ramp(fc, 0, INTRO_BLUR_S * fps)));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: paper,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: `${centerY * 100}%`,
          transform: "translateY(-50%)",
          width: MEASURE * width,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        {/* The question. Same pill, same entrance, as `agent-steps`. */}
        <div
          style={{
            opacity: intro,
            filter: introBlur > 0.01 ? `blur(${introBlur}px)` : undefined,
            transform: `scale(${interpolate(intro, [0, 1], [INTRO_SCALE, 1])})`,
            transformOrigin: "0% 50%",
            marginBottom: PILL_GAP * height,
          }}
        >
          <div
            style={{
              fontFamily: face,
              fontSize: QUESTION_FONT * height,
              fontWeight: 500,
              lineHeight: 1,
              color: askInk,
              background: pill,
              height: PILL_H * height,
              borderRadius: PILL_R * PILL_H * height,
              padding: `0 ${PILL_PAD * PILL_H * height}px`,
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
            }}
          >
            {question}
          </div>
        </div>

        {/* The answer. Every word is its own inline span, which is what lets the
            selection band be a background rather than a measured rectangle: the
            browser wraps the spans, and a band that is painted per word wraps
            with them and breaks square at the line end, exactly like a real one.
            No DOM measurement, and it survives any copy you put in it. */}
        <div
          style={{
            fontFamily: face,
            fontSize: font,
            fontWeight: 400,
            lineHeight: ANSWER_LEADING,
            color: ink,
          }}
        >
          {words.map((w, i) => {
            const arrive = Easing.out(Easing.cubic)(
              ramp(fc, answerAt + i * stepF, WORD_IN_S * fps),
            );
            const inRun = run ? i >= run[0] && i < run[1] : false;
            const isPicked = picked ? i >= picked[0] && i < picked[1] : false;
            // How far the drag has crossed *this* word: 0 not yet, 1 fully past,
            // and everything between is where the leading edge actually is.
            const across =
              inRun && run ? Math.max(0, Math.min(1, edge - (i - run[0]))) : 0;
            const fill = isPicked
              ? withAlpha(accent, 0.16 + 0.14 * wordIn)
              : band;

            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: the answer is a fixed ordered token list, so the index is the identity
                key={i}
                style={{
                  display: "inline-block",
                  opacity: arrive,
                  transform: `translateY(${(1 - arrive) * WORD_RISE * font}px)`,
                  color: isPicked ? mixOklch(ink, accent, wordIn) : ink,
                  // One background does the band, its leading edge and the
                  // caret: solid behind everything the drag has passed, a hard
                  // stop where it has got to, and a sliver of the accent just
                  // ahead of that stop while it is still moving. A caret drawn
                  // as a separate element would have to be positioned, and
                  // positioning it means measuring the text.
                  background: paintBand(across, fill, accent, CARET_W * font),
                  // The word gap is padding, not margin, so the band is drawn
                  // behind the space as well: a selection over four words comes
                  // out as one unbroken run rather than four chips with holes
                  // where the spaces were.
                  padding: `${BAND_PAD_Y * font}px ${WORD_GAP}em ${BAND_PAD_Y * font}px 0`,
                  borderTopLeftRadius:
                    run && i === run[0] ? BAND_R * font : undefined,
                  borderBottomLeftRadius:
                    run && i === run[0] ? BAND_R * font : undefined,
                  borderTopRightRadius:
                    run && i === run[1] - 1 ? BAND_R * font : undefined,
                  borderBottomRightRadius:
                    run && i === run[1] - 1 ? BAND_R * font : undefined,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
