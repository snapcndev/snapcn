# Video Anatomy & Composition Strategy

How to turn "make a product demo with snapcn" into a coherent video. Read this before composing.
The component catalog is `components/index.md`; the per-archetype recipes are in `archetypes/` (start at `archetypes/index.md`).

This file has three layers, kept separate:
1. **Strategy** — template vs compose vs build-new.
2. **Anatomy** — the beats a product demo is made of.
3. **Good vs slop** — the quality bar, derived from real good/bad reference demos.

---

## 1. Strategy: template, compose, or new component

Before building, decide HOW. Three strategies, each with when-to / when-not-to.

### Reach for a ready-made template when
- The archetype is canonical and common (product-demo, changelog, testimonial-reel) and a template exists.
- The choreography is non-trivial (multi-act camera moves, overlapping phase timings) — things an ad-hoc composition won't reliably reproduce.
- The structure is stable and the user's content maps cleanly onto the template's slots.

Don't use a template when the user's content or brand can't fit its fixed slots, or the archetype is long-tail.

### Compose from catalog components (the default) when
- The user has specific content/brand, or a variable number of features/metrics.
- The needed structure is a sequence of existing components (hook → product UI → proof → CTA) with no exotic choreography.
- Speed and fit matter more than a pixel-locked recreation.

This is the primary path. Output is a raw `<TransitionSeries>` orchestrator stitching installed components — see `archetypes/index.md`.

### Build a new lightweight component when
- A beat needs a visual the catalog lacks (a specific product-UI frame, a chart type) **and** it will be reused across videos (e.g. a generic `ui-frame`, a `metric-card`, a `task-card`).
- For a true one-off, try composing from existing components first; only author a new one when reuse justifies it.

New components stay transparent (background via a backdrop in the example), seek-safe, and follow the anti-slop rules below.

---

## 2. Anatomy of a product demo

A product demo is 6 beats. **Proof** and **CTA** are optional; **Hook** and **Product reveal** are the spine. Beats overlap at their edges (the end of one launches the next — no dead frames between).

| # | Beat | Job | Typical content |
|---|---|---|---|
| 1 | **Hook** | State the problem or a bold positioning line in plain language | "Your team has tasks everywhere", "Show up in AI answers", "Don't get blocked by your machine" |
| 2 | **Positioning** | Name the product / what it is → resolve to the lockup | "Meet Acme", "AI-Powered Work Operating System" → logo |
| 3 | **Product reveal** | Show the actual product surface working | chat composer typing a prompt, a terminal running, a planning timeline, a workflow graph |
| 4 | **Features** | 2–4 capabilities, each as a quick concrete moment | a checklist running, task cards wiring up, a "designed to simplify your workflow" line |
| 5 | **Proof** *(optional)* | Make it credible | a metric/score counting up, metric cards, "Join 12,000+ people" + testimonials, an integration landing in Slack |
| 6 | **CTA** *(optional)* | One ask + where to go | "Build with…", a command to run, `domain.com`, logo lockup on a calm hold |

The hook usually carries the single hardest idea; features are where most of the runtime lives. Transitions between beats come from `@remotion/transitions` (`slide` for "going deeper", `fade` for a neutral cut) — snapcn ships none. `text-swap` changes a line within a beat, not the beat itself.

---

## 3. Good vs slop — the quality bar

Derived from a corpus of real reference demos. The good ones (several SaaS product demos, a CLI tool demo, a component walkthrough, an agent-security demo, workspace-product demos, an animation-library promo) share a language; the bad ones (a component-catalog dump, generic library promos, an over-long slide tool, bad_01–bad_06 below) share failure modes. The line is often *restraint and legibility*, not the presence of any one effect.

### Good — do these
- **One accent color per video.** Everything else neutral (mono / cream / dark). Good demos pick exactly one (orange, yellow, teal, blue) and use it only on the emphasized word, the active number, and the CTA.
- **Kinetic type with selective emphasis.** Sentence case. Emphasize meaning with weight, the accent color, or a highlight box on the ONE word that matters — never the whole line.
- **Show the real product surface.** A believable chat composer with a cursor, a terminal with monospace output and progress, a checklist, task cards, a metric card. The UI sim *is* the product, not decoration.
- **Real, specific content.** Real-feeling names, metrics, copy ("Your AI Visibility Score: 71%", "Focus Time 4h 25m", "Join 12,000+ people"). All copy in English.
- **Generous whitespace and a single focal point per beat.** One idea on screen at a time.
- **Cursor-driven interaction** for product beats (type, click, the button reacts).
- **A number/score payoff** with the accent, when there's a metric to land.
- **A calm logo lockup outro.** Optionally on a dark hold; keep it restrained.
- **Tight runtime with overlapping beats.** ~18s (short) to ~45s (standard). Length comes from story, not from listing.
- **Show the product large and legible.** The UI sim fills the frame and reads clearly (Claude Code Security's scan→findings→fix→PR, Notion's populated dashboard) — the product is the hero, not a distant window.
- **Long videos ride a narrative thread.** If it must run 60s+, carry it with a character / story (good Notion demo: the "Bug Wrangler" agent doing real tasks), never a feature list.

### Slop — never do these (each seen in a bad reference)
- **Keep gradients / glow restrained — small and subtle, never large or dominant.** This is about *dosage*, not presence. A small, sparing gradient accent is fine (good_04 React Bits — restrained, not big, not much of it). Slop is a *large, saturated, full-frame* gradient wash (bad_04's hot-pink background) or a soft radial **halo behind headings** (both shadcn promos — the #1 tell). The hook gets life from motion and the accent, not a glow blob. See `design.md`, [no decorative glows].
- **No feature-list / catalog enumeration.** Naming feature after feature ("Row Selection", "Pagination", "Sorting"…) over the same screenshot, or dumping every component in a gallery, is not a video — it has no narrative. Tell one problem → solution → proof story instead.
- **No placeholder / lorem content.** "Scene A", "Scene B", "First", "Your UI", "Selected element", `TASK-####` filler. If real content is missing, use honest English placeholders the user will obviously replace — never ship lorem as the final.
- **No ALL-CAPS heavy blocks, no decorative letter-spacing, no gradient text.** (A red ALL-CAPS "VISUAL EDITOR" block is slop.) See `design.md`.
- **No walls of dense, unreadable text** (tiny terminal dumps filling the frame). Show a few legible lines, not a transcript.
- **No monotony.** Don't repeat the same slide/screenshot under different labels. Each beat must advance the story.
- **Don't run long by enumerating.** 100s+ of feature-listing drags. If the content is genuinely long, give it a strong repeating rhythmic device (e.g. a question→answer cadence) or split into multiple videos.
- **No a solid theme background** as a background — it reads as generic AI slop. A **dynamic background is fine when restrained**: use a slow, muted **shader** backdrop (a solid theme background…) at low `speed`, a static a solid theme background, or a solid theme color via `backdrop`. Whatever moves: muted palette, gentle motion, never bright or fast enough to fight foreground legibility, and no neon or glow-blob bloom.
- **Show the product big and legible.** Don't render the UI near-black / low-contrast (bad_01, bad_03), shrink it to a distant floating window, or float it over a photographic background (bad_02, a doc tool). The viewer must be able to read the product — it's the hero.
- **No browser / OS chrome in the frame.** The footage is not the problem — a recording of the real product is the strongest reveal there is. What makes bad_04 slop is the tab strip, the URL bar and the dock, so crop them off: `screen-recording` takes the capture, insets each edge with `crop` and runs a keyframed `camera` over it, with `cursor-track` over that when the clicks need to read. **The camera push is how a screen shot points at something** — a push to a focal point and back out. It rides the footage by construction, so unlike an overlay it cannot drift off the thing it is emphasising when the shot moves. Only when there is no capture (or the UI does not exist yet) do you fall back to a clean product sim. Never an un-styled screencast of a real browser tab.
- **No casual / throwaway copy.** "?????", ";)", "link in bio :)", lazy filler (bad_05, a landing-page demo) reads unfinished. Keep copy crisp and professional. All English.
- **One accent, not per-brand colors.** Don't tint each word a different platform's brand color (bad_06: Instagram-pink + Twitter-blue + LinkedIn-blue in one line). One accent across the whole video.

### The one-line test
A good product demo could be described as *"X has problem Y; here's the product solving it, here's proof, here's how to get it."* If your composition is instead *"here are my components / here are my features,"* it's slop — restructure around a story.
