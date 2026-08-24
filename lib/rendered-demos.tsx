"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The `<RenderedDemo>` element itself. The list of components that use one, and
 * the URL helpers, live in `lib/demo-urls.ts` — server code needs those and
 * cannot import them across this file's client boundary. Re-exported here so
 * every existing caller keeps one import.
 */
export {
  RENDERED_DEMOS,
  renderedDemoPoster,
  renderedDemoSrc,
} from "./demo-urls";

/**
 * The rendered demo, standing in for a `<Player>`. Deliberately inert — no
 * controls, no audio, no download — because it is a picture of the component,
 * not a video the reader is meant to interact with.
 *
 * It plays on its own, once it is on screen, and pauses the moment it is not.
 *
 * The gate matters more than it looks. This was `autoPlay preload="auto"` with
 * nothing gating it at all, and `/docs/components` renders one card per
 * component — so the grid pulled every demo in full on load and left all of
 * them decoding and looping forever, on a page that never went idle. An
 * `IntersectionObserver` keeps the *behaviour* (a grid that moves) and drops
 * the part that hurt: a demo scrolled past is paused, and one never scrolled to
 * is never fetched, because `preload="none"` means the bytes arrive with the
 * first `play()` and not before.
 *
 * The poster still does the waiting — 164KB for all 22 against 9.9MB of video —
 * so a card is never an empty box, and for a reader who has asked for reduced
 * motion it is *all* they get: no autoplay, and hover or focus to see it move.
 */
export function RenderedDemo({
  src,
  poster,
  className,
}: {
  src: string;
  /** Still frame shown until the reader asks for motion. */
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  // `.catch()` on every play: a browser can refuse (a background tab, an
  // autoplay policy, a pause landing mid-promise) and an unhandled rejection
  // from a decorative preview must not reach the console.
  const play = () => ref.current?.play().catch(() => {});
  const stop = () => ref.current?.pause();

  /**
   * Whether this reader asked for reduced motion — and so the only reader for
   * whom the pointer drives playback at all.
   *
   * A ref, not state: nothing in the render depends on it, it is read inside
   * the handlers, and making it state would cost every card on the page a
   * re-render to learn something that never changes.
   */
  const reduced = useRef(false);

  /**
   * Pointer and focus move the video for a reduced-motion reader **only**.
   *
   * These fired for everybody, on top of the autoplay below, and the `stop`
   * half is the bug that produced: hover a card, move the mouse away, and
   * `onMouseLeave` paused a demo that was playing perfectly well — leaving one
   * frozen card in a grid of moving ones, which is precisely the "looked
   * broken" state the observer's own comment was written to prevent. Moving a
   * pointer across a card is not a request to stop the video under it.
   */
  const pointerPlay = () => {
    if (reduced.current) play();
  };
  const pointerStop = () => {
    if (reduced.current) stop();
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Read once, at mount: a preference change mid-session is not worth a
    // listener per card, and the reader still has hover.
    reduced.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced.current) return;

    // Every demo on screen plays. `isIntersecting` rather than a ratio: a card
    // half-cut by the fold is still a card the reader is looking at, and it
    // looked broken sitting frozen next to seven that were moving.
    //
    // 200px of margin so a card is already running by the time it is scrolled
    // to — the same margin `components/docs/use-lazy-player.ts` uses for the
    // live-Player tier.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) playWhenLoaded(el);
          else el.pause();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.pause();
    };
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      loop
      muted
      playsInline
      // `none`, still. The observer above starts the fetch when the card is
      // actually on screen; `auto` would tell the browser to pull every demo on
      // the page at once — 22 files and 16.6MB before a single pixel of the
      // grid had been looked at, which is the bug this whole mechanism exists
      // to prevent.
      preload="none"
      // Reduced-motion readers only — see `pointerPlay`. For them hover, or
      // focus (the card is a link, so the keyboard tabs through the grid), is
      // the only way to see the thing move. For everyone else these are inert
      // and the IntersectionObserver owns playback.
      onMouseEnter={pointerPlay}
      onMouseLeave={pointerStop}
      onFocus={pointerPlay}
      onBlur={pointerStop}
      // `contain`, not `cover`: the Player letterboxes rather than crops, and a
      // demo that silently crops its own composition is a lie about the output.
      className={cn("size-full object-contain", className)}
    />
  );
}

/**
 * Playback waits for `load`, and for nothing else.
 *
 * A demo is ~450KB and every one on screen plays, so starting them while the
 * page is still fetching puts them in competition with the critical path — and
 * one of them is usually the largest element on screen, so that competition
 * lands directly on LCP. Waiting costs the reader nothing: the poster is
 * already painted, and `load` arrives before anyone has finished reading the
 * heading.
 *
 * ponytail: no cap on concurrent playback — a wide `/docs/components` can run
 * all 22 at once, which is what the grid is *for*, at the cost of ~9.9MB and a
 * page that never goes idle. `preload="none"` still means a card never scrolled
 * to is never fetched. If mobile data or fan noise ever becomes the complaint,
 * the fix is a cap on the most-visible N, not a return to hover-to-play.
 */
let pageLoaded =
  typeof document === "undefined" || document.readyState === "complete";
const waitingForLoad = new Set<HTMLVideoElement>();

function playWhenLoaded(el: HTMLVideoElement): void {
  if (pageLoaded) {
    if (el.paused) void el.play().catch(() => {});
    return;
  }
  if (waitingForLoad.size === 0) {
    window.addEventListener(
      "load",
      () => {
        pageLoaded = true;
        for (const pending of waitingForLoad) {
          if (pending.paused) void pending.play().catch(() => {});
        }
        waitingForLoad.clear();
      },
      { once: true },
    );
  }
  waitingForLoad.add(el);
}
