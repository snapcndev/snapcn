"use client";

import type { PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { useAutoplay } from "@/app/(home)/components/use-autoplay";

/**
 * Shared lazy-mount wiring for card-grid Remotion previews.
 *
 * A gallery of 100+ cards can't mount a live `<Player>` per card eagerly — that
 * fires every composition's font/asset loads and render loop at once on page
 * load. This hook mounts a card's preview only once it nears the viewport
 * (`IntersectionObserver`, `rootMargin: "200px 0px"`), autoplays it via
 * `useAutoplay`, and pauses playback whenever the card scrolls back out of view,
 * so at most a handful of previews are ever actively rendering.
 *
 * This drives the live `<Player>` tier only. A card whose preview is a rendered
 * demo is a plain `<video>`, and that element belongs to `RenderedDemo` — see
 * the note on the effect below.
 *
 * Extracted verbatim from `component-card.tsx` so both the docs `ComponentCard`
 * and the gallery `GalleryCard` share one implementation — no copy-paste drift
 * on this load-bearing perf path.
 */
export function useLazyPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([observerEntry]) => {
        setVisible(observerEntry.isIntersecting);
        if (observerEntry.isIntersecting) setMounted(true);
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useAutoplay(playerRef, mounted);

  /**
   * Play/pause the live `<Player>` with the card's visibility.
   *
   * It used to reach into the DOM for a `<video>` as well and force-play that,
   * because Chrome's muted-autoplay policy declines to start an element created
   * off-screen and the card would sit frozen on a blank first frame.
   *
   * That is no longer this hook's call to make. `RenderedDemo` now ships a
   * poster and plays on hover, and a `querySelector` from out here quietly
   * overruled it — every one of the 22 demos on `/docs/components` downloaded
   * and looped anyway, which is the 9.9MB the poster exists to avoid. Two
   * places deciding whether a video plays is how they end up disagreeing; the
   * element belongs to the component that renders it.
   */
  useEffect(() => {
    if (!mounted) return;
    const player = playerRef.current;
    if (!player) return;
    if (visible) {
      if (!player.isPlaying()) player.play();
    } else {
      player.pause();
    }
  }, [mounted, visible]);

  return { containerRef, playerRef, mounted, visible };
}
