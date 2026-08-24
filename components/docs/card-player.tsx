"use client";

import { Player, type PlayerRef } from "@remotion/player";
import type { RefObject } from "react";
import { getDefaults } from "@/lib/customizer-config";
import registry from "@/registry/__index__";

/**
 * A card's live player, in its own chunk.
 *
 * Every component in the registry today has a rendered mp4, so this path only
 * runs for one that does not yet — and it is the reason the card grid used to
 * pull all 22 scenes and Remotion into every docs page that rendered a grid.
 * `next/dynamic` keeps it out until a card actually has no demo to show.
 */
export default function CardPlayer({
  slug,
  playerRef,
}: {
  slug: string;
  playerRef: RefObject<PlayerRef | null>;
}) {
  const entry = registry[slug];
  if (!entry) return null;

  const { Component, config } = entry;
  return (
    <Player
      ref={playerRef}
      component={Component}
      inputProps={getDefaults(config.controls)}
      durationInFrames={config.durationInFrames}
      fps={config.fps}
      compositionWidth={config.compositionWidth}
      compositionHeight={config.compositionHeight}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "var(--card)",
      }}
      controls={false}
      loop
      // Remotion starts playback itself once the player is ready (no time
      // limit), so a slow-loading card never freezes on its first frame the
      // way the rAF play() poll can when it gives up under a heavy mount.
      autoPlay
      acknowledgeRemotionLicense
    />
  );
}
