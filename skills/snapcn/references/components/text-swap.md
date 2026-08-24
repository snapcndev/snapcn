# text-swap

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 90f @ 30fps

Replaces one line of text with another using exit-then-enter scheduling, with six transitions and per-word or whole-block units.

## Install

```bash
shadcn add @snapcn/text-swap
```

Lands at `components/snap-cn/text-swap.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `text-swap` is what to reach for instead:

`fade-through` · `crossfade` · `shared-axis-y` · `shared-axis-z` · `per-word-crossfade` · `fly-through`

## Props

| Prop | Type | Default |
|---|---|---|
| `fromText` | `string` | required |
| `toText` | `string` | required |
| `transition` | `"fly-through" | "fade-through" | "crossfade" | "shared-axis-y" | "shared-axis-z" | "cut"` | "fly-through" |
| `unit` | `"word" | "block"` | per transition |
| `exitDuration` | `number` | per transition |
| `enterDuration` | `number` | per transition |
| `exitStagger` | `number` | 1 |
| `enterStagger` | `number` | 2 |
| `overlap` | `number` | 1 |
| `microDelay` | `number` | 2 |
| `fontSize` | `number` | 72 |
| `fontWeight` | `number` | 600 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TextSwap fromText="Manual invoices" toText="Reconciled automatically" transition="shared-axis-y" />
```

## Use when

- One label, stat or claim has to become another in the same slot — a before/after, a plan change, a chained A→B→C.
- The swap itself is the beat; the scene around it stays put.
- You want word-level staging on the swap rather than a single block fade — set `unit="word"`.

## Don't use when

- Text is entering for the first time with nothing to replace — use `text-reveal` or `text-build`.
- You need the two strings on screen together for comparison; this reuses one slot.
- The emphasis is one word inside a sentence that otherwise stays — use `text-highlight`.
