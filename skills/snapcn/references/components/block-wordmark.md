# block-wordmark

**Tier:** `snapcn` · **Vibe:** playful · **Natural length:** 150f @ 30fps

A wordmark builds out of solid blocks — a square scales in, a coloured deck fans out around it, and each block splits into the letter it stands for.

## Install

```bash
shadcn add @snapcn/block-wordmark
```

Lands at `components/snap-cn/block-wordmark.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `text` | `string` | "base" |
| `fontSize` | `number` | 160 |
| `fontFamily` | `string` | Inter |
| `fontWeight` | `number | string` | 700 |
| `color` | `string` | theme `foreground` |
| `colors` | `string[] | string` | deck colours |
| `blockSizing` | `"square" | "glyph"` | "square" |
| `blockGap` | `number` | 0.093 |
| `cornerRadius` | `number` | 0.07 |
| `ascenderRatio` | `number` | measured per glyph |
| `cards` | `number` | 6 |
| `spinTurns` | `number` | 1 |
| `growDuration` | `number` | 9 |
| `spinDuration` | `number` | 33 |
| `splitDuration` | `number` | 5 |
| `holdDuration` | `number` | 54 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<BlockWordmark text="acme" colors={["#5600f5", "#08ff4b"]} />
```

## Use when

- A short wordmark (3–6 characters) is the whole shot and should build rather than fade in.
- The brand has a colour set worth fanning out — pass `colors`.
- You want the type measured, not guessed: ascender height and stem width are read per glyph.

## Don't use when

- The wordmark is long; every character gets its own block and the row runs off frame past ~8.
- The mark is a logo image rather than type — use `logo-assemble` or `logo-flicker`.
- You need the letters to arrive as text — this is a block build, not a text animation.
