# agent-steps

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 160f @ 30fps

An agent narrating its own work: a prompt in a pill, then a log that writes itself one line at a time — each step spinning, then flipping to past tense behind a check while the column steps up so the live line always sits on centre — ending with the answer.

## Install

```bash
shadcn add @snapcn/agent-steps
```

Lands at `components/snap-cn/agent-steps.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `query` | `string` | the prompt shown in the pill |
| `steps` | `string` | `running > done` pairs, `;`-separated |
| `result` | `string` | "Rendered 900 frames" |
| `stepHold` | `number` | 0.45 |
| `queryHold` | `number` | 0.683 |
| `finalHold` | `number` | 0.283 |
| `accentColor` | `string` | "#3072db" |
| `glowColor` | `string` | "rgb(228, 230, 240)" |
| `glowRadius` | `number` | 0.465 |
| `speed` | `number` | 1 |

`steps` is one string, not an array: each step is `Running text… > Done text`, steps separated by `;`, and `@globe` on either side adds the spinner glyph. Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<AgentSteps
  query="A 30-second launch video for a Next.js analytics dashboard"
  steps="Searching the registry… > Searched the registry @globe; Reading the docs… > Read 4 component docs @globe; Rendering frames… > Rendered frames"
  result="Rendered 900 frames"
/>
```

## Use when

- The product *is* the agent, and the work it does between prompt and answer is the thing worth showing.
- You want tool-call chatter to read as progress rather than as noise — the past-tense flip is what sells it.
- The step count varies; the column scrolls itself, so 3 steps and 8 steps both centre correctly.

## Don't use when

- There is no intermediate work to narrate and the reply is the whole shot — use `answer-stream`.
- The steps are long sentences; each line is one row on centre and long copy fights the step-up.
- Your budget is under ~160 frames — `stepHold` is per step, so trimming the scene drops steps rather than speeding them.
