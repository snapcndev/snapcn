"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { inputStyleContext } from "@/components/snap-cn/input";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

// Loaded through @remotion/google-fonts, never a CSS variable — a Remotion
// bundle has none of the app's CSS, so a `var(--font-…)` gets you the right face
// in the Player and a fallback in the mp4 (design-system rule 4).
const { fontFamily: SERIF } = loadSerif("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
const { fontFamily: SANS } = loadSans("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export interface PromptZoomProps {
  /** The greeting above the field. */
  greeting?: string;
  /** Field placeholder, shown until the first character is typed. */
  placeholder?: string;
  /** The prompt that types itself once the cut has landed. */
  text?: string;
  /** Suggestion pills under the field. Empty by default — pass some to show
   *  them. They are static: the shot belongs to the typing and the cut. */
  chips?: string[];
  /** Model label in the field's footer, and the effort beside it. */
  model?: string;
  effort?: string;
  /** Seconds at which typing begins. */
  typeStart?: number;
  /** Seconds at which the view cuts. Not a transition — one frame. It lands
   *  *while the prompt is still being typed*, which is the whole gag. */
  cutAt?: number;
  /** Typing speed. 18 is what the reference measures. */
  charsPerSecond?: number;
  /** How far the cut pushes in. 2.547 is what the reference measures. */
  zoom?: number;
  /** Focal point of the cut, as a fraction of the frame. */
  focusX?: number;
  focusY?: number;
  /** The starburst mark. Defaults to `theme.primary`. */
  accentColor?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  /**
   * The face this scene paints its words in — a label from `fonts.ts`
   * ("Inter", "Space Grotesk", "Instrument Serif") or a CSS family you have
   * loaded yourself. Unset, the scene keeps the face it was designed around.
   *
   * Overrides `theme.fontFamily`, which is how a brand kit re-skins a whole
   * timeline from one value.
   */
  fontFamily?: string;
  speed?: number;
}

// --- Pure helpers (unit-tested) -------------------------------------------

/** Characters revealed by effective frame `fc`, clamped to `total`. */
export function typedCount(
  fc: number,
  startF: number,
  perFrame: number,
  total: number,
): number {
  if (fc <= startF) return 0;
  if (perFrame <= 0) return total;
  return Math.min(total, Math.floor((fc - startF) * perFrame));
}

/**
 * The cut, as a hard boolean. There is no ramp and no easing on purpose.
 *
 * Measured on the reference: the wide view is intact on one frame and fully
 * pushed in on the very next (frames 39 → 40, 803ms → 824ms). Nothing in
 * between. Interpolating this — even over two or three frames — turns a cut into
 * a zoom, and the whole read of the shot is that it *snaps*.
 */
export function isZoomed(fc: number, cutF: number): boolean {
  return fc >= cutF;
}

/**
 * Caret visibility. Solid whenever a character is actively landing, blinking on
 * a 1.06s cycle when it is not — which is what a real text caret does, and what
 * stops the shot looking frozen while the prompt waits to start.
 */
export function caretOn(fc: number, fps: number, typing: boolean): boolean {
  if (typing) return true;
  const halfCycle = 0.53 * fps;
  return Math.floor(fc / halfCycle) % 2 === 0;
}

// --- Icons -----------------------------------------------------------------

function Glyph({
  d,
  size,
  color,
  fill,
}: {
  d: string;
  size: number;
  color: string;
  fill?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill ? color : "none"}
      stroke={fill ? "none" : color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}
    >
      <title>icon</title>
      <path d={d} />
    </svg>
  );
}

/** Paths for the default chip set, in order. */
const CHIP_ICONS = [
  "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z", // pencil
  "M22 10 12 5 2 10l10 5 10-5ZM6 12v5c3 3 9 3 12 0v-5", // cap
  "m8 6-6 6 6 6M16 6l6 6-6 6", // code
  "M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z", // cup
  "M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4", // spark
];

/**
 * The starburst that leads the greeting.
 *
 * Twelve rays with a solid hub, measured off the reference: they are roughly a
 * ninth of the mark's diameter and clearly separated, and their overlap at the
 * centre reads as a filled disc.
 *
 * Six bars, not twelve. A bar is centred on the origin so it draws a ray at both
 * ends — the first version stepped twelve bars by 15° and produced *twenty-four*
 * rays, which at a 19px mark is not a starburst, it is a dot.
 */
function Starburst({ size, color }: { size: number; color: string }) {
  const rays = Array.from({ length: 6 }, (_, i) => i * 30);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0 }}
    >
      <title>Assistant</title>
      {rays.map((a) => (
        <rect
          key={a}
          x={10.9}
          y={1.6}
          width={2.2}
          height={20.8}
          rx={1.1}
          fill={color}
          transform={`rotate(${a} 12 12)`}
        />
      ))}
      <circle cx={12} cy={12} r={3.6} fill={color} />
    </svg>
  );
}

// --- Main composition ------------------------------------------------------

/**
 * An assistant's field that types a prompt into itself and, partway through the
 * sentence, **cuts** — hard, in a single frame — into the caret and keeps going.
 *
 * ## The cut is the component
 *
 * Everything here was taken off a frame-by-frame read of the reference, and the
 * one number that matters most is that the push-in happens between two adjacent
 * frames with nothing in between. It is a cut, not a move. The scale is
 * **2.547×** and it is anchored on a point that sits **10% across and 41% down
 * the input field** — which is exactly where the caret is.
 *
 * The typing starts *before* the cut and does not pause for it: the sentence is
 * already running when the frame snaps in, and carries straight on at the new
 * size. That is what stops the cut reading as a scene change — there is one
 * continuous action across it, and the cut just gets you closer to it.
 *
 * That focal point is over-determined by the measurement rather than guessed:
 * fitting the scale and centre to the field's top and left edges then predicts
 * the `+` glyph's centre to within 1.2px and the field's bottom edge to 0.0px.
 *
 * ## Layout is in the reference's own pixels
 *
 * The stage below is literally 810×450 — the recording's frame — scaled to fit
 * whatever composition it is given. Every position in it is a number measured
 * off that recording, so there is no second conversion to get wrong.
 *
 * ## What is not measured
 *
 * The colours and the wording. The reference is a specific product: its coral
 * mark, its model names, its suggestion labels. None of that belongs in a
 * component that ships to strangers and lands next to somebody else's `Input`
 * (design-system rule 5). The paint is the shadcn token set, the field takes its
 * surface from the `Input` primitive's own style context so the two cannot
 * drift, and every label is a prop.
 */
export function PromptZoom({
  greeting = "Up late?",
  placeholder = "How can I help you today?",
  text = "Get me a plan for tomorrow",
  chips = [],
  model = "Auto",
  effort = "Medium",
  typeStart = 0.35,
  cutAt = 1.0,
  charsPerSecond = 18,
  zoom = 2.547,
  focusX = 0.27,
  focusY = 0.516,
  accentColor,
  theme,
  mode,
  fontFamily,
  speed = 1,
}: PromptZoomProps) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? SANS;
  const ui = inputStyleContext(t);
  const accent = accentColor ?? t.primary;

  const fc = frame * speed;

  // The reference's own frame. Laying out in these units means every number
  // below is one that was measured, not one that was converted.
  const REF_W = 810;
  const REF_H = 450;
  const stageScale = Math.min(width / REF_W, height / REF_H);

  // --- measured layout (recording px) ---
  const BOX = { x: 173, y: 197, w: 461, h: 86, r: 11 };
  const HEAD_Y = 145; // ink top of the greeting
  const HEAD_SIZE = 30; // ~28px ink height including descenders
  const MARK = 19;
  const CHIP_Y = 301;
  const CHIP_H = 26;
  const PAD = 20; // field's inner padding

  // A hairline is specified at a 40px control; this field is 86 tall, so the
  // token is walked toward the foreground through the system's own mix rather
  // than by picking a darker grey (design-system rule 3b). No drop shadow —
  // under a control this size a visible one is a grey smear (rule 3).
  const borderColor = mixOklch(ui.idleBorder, t.foreground, 0.18);

  // --- timeline ---
  const cutF = cutAt * fps;
  const zoomed = isZoomed(fc, cutF);
  const typedN = typedCount(
    fc,
    typeStart * fps,
    charsPerSecond / fps,
    text.length,
  );
  const typing = typedN > 0 && typedN < text.length;
  const typed = text.slice(0, typedN);
  const caret = caretOn(fc, fps, typing);

  const isRendering = getRemotionEnvironment().isRendering;
  const willChange = isRendering ? undefined : ("transform" as const);

  const chipRow =
    chips.length === 0 ? null : (
      <div
        style={{
          position: "absolute",
          left: BOX.x,
          top: CHIP_Y,
          width: BOX.w,
          display: "flex",
          justifyContent: "center",
          gap: 9,
        }}
      >
        {chips.map((chip, i) => {
          return (
            <div
              key={chip}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: CHIP_H,
                padding: "0 11px",
                borderRadius: CHIP_H / 2,
                background: t.card,
                border: `1px solid ${borderColor}`,
                color: t.foreground,
                fontFamily: face,
                fontWeight: 500,
                fontSize: 11,
                lineHeight: 1,
                whiteSpace: "nowrap",
                textRendering: "geometricPrecision",
              }}
            >
              <Glyph
                d={CHIP_ICONS[i % CHIP_ICONS.length]}
                size={12}
                color={t.mutedForeground}
              />
              {chip}
            </div>
          );
        })}
      </div>
    );

  return (
    <AbsoluteFill style={{ background: t.background }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: REF_W,
          height: REF_H,
          transform: `translate(-50%, -50%) scale(${stageScale})`,
        }}
      >
        {/* The cut. A plain static scale about the caret — no interpolation, so
            there is never a frame of it "zooming". `transformOrigin` is the
            measured focal point, in the same units as everything else. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoomed ? zoom : 1})`,
            transformOrigin: `${focusX * REF_W}px ${focusY * REF_H}px`,
            willChange,
          }}
        >
          {/* ---- Greeting */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: HEAD_Y - 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              fontFamily: SERIF,
              fontWeight: 400,
              fontSize: HEAD_SIZE,
              lineHeight: 1.1,
              color: t.foreground,
              textRendering: "geometricPrecision",
            }}
          >
            <Starburst size={MARK} color={accent} />
            {greeting}
          </div>

          {/* ---- The field */}
          <div
            style={{
              position: "absolute",
              left: BOX.x,
              top: BOX.y,
              width: BOX.w,
              height: BOX.h,
              borderRadius: BOX.r,
              background: t.card,
              border: `1px solid ${borderColor}`,
              boxShadow: "none",
            }}
          >
            {/* The prompt line, with the caret riding its end. */}
            <div
              style={{
                position: "absolute",
                left: PAD,
                top: PAD - 4,
                right: PAD,
                display: "flex",
                alignItems: "center",
                fontFamily: face,
                fontWeight: 400,
                fontSize: 12,
                lineHeight: 1.4,
                color: typedN > 0 ? t.foreground : t.mutedForeground,
                whiteSpace: "pre",
                textRendering: "geometricPrecision",
              }}
            >
              {typedN > 0 ? typed : placeholder}
              <span
                style={{
                  display: "inline-block",
                  width: 1.4,
                  height: 15,
                  marginLeft: 1,
                  background: t.foreground,
                  opacity: caret ? 1 : 0,
                }}
              />
            </div>

            {/* Footer: the add affordance, and the model readout. */}
            <div
              style={{
                position: "absolute",
                left: PAD,
                right: PAD,
                bottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: face,
                fontSize: 10,
                color: t.mutedForeground,
              }}
            >
              <Glyph d="M12 5v14M5 12h14" size={13} color={t.mutedForeground} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: t.foreground, fontWeight: 500 }}>
                  {model}
                </span>
                <span>{effort}</span>
              </div>
            </div>
          </div>

          {chipRow}
        </div>
      </div>
    </AbsoluteFill>
  );
}
