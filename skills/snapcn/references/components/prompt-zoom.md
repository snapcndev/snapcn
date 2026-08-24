# prompt-zoom

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 90f @ 30fps

An assistant landing screen that offers its suggestions, then cuts — hard, in a single frame — into the field while the prompt is still being typed.

## Install

```bash
shadcn add @snapcn/prompt-zoom
```

Lands at `components/snap-cn/prompt-zoom.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `prompt-zoom` is what to reach for instead:

`ai-prompt-flow` · `claude-chat` · `v0`

## Props

| Prop | Type | Default |
|---|---|---|
| `greeting` | `string` | "Up late?" |
| `placeholder` | `string` | "How can I help you today?" |
| `text` | `string` | "Get me a plan for tomorrow" |
| `chips` | `string[]` | [] |
| `model` | `string` | "Auto" |
| `effort` | `string` | "Medium" |
| `typeStart` | `number` | 0.35 |
| `cutAt` | `number` | 1.0 |
| `charsPerSecond` | `number` | 18 |
| `zoom` | `number` | 2.547 |
| `focusX` | `number` | 0.27 |
| `focusY` | `number` | 0.516 |
| `accentColor` | `string` | theme `primary` |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<PromptZoom text="Get me a plan for tomorrow" chips={["Plan my week", "Summarise this"]} />
```

## Use when

- A short, punchy AI-product beat: the surface, the prompt, and a cut that lands mid-word.
- You need an AI landing screen in 90 frames — this is the compact option.
- The suggestion chips are part of the pitch; pass `chips` (empty by default).

## Don't use when

- You want a smooth push rather than a cut — `cutAt` is one frame by design, that is the gag.
- The reply matters as much as the prompt — use `answer-stream`.
- The typing itself is the whole shot and needs room to breathe — use `search-typing`.
