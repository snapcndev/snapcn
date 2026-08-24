"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { Pause, Play } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { formatTimecode } from "@/lib/video-editor/timeline-zoom";
import {
  type AudioTrack,
  CANVAS,
  type Clip,
  totalDuration,
} from "@/lib/video-editor/types";
import { VideoTimeline } from "./video-timeline";

export interface EditorPlayerHandle {
  seekTo: (frame: number) => void;
}

/**
 * The canvas and its transport.
 *
 * Remotion's built-in `controls` are switched off and replaced with our own
 * row, for one reason: the timeline below needs the playhead, which means this
 * component has to own the frame anyway. Two clocks — Remotion's overlay and
 * the timeline's playhead — reading from different sources is how they end up
 * disagreeing by a frame.
 *
 * `frameupdate` fires on every rendered frame, so the state it writes drives a
 * re-render at up to 30fps. That is affordable here because the subtree it
 * moves is a `<div>` and a couple of `<span>`s; do not hang anything expensive
 * off `currentFrame`.
 */
export function EditorPlayer({
  clips,
  watermark,
  audio,
  font,
  playerRef,
  onFrame,
}: {
  clips: Clip[];
  /** Preview only — the exported file's mark is decided by the server. */
  watermark: boolean;
  /** Preview only — a `blob:` URL cannot be resolved by a server render. */
  audio: AudioTrack | null;
  font: string;
  playerRef: React.RefObject<EditorPlayerHandle | null>;
  onFrame: (frame: number) => void;
}) {
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);

  const durationInFrames = totalDuration(clips);

  // Memoised, and this is not a micro-optimisation. `frameupdate` sets state 30
  // times a second, and an object literal in the JSX below would hand `<Player>`
  // a new `inputProps` on every one of those renders — re-rendering the whole
  // composition, and with it the `<Audio>`, thirty times a second. That is what
  // made the soundtrack stutter.
  const inputProps = useMemo(
    () => ({ clips, watermark, audio, font }),
    [clips, watermark, audio, font],
  );

  useImperativeHandle(playerRef, () => ({
    seekTo: (target: number) => {
      player?.seekTo(Math.max(0, Math.min(durationInFrames - 1, target)));
    },
  }));

  // Callback ref: `<Player>` mounts asynchronously, so a `useRef` read in an
  // effect is null on the pass that matters. State forces the re-subscribe.
  useEffect(() => {
    if (!player) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setFrame(e.detail.frame);
      onFrame(e.detail.frame);
    };
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("frameupdate", onFrameUpdate);
    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("frameupdate", onFrameUpdate);
    };
  }, [player, onFrame]);

  const toggle = useCallback(() => {
    if (!player) return;
    if (player.isPlaying()) player.pause();
    else player.play();
  }, [player]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
      {/* The canvas floats on the stage's ground rather than sitting in a card —
          the shadow is what separates it, the way a sheet of paper is separated
          from a desk.

          No `max-w`: the sheet should take every pixel the stage can give it.
          `aspect-video` with both `max-h-full` and `max-w-full` lets whichever
          axis runs out first do the constraining, so it stays 16:9 and as large
          as it can be in either a tall window or a wide one. */}
      {/* `container-type: size` makes the stage a query container in both axes,
          which is what lets the canvas below size itself from the *stage* rather
          than from its own contents. */}
      <div
        className="flex min-h-0 w-full flex-1 items-center justify-center"
        style={{ containerType: "size" }}
      >
        {/* width = the smaller of "all the stage's width" and "the width a
            full-height 16:9 box would need". Then `aspect-ratio` derives the
            height. Both axes are respected with no measuring and no JS.

            This replaces `w-auto max-h-full`, which collapsed the canvas to
            nothing: `w-auto` inside a flex row means shrink-to-fit, the Player
            inside is `width:100%` of that, and a parent sized by a child sized
            by its parent resolves to zero. `max-h-full` is a ceiling, never a
            height, so nothing stopped it. */}
        <div
          style={{
            width: `min(100cqw, calc(100cqh * ${CANVAS.width} / ${CANVAS.height}))`,
            aspectRatio: `${CANVAS.width} / ${CANVAS.height}`,
          }}
          className="overflow-hidden rounded-lg bg-black shadow-[0_16px_44px_-22px_rgba(0,0,0,0.30)] ring-1 ring-black/[0.07]"
        >
          <Player
            ref={setPlayer}
            component={VideoTimeline}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            fps={CANVAS.fps}
            compositionWidth={CANVAS.width}
            compositionHeight={CANVAS.height}
            style={{ width: "100%", height: "100%" }}
            loop
            acknowledgeRemotionLicense
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <span className="w-10 text-right font-mono text-sm tabular-nums text-foreground">
          {formatTimecode(frame / CANVAS.fps)}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-11 place-items-center rounded-full bg-background text-foreground shadow-[0_6px_18px_-6px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.06] transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="size-5 translate-x-px fill-current" />
          )}
        </button>
        <span className="w-10 font-mono text-sm tabular-nums text-muted-foreground">
          {formatTimecode(durationInFrames / CANVAS.fps)}
        </span>
      </div>
    </div>
  );
}
