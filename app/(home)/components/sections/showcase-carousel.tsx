"use client";

import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTrackEvent } from "@/lib/analytics";
import { GALLERY_ITEMS } from "@/lib/gallery-data";
import { RENDERED_DEMOS, renderedDemoSrc } from "@/lib/rendered-demos";
import { drawWallCard, WALL, wallGeometry } from "./showcase-wall";

/**
 * Slides are the components that already have a **rendered mp4** — not live
 * `<Player>`s. Eleven Remotion players on the landing page is the whole page's
 * JS budget, and the file is what the reader actually ships anyway (see
 * `lib/rendered-demos`).
 *
 * Titles, blurbs and hrefs come from `GALLERY_ITEMS` so this section cannot
 * drift from `/docs/components`. The slug is the last segment of the href.
 */
const SLIDES = RENDERED_DEMOS.flatMap((slug) => {
  const item = GALLERY_ITEMS.find((i) => i.href.endsWith(`/${slug}`));
  const src = renderedDemoSrc(slug);
  if (!item || !src) return [];
  return [
    {
      slug,
      src,
      href: item.href,
      name: item.name,
      description: item.description,
    },
  ];
});

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function ShowcaseCarousel() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  /** One card's surface, to read the radius the stylesheet actually gave it. */
  const surfaceRef = useRef<HTMLDivElement>(null);
  const cardVideos = useRef<(HTMLVideoElement | null)[]>([]);
  const videos = useRef(new Set<HTMLVideoElement>());
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
  const reduced = useReducedMotion();
  const trackEvent = useTrackEvent();

  const registerVideo = useCallback((el: HTMLVideoElement) => {
    videos.current.add(el);
    return () => {
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

  // Only what is on screen plays. The 300px margin is the important part: it
  // starts the fetch *before* a card arrives, so nothing ever turns into view as
  // an empty rectangle waiting on its own bytes. Paired with `preload="none"`,
  // it is also why the page loads none of these ~13MB until you scroll here.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLVideoElement;
          if (!entry.isIntersecting) {
            // Pause, but do not rewind. Every card leaves and re-enters once a
            // cycle — about one event a second across the row — and seeking to
            // zero flushes the decoder, so the resume costs a frame right when
            // a card is sliding into view.
            el.pause();
          } else if (reduced) {
            // Hold the opening frame. No motion, but not an empty box either.
            el.preload = "metadata";
            el.load();
          } else if (tabVisible) {
            el.play().catch(() => {});
          }
        }
      },
      { rootMargin: "300px" },
    );
    for (const el of videos.current) io.observe(el);
    return () => io.disconnect();
  }, [reduced, tabVisible]);

  useEffect(() => {
    if (tabVisible) return;
    for (const el of videos.current) el.pause();
  }, [tabVisible]);

  const geometry = useCallback(
    (stageWidth: number) => wallGeometry(stageWidth, SLIDES.length),
    [],
  );

  const paint = useCallback(
    (stageWidth: number, flat: boolean) => {
      const geo = geometry(stageWidth);
      const { width, pitch, span } = geo;
      const ctx = canvasRef.current?.getContext("2d") ?? null;

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

      for (let i = 0; i < SLIDES.length; i++) {
        const el = cards.current[i];
        if (!el) continue;

        // One pitch of slack on the left, so a card wraps back to the far right
        // while it is still fully off screen. The seam is never on camera.
        const x = mod(-travelled.current - i * pitch, span) - pitch;
        el.style.transform = `translate3d(${x}px, 0, 0)`;
        if (flat) continue;

        // The card art, drawn on the real curve — but only for the cards that
        // are on one. A card in the flat zone is its own DOM element already,
        // pixel for pixel, so drawing it again buys nothing and costs a fill, a
        // clip and a resample. The handover happens exactly where the two are
        // identical, so there is nothing to see. Off-stage cards are skipped for
        // the same reason: most of the row is off-stage at any moment.
        const curved = (x + width) / stageWidth > geo.foldStart;
        if (ctx && curved && x < stageWidth && x + width > 0) {
          drawWallCard(ctx, cardVideos.current[i], geo, stageWidth, {
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
    },
    [geometry],
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
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
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
  }, [onScreen, paint, reduced, tabVisible]);

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
          compositor; the curve is drawn. */}
      <div ref={stageRef} className="wall relative w-full overflow-hidden">
        <div className="wall-track absolute inset-0">
          {SLIDES.map((slide, i) => (
            <article
              key={slide.slug}
              ref={(el) => {
                cards.current[i] = el;
              }}
              className="absolute left-0 top-0"
            >
              <Link
                href={slide.href}
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
                    src={slide.src}
                    muted
                    loop
                    playsInline
                    preload="none"
                    // `contain`, not `cover`: a demo that silently crops its
                    // own composition is a lie about the output.
                    className="size-full object-contain"
                  />
                </div>
              </Link>
            </article>
          ))}
        </div>

        {/* The curved half of the wall. Under reduced motion there is no wall —
            the row is a plain scroller — so there is nothing to draw at all.

            `size-full` is load-bearing, and `inset-0` alone is not: a canvas is
            a *replaced* element, so when it is absolutely positioned with an
            auto width the used width is its intrinsic one — the `width`
            attribute, which is the device-pixel backing store — and `right` is
            ignored outright. Take this off and the wall draws at devicePixelRatio
            times its size on every retina display, anchored to the top left.
            It looks correct on a 1× monitor, which is the trap. */}
        {!reduced && (
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
