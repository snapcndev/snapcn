# word-flip

**Tier:** `snapcn` · **Vibe:** playful · **Natural length:** 180f @ 30fps

A headline types itself out, then one word cycles on a 3D flip — it sinks into an anticipation, rolls over and settles, gradient-painted.

## Install

```bash
shadcn add @snapcn/word-flip
```

Lands at `components/snap-cn/word-flip.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `word-flip` is what to reach for instead:

`slot-machine-roll` · `number-wheel` · `rolling-number`

## Props

| Prop | Type | Default |
|---|---|---|
| `prefix` | `string` | "Looking For A" |
| `words` | `string[]` | ["Modern","Stunning","Minimal"] |
| `suffix` | `string` | "Portfolio" |
| `gradient` | `string[]` | accent → destructive ramp |
| `cps` | `number` | 9 |
| `typeStart` | `number` | 4 |
| `charFade` | `number` | 6 |
| `jitter` | `number` | 0.18 |
| `pause` | `number` | 6 |
| `cycle` | `number` | 35 |
| `exitDuration` | `number` | 9 |
| `enterDuration` | `number` | 9 |
| `overlap` | `number` | 3 |
| `caret` | `boolean` | true |
| `loop` | `boolean` | true |
| `perspective` | `number` | 6.5 |
| `fontFamily` | `string` | shadcn sans stack |
| `fontSize` | `number` | 72 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<WordFlip prefix="Ship your" words={["demo", "changelog", "launch"]} suffix="video" />
```

## Use when

- A hero line has to cover several audiences or use-cases without three separate scenes.
- You want the typing beat and the cycle in one component rather than composing them.
- The scene loops or runs long — `loop` keeps the slot cycling indefinitely.

## Don't use when

- The budget is short; typing the prefix alone eats most of a 90-frame shot.
- You need a single clean swap of one line for another — use `text-swap`.
- The tone is restrained or editorial: the gradient and 3D flip read as playful.
