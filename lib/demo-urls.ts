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
  // The opening is `text-reveal` itself, so it inherits that entry's reason —
  // and then adds its own: after the reveal, a whole line is carried across the
  // frame on a 16-frame bezier, morphed letter by letter, and pulled out on an
  // exponential. Slow smooth travel over half a second is precisely what a live
  // Player mispaces on a high-refresh display, and every curve in this one was
  // fitted to sub-pixel error against a reference — none of which survives being
  // shown a frame late.
  "type-morph",
  "text-swell",
  // Two of its three cards hold a scale on type for their whole life — a word
  // wave, then a slow push that never stops — and the third rushes the whole
  // frame past the camera in nine frames. Slow smooth scale on type is the exact
  // motion a live Player mispaces, and the rush is over before a dropped frame
  // can be forgiven.
  "punch-lines",
  // The whole entry beat is a 22px horizontal smear that has to clear in five
  // frames, and the fill collapses the grid by a fifth of its pitch in three.
  // Both are over before a live Player can be forgiven a dropped frame, and the
  // fill only reads as one move if every card lands on the frame it is supposed
  // to — this is also a grid of images, so it is the one demo whose Player cost
  // is thirty decodes rather than a few hundred rects.
  "count-grid",
  // A camera scale on type that is already 419px tall, through a masked blur
  // layer, for the whole second half — and the beat it would ruin is a hard cut
  // on one frame between two shots that are both moving. A Player that shows one
  // frame for the wrong length of time turns that cut into a stumble.
  "wordmark-cut",
  // Nine cards of type under a camera that never stops scaling, for the whole
  // 120 frames — every glyph is re-shaped at a brand-new size on every frame,
  // and two of the three rows are sliding underneath it as well. It is the most
  // expensive thing a browser can be asked to do per frame, and the beat it
  // ruins is the one the shot is for: five monograms turning over seven frames
  // apart reads as a cascade only if all five land on the frame they are meant
  // to.
  "roster-grant",
  // Eight shots cut every three to six frames under a type zoom, then the frame
  // shuts in two frames of real travel. A cut shown a frame late is a stutter,
  // and a live Player flashes each new shot before its image is decoded.
  "reel-collage",
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
  // The whole line is pushed forward 2.39x over 420ms, on type, while a
  // selection is dragged across it. Slow smooth scale on type is the one thing a
  // live Player is worst at — a frame shown for the wrong length of time reads
  // as the line sticking mid-push — and the scale here is pivoted on a measured
  // baseline precisely so it does not stick. The render keeps that.
  "text-select",
  // Half of this one is a vertical clip edge crossing a line of type on an
  // ease-in-out — it creeps for four frames, crosses in twelve and settles for
  // twelve more, and every frame of that is a letter being cut at a different
  // sub-pixel offset. A live Player that shows one of those frames for the
  // wrong length of time reads as the edge stuttering through the word.
  "text-rewrite",

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
  // Ten tiles, every one of them scaling and translating by a fraction of a
  // pixel per frame for three seconds straight. Smooth sub-pixel motion on
  // solid edges is the other thing a live Player mispaces, and here there are
  // forty edges doing it at once.
  "logo-drift",
  // A 2.3× camera riding a sentence horizontally for two seconds. The type
  // moves at ~500px/s at that scale, which is the exact motion a live Player
  // mispaces on a high-refresh display — every frame of it is sub-pixel.
  "prompt-send",

  // ── The four from 08d947b, which shipped without demos ────────────────────
  // Added in the same commit as the paid tier and missed by the render pass, so
  // for four components the card grid mounted a live Player — the cost this
  // whole list exists to avoid — and their docs pages emitted no `VideoObject`,
  // which is the one piece of schema a component page has that a prose page
  // does not. Coverage, on the same contract as everything above: change the
  // component, re-render the file, commit it.
  "agent-steps",
  "answer-highlight",
  "cursor-track",
  "screen-recording",

  // ── The five measured off recordings ──────────────────────────────────────
  // All five are the failure case this list exists for, and each for a reason
  // that was measured rather than felt:
  //
  //   word-wheel      a reel of type moving 15px a frame at its peak, scaling
  //                   about its baseline. The Player's dropped frames read as
  //                   the exact judder the baseline pivot exists to remove.
  //   word-gather     a dozen words travelling at once on two clocks, and a
  //                   block that eases back to size under all of them.
  //   channel-thread  arrivals that are byte-identical between beats, so any
  //                   frame the Player shows for the wrong length is the only
  //                   movement on screen.
  //   logo-collapse   cuts one frame apart and two frames of overshoot on the
  //                   mark. A Player that misses one shows neither.
  //   card-rail       a rail crossing the frame at 29px a frame on a
  //                   perspective plane, re-rasterised every frame.
  "word-wheel",
  "word-gather",
  "channel-thread",
  "logo-collapse",
  "card-rail",
];

/**
 * Where every rendered demo, poster and pro demo is served from: R2 (bucket
 * `snapcn`) behind Cloudflare, uploaded by `scripts/media-upload.mts`. Not the
 * app: from `public/demos` they came off one server with no CDN in front, a
 * round trip per file per visit, and 16MB of video in the repository.
 */
export const MEDIA_BASE = "https://media.snapcn.dev";

/**
 * Public URL of a slug's rendered demo, or null if it has none.
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
  const base = `${MEDIA_BASE}/demos/${slug}.mp4`;
  return version ? `${base}?v=${version}` : base;
}

/**
 * Still frame for a slug's demo, hashed like the video so a re-render is never
 * served from cache. Generated alongside the mp4 by `pnpm run render:previews`.
 */
export function renderedDemoPoster(slug: string): string | null {
  if (!RENDERED_DEMOS.includes(slug)) return null;
  const version = (demoManifest as Record<string, string>)[slug];
  const base = `${MEDIA_BASE}/demos/posters/${slug}.webp`;
  return version ? `${base}?v=${version}` : base;
}
