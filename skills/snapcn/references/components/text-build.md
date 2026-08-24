# text-build

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 75f @ 30fps

Words enter one at a time while already-placed words physically reflow to stay centred — the line rebalances on every arrival instead of appearing in its final position.

## Install

```bash
shadcn add @snapcn/text-build
```

Lands at `components/snap-cn/text-build.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `text-build` is what to reach for instead:

`kinetic-center-build` · `short-slide-down` · `line-by-line-slide`

## Props

| Prop | Type | Default |
|---|---|---|
| `text` | `string` | required |
| `axis` | `"x" | "y"` | "x" |
| `entryOffset` | `number` | 88 on x, 28 on y |
| `gap` | `number` | 12 on y |
| `firstDuration` | `number` | 10 |
| `pushDuration` | `number` | 13 |
| `entryScale` | `number` | 0.992 |
| `entryBlur` | `number` | 3.5 on x, 2.4 on y |
| `reflowBlur` | `number` | 0.8 |
| `easing` | `[number,number,number,number]` | [0.2, 0.8, 0.2, 1] |
| `fontSize` | `number` | 72 |
| `fontWeight` | `number` | 600 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TextBuild text="Built in React, rendered to mp4" axis="x" />
```

## Use when

- A short headline should visibly assemble, with the reflow doing the work rather than a stagger alone.
- You want a calmer build than `text-reveal` — no hero word, no camera push.
- A stacked multi-row build is wanted — `axis="y"`.

## Don't use when

- The line is 7+ words: every arrival re-centres the whole line and the motion turns busy.
- The layout must not shift (a caption slot, a lower third) — reflow is the point of this component.
- You need one word emphasised inside a settled sentence — use `text-highlight`.
