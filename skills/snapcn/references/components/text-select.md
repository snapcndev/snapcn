# text-select

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 72f @ 30fps

A line that writes itself a word at a time — each arriving in the accent and cooling to the foreground a beat later, so exactly one word is ever coloured — then pushes forward to full size on a baseline-pivoted scale and gets selected under a gradient sheen.

## Install

```bash
shadcn add @snapcn/text-select
```

Lands at `components/snap-cn/text-select.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `headline` | `string` | "One command into your project." |
| `wordStagger` | `number` | 0.208 |
| `wordDuration` | `number` | 0.13 |
| `coolDelay` | `number` | 0.208 |
| `cutAt` | `number` | 1.13 |
| `zoom` | `number` | 2.39 |
| `selectAt` | `number` | 1.4 |
| `selectDuration` | `number` | 0.26 |
| `fontSize` | `number` | 20 |
| `fontWeight` | `number` | 500 |
| `shineColor` | `string` | "#ffffff" |
| `accentColor` | `string` | "#3072db" |
| `mode` | `"light" \| "dark"` | "light" |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TextSelect headline="One command into your project." />
```

## Use when

- You need a short, cheap emphasis beat — at 72 frames this is the shortest text scene in the registry.
- The whole line is the claim and selecting all of it is the point; the drag reads as a person about to copy it.
- The rolling one-word accent is doing the work of a stagger without a separate colour pass.

## Don't use when

- Only part of the line should be emphasised — use `text-highlight` for a phrase, or `answer-highlight` inside a paragraph.
- The line has to change after the selection — that is `text-rewrite`.
- You want a hero entrance rather than an edit gesture — `text-reveal` or `text-swell` carry a headline better.
