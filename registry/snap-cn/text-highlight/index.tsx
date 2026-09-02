"use client";

import {
  Easing,
  getRemotionEnvironment,
  Img,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  parseColor,
  resolveFont,
  rgbToOklch,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

export type TextHighlightPreset =
  | "logo-wipe"
  | "marker"
  | "color"
  | "underline"
  | "strikethrough"
  | "shimmer";

export interface TextHighlightSpringConfig {
  damping?: number;
  mass?: number;
  stiffness?: number;
}

/**
 * Rewrite root-relative assets through staticFile only while rendering.
 *
 * A page serves `/logo/mark.png` from `public/`; a Remotion bundle does not —
 * it 404s, and `<Img>` turns that into a `cancelRender` that kills the whole
 * render rather than showing a broken image. Same helper as `logo-flicker`,
 * `logo-assemble` and `moodboard-reveal`; kept per-file on purpose, because a
 * registry component has to stand alone in whatever project copies it.
 */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (isLocal && getRemotionEnvironment().isRendering) {
    return staticFile(src.replace(/^\/+/, ""));
  }
  return src;
}

/** The lighter of two colours — a specular highlight follows the light, not the mode. */
function lighterOf(a: string, b: string): string {
  return (rgbToOklch(parseColor(a)).l ?? 0) >=
    (rgbToOklch(parseColor(b)).l ?? 0)
    ? a
    : b;
}

/** Default line thickness for underline/strikethrough, derived from font size. */
export function defaultThickness(fontSize: number): number {
  return Math.max(2, Math.round(fontSize * 0.08));
}

/**
 * Strikethrough timeline. The line draws over `drawDuration` frames (0–40% of
 * the emphasis window), then the old text crossfades into the replacement
 * over half that long (40–60%), then holds.
 */
export function strikethroughPhases(
  startAt: number,
  drawDuration: number,
): { drawStart: number; drawEnd: number; fadeStart: number; fadeEnd: number } {
  const drawEnd = startAt + drawDuration;
  return {
    drawStart: startAt,
    drawEnd,
    fadeStart: drawEnd,
    fadeEnd: drawEnd + drawDuration * 0.5,
  };
}

/**
 * Apparent size of something travelling toward the camera. `travel` is 0 at rest
 * and 1 at the eye. Size goes as `1 / (1 - travel)`, so it creeps for most of the
 * trip and then blows up right at the end — which is the whole character of a
 * thing coming at your face, and is not something an easing curve can fake. The
 * reference bears this out: the mark sat at 1.4x for over half the rush and then
 * went to 12x in the last few frames.
 */
export function perspectiveScale(travel: number, maxScale: number): number {
  if (maxScale <= 1) return 1;
  const p = 1 - 1 / maxScale;
  return 1 / (1 - p * Math.min(Math.max(travel, 0), 0.9999));
}

/**
 * The mark's lateral position along the swing, in *world* units — before the projection
 * multiplies it by the apparent scale.
 *
 * `drift · travel` is the crossing: it carries the mark from the lockup out past the lens
 * on the far side. `out · sin(π · travel)` is the bow: nought at both ends, widest in the
 * middle, and it is the whole difference between a line and an arc. Subtract it and the
 * mark swings wide on the way out, comes round, and the crossing brings it back through
 * and away — one curve, no corner in it.
 *
 * It turns, and turning is not doubling back. A pendulum at the end of its swing has not
 * changed its mind; it is still going, and the moment its lateral speed passes through
 * nought it is travelling at you faster than ever. What you must not do — what a *drift*
 * does — is take it off one way and then send something else back the other.
 */
export function swingWorldX(
  travel: number,
  drift: number,
  out: number,
): number {
  return drift * travel - out * Math.sin(Math.PI * travel);
}

/**
 * How much the projection magnifies the bow at its widest.
 *
 * The swing is authored in world space and what you *see* is that world path multiplied by
 * the apparent scale — so the arc is at its widest on screen not where the bow is widest
 * (halfway) but where `sin(π · travel) · perspectiveScale(travel)` peaks, out around
 * travel ≈ 0.8, by which point the mark is already several times its resting size. That is
 * the arc doing what an arc coming at your face does: it opens up as it gets near.
 *
 * This finds that peak, and it is the only reason `swingOut` can be quoted in the unit
 * anyone actually thinks in — a fraction of the frame — instead of in world units nobody
 * can picture. It is a good approximation rather than an identity: by the time the bow is
 * at its widest the rightward crossing is already pulling against it, and eats about a
 * fifth. Hence "about" in the prop.
 */
export function swingGain(maxScale: number): number {
  let peak = 1;
  for (let i = 1; i < 128; i++) {
    const t = i / 128;
    const v = Math.sin(Math.PI * t) * perspectiveScale(t, maxScale);
    if (v > peak) peak = v;
  }
  return peak;
}

/**
 * How far the ink has to reach to close the frame.
 *
 * Nothing here measures the word, so nothing knows where the mark actually *is* — only
 * that the lockup is centred and the mark sits at its left end, which puts its resting
 * centre somewhere in `[0, width / 2]` for any string. The swing then carries it
 * `driftPx` further. This is the distance from the worst of those positions to the
 * furthest corner of the frame, so the last frame is flat colour for a two-letter
 * wordmark and a frame-wide one alike.
 *
 * The old code used a flat `0.85 × diagonal`, which was true only while the mark stayed
 * near the middle. Send it out to one side and the far corner is further away than that
 * — the ink stops just short, and a wedge of backdrop survives in the corner.
 */
export function inkReach(
  width: number,
  height: number,
  driftPx: number,
): number {
  const nearest = driftPx; // a wordmark that fills the frame: the mark rests at its left edge
  const furthest = width / 2 + driftPx; // an empty one: the mark rests at the centre
  const horizontal = Math.max(
    Math.abs(nearest),
    Math.abs(furthest),
    Math.abs(width - nearest),
    Math.abs(width - furthest),
  );
  return Math.hypot(horizontal, height / 2) * 1.05;
}

/**
 * How much of the mark's swing the ink *does not* follow.
 *
 * Ink is emitted, not carried: the mark punches away and its colour is left in the wake.
 * Pin the disc to the mark and it flies out to the side with it, which drags the burst
 * off-centre — and then the furthest corner of the frame is the one *behind* the mark, so
 * the last thing on screen is a colour edge closing backwards, against the direction the
 * whole shot is travelling.
 *
 * Not 1, though. At nought lag the disc is born under the mark's centre knot, where there
 * is nothing to see; every step away from that walks its birth out toward the mark's flank,
 * where there is.
 */
const INK_LAG = 0.7;

/** The wipe: the mark leaves and arrives at a standstill, and actually arrives. */
const WIPE_EASE = Easing.bezier(0.2, 0.6, 0.35, 1);
/**
 * The rush — this is the *travel*, not the size. Measured off the reference it is
 * very nearly a constant approach with a little acceleration off the mark; all the
 * drama is the perspective above, not the curve.
 */
const RUSH_EASE = Easing.bezier(0.45, 0.2, 0.45, 1);

/**
 * Default mark: the snapcn mark, the same path `public/logo.svg` draws.
 *
 * Inline and vector on purpose. The rush blows the mark up ~40x, which is where
 * a raster placeholder turns to mush, and it is drawn in `accentColor` so the
 * mark and the wordmark stay one lockup instead of two colours that have to be
 * kept in step by hand. Override it with the `logo` prop — anything that
 * renders will do — or with `logoSrc` for the easy path.
 *
 * The box is square, like the `<Img>` branch below; the mark is 464x409, so it
 * letterboxes inside it exactly the way `objectFit: "contain"` would.
 */
function SnapMark({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 464 409"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <title>mark</title>
      <g transform="translate(0,409) scale(0.1,-0.1)">
        <path
          d="M589 3805 c-167 -41 -305 -149 -380 -297 -60 -120 -59 -84 -59 -1239 0 -1004 1 -1059 19 -1112 48 -147 148 -226 331 -262 100 -20 127 -33 186 -87 53 -49 74 -109 74 -212 1 -121 42 -196 133 -244 l52 -27 980 -3 c883 -3 986 -1 1042 13 75 21 133 67 171 139 l27 51 3 315 c2 173 2 342 0 374 l-3 60 -31 -50 c-36 -59 -101 -115 -170 -146 l-49 -23 -810 -3 c-591 -2 -825 0 -865 8 -128 28 -258 121 -325 234 -65 110 -66 128 -63 826 l3 625 24 58 c44 111 147 210 270 259 l56 23 830 3 c809 2 831 2 895 -18 80 -25 149 -74 198 -142 l37 -52 3 334 c3 367 -3 418 -56 494 -30 44 -98 91 -152 106 -22 6 -457 10 -1175 9 -923 -1 -1151 -3 -1196 -14z M3800 2983 c-327 -196 -598 -361 -602 -367 -4 -6 -7 -254 -5 -550 l2 -540 145 -91 c80 -50 208 -130 285 -177 77 -47 283 -174 457 -282 174 -108 326 -196 337 -196 11 0 27 7 35 16 14 14 16 141 16 1254 0 781 -4 1248 -10 1264 -7 20 -16 26 -37 26 -18 -1 -232 -123 -623 -357z"
          fill={color}
        />
      </g>
    </svg>
  );
}

export interface TextHighlightProps {
  before?: string;
  highlight: string;
  after?: string;
  preset?: TextHighlightPreset;
  /** Overrides the design system's `foreground`. */
  baseColor?: string;
  /** Overrides the design system's `primary`. */
  accentColor?: string;
  /** Design-system token overrides. */
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
  /**
   * Final color of the highlighted span. Defaults to `accentColor` for the
   * "color" and "strikethrough" presets and to `baseColor` otherwise.
   */
  highlightedTextColor?: string;
  /** Strikethrough only: text that crossfades in over the struck span. */
  replaceWith?: string;
  /** Frame at which the emphasis starts. */
  startAt?: number;
  /** Frames the draw/sweep takes. */
  drawDuration?: number;
  springConfig?: TextHighlightSpringConfig;
  /** Underline/strikethrough line thickness. Defaults to round(fontSize * 0.08). */
  thickness?: number;
  /** Shimmer only: color of the sweeping shine. */
  shineColor?: string;

  /** logo-wipe only: the mark. Defaults to the snapcn mark in `accentColor`. */
  logo?: React.ReactNode;
  /**
   * logo-wipe only: URL of a logo image, the easy way to pass a mark. Loaded
   * through Remotion's `<Img>`, so the frame waits for it instead of rendering a
   * hole. A root-relative path (`/logo/mark.png`) is served by your dev server on
   * a page and by `staticFile()` in a render — this resolves it for both, so you
   * do not have to. An absolute URL is passed through untouched.
   *
   * The rush blows this up to fill the frame — around 40x. Ship art with the
   * resolution to survive that (a few hundred pixels will turn to mush), or an
   * SVG via `logo`, which will not. `logo` wins if you pass both.
   */
  logoSrc?: string;
  /** logo-wipe only: mark size as a multiple of `fontSize`. */
  logoScale?: number;
  /** logo-wipe only: turns the mark spins while it wipes the word open. */
  spinTurns?: number;
  /** logo-wipe only: frames the finished lockup rests before the mark rushes you. */
  holdDuration?: number;
  /** logo-wipe only: frames the rush takes. */
  rushDuration?: number;
  /**
   * logo-wipe only: how many times its resting size the mark reaches by the end of the
   * rush.
   *
   * It has to be big enough that the mark's own body **overruns the frame** — at the
   * defaults it starts about 59px across and 42x takes it past 2,400px against a 1,280px
   * frame. That is not showmanship, it is what makes the ending possible at all. The ink
   * has to close over the *left* of the frame while the mark is travelling *right*, and
   * the only way to do that without something sweeping leftward across the screen — a
   * wall, a roller, call it what you like; it is a second momentum and it looks cheap —
   * is for the mark to already be lying over that ground when its ink spreads. Shrink
   * this and the ending has to fetch its colour from somewhere off-stage.
   *
   * Note it is the mark's *box* that overruns the frame, not its ink. A logo with gaps in
   * it scales its holes by exactly as much, so the backdrop keeps showing through them
   * however big it gets — measured on the bundled clover, solid-ink coverage would take
   * 396x. That is what the ink is for.
   */
  rushScale?: number;
  /**
   * logo-wipe only: where the swing *ends up*, as a fraction of the composition width.
   * Positive is right — the mark crosses the frame and goes out past your shoulder.
   *
   * This is the crossing, not the arc. `swingOut` is the arc.
   */
  rushDrift?: number;
  /**
   * logo-wipe only: about how far the mark bows out to the *left* on its way, at the widest
   * point of the arc, as a fraction of the composition width. (About: the rightward crossing
   * is already pulling against the bow by the time it peaks, and eats roughly a fifth of it.)
   *
   * This is what makes the rush a swing instead of a slide. The mark leaves the lockup,
   * arcs wide, comes round, and passes the lens on the other side — a semicircle from the
   * screen to your eye, and it is a single curve with no corner in it.
   *
   * It is not free decoration. The mark has to be *lying over the left of the frame* when
   * its ink bursts, or the colour has to come and find that ground from somewhere, which
   * means something sweeping backwards across the screen. The bow is what puts it there:
   * it is still left of centre at the moment it goes off, so the ink is born on the left
   * and opens out to the right, following the mark out. Take the bow away and the ink has
   * to close leftward against everything else in the shot.
   *
   * Keep it under about a third of the width. The mark rests at the left end of a centred
   * lockup, so a long wordmark starts it near the left edge already, and a big enough bow
   * will walk it off the side — and a mark that leaves the frame has to come back, which is
   * the one thing this ending must never do.
   */
  swingOut?: number;
  /**
   * logo-wipe only: the colour the mark's ink floods out in, and the colour the frame
   * ends on. Defaults to `accentColor`; set it to your mark's own colour if you pass a
   * `logoSrc` that is not the accent. Set it to `"transparent"` to end on the giant mark
   * with the backdrop still showing through it.
   *
   * The ink is a **shape** and it comes **out of the mark** — a hard-edged disc born
   * inside the mark's own centre knot, where it cannot be seen, which then outruns it.
   * Both of those are load-bearing. Slide a coloured rectangle in from an edge instead and
   * it reads as paint being rolled onto the screen by something off-stage. Fade one up to
   * opaque and you get a half-transparent film lying over the backdrop for several frames,
   * which reads as nothing but "the screen turned blue". Ink coming out of the mark is the
   * mark *arriving*, which is the thing that is actually happening.
   *
   * It is keyed to the mark's size, never to the clock, so it cannot begin before the mark
   * already overruns the frame.
   */
  coverColor?: string;

  fontSize?: number;
  fontWeight?: number;
  speed?: number;
  className?: string;
}

export function TextHighlight({
  before = "",
  highlight,
  after = "",
  preset = "logo-wipe",
  baseColor,
  accentColor,
  theme,
  mode,
  fontFamily,
  highlightedTextColor,
  replaceWith,
  startAt = 6,
  drawDuration = 14,
  springConfig,
  thickness,
  shineColor,
  logo,
  logoSrc,
  logoScale = 1.05,
  spinTurns = 1,
  holdDuration = 12,
  rushDuration = 24,
  rushScale = 42,
  rushDrift = 0.55,
  swingOut = 0.25,
  coverColor,
  fontSize = 56,
  fontWeight = 600,
  speed = 1,
  className,
}: TextHighlightProps) {
  const frame = useCurrentFrame() * speed;
  const { fps, width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face =
    resolveFont(fontFamily ?? t.fontFamily) ??
    "Inter, -apple-system, BlinkMacSystemFont, sans-serif";
  const base = baseColor ?? t.foreground;
  const accent = accentColor ?? t.primary;
  // A gloss sweep is white light in both modes, so it takes whichever of the
  // page's two extremes is actually the lighter one rather than a fixed token.
  const shine = shineColor ?? lighterOf(t.card, t.foreground);

  const emphasisColor =
    highlightedTextColor ??
    (preset === "color" || preset === "strikethrough" ? accent : base);
  const lineThickness = thickness ?? defaultThickness(fontSize);

  // High-damping sweep (no bounce) shared by marker + underline.
  const sweep = spring({
    frame: frame - startAt,
    fps,
    config: { damping: 18, ...springConfig },
    durationInFrames: drawDuration,
  });

  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color: base,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
    fontFamily: face,
    whiteSpace: "pre-wrap",
    textAlign: "center",
    maxWidth: "80%",
  };

  if (preset === "logo-wipe") {
    // 0 → 1 as the mark travels from the word's right end to its left end.
    const wipe = interpolate(frame, [startAt, startAt + drawDuration], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: WIPE_EASE,
    });
    // The wipe edge, as a fraction of the word's own width. It is the one number
    // the whole reveal turns on: the word is clipped to everything right of it,
    // and the mark rides it. Everything is a percentage of the word's box, so
    // nothing here needs measuring.
    const edge = (1 - wipe) * 100;

    const rushStart = startAt + drawDuration + holdDuration;
    const travel = interpolate(
      frame,
      [rushStart, rushStart + rushDuration],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: RUSH_EASE,
      },
    );

    const markSize = fontSize * logoScale;
    // How big the mark is *right now*, as a multiple of its resting size.
    const rushed = perspectiveScale(travel, rushScale);
    const markBox = markSize * rushed;
    const diagonal = Math.hypot(width, height);

    // The swing, and it is built where it belongs: in *world* space, then projected.
    //
    // The world path is a crossing with a bow pulled out of it (`swingWorldX`), and the
    // projection multiplies it by the apparent scale. That one multiply is the whole
    // effect. The same world path is a nudge while the mark is far away and a whip across
    // the frame once it is at the lens, which is what an arc coming at your face actually
    // does — it opens up as it arrives. Author the offset in screen pixels instead and no
    // curve you pick will fix it: you get a shape sliding around on glass, in front of the
    // scene rather than through it. I shipped that too.
    //
    // `swingGain` is what lets `swingOut` be quoted as a fraction of the frame: it is the
    // factor the projection applies to the bow at its widest, so dividing it back out here
    // means the arc lands exactly as wide on screen as the prop asked for.
    const worldDrift = (rushDrift * width) / rushScale;
    const worldBow = (swingOut * width) / swingGain(rushScale);
    const swingPx = rushed * swingWorldX(travel, worldDrift, worldBow);

    // The ink, keyed to the mark's size — never to the clock, so it cannot begin while
    // the mark is small.
    //
    // Where the window *opens* is the whole ballgame, and the honest answer came out of
    // rendering the frames rather than reasoning about them. Under a perspective rush the
    // apparent size goes as 1/(1-travel), so every size threshold near the top is crossed
    // within a frame or two of every other one, and the disc has to lay down the entire
    // frame in whatever frames are left. Measured, on the fill it puts on screen:
    //
    //   gate at 1.00 × diagonal    52 → 88 → 100        a cut, in two frames
    //   gate at 0.50 × diagonal     6 → 54 → 83 → 100   still a cut, in three
    //   gate at 0.25 × diagonal     4 → 17 → 49 → 77 → 93 → 100
    //
    // So it opens at a quarter of the diagonal, which sounds far too early and is not:
    // the disc is *born inside the mark's own centre knot* (radius = 3% of the box) where
    // there is nothing to see, and it does not clear the mark's ink for another three
    // frames. It cannot look like a blue screen with a logo on it, because at the moment
    // it starts it is smaller than the logo.
    const flood = interpolate(
      markBox,
      [diagonal * 0.55, diagonal * 1.45],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    // Where the ink actually sits, which is behind the mark — so the reach it has to
    // manage is measured from there, not from wherever the mark has whipped off to.
    const inkPx = swingPx * (1 - INK_LAG);
    const floodRadius =
      flood <= 0
        ? 0
        : interpolate(
            flood,
            [0, 1],
            [
              markBox * 0.03,
              inkReach(width, height, rushDrift * width * (1 - INK_LAG)),
            ],
          );

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // The mark grows well past the frame. Nothing may crop it.
          overflow: "visible",
        }}
      >
        {/* The lockup. The left padding reserves the mark's slot, so flex centres
            [mark][word] as one object rather than centring the word alone and
            leaving the mark hanging off the side. */}
        <div
          className={className}
          style={{
            position: "relative",
            paddingLeft: markSize + fontSize * 0.3,
          }}
        >
          <span
            style={{
              ...textStyle,
              position: "relative",
              display: "inline-block",
              maxWidth: undefined,
              whiteSpace: "nowrap",
            }}
          >
            {/* Only what is right of the edge exists yet. A clip, not a fade —
                the letters arrive already solid, the way a lid sliding off a
                thing reveals it. Percentages resolve against this span's own box,
                which is what makes the whole reveal measurement-free. */}
            <span
              style={{
                display: "block",
                clipPath: `inset(0 0 0 ${edge}%)`,
                // The word does not leave — it gets swallowed. The mark blows up straight
                // through it on its way out, and the ink takes what is left, so nothing
                // fades: a word that is *erased* is worth more than a word that was
                // already gone. It also means the frame is never empty, which is what
                // fading it cost when the mark went with it.
                //
                // The reference runs the wordmark from the accent into the base
                // colour, left to right. Painted through the glyphs, so it moves
                // with them and needs no second element.
                backgroundImage: `linear-gradient(90deg, ${accent}, ${emphasisColor})`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              {highlight}
            </span>

            {/* The mark. `left` is a percentage of the word's box, so it rides the
                wipe edge exactly; `-100%` of its own width parks it just clear of
                the letters, which is where it comes to rest as the logo.

                Two nested elements, and the nesting is load-bearing. The outer one
                *places* the mark — including the sideways swing of the rush, which
                has to live out here in frame pixels. Put the swing inside the
                scale and it would be multiplied by it, so a 200px swing becomes a
                2,800px one the moment the mark is 14x. The inner one only spins
                and grows, about its own centre. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "50%",
                left: `${edge}%`,
                // `max-content`, and it is not optional. This box is absolutely
                // positioned at `left: 100%` for most of the wipe, so the width
                // available to it is (containing block - left) = *zero*, and an
                // auto-width box there is shrink-to-fit: it asks its content for a
                // minimum width and collapses to that. An <svg width={58}> answers
                // "58" and holds it open. An <img> under Tailwind's preflight
                // (`img { max-width: 100% }`) answers "I can be 0" — so the box
                // collapses, 100% of 0 is 0, and the mark renders zero pixels wide.
                // Which is a blank frame and a Player with nothing to draw.
                //
                // It does not reproduce in a Remotion render: a bundle has no
                // preflight. It reproduces in every project that installs this.
                width: "max-content",
                translate: `calc(-100% - ${fontSize * 0.16}px + ${swingPx}px) -50%`,
              }}
            >
              {/* The last beat, and it is a shape — not an opacity, and not something
                  arriving from off-stage.

                  The mark cannot close its own holes by growing, because they grow with
                  it. So its ink floods out from the middle of it: a disc, in the mark's
                  own colour, centred on the mark and carried along by it. It starts life
                  *inside* the mark's centre knot, where it cannot be seen, and then
                  outruns it.

                  This is also the only way the frame can end on flat colour while the mark
                  is on its way *out to the right*. The colour has to close over the left of
                  the frame too, and there are exactly two ways to get it there: something
                  travelling leftwards across the screen — which is a second momentum, and
                  it reads as paint being rolled on by an off-stage hand — or the mark
                  already lying over that ground when its ink spreads. Hence the size: by
                  the time the ink moves, the mark's arms are past all four corners, and
                  what closes the left of the frame is the gaps between them filling in.
                  That is ink arriving, and it is the only thing that reads as one gesture.

                  Both ends are keyed to the mark's *size*, never to the clock, so it cannot
                  start before the mark has already overrun the frame. */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  // Back out the share of the swing the ink does not follow (INK_LAG),
                  // in frame pixels — the mark pulls ahead of its own colour.
                  translate: `calc(-50% - ${swingPx - inkPx}px) -50%`,
                  borderRadius: "50%",
                  background: coverColor ?? accent,
                  width: 2 * floodRadius,
                  height: 2 * floodRadius,
                }}
              />
              <div
                style={{
                  transformOrigin: "50% 50%",
                  rotate: `${spinTurns * 360 * wipe + 30 * travel}deg`,
                  // Grows into the lockup, rests, then comes at you. The two are
                  // separate — the first clamps once the wipe lands, the second is
                  // 1 until the rush starts — so they simply multiply.
                  scale: `${
                    interpolate(wipe, [0, 1], [0.55, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }) * rushed
                  }`,
                }}
              >
                {/* `logo` (any node — an SVG scales forever) beats `logoSrc` (a
                    URL, the easy path) beats the built-in mark. */}
                {logo ??
                  (logoSrc ? (
                    // Remotion's <Img>, not <img>: it holds the frame until the
                    // image has decoded. A bare <img> renders frame 0 as a hole
                    // and you find out from someone else's screenshot.
                    <Img
                      src={resolveSrc(logoSrc)}
                      alt=""
                      style={{
                        display: "block",
                        width: markSize,
                        height: markSize,
                        // Tailwind's preflight caps every img at `max-width: 100%`.
                        // Here that is a bug, not a safety net — see the note on
                        // the placement box above. Opt out explicitly.
                        maxWidth: "none",
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <SnapMark size={markSize} color={accent} />
                  ))}
              </div>
            </div>
          </span>
        </div>
      </div>
    );
  }

  let highlightNode: React.ReactNode;

  if (preset === "marker") {
    highlightNode = (
      <span style={{ position: "relative", display: "inline-block" }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: "-0.02em -0.12em",
            background: withAlpha(accent, 0.16),
            borderRadius: "0.12em",
            transformOrigin: "left center",
            transform: `scaleX(${sweep})`,
            zIndex: 0,
          }}
        />
        <span
          style={{
            position: "relative",
            zIndex: 1,
            color: interpolateColors(
              interpolate(sweep, [0.5, 0.85], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              [0, 1],
              [base, emphasisColor],
            ),
          }}
        >
          {highlight}
        </span>
      </span>
    );
  } else if (preset === "color") {
    highlightNode = (
      <span
        style={{
          color: interpolateColors(
            interpolate(frame, [startAt, startAt + drawDuration], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            [0, 1],
            [base, emphasisColor],
          ),
        }}
      >
        {highlight}
      </span>
    );
  } else if (preset === "underline") {
    highlightNode = (
      <span style={{ position: "relative", display: "inline-block" }}>
        <span
          style={{
            color: interpolateColors(
              interpolate(sweep, [0.5, 0.85], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              [0, 1],
              [base, emphasisColor],
            ),
          }}
        >
          {highlight}
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "-0.06em",
            height: lineThickness,
            background: accent,
            borderRadius: lineThickness / 2,
            transformOrigin: "left center",
            transform: `scaleX(${sweep})`,
          }}
        />
      </span>
    );
  } else if (preset === "strikethrough") {
    const phases = strikethroughPhases(startAt, drawDuration);
    highlightNode = (
      <span
        style={{
          display: "inline-grid",
          verticalAlign: "baseline",
          justifyItems: "center",
        }}
      >
        <span
          style={{
            gridArea: "1 / 1",
            position: "relative",
            whiteSpace: "pre",
            opacity: interpolate(
              frame,
              [phases.fadeStart, phases.fadeEnd],
              [1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          }}
        >
          {highlight}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              height: lineThickness,
              width: `${interpolate(
                frame,
                [phases.drawStart, phases.drawEnd],
                [0, 100],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )}%`,
              background: accent,
              transform: "translateY(-50%)",
              borderRadius: lineThickness / 2,
            }}
          />
        </span>
        <span
          style={{
            gridArea: "1 / 1",
            whiteSpace: "pre",
            color: emphasisColor,
            opacity: interpolate(
              frame,
              [phases.fadeStart, phases.fadeEnd],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
            transform: `translateY(${interpolate(
              frame,
              [phases.fadeStart, phases.fadeEnd],
              [8, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )}px)`,
          }}
        >
          {replaceWith ?? highlight}
        </span>
      </span>
    );
  } else {
    // shimmer
    highlightNode = (
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{ color: emphasisColor }}>{highlight}</span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            color: "transparent",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            backgroundImage: `linear-gradient(110deg, transparent 30%, ${shine} 50%, transparent 70%)`,
            backgroundSize: "200% 100%",
            backgroundPosition: `${interpolate(
              frame,
              [startAt, startAt + drawDuration],
              [200, -100],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )}% 50%`,
          }}
        >
          {highlight}
        </span>
      </span>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span className={className} style={textStyle}>
        {before}
        {highlightNode}
        {after}
      </span>
    </div>
  );
}
