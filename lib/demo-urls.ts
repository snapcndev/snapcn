/**
 * Components whose preview plays the **rendered mp4** instead of a live
 * `<Player>`.
 *
 * ## Why this exists
 *
 * A live `<Player>` is not a video. It is React re-rendering the scene on
 * `requestAnimationFrame`, in real time, in the browser. That is a fundamentally
 * different pipeline from the one that produces the file a user actually ships,
 * and it fails in a way the render never does: **frame pacing**.
 *
 * A 30fps composition on a 120Hz display has to hold every frame for exactly
 * four refreshes. A frame that misses its ~8ms budget is not dropped, it is
 * shown for the wrong length of time — and the eye reads that as the animation
 * sticking and shaking. It is worst during slow, smooth motion, which is exactly
 * where a title reveal lives. A render has no such budget: each frame gets as
 * long as it needs, and the encoded file is then handed to the display with
 * correct timing.
 *
 * So for scenes where that difference is visible, the preview lies — it makes a
 * correct component look broken. The fix is to stop previewing an approximation
 * and just show the real output.
 *
 * ## When to add a component here
 *
 * Only when the live preview misrepresents the render. That is nearly always a
 * scene that **animates a scale on text** over many frames, because re-shaping
 * type at a new size every frame is the most expensive thing a browser can be
 * asked to do per frame, and glyph quantisation makes any pacing error obvious.
 * Do not add a component just because it is nice — every entry is an mp4 that
 * has to be re-rendered and committed whenever the component changes, and a
 * stale demo is worse than a stuttery one.
 *
 * ## What still uses the live Player
 *
 * The customizer. The moment a prop is changed the rendered file is wrong by
 * definition, so `PreviewStage` falls back to `<Player>` for anything that is
 * not the default props. The mp4 is the *default* view; the Player is the
 * *interactive* view.
 *
 * Regenerate with `pnpm run render:previews` (see CONTRIBUTING.md).
 *
 * ## Why the URLs live here and not next to `<RenderedDemo>`
 *
 * This module is deliberately free of `"use client"`. The docs route emits a
 * `VideoObject` for each demo and needs these URLs on the server, and a client
 * module's exports are client *references* — a server component cannot call
 * them. `lib/rendered-demos.tsx` re-exports everything below, so no existing
 * caller had to change.
 */

import demoManifest from "./demo-manifest.json";

export const RENDERED_DEMOS: readonly string[] = [
  // Solid rects and hard cuts, but the same rule applies: the card grid is the
  // one place all 22 demos mount at once, and a live Player there is the cost
  // this list exists to avoid.
  "block-wordmark",
  "text-reveal",
  "text-swell",
  "hero-launch",
  // Type is under a moving scale for most of the run — a receding 3D plane, a
  // 1.5x settle, then a whole line panned at 19x — and each of the first two
  // shots is drawn eight times a frame for the shutter. A live Player has an
  // 8ms budget for all of that; the render has none, and the difference is the
  // whole read of the opening.
  "announce-title",
  // The screen-takeover finale is a slow camera dolly (scale) on a whole video
  // screen over ~45 frames, then a long hold — the exact slow, smooth motion a
  // live Player mispaces on a high-refresh display. The render doesn't mispace.
  "laptop-frame",
  // A camera push scales the whole photo gallery with motion blur, then settles
  // on a hero image — slow scale-on-imagery a live Player stutters through.
  "moodboard-reveal",
  // A fast card collapse then a scale-on-imagery brand-card landing — the exact
  // slow-then-snappy motion a live Player mispaces on a high-refresh display.
  "logo-assemble",
  // Images swap nearly every frame, which a live Player flashes harshly before
  // the pool is cached; the render is a clean, decelerating flicker.
  "logo-flicker",
  // fly-through draws the outgoing line 18 times a frame (a shutter, for the
  // motion blur) and blurs each copy. Free in a render; nowhere near an 8ms
  // budget in a live browser.
  "text-swap",
  // A slow continuous dolly across the whole clip, on type. That is the exact
  // motion a live Player is worst at: a frame that misses its budget is shown
  // for the wrong length of time, and the eye reads a creeping scale that
  // stutters as the type sticking and shaking. The file does not stutter.
  "search-typing",
  // The flip is nine frames long and moves a rotateX, a translate, a scale and a
  // blur on type at the same time. Every one of those is a re-shape of the line
  // at a brand-new size, and a single missed frame inside a nine-frame gesture is
  // a tenth of it shown for the wrong length of time.
  "word-flip",
  // A continuously travelling, scrolling wave of two-dozen avatars plus a running
  // count — smooth, unbroken motion across the whole clip, the exact thing a live
  // Player mispaces on a high-refresh display (and stalls on outright at mount).
  // The render is a clean, even undulation.
  "follower-rush",
  // A camera pull-back that scales the whole page — three paragraphs, a headline
  // and four cards of type — over 33 frames, while ~110 words are streaming into
  // it. Every frame re-shapes every line at a brand-new size, and one that misses
  // its budget is shown for the wrong length of time; the eye reads that as the
  // answer sticking as it arrives. The file pulls back smoothly.
  "answer-stream",

  // ── Rendered for coverage, not because the Player misrepresents them ───────
  // Everything above earned its place by failing in a live Player. The eight
  // below were added deliberately so that *every* component in the barrel ships
  // a demo the site can play without booting Remotion. They are held to the same
  // contract as the rest: change the component, re-render the file, commit it.
  // `pnpm run render:previews --only <slug>` if you only touched one.
  //
  // If any of these ever costs more than it earns, the fix is to delete the line
  // — `renderedDemoSrc` returns null and the page falls straight back to the
  // live `<Player>`. Nothing else has to change.
  // A width that morphs under a label that must not move with it, a per-letter
  // scale cascade, and a field that steps 200px with a 1.8-frame time constant.
  // All three are slow, smooth, sub-pixel motion on type — the exact thing a
  // live Player mispaces on a high-refresh display, and the width morph's
  // overshoot is only legible if every frame is held for the right length.
  "status-cycle",
  "text-highlight",
  "text-build",
  "word-captions",
  "karaoke-captions",
  "phone-frame",
  "terminal-simulator",
  "orbit-gallery",
  "prompt-zoom",
];

/**
 * Public path of a slug's rendered demo, or null if it has none.
 *
 * The `?v=` is a hash of the file's own bytes, written by `pnpm run render:previews`
 * into `lib/demo-manifest.json`. Every demo ships to the same path forever, so
 * without it a browser will keep replaying the copy it already has long after the
 * file underneath has been re-rendered — <video> caches hardest of all. With it,
 * a re-rendered demo is a different URL, and a stale one is not something a cache
 * can serve. Re-render, and the site picks it up. No hard refresh, no restart.
 *
 * Every caller that points at `/demos/` must come through here. Building the
 * path by hand — which the editor's library grid did — opts that surface out of
 * the whole mechanism and serves a stale demo out of the <video> cache.
 */
export function renderedDemoSrc(slug: string): string | null {
  if (!RENDERED_DEMOS.includes(slug)) return null;
  const version = (demoManifest as Record<string, string>)[slug];
  return version ? `/demos/${slug}.mp4?v=${version}` : `/demos/${slug}.mp4`;
}

/**
 * Still frame for a slug's demo, hashed like the video so a re-render is never
 * served from cache. Generated alongside the mp4 by `pnpm run render:previews`.
 */
export function renderedDemoPoster(slug: string): string | null {
  if (!RENDERED_DEMOS.includes(slug)) return null;
  const version = (demoManifest as Record<string, string>)[slug];
  const base = `/demos/posters/${slug}.webp`;
  return version ? `${base}?v=${version}` : base;
}
