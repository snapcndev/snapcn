# Contributing

snapcn is a shadcn registry of ready-made animations, transitions and
backgrounds for Remotion. Components are **copied into the user's project**, so
every file we ship is a file someone will read, edit and own. Write it that way.

```bash
pnpm install
pnpm dev                  # the docs site, localhost:3000
pnpm lint                 # biome
pnpm test                 # vitest
pnpm run registry:build   # rebuild public/r/*.json after touching a component
```

---

## Adding a component

1. `registry/snap-cn/<slug>/index.tsx` — the component. Frame-driven, no
   `setTimeout`, no CSS keyframes: everything comes from `useCurrentFrame()`.
2. `registry/snap-cn/<slug>/config.ts` — the customizer controls, timing and
   canvas size. This is also what the docs preview and the rendered demo read.
3. Register it in `registry/__index__.tsx`, add an entry to
   `registry/snap-cn/registry.json`, `lib/gallery-data.ts` and
   `content/docs/<category>/<slug>.mdx`.
4. `pnpm run registry:build`, then `pnpm lint && pnpm test`.

`registry.json` is **hand-maintained**. Do not run a formatter over it — it will
reflow the whole file and bury your one entry in three hundred lines of noise.

---

## Previews: the live Player, and when to stop trusting it

Most components preview through a live `@remotion/player`. That is not a video.
It is React re-rendering your scene on `requestAnimationFrame`, in real time, in
the reader's browser — a completely different pipeline from the one that produces
the file a user actually ships.

Usually that is fine. Sometimes it is a **lie**, and it makes a correct component
look broken:

- A 30fps composition on a 120Hz display must hold every frame for exactly four
  refreshes. A frame that misses its ~8ms budget is not dropped — it is shown for
  the *wrong length of time*. The eye reads that as the animation sticking and
  shaking.
- It is worst during slow, smooth motion. Which is exactly where a title reveal
  lives.
- A render has no budget. Every frame gets as long as it needs, and the encoded
  file is handed to the display with correct timing.

So for those scenes we stop previewing an approximation and just **play the real
rendered output**.

### The mechanism

**One allowlist.** `lib/rendered-demos.tsx`:

```ts
export const RENDERED_DEMOS: readonly string[] = [
  "text-reveal",
  "text-swell",
  "hero-launch",
];
```

Being in that list is the whole switch. Three call sites read it and swap the
`<Player>` for a `<video>`:

| where | file | behaviour |
| --- | --- | --- |
| docs preview + gallery overlay | `lib/ui-preview-internals.tsx` (`PreviewStage`) | plays the mp4 **while props are at their defaults**; falls back to the live Player the moment a control is touched |
| gallery grid card | `components/docs/gallery/gallery-card.tsx` | always the mp4 |
| docs card grid | `components/docs/component-card.tsx` | always the mp4 |

The customizer keeps the live Player, and it must: once a prop changes, the
rendered file is the wrong picture by definition. **The mp4 is the default view;
the Player is the interactive view.**

**One render script.** `pnpm run render:previews` → `public/demos/<slug>.mp4`.

It bundles `src/remotion/previews-root.tsx`, which registers one composition per
allowlisted slug and reproduces `PreviewStage` exactly — same default props, same
`DemoBackdrop`, same size and duration. Drift between those two is the one thing
that can make this feature actively harmful: a demo that does not match its own
component. Two bridges are load-bearing there, both already in place:

- **Props** come from `getDefaults(config.controls)` *after* the registry barrel
  has folded in `SHARED_CONTROLS` and the `MIN_SPEED_ONE` overrides — not from
  the literals written in the config file.
- **Geist** is loaded via `@remotion/google-fonts` and published as
  `--font-geist-sans`. The site gets that variable from `next/font`, which does
  not exist in a standalone Remotion bundle. Without the bridge the mp4 silently
  falls back to Times, and you will not notice until someone else does.

The mp4s are **committed**. The site serves them statically and a production
build must not depend on a headless Chrome round-trip.

### The rule you have to follow

**If you change a component in `RENDERED_DEMOS`, re-render its demo in the same
commit:**

```bash
pnpm run render:previews --only text-swell
```

A stale demo is worse than a stuttery one. There is no build-time check for this
— the file will happily keep showing last month's animation.

### When to add a component to the list

Only when the live preview *misrepresents the render*. In practice that means a
scene that **animates a scale on text** over many frames — see below for why that
is the pathological case. Do not add a component because it is nice: every entry
is an mp4 that has to be re-rendered and re-committed forever.

### Every surface that shows the default scene must ask for the demo

`RENDERED_DEMOS` only helps a surface that actually consults it. A surface that
mounts `<Player>` directly opts itself out of the whole mechanism and shows the
exact stutter the mp4 exists to prevent.

**The rule: if a surface renders a component with its *default* props, it must
call `renderedDemoSrc(slug)` first and play the mp4 when there is one.**

The surfaces, and what each one shows:

| Surface | Props | Source |
|---|---|---|
| `gallery-card.tsx` | defaults | mp4 if present, else `<Player>` |
| `gallery-detail-overlay.tsx` | defaults | mp4 if present, else `<Player>` |
| `component-preview.tsx` (docs page) | **customized** | mp4 only while untouched, `<Player>` once a control moves |
| `library-panel.tsx` (editor) | defaults | mp4 if present |

This is written down because it was got wrong. The detail overlay never called
`renderedDemoSrc`, so every one of the 23 gallery components — the list and the
gallery are the same 23 slugs — opened into a live `<Player>`. `logo-flicker` is
in the list precisely because "images swap nearly every frame, which a live
Player flashes harshly before the pool is cached", and that is what the overlay
showed, at full size. The card beside it was playing the mp4 correctly the whole
time, which is what made it hard to spot.

**Do not "fix" this inside `PreviewStage`.** It looks like the one shared choke
point, and it is the wrong one: the docs page hands it *customized* values from
the customizer, and a fixed mp4 cannot show a prop the reader just changed. The
check belongs at each default-props call site. There are four; they are listed
above.

### Checking it

Two invariants, both scriptable, neither enforced by the build.

**1. Every rendered mp4 matches its component's declared length.** A truncated
render looks exactly like an animation that stops in the middle:

```bash
# for each slug in RENDERED_DEMOS: config.durationInFrames / fps  ==  mp4 duration
ffprobe -v error -show_entries format=duration -of csv=p=0 public/demos/<slug>.mp4
```

**2. Every gallery component opens into a `<video>`, not a `<canvas>`.** Load
`/docs/components?item=<slug>` and look at what is inside `[role="dialog"]`. A
`<canvas>` there means that slug fell through to a live Player:

```js
const dlg = document.querySelector('[role="dialog"]');
dlg.querySelector("video") ? "mp4" : dlg.querySelector("canvas") ? "PLAYER — bug" : "static";
```

Run it across every slug before touching any preview surface. Both invariants
held for all 23 components when this was written.

---

## Motion quality: what actually makes scaled text look cheap

Everything here was measured on rendered frames, not guessed. If you animate a
scale on type, you will hit all of it.

**Pivot the scale on the baseline, not the middle of the line.** The glyph
rasteriser snaps each glyph's origin to the pixel grid — quarter-pixel precision
horizontally, and *none at all* vertically. So a scale that moves the baseline
makes the type climb the grid in whole-pixel jumps: during the slow ends of an
eased curve the baseline drifts a fraction of a pixel per frame, which rounds to
nothing for several frames and then to a whole pixel at once. Sit still, jump,
sit still. Pivot on the baseline and it never moves, so there is nothing to snap.
Measured on a linear 1.6x → 1x ramp: vertical judder **0.284px → 0.014px**, and
direction reversals **29 → 0**. Measure the baseline off the real font metrics (a
zero-sized `inline-block` sits on it) — do not guess it from a line-height ratio.

**Turn hinting off: `text-rendering: geometricPrecision`.** Hinting bends each
glyph's outline so its stems land on whole pixels. As the size slides, every stem
re-snaps to a different grid and the letterforms literally change shape frame to
frame. They boil. The line's shape invariant — ink area over width squared, which
for a rigid shape being scaled *cannot* change — wandered **3.41%** with hinting
on and **0.22%** with it off. The type reads very slightly softer without it. That
is not blur, it is the absence of a lie, and it is what every professional motion
tool does with type.

**Do not use `will-change: transform` on scaled text in a render.** It hands the
scale to the compositor, which resamples a *bitmap* instead of re-rasterising real
type — and a render is spread across parallel browser tabs, each of which inherits
a stale raster from whatever scale it drew last, so the same frame comes out
differently depending on which tab drew it. `getRemotionEnvironment().isRendering`
is the switch: composite for the Player (one continuous tab, a hard frame budget),
re-rasterise for the render (no budget, and crispness is the deliverable).
`translateZ(0)`, `backface-visibility: hidden` and `perspective(1px)` are the same
layer-promotion trick wearing different hats. They are not fixes.

**No asymptotic easing on a frame clock.** Quint-out and expo-out cover 99% of
their travel in the first third and then crawl. Over a 50px rise at 30fps that
leaves five frames each moving less than half a pixel — which rasterise to
*identical frames*. The element visibly stops dead partway and waits. Every curve
should still arrive at a standstill, but none should spend more than a frame or so
on travel you cannot see. **A settle worth one frame is a settle; a settle worth
five frames is a freeze.**

---

## Before you open a PR

```bash
pnpm lint
pnpm test
pnpm run registry:build
pnpm run render:previews --only <slug>   # only if it is in RENDERED_DEMOS
```

Say what you changed and how you know it works. "It looks right" is not a claim
about a frame-accurate animation — render it and look at the frames.
