"use client";

import { Player, type PlayerRef } from "@remotion/player";
import type { RefObject } from "react";
import { useMemo } from "react";
import { AbsoluteFill, Img } from "remotion";
import { resolvePreview } from "@/lib/gallery-preview";
import { PreviewStage } from "@/lib/ui-preview-internals";

/**
 * The live `<Player>` fallback, in its own chunk.
 *
 * Everything Remotion the gallery can possibly need is in this file and nothing
 * imports it statically — `gallery-card` and the detail overlay reach it through
 * `next/dynamic`, so the 599KB of component source and player runtime it drags
 * in is fetched only if a card turns up with no rendered demo.
 *
 * Today that is none of them: all 41 free components are in `RENDERED_DEMOS`
 * and the 35 paid ones are video by construction. The branch stays because the
 * alternative is a blank card the first time somebody adds a component and
 * forgets to render its demo — a silent hole, rather than a slow card.
 */
export default function LivePreview({
  slug,
  name,
  stage,
  playerRef,
}: {
  slug: string;
  /** Human label, used by the overlay's stage. */
  name: string;
  /** The overlay's large preview rather than the grid card. */
  stage?: boolean;
  playerRef?: RefObject<PlayerRef | null>;
}) {
  const preview = useMemo(() => resolvePreview(slug), [slug]);

  // Blocks paint their own full-bleed backdrop fill, exactly like PreviewStage
  // — memoized so the Player's `component` identity stays stable across renders
  // (a changing identity would remount the Player and restart playback).
  const Composition = useMemo(() => {
    if (!preview) return null;
    if (!preview.previewBackdrop) return preview.Component;
    const backdrop = preview.previewBackdrop;
    const Inner = preview.Component;
    const Wrapped = (props: Record<string, unknown>) => (
      <AbsoluteFill>
        {backdrop.type === "image" ? (
          <AbsoluteFill>
            <Img
              src={backdrop.src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: backdrop.fit ?? "cover",
              }}
            />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ background: backdrop.value }} />
        )}
        <Inner {...props} />
      </AbsoluteFill>
    );
    return Wrapped;
  }, [preview]);

  if (!preview || !Composition) return null;

  if (stage) {
    return (
      <PreviewStage
        name={name}
        Component={preview.Component}
        inputProps={preview.inputProps}
        durationInFrames={preview.durationInFrames}
        fps={preview.fps}
        compositionWidth={preview.width}
        compositionHeight={preview.height}
        previewBackdrop={preview.previewBackdrop}
      />
    );
  }

  return (
    <Player
      ref={playerRef}
      component={Composition}
      inputProps={preview.inputProps}
      durationInFrames={preview.durationInFrames}
      fps={preview.fps}
      compositionWidth={preview.width}
      compositionHeight={preview.height}
      style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
      controls={false}
      loop
      // Remotion starts playback itself as soon as the player is ready, with no
      // time limit — so a slow-loading card never gets stranded on its first
      // frame the way the rAF play() poll (which gives up after ~2s under a
      // heavy concurrent mount) can leave it. The useLazyPlayer visibility
      // effect still pauses off-screen cards.
      autoPlay
      acknowledgeRemotionLicense
    />
  );
}
