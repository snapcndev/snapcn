# text-rewrite

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 102f @ 30fps

A line that writes itself a word at a time, comes forward and gets selected — then its opening is swept away by a clip that cuts letters in half as it passes, and a new ending is written on while the line slides to its new centre.

## Install

```bash
shadcn add @snapcn/text-rewrite
```

Lands at `components/snap-cn/text-rewrite.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `headline` | `string` | "Or just add snapcn" |
| `keep` | `number` | 1 |
| `append` | `string` | "registry" |
| `eraseAt` | `number` | 1.45 |
| `eraseDuration` | `number` | 0.517 |
| `rewriteAt` | `number` | 2 |
| `rewriteDuration` | `number` | 0.533 |
| `zoom` | `number` | 2.41 |
| `fontSize` | `number` | 20 |
| `fontWeight` | `number` | 500 |
| `accentColor` | `string` | "#3072db" |
| `mode` | `"light" \| "dark"` | "light" |
| `speed` | `number` | 1 |

`keep` counts words retained from the start of `headline`; everything before them is what the sweep erases. Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TextRewrite headline="Or just add snapcn" keep={1} append="registry" />
```

## Use when

- The correction is the beat — a line that says one thing, then gets edited on camera into what you actually meant.
- The two versions share their opening words; `keep` is what makes the edit read as a rewrite rather than a replacement.
- You want the erase to look like a real clip sweeping through glyphs, not a fade.

## Don't use when

- Both versions are entirely different strings — `text-swap` replaces a whole line and offers six transitions.
- Nothing is being removed and the line only needs emphasis — use `text-select` or `text-highlight`.
- The line is long; it comes forward to `zoom` 2.41 and a long headline overruns the frame at that scale.
