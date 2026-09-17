"use client";

import { useEffect, useRef } from "react";
import {
  type DemoState,
  type DemoView,
  planDemos,
  SETTLE_MS,
} from "@/lib/demo-governor";
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
 * It plays while it is the part of the page you are looking at, and does
 * nothing at all when it is not. *Which* demos those are is not decided here:
 * every element on the page registers with one shared observer and `planDemos`
 * ranks them together, because "should this play" is a question about the page
 * and cannot be answered by a card looking only at itself. That is what 24
 * simultaneous decoders and 18.7MB of mp4 per visit were — 76 cards each
 * answering it correctly on its own. See `lib/demo-governor.ts`.
 *
 * The src is attached by the governor rather than rendered, so that releasing
 * a scrolled-past demo is not something React puts straight back.
 *
 * For a reader who has asked for reduced motion none of this runs: nothing
 * autoplays, and hover or focus is the only thing that moves a demo.
 */
export function RenderedDemo({
  src,
  poster,
  className,
  priority = false,
}: {
  src: string;
  /** Still frame shown until the reader asks for motion. */
  poster?: string;
  className?: string;
  /** The demo the reader opened — plays ahead of the grid. See `planDemos`. */
  priority?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  // `.catch()` on every play: a browser can refuse (a background tab, an
  // autoplay policy, a pause landing mid-promise) and an unhandled rejection
  // from a decorative preview must not reach the console.
  const play = () => {
    const el = ref.current;
    if (!el) return;
    if (!el.getAttribute("src")) el.setAttribute("src", src);
    el.play().catch(() => {});
  };
  const stop = () => ref.current?.pause();

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
    if (prefersReducedMotion()) play();
  };
  const pointerStop = () => {
    if (prefersReducedMotion()) stop();
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      // Hover is the only thing that starts it, so the src has to be there.
      el.setAttribute("src", src);
      return;
    }
    register(el, src, priority);
    return () => unregister(el);
  }, [src, priority]);

  return (
    <video
      ref={ref}
      poster={poster}
      loop
      muted
      playsInline
      // `none`, still, and no `src` until the governor gives it one. The bytes
      // arrive when the card is actually being looked at and not before —
      // `auto` would tell the browser to pull every demo on the page at once.
      preload="none"
      // Reduced-motion readers only — see `pointerPlay`. For them hover, or
      // focus (the card is a link, so the keyboard tabs through the grid), is
      // the only way to see the thing move. For everyone else these are inert
      // and the governor owns playback.
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

/* ── The shared observer ──────────────────────────────────────────────────── */

interface Entry {
  el: HTMLVideoElement;
  src: string;
  view: DemoView;
  state: DemoState | null;
  settle: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<number, Entry>();
const idOf = new WeakMap<HTMLVideoElement, number>();
let nextId = 0;
let onScreen: IntersectionObserver | null = null;
let nearby: IntersectionObserver | null = null;
let queued = false;

/**
 * Read once, lazily, and cached: a preference change mid-session is not worth a
 * listener per card, and the reader still has hover.
 */
let reduced: boolean | null = null;
function prefersReducedMotion(): boolean {
  if (reduced === null) {
    reduced =
      typeof window === "undefined"
        ? false
        : (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
          false);
  }
  return reduced;
}

function observers() {
  if (onScreen && nearby) return;
  // Thresholds, not a bare `isIntersecting`: the ranking needs to know *how
  // much* of each card is showing, or the cap would drop whichever card
  // happened to register last rather than the sliver at the edge of the fold.
  onScreen = new IntersectionObserver(
    (list) => {
      for (const e of list) {
        const entry = entries.get(idOf.get(e.target as HTMLVideoElement) ?? -1);
        if (entry)
          entry.view.ratio = e.isIntersecting ? e.intersectionRatio : 0;
      }
      schedule();
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
  );
  // Half a viewport either side keeps its src; past that the element is
  // emptied. 150% sounds generous and is not: this grid is nineteen rows, so a
  // band that wide is the whole page and nothing was ever released.
  nearby = new IntersectionObserver(
    (list) => {
      for (const e of list) {
        const entry = entries.get(idOf.get(e.target as HTMLVideoElement) ?? -1);
        if (entry) entry.view.near = e.isIntersecting;
      }
      schedule();
    },
    { rootMargin: "50% 0px" },
  );
  document.addEventListener("visibilitychange", schedule);
}

function register(el: HTMLVideoElement, src: string, priority: boolean) {
  if (typeof IntersectionObserver === "undefined") {
    el.setAttribute("src", src);
    el.play().catch(() => {});
    return;
  }
  observers();
  const id = nextId++;
  idOf.set(el, id);
  entries.set(id, {
    el,
    src,
    view: { ratio: 0, near: false, priority },
    state: null,
    settle: null,
  });
  onScreen?.observe(el);
  nearby?.observe(el);
}

function unregister(el: HTMLVideoElement) {
  const id = idOf.get(el);
  if (id === undefined) return;
  const entry = entries.get(id);
  if (entry?.settle) clearTimeout(entry.settle);
  entries.delete(id);
  onScreen?.unobserve(el);
  nearby?.unobserve(el);
  el.pause();
}

/** Coalesce a scroll's worth of observer callbacks into one decision. */
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    apply();
  });
}

function apply() {
  // A hidden tab decodes nothing. Chrome throttles it anyway; this makes it
  // certain, and makes coming back a re-rank rather than a resume of whatever
  // was running an hour ago.
  const hidden = typeof document !== "undefined" && document.hidden;
  const views = new Map<number, DemoView>();
  for (const [id, entry] of entries) {
    views.set(id, hidden ? { ratio: 0, near: entry.view.near } : entry.view);
  }
  const plan = planDemos(views);

  for (const [id, state] of plan) {
    const entry = entries.get(id);
    if (!entry || entry.state === state) continue;
    entry.state = state;
    if (entry.settle) {
      clearTimeout(entry.settle);
      entry.settle = null;
    }
    applyState(entry, state);
  }
}

/** Addressed, but told to fetch nothing until somebody settles on it. */
function attach(el: HTMLVideoElement, src: string) {
  el.preload = "none";
  if (!el.getAttribute("src")) el.setAttribute("src", src);
}

function applyState(entry: Entry, state: DemoState) {
  const { el, src } = entry;
  switch (state) {
    case "play":
      // Wait, THEN fetch, then start. A flick to the bottom of the grid sweeps
      // every card through "on screen" for a few frames each; the settle is
      // what makes that free, and it only is if `preload` stays `none` until it
      // fires — deferring `play()` alone still had `auto` pulling all 76 files,
      // which measured 22.4MB for a scroll nobody looked at.
      attach(el, src);
      entry.settle = setTimeout(() => {
        el.preload = "auto";
        playWhenLoaded(el);
      }, SETTLE_MS);
      break;
    case "hold":
      // On screen, over the cap. Fetched — so it shows a frame rather than a
      // hole — but never decoded; it becomes "play" the moment a card above it
      // leaves. Same settle, for the same reason.
      attach(el, src);
      el.pause();
      entry.settle = setTimeout(() => {
        el.preload = "auto";
      }, SETTLE_MS);
      break;
    case "ready":
      // Addressed but not fetched. `metadata` here cost 76 range requests and
      // 7MB on a page where nothing had been looked at yet — Chrome's idea of
      // "metadata" for an mp4 is the first chunk of it, not the moov box. The
      // src is attached so arriving is one state change and not a React render.
      attach(el, src);
      el.pause();
      break;
    case "release":
      el.pause();
      if (el.getAttribute("src")) {
        el.removeAttribute("src");
        el.preload = "none";
        // The only way to make a browser let go of the buffer and the decoder.
        el.load();
      }
      break;
  }
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
 * Exported for the test that pins the staleness bug: the only way to catch it
 * is to call this once while the document is still loading and again after it
 * has finished, on a fresh element, and a pure helper cannot see that.
 *
 * ponytail: no cap on concurrent playback — a wide `/docs/components` can run
 * all 22 at once, which is what the grid is *for*, at the cost of ~9.9MB and a
 * page that never goes idle. `preload="none"` still means a card never scrolled
 * to is never fetched. If mobile data or fan noise ever becomes the complaint,
 * the fix is a cap on the most-visible N, not a return to hover-to-play.
 */
const waitingForLoad = new Set<HTMLVideoElement>();
let listening = false;

export function playWhenLoaded(el: HTMLVideoElement): void {
  // Read `readyState` here, on every call — never once at module scope.
  //
  // This is a client-side-routed site, and `window`'s `load` fires exactly once
  // per hard navigation. A module-scope snapshot is taken while the *first*
  // page is still loading, so it says `false`; if no demo happens to be on that
  // first page, nothing ever queues, the listener is never attached, and the
  // stale `false` outlives the only `load` there will ever be. Every card
  // reached by client navigation from then on queues for an event that has
  // already fired and sits on its poster forever — which is exactly the report:
  // hard-refresh `/docs/components` and the grid runs, navigate to it and it is
  // a wall of stills.
  //
  // `readyState` stays "complete" for the rest of the session, so asking it
  // each time answers both cases with one branch.
  if (typeof document === "undefined" || document.readyState === "complete") {
    if (el.paused) void el.play().catch(() => {});
    return;
  }
  waitingForLoad.add(el);
  if (listening) return;
  listening = true;
  window.addEventListener(
    "load",
    () => {
      for (const pending of waitingForLoad) {
        if (pending.paused) void pending.play().catch(() => {});
      }
      waitingForLoad.clear();
    },
    { once: true },
  );
}
