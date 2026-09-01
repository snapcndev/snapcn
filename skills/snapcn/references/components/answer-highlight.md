# answer-highlight

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 190f @ 30fps

A question in a pill, an answer that writes itself a word at a time, then a caret that lands mid-sentence and drags a selection band across one statement — wrapping the line the way a real one does — before settling onto the single word that matters.

## Install

```bash
shadcn add @snapcn/answer-highlight
```

Lands at `components/snap-cn/answer-highlight.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `question` | `string` | "How should we structure the demo video?" |
| `answer` | `string` | a two-sentence answer |
| `statement` | `string` | "keep the timeline declarative" |
| `word` | `string` | "declarative" |
| `questionHold` | `number` | 0.6 |
| `wordStep` | `number` | 0.055 |
| `beforeDrag` | `number` | 0.45 |
| `dragStep` | `number` | 0.11 |
| `beforeWord` | `number` | 0.6 |
| `accentColor` | `string` | "#3072db" |
| `speed` | `number` | 1 |

`statement` and `word` are searched for inside `answer` — pass them as plain strings, punctuation and all, and the run is found for you. Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<AnswerHighlight
  question="How should we structure the demo video?"
  answer="Build one composition per scene and keep the timeline declarative, so the same props always render the same frames."
  statement="keep the timeline declarative"
  word="declarative"
/>
```

## Use when

- The answer is the pitch and one clause inside it is the actual claim — the drag is what points at it.
- You want the emphasis to read as a person selecting text, not as a highlighter effect painted on.
- The statement wraps across lines; the band follows the wrap instead of drawing one flat rectangle.

## Don't use when

- The reply should just stream and land with no emphasis beat — use `answer-stream`, which is 40 frames shorter and does not reserve time for the drag.
- The prompt is the story and the answer is incidental — use `prompt-zoom` or `prompt-send`.
- The emphasised run is not literally present in `answer`; nothing is highlighted if the search misses.
