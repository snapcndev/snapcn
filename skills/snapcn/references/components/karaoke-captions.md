# karaoke-captions

**Tier:** `snapcn` · **Vibe:** social · **Natural length:** 150f @ 30fps

A caption line that fills word by word as it is spoken — heavy outlined type that reads on any footage, with the fill sweeping through the line rather than swapping pages.

## Install

```bash
shadcn add @snapcn/karaoke-captions
```

Lands at `components/snap-cn/karaoke-captions.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `captions` | `Caption[]` | — (word-level, ms) |
| `srt` | `string` | — |
| `lines` | `CaptionLine[]` | — |
| `text` | `string` | "Acme reconciles every transaction automatically" |
| `emphasize` | `string` | "automatically" |
| `preset` | `"boxed" | "karaoke" | "highlight" | "clean"` | "boxed" |
| `aspect` | `"landscape" | "portrait" | "square"` | "landscape" |
| `mode` | `"light" | "dark"` | "dark" |
| `accentColor` | `string` | "#FFE81F" |
| `emphasisScale` | `number` | 1.08 |
| `baseColor` | `string` | per theme |
| `fillColor` | `string` | per theme |
| `strokeRatio` | `number` | per preset |
| `pill` | `boolean` | — |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<KaraokeCaptions text="Every transaction, reconciled" emphasize="reconciled" preset="karaoke" />
```

## Use when

- The line should visibly fill as it is spoken — lyric-video or talking-head energy.
- One or two words in the line need to pop as they land — set `emphasize`.
- A short quote or claim is the whole shot and wants to read as spoken, not typeset.

## Don't use when

- You are burning a full transcript over a long clip — `word-captions` pages properly, this does not.
- The footage is busy and you need maximum legibility across many lines — `word-captions` presets are tuned for it.
- The caption is a static lower third; nothing here is static.
