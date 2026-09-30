import { loadFont } from "@remotion/google-fonts/Geist";
import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Composition,
  interpolate,
  registerRoot,
  Sequence,
  Series,
  useCurrentFrame,
} from "remotion";
import { AnnounceTitle } from "@/registry/snap-cn/announce-title";
import { LogoFlicker } from "@/registry/snap-cn/logo-flicker";
import { OrbitGallery } from "@/registry/snap-cn/orbit-gallery";
import { WordmarkCut } from "@/registry/snap-cn/wordmark-cut";

/**
 * X post, day 1 HERO: one prompt, two results, side by side.
 * Left is what Opus 5.5 writes with no library (centred text, gradient, fades);
 * right is the same brief composed from snapcn scenes at their natural lengths.
 * 170 + 60 + 40 + 66 = 336f = 11.2s @30fps.
 * orbit-gallery cut from 300f to 60f (at 2.5×) and logo-flicker to its last 40f: both read as dead air at full length.
 */
const { fontFamily } = loadFont();
const SPLIT = 336;
const PAGE = "#FFFFFF";
// Two 16:9 panels edge to edge: 16 + 936 + 16 + 936 + 16 = 1920 wide. 816 tall = 2.35:1, inside X's 2.39:1 upload limit.
const W = 1920;
const H = 816;

/** A full 1920×1080 scene shrunk into a 936×527 panel, so components lay out at their real size. */
const Panel = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      width: 936,
      height: 527,
      overflow: "hidden",
      borderRadius: 14,
      position: "relative",
    }}
  >
    <div
      style={{
        width: 1920,
        height: 1080,
        transform: "scale(0.4875)",
        transformOrigin: "top left",
        position: "absolute",
      }}
    >
      {children}
    </div>
  </div>
);

/** The no-library version, written the way an agent does it from a blank file. */
const OpusAlone = () => {
  // Loops on its own clock (60f a line) instead of stretching three lines over the whole split.
  const f = useCurrentFrame();
  const beats = [
    "Introducing snapcn",
    "Remotion components for your videos",
    "Get started at snapcn.dev",
  ];
  const LEN = 60;
  const i = Math.floor(f / LEN) % beats.length;
  const local = f % LEN;
  const opacity = interpolate(local, [0, 10, LEN - 10, LEN], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });
  const y = interpolate(local, [0, 12], [40, 0], { extrapolateRight: "clamp" });
  const scale = interpolate(local, [0, LEN], [1, 1.04]);
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #fafafa, #e4e4e7)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${y}px) scale(${scale})`,
          color: "#09090B",
          fontSize: 110,
          fontWeight: 700,
          letterSpacing: -2,
          textAlign: "center",
          padding: 120,
          fontFamily,
        }}
      >
        {beats[i]}
      </div>
    </AbsoluteFill>
  );
};

const WithSnapcn = () => (
  <Series>
    <Series.Sequence durationInFrames={170}>
      <AnnounceTitle
        eyebrow="Introducing"
        title="snapcn"
        tagline="Remotion scenes your agent can use."
      />
    </Series.Sequence>
    <Series.Sequence durationInFrames={60}>
      <OrbitGallery
        speed={2.5}
        title="Launch videos, in React"
        subtitle="97 Remotion components"
        buttonLabel="snapcn.dev"
      />
    </Series.Sequence>
    <Series.Sequence durationInFrames={40}>
      {/* from={-60}: skips the first 2s of the flicker, so the clip is its last 40f and ends on the resolved logo. */}
      <Sequence from={-60}>
        <LogoFlicker brandName="snapcn" />
      </Sequence>
    </Series.Sequence>
    <Series.Sequence durationInFrames={66}>
      <WordmarkCut word="snapcn." mode="dark" />
    </Series.Sequence>
  </Series>
);

const Label = ({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: boolean;
}) => (
  <div
    style={{
      fontFamily,
      fontSize: 52,
      fontWeight: 700,
      color: accent ? "#09090B" : "#71717a",
      height: 90,
      display: "flex",
      alignItems: "center",
    }}
  >
    {children}
  </div>
);

const Split = () => (
  <AbsoluteFill
    style={{
      background: PAGE,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    }}
  >
    <div>
      <Label>Opus 5.5 alone</Label>
      <Panel>
        <OpusAlone />
      </Panel>
    </div>
    <div>
      <Label accent>Opus 5.5 + snapcn</Label>
      <Panel>
        <WithSnapcn />
      </Panel>
    </div>
  </AbsoluteFill>
);

// No end card: the right panel already ends on the snapcn wordmark, and the post carries the link.
export const OpusSplit = Split;

registerRoot(() => (
  <Composition
    id="OpusSplit"
    component={OpusSplit}
    durationInFrames={SPLIT}
    fps={30}
    width={W}
    height={H}
  />
));
