"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTrackEvent } from "@/lib/analytics";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import {
  drawWallCard,
  mod,
  startSlot,
  WALL,
  type WallArt,
  wallGeometry,
  wallOffset,
} from "./showcase-wall";

/**
 * One card on the wall. Built on the server (see the home page) from
 * `RENDERED_DEMOS` and `GALLERY_ITEMS`, and handed in: importing the gallery
 * here put the whole catalogue — every component's name and blurb, and the
 * registry JSON it is read out of — into the home page's JavaScript, to render
 * a dozen titles.
 */
export type ShowcaseSlide = {
  slug: string;
  /** The rendered mp4, content-hashed. */
  src: string;
  /** A still of it, content-hashed like the video. */
  poster: string | null;
  href: string;
  name: string;
  description: string;
};

/**
 * How long the curve may take to draw, per frame, before the wall gives it up.
 * Averaged over the first `PAINT_SAMPLES` frames that have a curve to draw.
 * A 60fps frame is 16.7ms and the browser needs most of it; a wall that spends
 * a third of it bending pictures is a wall the page is waiting on.
 */
const PAINT_BUDGET_MS = 5;
const PAINT_SAMPLES = 45;

/**
 * …and the frame rate the reader actually gets, which is the measure that
 * counts. The JavaScript above is only part of a frame: without a GPU the
 * canvas is rasterised and every video decoded on the CPU *after* it, where a
 * timer around `paint` never sees it — measured on such a machine, `paint`
 * came in under budget while the page ran at 20fps with the main thread
 * pinned. Averaged over `FRAME_SAMPLES` frames; slower than `FRAME_BUDGET_MS`
 * and the wall drops to low-power: flat, and only the cards in the reading
 * zone playing.
 */
const FRAME_BUDGET_MS = 22;
const FRAME_SAMPLES = 60;

/**
 * Cards whose poster is in the server HTML — the ones on screen when the page
 * opens (six covers the widest stage). Every other card gets its poster as it
 * approaches. All forty-two up front was ~180KB of stills fetched before
 * `load`, which put `load` back 1.3s on a slow phone — and `load` is what the
 * wall waits for before it starts any video.
 */
const EAGER_POSTERS = 6;

/**
 * Whether this visit should load no video at all: the reader has asked to save
 * data, or the connection could not keep up with a wall of them anyway. The
 * posters are the wall then — it still moves, it just moves stills.
 */
function wantsLite(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const c = nav.connection;
  if (c?.saveData) return true;
  if (c?.effectiveType && /(^|-)2g$|^3g$/.test(c.effectiveType)) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) {
    return true;
  }
  return window.matchMedia?.("(prefers-reduced-data: reduce)").matches ?? false;
}

export function ShowcaseCarousel({ slides }: { slides: ShowcaseSlide[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  /** Each card's last-written offset within the track, so `paint` skips the
      style write on the ~every frame it has not changed. */
  const offsets = useRef<number[]>([]);
  /** One card's surface, to read the radius the stylesheet actually gave it. */
  const surfaceRef = useRef<HTMLDivElement>(null);
  const cardVideos = useRef<(HTMLVideoElement | null)[]>([]);
  const videos = useRef(new Set<HTMLVideoElement>());
  /** Per card: its current frame, copied once per new frame (see `WallArt`). */
  const frames = useRef<({ canvas: HTMLCanvasElement; time: number } | null)[]>(
    [],
  );
  /** Per card: its poster as an image the canvas can draw, once it has loaded. */
  const posters = useRef<(HTMLImageElement | null)[]>([]);
  /** Videos that failed to load. They keep their poster and are never retried. */
  const failed = useRef(new WeakSet<HTMLVideoElement>());
  /** The browser refused to autoplay (iOS Low Power Mode, a site setting). Once
      is enough to know: asking again per card only fails again. */
  const blocked = useRef(false);
  /** The curve is off: the stage is too narrow to fold, or this device could not
      draw it in budget. Either way the wall is the flat row a phone gets. */
  const flatOnly = useRef(false);
  const paintCost = useRef({ total: 0, count: 0 });
  const frameCost = useRef({ total: 0, count: 0 });
  /** This device cannot run the whole wall: flat, and at most the cards in the
      reading zone play (see `FRAME_BUDGET_MS`). Decided once per visit. */
  const lowPower = useRef(false);
  /** Per card, whether low-power mode last asked it to play — so `paint` only
      calls play/pause when the answer changes, not every frame. */
  const wantPlay = useRef<boolean[]>([]);
  const dpr = useRef(1);
  /** What the stylesheet says a card is made of. Sampled on layout and on a
      theme change rather than per frame: reading computed style in the middle
      of a loop that is writing inline styles is how you buy a recalc a frame. */
  const tokens = useRef({ fill: "#f2f4f7", stroke: "#e4e7ec", radius: 0 });
  /** The stage's box, measured on layout. Asking the DOM for it inside the loop
      is a forced style resolution every frame, right after the loop dirtied the
      style of eleven elements — the textbook read-after-write. */
  const box = useRef({ width: 0, height: 0 });
  /** Pixels travelled. Owning this as state (rather than deriving it from a
      start timestamp) is what makes pausing and seek-to-card one assignment. */
  const travelled = useRef(0);
  const paused = useRef(false);

  const [tabVisible, setTabVisible] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  /** Whether the wall may fetch and play video yet — see the effect below. */
  const [videosOn, setVideosOn] = useState(false);
  const [curveOff, setCurveOff] = useState(false);
  const reduced = usePrefersReducedMotion();
  const trackEvent = useTrackEvent();

  const registerVideo = useCallback((el: HTMLVideoElement) => {
    videos.current.add(el);
    const onError = () => {
      failed.current.add(el);
      el.pause();
    };
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("error", onError);
      videos.current.delete(el);
    };
  }, []);

  // Nothing plays in a background tab. The reader never sees this working —
  // they just don't come back to a spent battery.
  useEffect(() => {
    const sync = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // No video until the page has finished loading and gone idle.
  //
  // The wall sits directly under the hero, so it is "near the viewport" on the
  // very first frame, and it used to start a dozen video downloads right then —
  // 782KB of mp4 fighting the hero's fonts and scripts for the same connection,
  // and the reason the hero's text took seconds to settle on a phone. The
  // posters are there from the first paint; the motion arrives a moment after
  // the page is usable, which nobody notices, instead of before, which everybody
  // did.
  useEffect(() => {
    if (wantsLite()) return;
    let idle = 0;
    let timer = 0;
    const go = () => {
      const w = window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (w.requestIdleCallback) {
        idle = w.requestIdleCallback(() => setVideosOn(true), {
          timeout: 2000,
        });
      } else {
        timer = window.setTimeout(() => setVideosOn(true), 300);
      }
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      const w = window as Window & {
        cancelIdleCallback?: (id: number) => void;
      };
      if (idle) w.cancelIdleCallback?.(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Only what is on screen plays. The 300px margin is the important part: it
  // starts the fetch *before* a card arrives, so nothing ever turns into view as
  // an empty rectangle waiting on its own bytes. The `src` is only attached here,
  // so a card that never comes near the screen never costs a byte of video.
  useEffect(() => {
    if (!videosOn) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLVideoElement;
          if (failed.current.has(el)) continue;
          if (!entry.isIntersecting) {
            // Pause, but do not rewind. Every card leaves and re-enters once a
            // cycle — about one event a second across the row — and seeking to
            // zero flushes the decoder, so the resume costs a frame right when
            // a card is sliding into view.
            el.pause();
            continue;
          }
          if (!el.getAttribute("src") && el.dataset.src) {
            el.setAttribute("src", el.dataset.src);
          }
          if (reduced) {
            // Hold the opening frame. No motion, but not an empty box either.
            el.preload = "metadata";
            continue;
          }
          if (tabVisible && !blocked.current && !lowPower.current) {
            el.play().catch((error: unknown) => {
              // Refused rather than interrupted: stop asking, and let the
              // posters stand. The stylesheet keeps the browser from drawing a
              // play button over them (see `.demo-video` in globals.css).
              if ((error as { name?: string })?.name === "NotAllowedError") {
                blocked.current = true;
              }
            });
          }
        }
      },
      { rootMargin: "300px" },
    );
    for (const el of videos.current) io.observe(el);
    return () => io.disconnect();
  }, [reduced, tabVisible, videosOn]);

  useEffect(() => {
    if (tabVisible) return;
    for (const el of videos.current) el.pause();
  }, [tabVisible]);

  // Posters for the cards that were not in the first screen, attached as they
  // come within 300px of it — the same margin the video uses, so a card never
  // arrives as an empty box. Runs from the start, unlike the video: a poster
  // is a few KB and it is the thing a card shows until everything else is up.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLVideoElement;
          if (!el.getAttribute("poster") && el.dataset.poster) {
            el.setAttribute("poster", el.dataset.poster);
          }
          io.unobserve(el);
        }
      },
      { rootMargin: "300px" },
    );
    for (const el of videos.current) {
      if (!el.getAttribute("poster")) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  const geometry = useCallback(
    (stageWidth: number) => wallGeometry(stageWidth, slides.length),
    [slides.length],
  );

  /** The picture to cut card `i` from, or null for a plain card. */
  const artFor = useCallback(
    (i: number): WallArt | null => {
      const video = cardVideos.current[i];
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        let frame = frames.current[i];
        if (!frame) {
          const canvas = document.createElement("canvas");
          frame = { canvas, time: -1 };
          frames.current[i] = frame;
        }
        const { canvas } = frame;
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          frame.time = -1;
        }
        // One conversion per new frame of video, however many strips it becomes.
        if (frame.time !== video.currentTime) {
          canvas.getContext("2d")?.drawImage(video, 0, 0);
          frame.time = video.currentTime;
        }
        return { source: canvas, width: canvas.width, height: canvas.height };
      }
      // The poster as an image the canvas can cut a curved card from before its
      // video has a frame (or when it never will). Made the first time the card
      // is on the curve; same URL as its `<video poster>`, so it is one fetch.
      let poster = posters.current[i];
      const url = slides[i]?.poster;
      if (poster === undefined && url) {
        poster = new Image();
        poster.decoding = "async";
        poster.src = url;
        posters.current[i] = poster;
      }
      if (poster?.complete && poster.naturalWidth > 0) {
        return {
          source: poster,
          width: poster.naturalWidth,
          height: poster.naturalHeight,
        };
      }
      return null;
    },
    [slides],
  );

  const paint = useCallback(
    (stageWidth: number, flat: boolean) => {
      const geo = geometry(stageWidth);
      const { width, pitch, span } = geo;
      // A stage too narrow to fold has no curve to draw — but a card poking past
      // its right edge still counted as "on the curve", so a phone was bending
      // pictures of a wall that was flat, every frame, for nothing.
      const drawCurve = !flat && !flatOnly.current && geo.foldStart < 1;
      const ctx = drawCurve
        ? (canvasRef.current?.getContext("2d") ?? null)
        : null;

      const height = box.current.height;
      const { fill, stroke, radius } = tokens.current;

      // The backing store, checked rather than pushed: `devicePixelRatio`
      // changes when the window is dragged to a second monitor and that fires no
      // resize of anything. Capped at 2 — past there the fill cost is real and
      // the gain is not. Sizing a canvas resets its context, so the transform
      // that puts drawing back into CSS pixels goes on after.
      const canvas = canvasRef.current;
      if (canvas && ctx) {
        const density = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(stageWidth * density);
        const h = Math.round(height * density);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          ctx.setTransform(density, 0, 0, density, 0, 0);
          dpr.current = density;
        }
      }

      const cardHeight = (width * 9) / 16;
      const cy = (cardHeight * geo.headroom) / 2 + cardHeight / 2;
      ctx?.clearRect(0, 0, stageWidth, height);

      // The row moves as ONE element. Writing an inline transform on every card
      // every frame recalculated 82 elements' style a frame — 3.15ms on a desktop
      // Mac, and 88% of a 4×-throttled phone's main thread (production build,
      // CDP metrics). One element a frame is 0.05ms. So the track carries the
      // travel, and a card is only written when it wraps.
      const r = mod(travelled.current, span);
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-r}px, 0, 0)`;
      }

      const start = ctx ? performance.now() : 0;
      let drew = false;
      for (let i = 0; i < slides.length; i++) {
        const el = cards.current[i];
        if (!el) continue;

        // The seam is never on camera: see `wallOffset`.
        const offset = wallOffset(i, pitch, span, r);
        if (offsets.current[i] !== offset) {
          offsets.current[i] = offset;
          el.style.transform = `translate3d(${offset}px, 0, 0)`;
        }
        const x = offset - r;

        // Low power: the cards in the reading zone (the left half) play, the
        // rest hold their frame. Six software decoders were most of what a
        // machine without a GPU was spending on this wall.
        if (lowPower.current) {
          const video = cardVideos.current[i];
          const play =
            x + width > 0 && x < stageWidth * 0.5 && !blocked.current;
          if (video?.getAttribute("src") && wantPlay.current[i] !== play) {
            wantPlay.current[i] = play;
            if (play) video.play().catch(() => {});
            else video.pause();
          }
        }
        if (!ctx) continue;

        // The card art, drawn on the real curve — but only for the cards that
        // are on one. A card in the flat zone is its own DOM element already,
        // pixel for pixel, so drawing it again buys nothing and costs a fill, a
        // clip and a resample. The handover happens exactly where the two are
        // identical, so there is nothing to see. Off-stage cards are skipped for
        // the same reason: most of the row is off-stage at any moment.
        const curved = (x + width) / stageWidth > geo.foldStart;
        if (curved && x < stageWidth && x + width > 0) {
          drew = true;
          drawWallCard(ctx, artFor(i), geo, stageWidth, {
            x,
            cy,
            half: cardHeight / 2,
            radius,
            fill,
            stroke,
            dpr: dpr.current,
          });
        }
      }

      // Measure the curve on this device, and give it up if it is too dear.
      // Throttled CPUs and machines without GPU canvas are exactly the ones
      // that froze under it; on them the wall is the flat row a phone gets,
      // which costs one transform a frame. The cards under the canvas are
      // already there, so turning it off is the whole change.
      if (ctx && drew && paintCost.current.count < PAINT_SAMPLES) {
        const cost = paintCost.current;
        cost.total += performance.now() - start;
        cost.count += 1;
        if (
          cost.count === PAINT_SAMPLES &&
          cost.total / cost.count > PAINT_BUDGET_MS
        ) {
          flatOnly.current = true;
          lowPower.current = true;
          ctx.clearRect(0, 0, stageWidth, height);
          setCurveOff(true);
        }
      }
    },
    [artFor, geometry, slides.length],
  );

  // Layout: the stage is absolutely positioned inside, so it needs its height
  // told to it — the card, and the headroom a turned one grows into.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const layout = () => {
      const stageWidth = stage.clientWidth;
      if (!stageWidth) return;
      const { width, span, headroom } = geometry(stageWidth);
      const cardHeight = (width * 9) / 16;
      const pad = (cardHeight * headroom) / 2;

      const height = cardHeight * (1 + headroom);
      stage.style.height = `${height}px`;
      box.current = { width: stageWidth, height };
      for (const el of cards.current) {
        if (!el) continue;
        el.style.width = `${width}px`;
        el.style.top = `${pad}px`;
      }

      // What the canvas has to paint a card out of, taken from the card the
      // stylesheet already styled rather than from a table of hexes here.
      const surface = surfaceRef.current;
      const theme = getComputedStyle(stage);
      tokens.current = {
        fill: theme.getPropertyValue("--muted").trim() || "#f2f4f7",
        stroke: theme.getPropertyValue("--border").trim() || "#e4e7ec",
        radius: surface
          ? Number.parseFloat(getComputedStyle(surface).borderTopLeftRadius)
          : 0,
      };

      // Reduced motion turns the wall into a plain scrollable row, so the
      // track needs a real width to scroll through.
      stage.style.setProperty("--wall-span", `${span}px`);
      paint(stageWidth, Boolean(reduced));
    };

    layout();
    // Deferred a frame for the same reason the theme observer below is, plus
    // one this observer has on its own: `layout` writes `style.width` on the
    // cards and `--wall-span` on `stage` — the element being observed. Writing
    // to the observed element from inside its own callback is what raises
    // "ResizeObserver loop completed with undelivered notifications", and it
    // was the single loudest entry in error tracking. The browser recovers by
    // re-delivering next frame, so this only ever cost us a noisy digest, but
    // the synchronous read-after-write inside the callback was real work in the
    // resize path. One rAF hop removes both.
    let resizeFrame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(layout);
    });
    ro.observe(stage);
    // The theme toggle swaps both colours out from under the canvas and fires
    // nothing a ResizeObserver would hear.
    //
    // Deferred a frame, and that is the whole fix for a toggle that stuck. A
    // MutationObserver callback is a *microtask*: it runs at the end of the very
    // task that flipped `<html class>`, at the one moment every style in the
    // document is invalid. `layout()` then writes style on eleven cards and
    // immediately reads `getComputedStyle` twice — a read-after-write that has to
    // resolve the entire freshly-invalidated document synchronously — and repaints
    // the canvas. That whole bill landed inside the click, so the toggle's own
    // 350ms animation began already behind and read as a stutter.
    //
    // Nothing here is urgent: the rAF loop repaints every frame anyway, so the new
    // colours only have to be in `tokens` before the next one.
    const themed = new MutationObserver(() => {
      requestAnimationFrame(layout);
    });
    themed.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      cancelAnimationFrame(resizeFrame);
      ro.disconnect();
      themed.disconnect();
    };
  }, [geometry, paint, reduced]);

  // A wall nobody is looking at costs nothing. Style writes were cheap enough to
  // leave running; a full-width canvas repainting at 60fps while the reader is
  // three sections away is not.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? false),
      { rootMargin: "200px" },
    );
    io.observe(stage);
    return () => io.disconnect();
  }, []);

  // The travel itself. Held on a ref and advanced by elapsed time, so a dropped
  // frame costs distance rather than desynchronising the row.
  useEffect(() => {
    if (reduced || !tabVisible || !onScreen) return;
    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    let last = performance.now();

    // Bound imperatively rather than in JSX: the stage is a canvas for an
    // animation, not a control, and giving it a widget role to satisfy a lint
    // rule would put a lie in the accessibility tree.
    const hold = () => {
      paused.current = true;
    };
    const release = () => {
      paused.current = false;
    };
    stage.addEventListener("pointerenter", hold);
    stage.addEventListener("pointerleave", release);

    const tick = (now: number) => {
      const elapsed = now - last;
      const dt = Math.min(elapsed / 1000, 0.1);
      last = now;
      // The frame rate this device is really getting, measured while the
      // wall is doing the most it ever does. See `FRAME_BUDGET_MS`.
      if (!lowPower.current && !paused.current && videosOn) {
        const cost = frameCost.current;
        cost.total += elapsed;
        cost.count += 1;
        if (cost.count === FRAME_SAMPLES) {
          if (cost.total / cost.count > FRAME_BUDGET_MS) {
            lowPower.current = true;
            flatOnly.current = true;
            setCurveOff(true);
          }
          cost.total = 0;
          cost.count = 0;
        }
      }
      const stageWidth = box.current.width;
      if (stageWidth) {
        if (!paused.current) {
          travelled.current += dt * stageWidth * WALL.speed;
        }
        paint(stageWidth, false);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      stage.removeEventListener("pointerenter", hold);
      stage.removeEventListener("pointerleave", release);
    };
  }, [onScreen, paint, reduced, tabVisible, videosOn]);

  /** Bring a card into the flat reading zone and hold it there. */
  const focusCard = useCallback(
    (i: number) => {
      const stage = stageRef.current;
      if (!stage || reduced) return;
      const stageWidth = stage.clientWidth;
      const { width, pitch, span, foldStart } = geometry(stageWidth);
      // Middle of the flat zone, not middle of the stage: a focused card is one
      // somebody is about to read, so it must not be in the fold.
      const target = Math.max(
        0,
        (Math.min(foldStart, 1) * stageWidth - width) / 2,
      );
      travelled.current = mod(-i * pitch - target - pitch, span);
      paused.current = true;
      paint(stageWidth, false);
    },
    [geometry, paint, reduced],
  );

  return (
    <section id="showcase" className="relative pb-20 sm:pb-28">
      {/* Full-bleed: the wall has to run past both edges of the screen or the
          fold reads as a card that got cut off rather than one turning away.
          No `perspective` here — nothing in the wall is projected by the
          compositor; the curve is drawn.

          `ph-no-capture`: session replay records every DOM change, and this
          subtree changes a transform every frame, forever. Recording it was
          main-thread work on the visitor's machine for a wall nobody watches in
          a replay; blocked, it is one placeholder. Card clicks are tracked by
          hand (`cta_clicked`), so autocapture loses nothing. */}
      <div
        ref={stageRef}
        className="wall ph-no-capture relative w-full overflow-hidden"
      >
        <div ref={trackRef} className="wall-track absolute inset-0">
          {slides.map((slide, i) => (
            <article
              key={slide.slug}
              ref={(el) => {
                cards.current[i] = el;
              }}
              className="absolute left-0 top-0"
              // Where `layout()` will put it, in CSS, so the row is already a
              // row in the server HTML. Without this every card sat at x=0
              // until the scripts had run: forty-two cards stacked on the left
              // edge, the top one blank, for the first seconds on a slow phone.
              // The stylesheet reserves `--wall-card-w` (see `.wall`), and a
              // pitch is a card and its gap; `paint` takes over from here with
              // the same numbers in pixels.
              style={{
                transform: `translate3d(calc(var(--wall-card-w) * ${
                  1 + WALL.gap
                } * ${startSlot(i, slides.length)}), 0, 0)`,
              }}
            >
              <Link
                href={slide.href}
                // A moving row walks every card through the viewport, so
                // viewport prefetch fetched ~5 RSC payloads per card, forever.
                prefetch={false}
                aria-label={`${slide.name} — ${slide.description}`}
                onFocus={() => focusCard(i)}
                onBlur={() => {
                  paused.current = false;
                }}
                onClick={() =>
                  trackEvent("cta_clicked", {
                    cta: "showcase_card",
                    destination: slide.href,
                  })
                }
                className="group relative block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:rounded-2xl"
              >
                {/* The card, for real, while it is flat — and once it starts to
                    curve, the decode source for the canvas that draws it, still
                    painted but covered: the drawn silhouette contains this
                    rectangle at every scale. Hiding it instead would invite the
                    browser to stop decoding it.

                    `bg-muted`, not the surface's own `--card`: on the light
                    theme an unloaded card would otherwise be a white rectangle
                    on a white page. The canvas fills with the same token. */}
                <div
                  ref={i === 0 ? surfaceRef : undefined}
                  className="surface-card relative aspect-video w-full overflow-hidden rounded-xl bg-muted sm:rounded-2xl"
                >
                  <video
                    ref={(el) => {
                      cardVideos.current[i] = el;
                      return el ? registerVideo(el) : undefined;
                    }}
                    // Attached by the observer above, not rendered: a card
                    // that never comes near the screen never loads a byte.
                    data-src={slide.src}
                    // The still, until the video has a frame — and for good,
                    // if it never does (an error, a refused autoplay, a data
                    // saver). A card is never an empty box.
                    poster={
                      startSlot(i, slides.length) >= 0 &&
                      startSlot(i, slides.length) < EAGER_POSTERS
                        ? (slide.poster ?? undefined)
                        : undefined
                    }
                    data-poster={slide.poster ?? undefined}
                    muted
                    loop
                    playsInline
                    preload="none"
                    disablePictureInPicture
                    disableRemotePlayback
                    controlsList="nodownload nofullscreen noremoteplayback"
                    aria-hidden
                    tabIndex={-1}
                    // `contain`, not `cover`: a demo that silently crops its
                    // own composition is a lie about the output. `demo-video`
                    // keeps every browser's own buttons off it; no pointer
                    // events, because the card is the link and the video is a
                    // picture in it — a hover must not raise a picture-in-
                    // picture or cast button over the demo.
                    className="demo-video pointer-events-none size-full object-contain"
                  />
                </div>
              </Link>
            </article>
          ))}
        </div>

        {/* The curved half of the wall. Under reduced motion there is no wall —
            the row is a plain scroller — so there is nothing to draw at all.
            Nor once this device has shown it cannot draw one in budget.

            `size-full` is load-bearing, and `inset-0` alone is not: a canvas is
            a *replaced* element, so when it is absolutely positioned with an
            auto width the used width is its intrinsic one — the `width`
            attribute, which is the device-pixel backing store — and `right` is
            ignored outright. Take this off and the wall draws at devicePixelRatio
            times its size on every retina display, anchored to the top left.
            It looks correct on a 1× monitor, which is the trap. */}
        {!reduced && !curveOff && (
          <canvas
            ref={canvasRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full"
          />
        )}
      </div>
    </section>
  );
}
