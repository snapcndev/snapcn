# status-cycle

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 150f @ 30fps

A centred line whose status pill cycles: the label rolls up behind a hard clip while the pill morphs to its new width, then act two scrolls a column of chips through the frame.

## Install

```bash
shadcn add @snapcn/status-cycle
```

Lands at `components/snap-cn/status-cycle.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `prefix` | `string` | "snapcn is" |
| `statuses` | `string[] | string` | ["animating","transitioning",…] |
| `chips` | `string[] | string` | component names |
| `fieldColor` | `string` | theme `primary` |
| `pageColor` | `string` | theme `background` |
| `pillColor` | `string` | theme `foreground` |
| `chipFills` | `string[] | string` | period-3 cycle from the theme |
| `fontWeight` | `number` | 400 |
| `chipFontWeight` | `number` | 400 |
| `pillRadius` | `number` | 0.229 × pill height |
| `statusHold` | `number` | 18 |
| `introFrames` | `number` | 24 |
| `chipStagger` | `number` | 8 |
| `startAt` | `number` | 0 |
| `motion` | `Partial<StatusCycleMotion>` | measured defaults |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<StatusCycle prefix="Acme is" statuses={["reconciling", "reporting", "done"]} chips={features} />
```

## Use when

- A product's verbs are the pitch — one line, several states, no scene changes.
- You want a second act that lists features as chips without a separate composition.
- The type must fit whatever you pass — every line is measured and scaled down to its budget, never up.

## Don't use when

- You are swapping a single string once — use `text-swap`.
- The statuses are long phrases; the pill morph reads best on one or two words.
- You want to bump `chipFontWeight` — it is measured at 400, and raising it is the usual way to make the chips look cheap.
