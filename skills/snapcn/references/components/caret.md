# caret

**Tier:** `snap-cn-ui` · **Vibe:** clean · **Natural length:** 120f @ 30fps

A blinking text caret — a controlled vertical bar, or a pure motion atom that blinks deterministically off the frame clock.

## Install

```bash
shadcn add @snapcn/caret
```

Lands at `components/snap-cn/caret.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `caret` is what to reach for instead:

`cursor`

## Props

| Prop | Type | Default |
|---|---|---|
| `color` | `string` | "currentColor" |
| `width` | `number` | 2 |
| `height` | `number` | 18 |
| `radius` | `number` | 1 |
| `opacity` | `number` | — |
| `blink` | `boolean` | false |
| `blinkPerSecond` | `number` | 1 |
| `marginLeft` | `number` | 0 |
| `speed` | `number` | 1 |
| `className` | `string` | — |
| `style` | `CSSProperties` | — |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<Caret blink blinkPerSecond={1} height={22} />
```

## Use when

- Your own typing scene needs a caret and you want the blink deterministic, not an interval.
- You are extending `input` or building a field the registry does not ship.
- You need the bar's exact geometry under your control — width, height, radius, colour.

## Don't use when

- You are using `input`, `search-typing` or `prompt-zoom` — they bring their own caret.
- You want a mouse cursor rather than a text caret; that does not ship.
- The blink should be driven by CSS animation — it is frame-derived so it survives a render.
