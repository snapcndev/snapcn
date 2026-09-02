"use client";

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TextReveal } from "@/components/snap-cn/text-reveal";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";
import {
  CUT_AT,
  CUT2_AT,
  EXIT_COEFF,
  EXIT_FROM,
  EXIT_RATIO,
  FLOOD_STAGE_FRAMES,
  MORPH_FROM,
  MORPH_TO,
  SLIDE_BEZIER,
  SLIDE_FROM,
  SLIDE_TO,
} from "./type-morph-timeline";

const { fontFamily: SANS } = loadInter("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

export interface TypeMorphProps {
  /**
   * The line as it is typed. Everything up to and including `lead` is cut away
   * once typing finishes, which is what leaves the emphasis alone on screen.
   */
  lead?: string;
  /** The emphasised tail of the typed line — this is what survives the cut. */
  emphasis?: string;
  /** What the emphasis morphs into, letter by letter. */
  morphTo?: string;
  /**
   * What is left after the second cut. Empty ends the beat on the bare flood.
   */
  finally_?: string;
  /**
   * Whether the final phrase survives into the flood.
   *
   * The reference carries it across; off is the cleaner ending, and it is the
   * default because a word sitting on a full-bleed colour for four frames reads
   * as a leftover rather than as a beat.
   */
  wordOnFlood?: boolean;
  /** Caret and freshly-typed glyphs. Defaults to the theme's accent. */
  accent?: string;
  /**
   * Two flat colours to flood the frame with at the end, or `false` to end on
   * paper — the default.
   *
   * The reference floods; off is the quieter ending and the one that composes,
   * because a beat that hands the next scene a full-bleed colour has decided
   * what that scene opens on.
   *
   * Two flat colours rather than a ramp: the reference arrives at 99% frame
   * coverage inside a single frame and then steps once. A crossfade between them
   * would put a half-transparent wash over the type for several frames, and
   * there is no reading of that except the screen dimming.
   */
  flood?: [string, string] | false;
  /**
   * The page.
   *
   * Defaults to the theme's background so the component belongs in whatever
   * project installs it. The reference's paper is a plain near-white (#f7f7f7 to
   * #fafafa across the beat), not the warm off-white the token carries, so the
   * preview passes its own.
   */
  background?: string;
  /** The type. Defaults to the theme's foreground. */
  ink?: string;
  /**
   * The opening line is rendered by `text-reveal` itself.
   *
   * Not a reimplementation of it, and not its helper functions rebuilt into a
   * second animator — the component, mounted. Everything in `reveal` is passed
   * to it untouched, so its lead-word push, its recede and its assemble are
   * exactly what that component does anywhere else, and there is nothing here
   * that can drift away from it.
   */
  reveal?: Omit<
    React.ComponentProps<typeof TextReveal>,
    "text" | "theme" | "mode" | "color" | "fontSize"
  >;
  /**
   * Cap-to-descender height as a fraction of the frame height.
   *
   * 0.1256, not the 0.139 the reference's raw ink height suggests: measured back
   * from the rendered line width against the reference's at the same frame, mine
   * came out 12.7% wide at 0.139 and 4% narrow at 0.1233, because ink height
   * includes the descender and the face's
   * own metrics differ from the reference's.
   */
  size?: number;
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
}

/**
 * `will-change` is right for the Player and wrong for the render — a render
 * draws each frame in a different tab, and a promoted layer hands that tab a
 * stale raster from whatever scale it last drew.
 */
const promoted = getRemotionEnvironment().isRendering
  ? null
  : ({ willChange: "transform" } as const);

/**
 * Hinting bends each glyph so its stems land on whole pixels, so as anything
 * moves the letterforms re-snap and boil. This also forces sub-pixel glyph
 * positioning, which Blink otherwise only enables above a device scale factor of
 * 1 — and a render is exactly 1, so without it every glyph in the morph would
 * land on a whole pixel and the travel would stutter.
 */
const CRISP: CSSProperties = {
  textRendering: "geometricPrecision",
  WebkitFontSmoothing: "antialiased",
};

/** Moderate decelerate. Quint/expo spend frames below half a pixel, which rasterise identically. */
const EASE = Easing.bezier(0.2, 0.6, 0.35, 1);

/**
 * Pair each glyph of `to` with a glyph of `from` that can travel to it.
 *
 * Greedy nearest-unused match on the character itself. It is not the optimal
 * assignment and does not need to be — what the eye reads is *continuity*, that
 * some letters persisted rather than the whole line being replaced, and a
 * nearest match delivers that while an optimal one costs a matrix and looks the
 * same. Unmatched targets fade up in place; unmatched sources fade out in place.
 */
function pairGlyphs(from: string, to: string): (number | null)[] {
  const used = new Set<number>();
  return [...to].map((ch, ti) => {
    let best: number | null = null;
    let bestDist = Infinity;
    for (let fi = 0; fi < from.length; fi += 1) {
      if (used.has(fi) || from[fi] !== ch) continue;
      const dist = Math.abs(fi - ti);
      if (dist < bestDist) {
        bestDist = dist;
        best = fi;
      }
    }
    if (best !== null) used.add(best);
    return best;
  });
}

/** Per-glyph x offsets of a string, measured in the real face at the real size. */
function useGlyphOffsets(
  strings: string[],
  fontSize: number,
  face: string,
  /** Glyphs before this index in string 0 are rendered at 400, the rest at 700. */
  _regularUntil: number,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState<number[][] | null>(null);
  // Every frame of a render is a fresh mount, so a plain effect + state lets the
  // frame be captured *before* the measurement has re-rendered — the glyphs are
  // then placed with no offsets at all and the frame comes out blank or short.
  // `delayRender` holds the capture until the second render has happened.
  const [handle] = useState(() => delayRender("type-morph: measuring glyphs"));

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    // `offsetLeft` is layout px and unaffected by transforms — which is exactly
    // why it is the right tool for measuring a line that is about to be
    // transformed, which is exactly why it is the right tool for measuring a
    // line that is about to be transformed.
    setOffsets(
      [...root.children].map((line) =>
        [...(line as HTMLElement).children].map(
          (g) => (g as HTMLElement).offsetLeft,
        ),
      ),
    );
  }, []);

  // Only once the measured offsets are actually in the tree.
  useLayoutEffect(() => {
    if (offsets) continueRender(handle);
  }, [offsets, handle]);

  const probe = (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        visibility: "hidden",
        pointerEvents: "none",
        whiteSpace: "pre",
        fontFamily: face,
        fontSize,
        letterSpacing: "-0.035em",
        ...CRISP,
      }}
    >
      {strings.map((s) => (
        <div key={s} style={{ whiteSpace: "pre" }}>
          {[...s].map((ch, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: glyph position is the identity here
            <span key={i} style={{ display: "inline-block" }}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );

  return { probe, offsets };
}

/**
 * A headline that types itself, sheds its lead, morphs letter by letter, and
 * ends under a colour flood.
 *
 * Four mechanics on one timeline, each measured off a reference frame by frame
 * (see `timeline.ts` for the signals and the numbers they produced):
 *
 * 1. **Typing.** The line is centre-anchored, so it grows in both directions
 *    rather than running to the right. Freshly landed glyphs arrive in the
 *    accent colour and cool to ink over four frames, which is what gives the
 *    typing a moving warm edge instead of a hard cursor.
 * 2. **The cut.** The lead is removed in a single frame, not animated out. What
 *    *is* animated is the slide back to centre that follows it.
 * 3. **The morph.** Glyphs shared between the two phrases travel from where they
 *    were to where they belong; the rest cross-fade in place.
 * 4. **The flood.** Two flat colours, four frames each.
 *
 * Every glyph position is measured in the real face at the real size behind a
 * hidden probe, because a morph built on estimated advance widths lands each
 * letter a pixel or two off and reads as a wobble.
 */
export function TypeMorph({
  lead = "Not just ",
  emphasis = "communicator.",
  morphTo = "something more.",
  finally_ = "more.",
  wordOnFlood = false,
  accent,
  background,
  ink,
  reveal,
  flood = false,
  size = 0.1256,
  theme,
  mode,
  fontFamily,
}: TypeMorphProps) {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? SANS;
  const _hot = accent ?? t.primary;
  const paper = background ?? t.background;
  const type = ink ?? t.foreground;
  const fontSize = height * size;

  const typed = lead + emphasis;
  const { probe, offsets } = useGlyphOffsets(
    [typed, emphasis, morphTo, finally_],
    fontSize,
    face,
    lead.length,
  );

  // ── the timeline ──────────────────────────────────────────────────────────
  //
  // Absolute frame numbers, measured, not derived from each other. Deriving them
  // meant one wrong constant early shifted everything after it.

  const floodAt = CUT2_AT + 1;
  const floodBAt = floodAt + FLOOD_STAGE_FRAMES;

  const phase =
    flood && frame >= floodAt
      ? "flood"
      : frame >= CUT2_AT
        ? "final"
        : frame >= MORPH_FROM
          ? "morph"
          : frame >= CUT_AT
            ? "slide"
            : "type";

  const floodColor =
    flood && frame >= floodAt
      ? frame >= floodBAt
        ? flood[1]
        : flood[0]
      : null;

  const centre = width / 2;

  /**
   * The line's horizontal offset — ONE continuous function of frame.
   *
   * The reference does not cut and then move; it moves continuously and the cut
   * only changes what is drawn. A single 16-frame cubic-bezier fits all 17
   * frames of the re-centring, straight through the cut, to 0.067px. Modelling
   * it as "drift, cut, slide" fits the same curve twice and puts a seam where
   * the reference has none.
   *
   * The travel is not a fixed distance — it is however far off-centre the
   * emphasis happens to sit inside the typed line, which the measured probe
   * already knows. On the reference that works out to 184.4px right of centre on
   * a 1400px frame; on any other phrase it is whatever that phrase needs.
   */
  const slideProgress = interpolate(frame, [SLIDE_FROM, SLIDE_TO], [0, 1], {
    easing: Easing.bezier(...SLIDE_BEZIER),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /** The exit: geometric per-frame velocity. Persists past the cut it precedes. */
  //
  // It stops at the cut. The reference carries the drifted position into what
  // the cut leaves behind, but the final phrase here is centred by choice, and a
  // drift still applied to it would drag a centred phrase off to the left — 300px
  // by the last frame.
  const exitDrift =
    frame <= EXIT_FROM || frame >= CUT2_AT
      ? 0
      : (-EXIT_COEFF * (EXIT_RATIO ** (frame - EXIT_FROM) - 1) * width) / 1400;

  /** One glyph, absolutely placed, so nothing reflows as the line changes. */
  const glyph = (
    key: string,
    ch: string,
    x: number,
    lineWidth: number,
    style: CSSProperties,
  ) => (
    <span
      key={key}
      style={{
        position: "absolute",
        left: centre - lineWidth / 2 + x,
        top: 0,
        whiteSpace: "pre",
        ...style,
      }}
    >
      {ch === " " ? " " : ch}
    </span>
  );

  let content: React.ReactNode = null;

  if (offsets) {
    const [typedX, emphX, morphX, finalX] = offsets;
    const widthOf = (xs: number[], str: string) =>
      (xs[str.length - 1] ?? 0) + fontSize * 0.34;

    const wTyped = widthOf(typedX, typed);
    const wEmph = widthOf(emphX, emphasis);
    const wMorph = widthOf(morphX, morphTo);

    // Where the emphasis sits inside the typed line. The slide carries the whole
    // line, so both the typed phase and the post-cut phase read the same offset.
    const emphInTyped = typedX[lead.length] - wTyped / 2 + wEmph / 2;

    if (phase === "type") {
      // `text-reveal` owns these frames entirely — see the render below.
      content = null;
    } else if (phase === "slide") {
      // From the cut to the end of the slide, this component draws the line —
      // `text-reveal` has already delivered it, centred, and the emphasis now
      // slides on the measured bezier.
      const w = widthOf(emphX, emphasis);
      const dx = -emphInTyped * (1 - slideProgress);
      content = [...emphasis].map((ch, i) =>
        glyph(`e${i}`, ch, emphX[i] + dx, w, {
          color: type,
          fontWeight: 700,
        }),
      );
    } else if (phase === "morph") {
      const p = interpolate(frame, [MORPH_FROM, MORPH_TO], [0, 1], {
        easing: EASE,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const w = interpolate(p, [0, 1], [wEmph, wMorph]);
      const pairs = pairGlyphs(emphasis, morphTo);
      const matched = new Set(pairs.filter((x): x is number => x !== null));
      content = [
        ...[...emphasis].map((ch, i) =>
          matched.has(i)
            ? null
            : glyph(`x${i}`, ch, emphX[i] + (wEmph - w) / 2, w, {
                color: type,
                fontWeight: 700,
                opacity: interpolate(p, [0, 0.45], [1, 0], {
                  extrapolateRight: "clamp",
                }),
              }),
        ),
        ...[...morphTo].map((ch, i) => {
          const src = pairs[i];
          const to = morphX[i] + (wMorph - w) / 2;
          if (src === null) {
            return glyph(`n${i}`, ch, to, w, {
              color: type,
              fontWeight: 700,
              opacity: interpolate(p, [0.55, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            });
          }
          const fromX = emphX[src] + (wEmph - w) / 2;
          return glyph(`m${i}`, ch, interpolate(p, [0, 1], [fromX, to]), w, {
            color: type,
            fontWeight: 700,
          });
        }),
      ].filter(Boolean);
    } else {
      // The final phrase, CENTRED — it does not inherit the drifted position.
      const w = widthOf(finalX, finally_);
      const hidden = phase === "flood" && !wordOnFlood;
      content = hidden
        ? []
        : [...finally_].map((ch, i) =>
            glyph(`f${i}`, ch, finalX[i], w, {
              fontWeight: 700,
              color: floodColor
                ? mixOklch(floodColor, t.background, 0.92)
                : type,
              opacity: 1,
            }),
          );
    }
  }

  return (
    <AbsoluteFill
      style={{
        background: floodColor ?? paper,
        fontFamily: face,
        ...CRISP,
      }}
    >
      {probe}
      {frame < CUT_AT ? (
        <TextReveal
          text={typed}
          fontSize={fontSize}
          color={type}
          theme={theme}
          mode={mode}
          {...reveal}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 0,
          fontSize,
          lineHeight: 1,
          letterSpacing: "-0.035em",
          transform: `translate(${exitDrift.toFixed(2)}px, ${-fontSize * 0.36}px)`,
          ...promoted,
        }}
      >
        {content}
      </div>
    </AbsoluteFill>
  );
}

export default TypeMorph;
