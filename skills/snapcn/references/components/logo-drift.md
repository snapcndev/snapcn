# logo-drift

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 108f @ 30fps

A field of tiles drifting past a headline while the camera pulls steadily back, so the wall of things-it-works-with keeps arriving from every edge. The words do not fade in — they arrive 1.216× large and 4.3px soft and land in 140ms.

## Install

```bash
shadcn add @snapcn/logo-drift
```

Lands at `components/snap-cn/logo-drift.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `headline` | `string` | "Built for the stack you already use." |
| `pullback` | `number` | 0.1762 |
| `tileSpeed` | `number` | 1 |
| `tileScale` | `number` | 1 |
| `tileFade` | `number` | 0.4 |
| `glyphScale` | `number` | 0.34 |
| `wordStagger` | `number` | 0.15 |
| `wordScale` | `number` | 1.216 |
| `wordBlur` | `number` | 4.3 |
| `exitAt` | `number` | 3.13 |
| `fontSize` | `number` | 20 |
| `accentColor` | `string` | "#3072db" |
| `mode` | `"light" \| "dark"` | "light" |
| `speed` | `number` | 1 |

`pullback` is one linear scale per second applied across every tile — the pull-back is continuous, not eased, by design. Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<LogoDrift headline="Built for the stack you already use." />
```

## Use when

- The integrations *are* the pitch and no single one is the hero — the field never stops on a tile.
- You want an "ecosystem" beat behind a headline without choreographing individual logos.
- The shot has to hold under voiceover; the drift is continuous and has no beat to miss.

## Don't use when

- One specific mark has to land and be read — nothing here stops. Use `logo-assemble` or `moodboard-reveal`.
- You are resolving into a brand lockup at the end of a video — `logo-assemble` and `logo-flicker` are the closers.
- The wordmark itself is the subject — use `block-wordmark`.
