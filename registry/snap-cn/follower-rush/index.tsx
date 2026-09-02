"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { useState } from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

const { fontFamily: FONT_FAMILY } = loadSans("normal", {
  weights: ["400", "500", "700", "800"],
  subsets: ["latin"],
});

export interface Follower {
  name: string;
  /**
   * Square photo for this follower. Root-relative paths (`/avatars/ada.jpg`) are
   * served by the app in the browser and rewritten through `staticFile()` in a
   * render; absolute URLs are passed straight through.
   *
   * Omit it and the avatar falls back to the gradient monogram, which is what
   * makes the fallback worth having: a crowd is the one place a missing photo
   * shows up as a hole in the row.
   */
  avatar?: string;
}

export interface FollowerRushProps {
  totalFollowers?: number;
  followers?: Follower[];
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
  orientation?: "horizontal" | "vertical";
  speed?: number;
}

interface Theme {
  bg: string;
  fg: string;
  fgMuted: string;
  /** Placeholder disc behind a photo — `muted`, one step off the page. */
  avatarBg: string;
}

// The four surfaces this scene paints, taken from the design system rather
// than mirrored as hex — so a user's own token overrides reach the pile-up
// instead of stopping at a copy of the defaults.
function paletteFrom(t: SnapCnTheme): Theme {
  return {
    bg: t.card,
    fg: t.foreground,
    fgMuted: t.mutedForeground,
    avatarBg: t.muted,
  };
}

/**
 * How many photos the sample crowd cycles through.
 *
 * 24, because the wave holds 22 avatars and scrolls two spare slots past the
 * edge (`MAX + 2`), so 24 is the smallest set where no two faces are ever on
 * screen together. Fewer is fine — they just repeat sooner. More is wasted; only
 * 24 can ever be visible at once.
 */
const SAMPLE_AVATAR_COUNT = 24;

/**
 * The crowd of names shown in the pile and named in the callout. Purely
 * flavour — swap it via the `followers` prop.
 *
 * Photos come from `public/avatars/01.jpg … 24.jpg`, kept local so the scene
 * still renders with no network and no CORS. **The files are the only thing this
 * expects — nothing here needs editing to add them.** Any that are missing fall
 * back to the gradient monogram rather than failing the render, which is also
 * what makes this list safe to ship before the folder is filled.
 *
 * There are more names than photos on purpose: the names cycle faster than the
 * faces, so a repeat of either never lines up with a repeat of the other.
 */
export const SAMPLE_FOLLOWERS: Follower[] = [
  "Manon",
  "Melon",
  "Victor",
  "Shane",
  "Lisa",
  "Natasha",
  "Annie",
  "Abdull",
  "Kratos",
  "Jhone",
  "Matt",
  "Huggy",
  "Felomi",
  "Hazar",
  "Mikasa",
  "Silmon",
  "Luciano",
  "Nova",
  "Priya",
  "Theo",
  "Amelia",
  "Rafael",
  "Sofia",
  "Kai",
  "Jordan",
  "Nora",
  "Dana",
  "Milo",
  "Yuki",
  "Bruno",
  "Elena",
  "Omar",
  "Ivy",
  "Leo",
  "Zara",
  "Finn",
  "Maya",
  "Cole",
].map((name, i) => ({
  name,
  avatar: `/avatars/${String((i % SAMPLE_AVATAR_COUNT) + 1).padStart(2, "0")}.jpg`,
}));

// --- Pure helpers (unit-tested) -------------------------------------------

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function smoothstep(x: number): number {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The running follower total at effective frame `fc`. Holds at 1 through the
 * inline intro; then grows *linearly* to a full pile (`midCount`) by `midF`;
 * then *explodes exponentially* to `target`, landing on it at `endF`. This is
 * the reference's shape — a believable trickle, then a blow-up. Rounded and
 * clamped to `[1, target]`.
 */
export function followerCount(
  fc: number,
  target: number,
  startF: number,
  midF: number,
  endF: number,
  midCount: number,
): number {
  if (fc <= startF) return 1;
  if (fc <= midF) {
    const p = (fc - startF) / (midF - startF);
    return Math.min(target, Math.max(1, Math.round(1 + p * (midCount - 1))));
  }
  const p = clamp01((fc - midF) / (endF - midF));
  const c = midCount * (target / midCount) ** p;
  return Math.min(target, Math.round(c));
}

/**
 * How far the crowd has scrolled, in stage px, at effective frame `fc`.
 *
 * The counter explodes from a full pile to the target between `growEnd` and
 * `explodeEnd`, so the crowd accelerates across exactly that window and then
 * holds. It used to travel at a flat 0.85px/frame, which is one avatar slot for
 * the whole blow-up — the number ran to five thousand while a single face went
 * past, and the wave read as still.
 *
 * Velocity ramps linearly `v0 → vMax` over the window, so position is its
 * integral: quadratic while it accelerates, linear once it holds. Velocity is
 * continuous at the join, which is what stops the hand-off being visible — a
 * speed that steps is a jolt no easing curve can hide afterwards.
 */
export function waveScroll(
  fc: number,
  growEnd: number,
  explodeEnd: number,
  v0: number,
  vMax: number,
): number {
  const f = Math.max(0, fc - growEnd);
  const T = explodeEnd - growEnd;
  if (T <= 0) return f * vMax;
  if (f <= T) return v0 * f + ((vMax - v0) * f * f) / (2 * T);
  // Distance banked over the ramp, then flat out.
  return (T * (v0 + vMax)) / 2 + vMax * (f - T);
}

// --- Sub-components --------------------------------------------------------

/** The X verified seal — the shape is the reference's, the fill is the theme
 *  accent (design-system rule: take the shape, leave the brand's paint). */
function VerifiedBadge({ accent, size }: { accent: string; size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 22"
      width={size}
      height={size}
      fill={accent}
      style={{ flexShrink: 0, display: "block" }}
    >
      <title>Verified</title>
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

/** The "new follower" silhouette that leads the pile before the wave takes over. */
function PersonIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color}
      style={{ display: "block" }}
    >
      <title>New follower</title>
      <circle cx="12" cy="7.2" r="4" />
      <path d="M12 13.4c-4.05 0-7.2 2.3-7.2 5.6 0 .55.45 1 1 1h12.4c.55 0 1-.45 1-1 0-3.3-3.15-5.6-7.2-5.6z" />
    </svg>
  );
}

/** Rewrite root-relative assets through staticFile only while rendering. */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (isLocal && getRemotionEnvironment().isRendering) {
    return staticFile(src.replace(/^\/+/, ""));
  }
  return src;
}

/**
 * A follower's photo, over a neutral monogram disc for when there isn't one.
 *
 * The disc used to be a hue derived from the name, which gave the crowd a row of
 * saturated greens and magentas — a palette invented right here, which the
 * design-system rule exists to forbid, and which fought every real photograph
 * put next to it. It is `muted` now: one step off the page, no hue of its own.
 *
 * It stays *underneath* the photo rather than being swapped out for it, so a
 * photo still decoding shows a filled disc instead of a hole in the row.
 * Remotion's `<Img>` holds a render back until it has loaded so a rendered frame
 * never catches that state, but the live `<Player>` and the customizer have no
 * such guarantee, and a row of empty circles reads as broken.
 */
function Avatar({
  follower,
  size,
  ring,
  theme,
  face,
}: {
  follower: Follower;
  size: number;
  ring: number;
  theme: Theme;
  face: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: 9999,
        background: theme.avatarBg,
        // Ring in the page colour, drawn as box-shadow so it doesn't grow the
        // layout box — the overlap pitch stays exact.
        boxShadow: `0 0 0 ${ring}px ${theme.bg}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.fgMuted,
        fontFamily: face,
        fontWeight: 700,
        fontSize: size * 0.4,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {follower.name.charAt(0).toUpperCase()}
      {follower.avatar && failedSrc !== follower.avatar && (
        <Img
          src={resolveSrc(follower.avatar)}
          // Without a handler Remotion treats a 404 as fatal and kills the whole
          // render. One follower with a dead photo URL is not a reason to lose the
          // video — drop back to the monogram already painted underneath.
          //
          // Keyed by src, not a bare boolean: a slot keeps its React instance
          // while the crowd scrolls a *different* follower through it, so a plain
          // `failed` flag would condemn every later face to the same slot.
          onError={() => setFailedSrc(follower.avatar ?? null)}
          // `cover` on a square box: a portrait crops to its centre rather than
          // letterboxing, which is the one thing a circular avatar cannot do.
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: 9999,
            // Preflight's `img { max-width: 100% }` is harmless here because the
            // box is explicitly sized, but say it anyway — this component ships
            // into other people's stylesheets.
            maxWidth: "none",
          }}
        />
      )}
    </div>
  );
}

/** The bold-name + badge + "…followed you" callout under the pile. */
function FollowLine({
  name,
  others,
  fontSize,
  theme,
  accent,
  face,
}: {
  name: string;
  others: number;
  fontSize: number;
  theme: Theme;
  accent: string;
  face: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: fontSize * 0.24,
        whiteSpace: "nowrap",
        fontFamily: face,
        fontSize,
        lineHeight: 1,
      }}
    >
      <span
        style={{ fontWeight: 800, color: theme.fg, letterSpacing: "-0.01em" }}
      >
        {name}
      </span>
      <VerifiedBadge accent={accent} size={fontSize * 0.62} />
      <span style={{ fontWeight: 500, color: theme.fgMuted }}>
        {others <= 0
          ? "followed you"
          : `and ${others.toLocaleString("en-US")} others followed you`}
      </span>
    </div>
  );
}

// --- Main composition ------------------------------------------------------

export function FollowerRush({
  totalFollowers = 5000,
  followers = SAMPLE_FOLLOWERS,
  accentColor,
  theme,
  mode,
  fontFamily,
  orientation = "horizontal",
  speed = 1,
}: FollowerRushProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const tokens = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? tokens.fontFamily) ?? FONT_FAMILY;
  const t = paletteFrom(tokens);
  const accent = accentColor ?? tokens.primary;
  const pool = followers.length > 0 ? followers : SAMPLE_FOLLOWERS;
  const isVertical = orientation === "vertical";

  const refW = isVertical ? 720 : 1280;
  const refH = isVertical ? 1280 : 720;
  const stageScale = Math.min(width / refW, height / refH);
  const fc = frame * speed;

  // --- timeline (effective frames, fps 30) ---
  const APPEAR = 8;
  const INLINE_END = 20; // single "X followed you" notification holds until here
  const MORPH_END = 34; // …then lifts into the stacked pile
  // The pile used to spend 116 frames (3.9s) laying down 21 avatars and the
  // count did not start climbing in earnest until frame 150 — half the clip gone
  // before anything felt urgent, which is what read as the numbers being slow.
  // They were not slower; they started later. 50 frames to fill, and the blow-up
  // begins at 1.8s instead of 5s.
  const GROW_END = 84; // pile fills to MAX; wave + scroll begin
  const EXPLODE_END = 140; // count lands on the target; row has fully bent to a wave

  const MAX = 22; // most avatars ever shown at once

  // `totalFollowers` is the headline "others" number, so the running total that
  // drives the pile is one more (the lead + the others).
  const others = Math.max(0, Math.round(totalFollowers));
  const target = others + 1;
  const count = followerCount(
    fc,
    target,
    INLINE_END,
    GROW_END,
    EXPLODE_END,
    MAX,
  );
  const shownOthers = count - 1;

  // --- layout constants (reference stage px) ---
  const D = isVertical ? 60 : 66; // avatar diameter
  const ring = isVertical ? 3 : 4;
  const pilePitch = D * 0.76; // overlap in the flat pile
  const iconSize = D * 0.92;
  const iconGap = D * 0.24;
  const rowY = isVertical ? refH * 0.4 : 316; // avatar row centre (stacked)
  const textY = isVertical ? refH * 0.52 : 452; // follow-line centre (stacked)
  const inlineY = refH / 2;
  const fontSize = isVertical ? 40 : 48;

  // --- phase progresses ---
  const globalFade = interpolate(fc, [0, APPEAR], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stackP = smoothstep((fc - INLINE_END) / (MORPH_END - INLINE_END));
  // The inline notification clears first; the stacked callout appears after, so
  // the two "…followed you" lines never overlap during the morph.
  const inlineOut = smoothstep((fc - INLINE_END) / 7);
  const textIn = smoothstep((fc - (INLINE_END + 7)) / (MORPH_END - INLINE_END));
  const sp = smoothstep((fc - GROW_END) / (EXPLODE_END - GROW_END)); // flat→wave
  const iconOpacity = interpolate(fc, [GROW_END - 6, GROW_END + 36], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Lead (bold) name cycles ~2.3×/s while followers rush in, then freezes on the
  // last one so the held wave doesn't flicker names forever.
  const NAME_SLOT = 9;
  const nameFreeze = Math.floor((EXPLODE_END - INLINE_END) / NAME_SLOT);
  const nameIdx =
    fc < INLINE_END
      ? 0
      : Math.min(Math.floor((fc - INLINE_END) / NAME_SLOT), nameFreeze);
  const leadName = pool[nameIdx % pool.length].name;

  // --- wave / pile geometry ---
  const waveMargin = isVertical ? 44 : 74;
  const waveLeft = waveMargin;
  const waveSpan = refW - waveMargin * 2;
  const waveP = waveSpan / (MAX - 1);
  const waveAmp = (isVertical ? 40 : 46) * sp;
  const WAVE_FREQ = 1.55; // periods across the strip
  const wavePhase = fc * 0.05; // the wave travels
  // Left alone deliberately: the crowd rushing *through* a slow-moving sine is
  // what makes them surf it. Speed the field up with them and the two motions
  // cancel — the avatars would slide sideways along a wave that no longer
  // appears to lift them.
  //
  // ~22px/frame flat out is one avatar slot every ~2.5 frames (the wave pitch is
  // ~54px here), so about twelve faces a second stream past at the peak.
  //
  // This is near the ceiling for a 30fps composition: at 22px the crowd moves a
  // third of an avatar's diameter per frame, and much past that the row stops
  // reading as travelling and starts reading as strobing — discrete copies
  // rather than motion. Faster than this wants motion blur, not a bigger number.
  const scrollPx = waveScroll(
    fc,
    GROW_END,
    EXPLODE_END,
    isVertical ? 0.6 : 0.85,
    isVertical ? 15 : 22,
  );
  const scrollUnit = Math.floor(scrollPx / waveP);

  // Flat pile: icon + avatars, centred as one group. Width grows smoothly with
  // the (un-rounded) count so adding an avatar doesn't jolt the centring.
  const pileCountF = Math.min(
    MAX,
    fc <= INLINE_END
      ? 1
      : fc <= GROW_END
        ? 1 + ((fc - INLINE_END) / (GROW_END - INLINE_END)) * (MAX - 1)
        : MAX,
  );
  const pileW = (pileCountF - 1) * pilePitch + D;
  const groupW = iconSize + iconGap + pileW;
  const groupLeft = (refW - groupW) / 2;
  const pileStartCX = groupLeft + iconSize + iconGap + D / 2;
  const iconCX = groupLeft + iconSize / 2;

  const isRendering = getRemotionEnvironment().isRendering;
  const willChange = isRendering ? undefined : ("transform" as const);

  const SLOTS = MAX + 2; // two extra so the scroll never opens an edge gap

  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: refW,
          height: refH,
          transform: `translate(-50%, -50%) scale(${stageScale})`,
          opacity: globalFade,
        }}
      >
        {/* ---- Inline first notification: [icon][avatar] Name ✓ followed you.
             Fades up and out as the pile takes over. */}
        {inlineOut < 1 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: iconGap,
              opacity: 1 - inlineOut,
              transform: `translateY(${lerp(0, -18, inlineOut)}px)`,
              willChange,
            }}
          >
            <PersonIcon color={accent} size={iconSize} />
            <Avatar
              follower={pool[0]}
              size={D}
              ring={ring}
              theme={t}
              face={face}
            />
            <div style={{ marginLeft: iconGap * 0.6 }}>
              <FollowLine
                face={face}
                name={pool[0].name}
                others={0}
                fontSize={fontSize}
                theme={t}
                accent={accent}
              />
            </div>
          </div>
        )}

        {/* ---- Person icon leading the flat pile (fades out as the wave forms) */}
        {iconOpacity > 0 && sp < 1 && (
          <div
            style={{
              position: "absolute",
              left: iconCX,
              top: lerp(inlineY, rowY, stackP),
              transform: `translate(-50%, -50%) scale(${1 - sp})`,
              opacity: iconOpacity * stackP,
            }}
          >
            <PersonIcon color={accent} size={iconSize} />
          </div>
        )}

        {/* ---- The avatar crowd: a flat overlapping pile that bends into a
             travelling wave. A single edge mask fades the wave's ends; the
             centred pile never reaches the edges, so it is untouched. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: stackP,
            WebkitMaskImage: `linear-gradient(to right, transparent 0%, #000 ${(waveMargin / refW) * 100 + 1}%, #000 ${100 - (waveMargin / refW) * 100 - 1}%, transparent 100%)`,
            maskImage: `linear-gradient(to right, transparent 0%, #000 ${(waveMargin / refW) * 100 + 1}%, #000 ${100 - (waveMargin / refW) * 100 - 1}%, transparent 100%)`,
          }}
        >
          {Array.from({ length: SLOTS }, (_, i) => {
            const follower = pool[(i + scrollUnit) % pool.length];
            // pile position (flat, centred) → wave position (full width, sine)
            const pileCX = pileStartCX + i * pilePitch;
            const waveCX = waveLeft + i * waveP - (scrollPx % waveP);
            const cx = lerp(pileCX, waveCX, sp);
            const pileCY = lerp(inlineY, rowY, stackP);
            const waveCY =
              rowY +
              waveAmp *
                Math.sin((cx / refW) * Math.PI * 2 * WAVE_FREQ + wavePhase);
            const cy = lerp(pileCY, waveCY, sp);

            // pile avatars pop in as the count reaches them; the two extra
            // scroll slots only exist once the wave is spread out.
            const popIn = smoothstep(clamp01(count - i));
            const baseOpacity = i < MAX ? popIn : 0;
            const opacity = lerp(baseOpacity, 1, sp);
            if (opacity <= 0.001) return null;
            const popScale = lerp(0.55, 1, popIn);

            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional; the follower shown in a slot changes as the crowd scrolls, so keying by follower would remount every frame.
                key={i}
                style={{
                  position: "absolute",
                  left: cx,
                  top: cy,
                  transform: `translate(-50%, -50%) scale(${lerp(popScale, 1, sp)})`,
                  opacity,
                  zIndex: SLOTS - i, // leftmost on top
                  willChange,
                }}
              >
                <Avatar
                  follower={follower}
                  size={D}
                  ring={ring}
                  theme={t}
                  face={face}
                />
              </div>
            );
          })}
        </div>

        {/* ---- Follow-line callout (stacked), centred under the pile/wave. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: textY,
            display: "flex",
            justifyContent: "center",
            transform: `translateY(-50%) translateY(${lerp(12, 0, textIn)}px)`,
            opacity: textIn,
            textRendering: "geometricPrecision",
            willChange,
          }}
        >
          <FollowLine
            face={face}
            name={leadName}
            others={shownOthers}
            fontSize={fontSize}
            theme={t}
            accent={accent}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}
