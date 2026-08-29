# snapcn Component Index

Router for the per-component reference files in this directory. **Scan this table to pick candidates, then open only the `components/<name>.md` files you actually need** — do not read every file.

The registry ships **36 items**. If a name is not in this file, it is not installable — check *Older names* at the bottom before assuming it exists.

Install any entry: `shadcn add @snapcn/<name>` (lands at `components/snap-cn/<name>.tsx`; deps auto-install).

## Text & Titles

Reveal, replace and emphasize a line. Frame-driven, shared `speed` prop.

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`text-reveal`](text-reveal.md) | A headline needs a hero entrance where one word carries the moment before the rest of the line… | The line is a subtitle or supporting label — the lead-word swell is too loud; set a short… | 90f | premium |
| [`text-swell`](text-swell.md) | A pricing line, promise or punchline needs to sit forward in the frame and hold before the… | The budget is under ~90 frames — the float and hold get clipped and the motion reads as a… | 110f | premium |
| [`text-highlight`](text-highlight.md) | One phrase in an otherwise static line has to carry the emphasis — a feature name, a number, a… | The whole line should animate — this leaves `before` and `after` static by design. Use… | 56f | clean |
| [`text-swap`](text-swap.md) | One label, stat or claim has to become another in the same slot — a before/after, a plan… | Text is entering for the first time with nothing to replace — use `text-reveal` or `text-build`. | 90f | clean |
| [`text-build`](text-build.md) | A short headline should visibly assemble, with the reflow doing the work rather than a stagger… | The line is 7+ words: every arrival re-centres the whole line and the motion turns busy. | 75f | clean |
| [`word-flip`](word-flip.md) | A hero line has to cover several audiences or use-cases without three separate scenes. | The budget is short; typing the prefix alone eats most of a 90-frame shot. | 180f | playful |
| [`text-rewrite`](text-rewrite.md) | The correction is the beat — a line that says one thing, then gets edited on camera into what… | Both versions are entirely different strings — `text-swap` replaces a whole line and offers… | 102f | clean |
| [`text-select`](text-select.md) | You need a short, cheap emphasis beat — at 72 frames this is the shortest text scene in the… | Only part of the line should be emphasised — use `text-highlight` for a phrase, or… | 72f | clean |
| [`type-morph`](type-morph.md) | The line has to say two things in sequence and the *second* is the payoff — the morph is the… | The two strings share no letters — the per-letter morph reads as a scramble. Use `text-swap`… | 94f | premium |

## Captions

Burned-in captions from word-level timings (Whisper, CapCut, `@remotion/captions`) or an .srt.

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`word-captions`](word-captions.md) | You have word-level timings from Whisper, CapCut or `@remotion/captions` and want them burned… | The line should fill word-by-word as it is spoken in a karaoke sweep — use `karaoke-captions`. | 96f | social |
| [`karaoke-captions`](karaoke-captions.md) | The line should visibly fill as it is spoken — lyric-video or talking-head energy. | You are burning a full transcript over a long clip — `word-captions` pages properly, this does… | 150f | social |

## AI Chat Input

Prompt surfaces — the field, the cut, the streamed reply.

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`search-typing`](search-typing.md) | The query itself is the story — a search or prompt box as the hero of the shot. | The budget is short — at 420 frames of natural length this is one of the longest scenes in the… | 420f | tech |
| [`prompt-zoom`](prompt-zoom.md) | A short, punchy AI-product beat: the surface, the prompt, and a cut that lands mid-word. | You want a smooth push rather than a cut — `cutAt` is one frame by design, that is the gag. | 90f | tech |
| [`answer-stream`](answer-stream.md) | The product's value is in the response — a copilot, an agent, an AI feature that returns… | The prompt is the story and the reply is incidental — use `prompt-zoom`. | 150f | tech |
| [`prompt-send`](prompt-send.md) | The *submit* is the beat — the pointer arriving at the send button is what the shot is for. | The cut into the field is the gag and you want it over in 90 frames — use `prompt-zoom`. | 165f | tech |
| [`answer-highlight`](answer-highlight.md) | The answer is the pitch and one clause inside it is the actual claim — the drag is what points… | The reply should just stream and land with no emphasis beat — use `answer-stream`, which is 40… | 190f | tech |
| [`agent-steps`](agent-steps.md) | The product *is* the agent, and the work it does between prompt and answer is the thing worth… | There is no intermediate work to narrate and the reply is the whole shot — use `answer-stream`. | 160f | tech |

## Screens & Devices

Put the product's own UI in the shot.

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`phone-frame`](phone-frame.md) | A mobile product needs its UI on a real device rather than a bare screenshot. | The product is desktop or web — use `laptop-frame`. | 240f | clean |
| [`laptop-frame`](laptop-frame.md) | A web or desktop product needs a device to sit in before the shot goes inside it. | `finale="zoom-to-screen"` is used inside a smaller container — the cover scale is derived from… | 240f | premium |
| [`terminal-simulator`](terminal-simulator.md) | The product is a CLI, or the install command is the pitch. | You need a syntax-highlighted source block rather than terminal output — that does not ship;… | 200f | tech |
| [`screen-recording`](screen-recording.md) | The user has an actual screen recording of their product and it needs to become a demo shot —… | The capture is already cropped, clean and locked off — an `OffthreadVideo` of your own does… | 139f | clean |
| [`cursor-track`](cursor-track.md) | A UI simulation, or a recording whose cursor never made it into the file, needs a pointer doing… | The recording already has a cursor in it — two pointers is worse than none. | 132f | clean |

## Logos

Openers and closers that resolve into a mark.

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`logo-assemble`](logo-assemble.md) | A closing lockup needs the product's own screenshots to resolve into the brand mark. | You have one or two images — the ring needs a population to read as one. | 108f | premium |
| [`logo-flicker`](logo-flicker.md) | A short, high-energy bumper — 100 frames from first flip to resolved mark. | The images deserve to be seen — the flip interval is short by design. Use `logo-assemble` or… | 100f | tech |
| [`block-wordmark`](block-wordmark.md) | A short wordmark (3–6 characters) is the whole shot and should build rather than fade in. | The wordmark is long; every character gets its own block and the row runs off frame past ~8. | 150f | playful |
| [`logo-drift`](logo-drift.md) | The integrations *are* the pitch and no single one is the hero — the field never stops on a… | One specific mark has to land and be read — nothing here stops. Use `logo-assemble` or… | 108f | tech |

## Scenes

Full multi-shot sequences. Each owns its own choreography.

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`announce-title`](announce-title.md) | A launch or version announcement needs a full title sequence, not a title card. | The budget is short — this is four shots in 170 frames and cutting it early lands mid-shot. | 170f | premium |
| [`hero-launch`](hero-launch.md) | An opening shot needs two pieces of media plus a line, with no further choreography to manage. | You have more than two pieces of media — use `orbit-gallery` or `moodboard-reveal`. | 170f | premium |
| [`orbit-gallery`](orbit-gallery.md) | A long hero that has to hold — 300 frames of continuous motion with no beat to hit. | A specific image has to land — the stream never stops on one. Use `moodboard-reveal`. | 300f | premium |
| [`moodboard-reveal`](moodboard-reveal.md) | One image has to be the payoff and the rest are context — `heroImage` is where the montage… | You need the scene to stay in one mode — it spans light and dark and takes no `mode` prop. | 150f | premium |
| [`status-cycle`](status-cycle.md) | A product's verbs are the pitch — one line, several states, no scene changes. | You are swapping a single string once — use `text-swap`. | 150f | clean |

## Social Proof

Numbers that land.

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`follower-rush`](follower-rush.md) | Social proof is the beat — a launch that landed, a milestone, a waitlist filling. | The metric is not a follower count — nothing else in the registry animates numbers, so build a… | 300f | social |

## Effects

Overlays that sit on top of a scene.

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`pulsing-border`](pulsing-border.md) | A scene needs to read as 'generating' or 'thinking' without a spinner. | You need a full animated background — this is a border overlay and `colorBack` is transparent… | 180f | tech |

## UI Primitives

State-based, timeline-driven shadcn atoms. **No `speed` prop.**

| Component | Use for | Avoid for | Length | Vibe |
|---|---|---|---|---|
| [`input`](input.md) | A form field is part of a larger scene and its state should be driven by the timeline, not by… | You want the whole typing scene choreographed — use `search-typing` or `prompt-zoom`. | 120f | clean |
| [`caret`](caret.md) | Your own typing scene needs a caret and you want the blink deterministic, not an interval. | You are using `input`, `search-typing` or `prompt-zoom` — they bring their own caret. | 120f | clean |
| [`snap-cn-ui`](snap-cn-ui.md) | You are writing your own component and need the same tokens the registry uses. | You are only installing components — `shadcn` pulls this in for you. | — | — |

## Older names

The catalog this file replaces described a pre-consolidation registry. None of those names install. Where an old name has a home, it is listed here; everything else was dropped and has no equivalent.

| Old name | Now |
|---|---|
| `ai-prompt-flow` | [`search-typing`](search-typing.md) or [`prompt-zoom`](prompt-zoom.md) |
| `blur-out-up` | [`text-reveal`](text-reveal.md) |
| `bottom-up-letters` | [`text-reveal`](text-reveal.md) |
| `claude-chat` | [`prompt-zoom`](prompt-zoom.md) or [`answer-stream`](answer-stream.md) |
| `combobox` | [`input`](input.md) |
| `crossfade` | [`text-swap`](text-swap.md) |
| `cursor` | [`search-typing`](search-typing.md) or [`caret`](caret.md) |
| `fade-through` | [`text-swap`](text-swap.md) |
| `field` | [`input`](input.md) |
| `fly-through` | [`text-swap`](text-swap.md) |
| `focus-blur-resolve` | [`text-reveal`](text-reveal.md) |
| `github-stars` | [`follower-rush`](follower-rush.md) |
| `glass-code-block` | [`answer-stream`](answer-stream.md) or [`terminal-simulator`](terminal-simulator.md) |
| `infinite-marquee` | [`orbit-gallery`](orbit-gallery.md) |
| `inline-highlight` | [`text-highlight`](text-highlight.md) |
| `kinetic-center-build` | [`text-swell`](text-swell.md) or [`text-build`](text-build.md) |
| `line-by-line-slide` | [`text-reveal`](text-reveal.md) or [`text-build`](text-build.md) |
| `logo-enter` | [`text-highlight`](text-highlight.md) or [`logo-assemble`](logo-assemble.md) or [`logo-flicker`](logo-flicker.md) |
| `marker-highlight` | [`text-highlight`](text-highlight.md) |
| `mask-reveal-up` | [`text-reveal`](text-reveal.md) |
| `micro-scale-fade` | [`text-reveal`](text-reveal.md) |
| `number-wheel` | [`word-flip`](word-flip.md) |
| `per-character-rise` | [`text-reveal`](text-reveal.md) |
| `per-word-crossfade` | [`text-swap`](text-swap.md) |
| `perspective-marquee` | [`orbit-gallery`](orbit-gallery.md) |
| `rolling-number` | [`word-flip`](word-flip.md) |
| `scale-down-fade` | [`text-reveal`](text-reveal.md) |
| `screen-callout` | [`screen-recording`](screen-recording.md) — `camera`, a push to the point that needs naming |
| `screen-spotlight` | [`screen-recording`](screen-recording.md) — `camera`, a push to the point that needs emphasis |
| `shader-pulsing-border` | [`pulsing-border`](pulsing-border.md) |
| `shared-axis-y` | [`text-swap`](text-swap.md) |
| `shared-axis-z` | [`text-swap`](text-swap.md) |
| `shimmer-sweep` | [`text-highlight`](text-highlight.md) |
| `short-slide-down` | [`text-build`](text-build.md) |
| `short-slide-right` | [`text-reveal`](text-reveal.md) |
| `slot-machine-roll` | [`word-flip`](word-flip.md) |
| `soft-blur-in` | [`text-reveal`](text-reveal.md) |
| `spring-scale-in` | [`text-reveal`](text-reveal.md) |
| `staggered-fade-up` | [`text-reveal`](text-reveal.md) |
| `strikethrough-replace` | [`text-highlight`](text-highlight.md) |
| `top-down-letters` | [`text-reveal`](text-reveal.md) |
| `tracking-in` | [`text-reveal`](text-reveal.md) |
| `v0` | [`prompt-zoom`](prompt-zoom.md) or [`answer-stream`](answer-stream.md) |
| `x-follow-card` | [`follower-rush`](follower-rush.md) |
| `x-followers-overview` | [`follower-rush`](follower-rush.md) |

**Dropped with no equivalent:** every `shader-*` background, `mesh-gradient-bg`, `dynamic-grid`, `backdrop`, `confetti`, `directional-wipe`, `frosted-glass-wipe`, `grid-pixelate-wipe`, `chromatic-aberration-wipe`, `spatial-push`, `zoom-through-transition`, `matrix-decode`, `rgb-glitch-text`, `number-wheel`, `rolling-number`, `slot-machine-roll`, `animated-bar-chart`, `glass-code-block`, and the shadcn-primitive tier beyond `input` and `caret` (`dialog`, `drawer`, `select`, `command-menu`, `popover`, `tabs`, `toast`, `switch`, …).

If a scene needs one of those, build it — see `../anatomy.md` §1.
