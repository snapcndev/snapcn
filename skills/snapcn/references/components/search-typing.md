# search-typing

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 420f @ 30fps

A search field wider than the shot: two thirds in frame, then it comes forward, types across, and travels back far enough that the whole field and the finished sentence land together.

## Install

```bash
shadcn add @snapcn/search-typing
```

Lands at `components/snap-cn/search-typing.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `search-typing` is what to reach for instead:

`ai-prompt-flow` · `cursor`

## Props

| Prop | Type | Default |
|---|---|---|
| `text` | `string` | required |
| `charsPerSecond` | `number` | 14 |
| `humanize` | `number` | 0.35 |
| `wordPause` | `number` | 1.55 |
| `punctuationPause` | `number` | 2.2 |
| `startDelay` | `number` | 0.5 |
| `dollyDuration` | `number` | 0.8 |
| `panDuration` | `number` | 0.5 |
| `holdAfter` | `number` | 0.9 |
| `recedeDuration` | `number` | 1.2 |
| `dolly` | `number` | 1.25 |
| `fieldHeight` | `number` | 0.27 |
| `surface` | `"shadcn" | "glass"` | "shadcn" |
| `icon` | `"search" | "sparkle" | "none"` | "search" |
| `caret` | `boolean` | true |
| `seed` | `string` | "search-typing" |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<SearchTyping text="how do I ship a demo video?" surface="glass" icon="sparkle" />
```

## Use when

- The query itself is the story — a search or prompt box as the hero of the shot.
- You want keystroke timing that reads as human without being random: `humanize` is seeded, never clock-driven.
- The scene has 12+ seconds; the dolly, pan, hold and recede need the room.

## Don't use when

- The budget is short — at 420 frames of natural length this is one of the longest scenes in the registry.
- You need the field plus a reply — use `prompt-zoom` (types then cuts) or `answer-stream` (types then streams).
- The field is chrome around other content rather than the subject; use the `input` primitive.
