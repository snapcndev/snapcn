# pulsing-border

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 180f @ 30fps

A soft pulsing border overlay that breathes around the scene — the 'AI is working' frame.

## Install

```bash
shadcn add @snapcn/pulsing-border
```

Lands at `components/snap-cn/pulsing-border.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `pulsing-border` is what to reach for instead:

`shader-pulsing-border`

## Props

| Prop | Type | Default |
|---|---|---|
| `glowColorA` | `string` | theme `primary` |
| `glowColorB` | `string` | `primary` lifted toward the page |
| `roundness` | `number` | 0.08 |
| `thickness` | `number` | 0.06 |
| `intensity` | `number` | 0.15 |
| `bloom` | `number` | 0.2 |
| `colorBack` | `string` | "#00000000" |
| `speed` | `number` | 0.6 |
| `theme` | `Partial<SnapCnTheme>` | — |
| `mode` | `"light" | "dark"` | — |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<AbsoluteFill><YourScene /><PulsingBorder /></AbsoluteFill>
```

## Use when

- A scene needs to read as 'generating' or 'thinking' without a spinner.
- You want an overlay that sits over any content — it paints the frame edge, not a surface.
- The glow should follow the theme rather than a fixed colour: both stops default off `primary`.

## Don't use when

- You need a full animated background — this is a border overlay and `colorBack` is transparent by default.
- The scene is already busy at the edges; the bloom competes with anything near the frame.
- You want a hard border; every knob here is soft by design.
