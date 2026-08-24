# text-reveal

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 90f @ 30fps

A sentence assembles from its lead word: the first word fades in large and centred, drifts toward the viewer, then falls back to its place in the line while the trailing words push in from the right.

## Install

```bash
shadcn add @snapcn/text-reveal
```

Lands at `components/snap-cn/text-reveal.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `text-reveal` is what to reach for instead:

`blur-out-up` · `focus-blur-resolve` · `per-character-rise` · `bottom-up-letters` · `top-down-letters` · `soft-blur-in` · `spring-scale-in` · `micro-scale-fade` · `scale-down-fade` · `line-by-line-slide` · `mask-reveal-up` · `tracking-in` · `short-slide-right` · `staggered-fade-up`

## Note

`text-reveal/index.tsx` also exports `TEXT_REVEAL_PRESETS`, `TextRevealPreset` and `resolveTextRevealSettings()` — a preset-driven API carrying the 14 legacy looks. **The shipped `TextReveal` component does not consume any of it**: its signature takes the lead-word props in the table above, and nothing outside the component's own tests calls `resolveTextRevealSettings`. Do not write `<TextReveal preset="blur-out-up" />` — the prop is not read. Reproduce a legacy look with the props above, or wire the resolver into the component first.

## Props

| Prop | Type | Default |
|---|---|---|
| `text` | `string` | "Meet Acme Billing" |
| `fontSize` | `number` | 72 |
| `color` | `string` | theme `foreground` |
| `fontWeight` | `number | string` | 600 |
| `initialScale` | `number` | 2.3 |
| `introDuration` | `number` | 6 |
| `holdDuration` | `number` | 12 |
| `pushScale` | `number` | 1.06 |
| `recedeDuration` | `number` | 14 |
| `assembleDuration` | `number` | 30 |
| `wordDelay` | `number` | 7 |
| `wordStagger` | `number` | 4 |
| `wordDuration` | `number` | 14 |
| `wordPush` | `number` | 0.5 |
| `wordFade` | `number` | 2 |
| `letterSpacing` | `string` | "-0.03em" |
| `theme` | `Partial<SnapCnTheme>` | — |
| `mode` | `"light" | "dark"` | — |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TextReveal text="Meet Acme Billing" fontSize={72} />
```

## Use when

- A headline needs a hero entrance where one word carries the moment before the rest of the line arrives.
- The title is the shot — this animation owns the full frame and reads as a scene, not a label.
- You want depth in a text reveal without a 3D scene: the lead word's drift does it with scale alone.

## Don't use when

- The line is a subtitle or supporting label — the lead-word swell is too loud; set a short `introDuration` on a plain reveal or use `text-build`.
- You are replacing one string with another — `text-reveal` only enters. Use `text-swap`.
- The text is multi-line or a paragraph; the lead word centres against the whole line's measured width.
