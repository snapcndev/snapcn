# answer-stream

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 150f @ 30fps

The beat after send: a macro shot on the send button cuts on its fastest frame to the reply, which streams in word by word while the camera pulls back to keep up.

## Install

```bash
shadcn add @snapcn/answer-stream
```

Lands at `components/snap-cn/answer-stream.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `answer-stream` is what to reach for instead:

`claude-chat` · `v0` · `glass-code-block`

## Props

| Prop | Type | Default |
|---|---|---|
| `question` | `string` | sample prompt |
| `answer` | `string` | sample reply (`\n` is a hard break) |
| `headline` | `string` | sample headline |
| `cards` | `AnswerCard[]` | DEFAULT_CARDS |
| `model` | `string` | "Auto" |
| `commitAt` | `number` | 1.0 |
| `cutAt` | `number` | 1.284 |
| `pullbackAt` | `number` | 1.933 |
| `pullbackDuration` | `number` | 1.1 |
| `wordsPerSecond` | `number` | 25 |
| `coolSeconds` | `number` | 0.23 |
| `macroZoom` | `number` | 2.36 |
| `blur` | `number` | 3 |
| `accentColor` | `string` | theme `primary` |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<AnswerStream question="How do I rank in AI answers?" answer="Found 27 prompts you should rank for." />
```

## Use when

- The product's value is in the response — a copilot, an agent, an AI feature that returns something.
- You want streaming text that reads as generated: words land hot and cool to the foreground colour.
- A plan or checklist is the payoff — `cards` land empty and fill.

## Don't use when

- The prompt is the story and the reply is incidental — use `prompt-zoom`.
- The budget is under ~120 frames; the macro, cut, stream and pull-back need the full 150.
- You need a generic chat surface to drop your own content into; this scene is choreographed end to end.
