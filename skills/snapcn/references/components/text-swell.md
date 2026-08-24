# text-swell

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 110f @ 30fps

A title reveal where the lead word floats toward the viewer and hangs there while the rest of the sentence builds behind it, letters swelling as they land.

## Install

```bash
shadcn add @snapcn/text-swell
```

Lands at `components/snap-cn/text-swell.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `text-swell` is what to reach for instead:

`kinetic-center-build`

## Props

| Prop | Type | Default |
|---|---|---|
| `text` | `string` | "No extra charge" |
| `fontSize` | `number` | 72 |
| `fontWeight` | `number | string` | 600 |
| `introDuration` | `number` | 8 |
| `riseDistance` | `number` | 0.7 |
| `riseDuration` | `number` | 10 |
| `frontScale` | `number` | 2.1 |
| `approachDelay` | `number` | 14 |
| `approachDuration` | `number` | 20 |
| `wordDelay` | `number` | 27 |
| `wordStagger` | `number` | 14 |
| `wordPush` | `number` | 0.15 |
| `bounceWords` | `number` | 1 |
| `letterSwell` | `number` | 0.23 |
| `holdDuration` | `number` | 6 |
| `recedeDuration` | `number` | 18 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TextSwell text="No extra charge" frontScale={2.1} />
```

## Use when

- A pricing line, promise or punchline needs to sit forward in the frame and hold before the scene moves on.
- You want the whole line to travel toward the camera, not just the first word — that is the difference from `text-reveal`.
- The shot has room to breathe: the approach and hold together run most of a 110-frame budget.

## Don't use when

- The budget is under ~90 frames — the float and hold get clipped and the motion reads as a stutter.
- The line is long; `frontScale` is capped so it never leaves the frame, and a long sentence barely swells at all.
- You need an exit as well as an entrance — this settles and holds. Follow it with `text-swap`.
