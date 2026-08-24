# text-highlight

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 56f @ 30fps

Animated emphasis on one span inside a static sentence — marker sweep, colour shift, underline, strikethrough, shimmer, or a logo that wipes across and rushes the frame.

## Install

```bash
shadcn add @snapcn/text-highlight
```

Lands at `components/snap-cn/text-highlight.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `text-highlight` is what to reach for instead:

`marker-highlight` · `inline-highlight` · `strikethrough-replace` · `shimmer-sweep` · `logo-enter`

## Props

| Prop | Type | Default |
|---|---|---|
| `before` | `string` | "" |
| `highlight` | `string` | required |
| `after` | `string` | "" |
| `preset` | `"logo-wipe" | "marker" | "color" | "underline" | "strikethrough" | "shimmer"` | "logo-wipe" |
| `baseColor` | `string` | theme `foreground` |
| `accentColor` | `string` | theme `primary` |
| `replaceWith` | `string` | — (strikethrough only) |
| `startAt` | `number` | 6 |
| `drawDuration` | `number` | 14 |
| `thickness` | `number` | round(fontSize * 0.08) |
| `shineColor` | `string` | — (shimmer only) |
| `logoSrc` | `string` | — (logo-wipe only) |
| `logoScale` | `number` | 1.05 |
| `fontSize` | `number` | 56 |
| `fontWeight` | `number` | 600 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TextHighlight before="Ships in " highlight="one command" after="." preset="marker" />
```

## Use when

- One phrase in an otherwise static line has to carry the emphasis — a feature name, a number, a promise.
- You need a physical-feeling mark (marker, underline) rather than a colour change alone.
- A word has to be struck out and replaced — `preset="strikethrough"` with `replaceWith`.

## Don't use when

- The whole line should animate — this leaves `before` and `after` static by design. Use `text-reveal`.
- You want the emphasis to persist as a permanent style; this is a one-shot animation, not a token.
- The span is most of the sentence; the contrast that makes the emphasis read disappears.
