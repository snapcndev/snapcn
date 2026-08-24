import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Series,
  useVideoConfig,
} from "remotion";
import {
  DEFAULT_FONT,
  googleFontHref,
  resolveFont,
} from "@/lib/video-editor/fonts";
import {
  type AudioTrack,
  type Clip,
  DEFAULT_BACKGROUND,
  isHexColor,
} from "@/lib/video-editor/types";
import registry from "@/registry/__index__";

// A `type` (not `interface`) so it satisfies Remotion's `Record<string, unknown>`
// composition-props constraint — interfaces don't get an implicit index signature.
export type VideoTimelineProps = {
  clips: Clip[];
  /**
   * Paint the snapcn mark into the frame.
   *
   * Never read from the request body. `/api/render` derives it from the signed-
   * in session and passes it here, so a crafted POST cannot ask for a clean
   * export — the only way to turn it off is to actually be signed in.
   */
  watermark: boolean;
  /**
   * Optional soundtrack, played across the whole composition.
   *
   * Absent rather than silent-by-default: `<Audio>` with no source is a
   * decoding error in a render, not a no-op.
   */
  audio?: AudioTrack | null;
  /** Built-in id or Google family. See `lib/video-editor/fonts`. */
  font?: string;
};

/**
 * The video the editor builds: each clip's registry component played back-to-
 * back via `<Series>`, watermarked unless the exporter is signed in. Used by
 * BOTH the
 * in-browser `<Player>` preview and the server MP4 render, so it takes only
 * serializable props (`clips`) and resolves the live `Component` from the slug
 * internally. 1280×720 @30fps — clips that share the canvas render cleanly.
 */
export function VideoTimeline({
  clips,
  watermark = true,
  audio = null,
  font = DEFAULT_FONT,
}: VideoTimelineProps) {
  const { fps } = useVideoConfig();
  const resolved = resolveFont(font);
  useGoogleFont(resolved.googleFamily);
  const valid = clips.filter(
    (c) => registry[c.slug] && (c.durationInFrames ?? 0) > 0,
  );

  return (
    // Redefining `--font-geist-sans` here is what restyles every scene: they
    // all resolve their family through it, so one variable on the composition
    // reaches all of them without any component knowing this control exists.
    <AbsoluteFill
      style={{
        backgroundColor: DEFAULT_BACKGROUND,
        ["--font-geist-sans" as string]: resolved.stack,
        fontFamily: resolved.stack,
      }}
    >
      {valid.length > 0 ? (
        <Series>
          {valid.map((clip) => {
            const Component = registry[clip.slug]
              .Component as React.ComponentType<Record<string, unknown>>;
            return (
              <Series.Sequence
                key={clip.id}
                durationInFrames={Math.max(
                  1,
                  Math.round(clip.durationInFrames),
                )}
              >
                {/* Each clip paints its own ground. An AbsoluteFill per
                    sequence rather than one on the composition, because the
                    background is per-clip: two scenes in one video routinely
                    want different grounds, and re-validating here (not just in
                    the editor) keeps a hostile body from reaching a style. */}
                <AbsoluteFill
                  style={{
                    backgroundColor: isHexColor(clip.background)
                      ? clip.background
                      : DEFAULT_BACKGROUND,
                  }}
                >
                  <Component {...clip.props} />
                </AbsoluteFill>
              </Series.Sequence>
            );
          })}
        </Series>
      ) : (
        <EmptyState />
      )}
      {/* Trimmed to the video, not the other way round: a track longer than the
          timeline would otherwise extend the render, and one shorter simply
          ends. `volume` is applied here so the source file is never modified. */}
      {audio?.src ? (
        <Audio
          src={audio.src}
          volume={Math.min(1, Math.max(0, audio.volume))}
          // The crop: which window of the file plays. No counterpart for the
          // end — the composition stops and takes the audio with it.
          trimBefore={Math.max(0, Math.round((audio.trimStart ?? 0) * fps))}
        />
      ) : null}

      {/* Defaulted on above rather than off: a props object that loses the
          flag in transit should fall back to the marked render, not the free
          one. */}
      {watermark && <Watermark />}
    </AbsoluteFill>
  );
}

function EmptyState() {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.5)",
        fontFamily:
          "var(--font-geist-sans), var(--font-sans), Inter, system-ui, sans-serif",
        fontSize: 30,
        fontWeight: 500,
      }}
    >
      Add components to build your video
    </AbsoluteFill>
  );
}

/**
 * Baked-in brand watermark (renders in preview AND export).
 *
 * The glyph is the real snapcn mark, taken from `public/logo.svg` — it used to
 * be a generic play triangle, which is a video icon rather than *our* icon and
 * marked every free export with somebody else's brand. Inlined rather than
 * fetched: this renders on a server with no origin to resolve a URL against.
 */
/**
 * Fetch a Google family and hold the render until it is actually usable.
 *
 * `delayRender` is the whole point. A server render does not wait for a
 * stylesheet on its own — it screenshots the frame the moment React settles, so
 * without this every export came out in the fallback face while the browser
 * preview, which had time to fetch, looked correct.
 *
 * `continueRender` runs on *every* path including failure. A font that 404s or
 * a network that hangs must produce a video in the fallback face, not a render
 * that sits there until Remotion's timeout kills it.
 */
function useGoogleFont(family: string | null) {
  const [handle] = useState(() =>
    family ? delayRender(`Loading font ${family}`) : null,
  );

  useEffect(() => {
    if (!family || handle === null) return;
    let cancelled = false;

    const href = googleFontHref(family);
    if (!document.querySelector(`link[data-google-font="${family}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.googleFont = family;
      document.head.appendChild(link);
    }

    // `document.fonts.load` resolves once the face is parsed and ready to draw
    // — which is later than the stylesheet finishing, and is the moment that
    // actually matters for a screenshot.
    Promise.all([
      document.fonts.load(`400 32px "${family}"`),
      document.fonts.load(`700 32px "${family}"`),
    ])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) continueRender(handle);
      });

    return () => {
      cancelled = true;
      continueRender(handle);
    };
  }, [family, handle]);
}

const MARK_BLUE = "#0062FC";
/**
 * The mark's own typeface, and deliberately not `--font-geist-sans`.
 *
 * That variable is exactly what the font picker overrides on the composition,
 * so a watermark reading it would reletter itself every time someone chose
 * Serif — picking a typeface for your video should not restyle somebody else's
 * logo. `--font-sans` is never overridden here and resolves to Geist in both
 * places that matter: next/font defines it in the browser preview, and
 * `Root.tsx` defines it in the render bundle.
 */
const WATERMARK_FONT =
  "var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, sans-serif";

function Watermark() {
  return (
    <div
      style={{
        position: "absolute",
        right: 26,
        bottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 16px 9px 10px",
        borderRadius: 999,
        background: "rgba(10,10,12,0.42)",
        color: "rgba(255,255,255,0.92)",
        fontFamily: WATERMARK_FONT,
        fontSize: 21,
        // 500, not 600: at this size on a translucent pill the heavier weight
        // reads as a label competing with the frame rather than a signature
        // sitting on it.
        fontWeight: 500,
        letterSpacing: "-0.01em",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 26,
          height: 26,
          borderRadius: 7,
          background: MARK_BLUE,
        }}
      >
        <svg width={15} height={13} viewBox="0 0 464 409" fill="#fff">
          <title>snapcn</title>
          <g transform="translate(0,409) scale(0.1,-0.1)">
            <path d="M589 3805 c-167 -41 -305 -149 -380 -297 -60 -120 -59 -84 -59 -1239 0 -1004 1 -1059 19 -1112 48 -147 148 -226 331 -262 100 -20 127 -33 186 -87 53 -49 74 -109 74 -212 1 -121 42 -196 133 -244 l52 -27 980 -3 c883 -3 986 -1 1042 13 75 21 133 67 171 139 l27 51 3 315 c2 173 2 342 0 374 l-3 60 -31 -50 c-36 -59 -101 -115 -170 -146 l-49 -23 -810 -3 c-591 -2 -825 0 -865 8 -128 28 -258 121 -325 234 -65 110 -66 128 -63 826 l3 625 24 58 c44 111 147 210 270 259 l56 23 830 3 c809 2 831 2 895 -18 80 -25 149 -74 198 -142 l37 -52 3 334 c3 367 -3 418 -56 494 -30 44 -98 91 -152 106 -22 6 -457 10 -1175 9 -923 -1 -1151 -3 -1196 -14z M3800 2983 c-327 -196 -598 -361 -602 -367 -4 -6 -7 -254 -5 -550 l2 -540 145 -91 c80 -50 208 -130 285 -177 77 -47 283 -174 457 -282 174 -108 326 -196 337 -196 11 0 27 7 35 16 14 14 16 141 16 1254 0 781 -4 1248 -10 1264 -7 20 -16 26 -37 26 -18 -1 -232 -123 -623 -357z" />
          </g>
        </svg>
      </span>
      snapcn
    </div>
  );
}
