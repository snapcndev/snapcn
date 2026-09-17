import { AbsoluteFill, Series } from "remotion";
import { BlockWordmark } from "@/components/snap-cn/block-wordmark";
import {
  type Follower,
  FollowerRush,
} from "@/components/snap-cn/follower-rush";
import { PhoneFrame } from "@/components/snap-cn/phone-frame";
import { TextHighlight } from "@/components/snap-cn/text-highlight";
import { TextReveal } from "@/components/snap-cn/text-reveal";
import { type SnapCnTheme, useSnapCnTheme } from "@/lib/snap-cn-ui";

export interface LaunchVideoProps {
  /** Beat 1 — the opening title. */
  headline?: string;
  /** Beat 2 — the claim, with `highlight` swept under a marker. */
  claimBefore?: string;
  highlight?: string;
  claimAfter?: string;
  /** Beat 3 — your product on a phone: an image or a video URL. Omit it for the built-in placeholder screen. */
  screenSrc?: string;
  /** Beat 4 — the follower count the pile rushes up to, and the faces in it. */
  followerCount?: number;
  followers?: Follower[];
  /** Beat 5 — the wordmark the video ends on. */
  wordmark?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  fontFamily?: string;
  speed?: number;
}

/**
 * Each beat's length at speed 1, in frames at 30fps — the component's own
 * length, or the frame its payoff lands on plus a hold. Register the
 * composition at `LAUNCH_VIDEO_DURATION` frames, 1280×720.
 */
export const LAUNCH_VIDEO_BEATS = {
  title: 90, // text-reveal: the sentence has assembled by ~62 and holds
  claim: 66, // text-highlight marker: drawn by frame 20, then read
  product: 150, // phone-frame showcase pose, scaled to the beat
  proof: 180, // follower-rush: the count lands on 140, holds 40
  outro: 150, // block-wordmark: its own full length, ending on the mark
} as const;

export const LAUNCH_VIDEO_DURATION = Object.values(LAUNCH_VIDEO_BEATS).reduce(
  (a, b) => a + b,
  0,
);

/**
 * A whole product launch video: title → claim → product → social proof →
 * wordmark, one snapcn component per beat on hard cuts.
 *
 * It paints nothing of its own except the page behind the beats that are
 * transparent, and that is the theme's `background` — so a theme or mode passed
 * here reaches every beat, and the video belongs to the same palette as the app
 * it is launching. Swap any beat for another snapcn component: each is a plain
 * `<Series.Sequence>`, and inside one `useCurrentFrame()` starts again at 0.
 */
export function LaunchVideo({
  headline = "Meet Acme Billing",
  claimBefore = "Invoices that ",
  highlight = "chase themselves",
  claimAfter = "",
  screenSrc,
  followerCount = 5000,
  followers,
  wordmark = "acme",
  theme,
  mode,
  fontFamily,
  speed = 1,
}: LaunchVideoProps) {
  const t = useSnapCnTheme(theme, mode);
  const shared = { theme, mode, fontFamily, speed };
  // Faster playback shortens every beat by the same factor, so the cuts stay on
  // the payoffs instead of landing in the dead air after them.
  const beat = (frames: number) => Math.ceil(frames / speed);

  return (
    <AbsoluteFill style={{ background: t.background }}>
      <Series>
        <Series.Sequence durationInFrames={beat(LAUNCH_VIDEO_BEATS.title)}>
          <TextReveal text={headline} {...shared} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={beat(LAUNCH_VIDEO_BEATS.claim)}>
          <TextHighlight
            preset="marker"
            before={claimBefore}
            highlight={highlight}
            after={claimAfter}
            {...shared}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={beat(LAUNCH_VIDEO_BEATS.product)}>
          <PhoneFrame
            variant="showcase"
            entrance="float"
            screenSrc={screenSrc}
            {...shared}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={beat(LAUNCH_VIDEO_BEATS.proof)}>
          <FollowerRush
            totalFollowers={followerCount}
            followers={followers}
            {...shared}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={beat(LAUNCH_VIDEO_BEATS.outro)}>
          <BlockWordmark text={wordmark} {...shared} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}
