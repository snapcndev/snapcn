import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  Composition,
  registerRoot,
} from "remotion";
import {
  VideoTimeline,
  type VideoTimelineProps,
} from "@/components/video-editor/video-timeline";
import { CANVAS, type Clip, totalDuration } from "@/lib/video-editor/types";

/**
 * Duration of the timeline = Σ per-clip durations, resolved from `inputProps`
 * at render time. Typed standalone so the `Composition` generic pins its props
 * to `{ clips }` instead of widening to `Record<string, unknown>`.
 */
const timelineMetadata: CalculateMetadataFunction<VideoTimelineProps> = ({
  props,
}) => ({
  durationInFrames: totalDuration(props.clips ?? []),
});

/**
 * Bundle root for the `/docs/video-editor` export. `video-timeline`'s duration
 * is derived from the `clips` prop via `calculateMetadata` (Σ per-clip
 * durations), so one composition renders any user-assembled timeline.
 */
// next/font does not exist in a standalone Remotion bundle, so none of the
// `--font-geist-*` variables the scenes reference resolve here — which is why
// an exported mp4 came out in a fallback face while the browser preview looked
// right. `demos-root.tsx` already solved this for the demo renders; this is the
// same bridge on the entry the video editor's export actually uses.
//
// Both spellings are defined: 15 registry components ask for
// `--font-geist-sans`, and the site also exposes plain `--font-sans`. Missing
// either one silently reverts that text to the fallback.
// Weights and subsets pinned. An unqualified `loadFont()` pulls all nine
// weights across five subsets — the renderer logged 90 requests for Geist and
// 108 for Geist Mono on a single frame, every one of them blocking the render
// while Cyrillic faces nothing in this registry uses were fetched.
const { fontFamily: GEIST } = loadGeist("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: GEIST_MONO } = loadGeistMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

const FONT_VARS = {
  ["--font-sans" as string]: GEIST,
  ["--font-geist-sans" as string]: GEIST,
  ["--font-geist-mono" as string]: GEIST_MONO,
  fontFamily: GEIST,
} as const;

/** `VideoTimeline` with the font variables its scenes expect in scope. */
function TimelineWithFonts(props: VideoTimelineProps) {
  return (
    <AbsoluteFill style={FONT_VARS}>
      <VideoTimeline {...props} />
    </AbsoluteFill>
  );
}

export function RemotionRoot() {
  return (
    <Composition
      id="video-timeline"
      component={TimelineWithFonts}
      durationInFrames={300}
      fps={CANVAS.fps}
      width={CANVAS.width}
      height={CANVAS.height}
      defaultProps={{ clips: [] as Clip[], watermark: true }}
      calculateMetadata={timelineMetadata}
    />
  );
}

registerRoot(RemotionRoot);
