# prompt-send

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 165f @ 30fps

A composer that unrolls from a hairline, writes a brief into itself while the camera cuts in and rides the caret, then cuts back out to the send button as a pointer arrives and clicks it. The typing is eased, not constant — 17 chars/sec on the first word, 33 in the middle, a settle on the last three.

## Install

```bash
shadcn add @snapcn/prompt-send
```

Lands at `components/snap-cn/prompt-send.tsx`. Pulls in `@snapcn/input`.

## Props

| Prop | Type | Default |
|---|---|---|
| `text` | `string` | the prompt that gets typed |
| `placeholder` | `string` | "Describe the scene you want…" |
| `chips` | `string` | comma-separated suggestions |
| `width` | `number` | 636.2 |
| `fieldHeight` | `number` | 121.2 |
| `typeStart` | `number` | 0.915 |
| `typeDuration` | `number` | 3.025 |
| `cutInAt` | `number` | 1.975 |
| `cutOutAt` | `number` | 4.008 |
| `clickAt` | `number` | 4.658 |
| `cursor` | `boolean` | true |
| `accentColor` | `string` | "#3072db" |
| `mode` | `"light" \| "dark"` | "light" |
| `speed` | `number` | 1 |

Long copy scrolls the field under its own caret and extra chips wrap, so the panel fits whatever you put in it. Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<PromptSend
  text="Add a text reveal, a soft blur transition, and a gradient background"
  chips="Add a text reveal, Try a blur transition, Pick a background"
/>
```

## Use when

- The *submit* is the beat — the pointer arriving at the send button is what the shot is for.
- You need the whole composer on screen: field, suggestions and button, not just a search box.
- The prompt is long. This is the one prompt scene that scrolls the field rather than shrinking the type.

## Don't use when

- The cut into the field is the gag and you want it over in 90 frames — use `prompt-zoom`.
- The reply matters more than the send — use `answer-stream` or `answer-highlight`.
- You only need a field whose state you drive yourself from a parent timeline — use `input`.
