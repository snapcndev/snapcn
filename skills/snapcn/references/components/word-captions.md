# word-captions

**Tier:** `snapcn` · **Vibe:** social · **Natural length:** 96f @ 30fps

Burned-in captions in the styles big channels actually use — heavy Montserrat, a real outline, and six presets that cover most of what social video does.

## Install

```bash
shadcn add @snapcn/word-captions
```

Lands at `components/snap-cn/word-captions.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `captions` | `Caption[]` | — (word-level, ms — Whisper/CapCut shape) |
| `srt` | `string` | — (paste an .srt) |
| `words` | `CaptionWord[] | string` | "Stop losing hours to manual invoices" |
| `preset` | `"boxed" | "youtube" | "beast" | "hormozi" | "pop" | "clean"` | "boxed" |
| `activeStyle` | `"pop" | "highlight" | "color"` | "pop" |
| `aspect` | `"16:9" | "1:1" | "9:16"` | "16:9" |
| `maxWords` | `number` | per preset |
| `maxChars` | `number` | per preset |
| `pageBreakMs` | `number` | 420 |
| `strokeRatio` | `number` | per preset |
| `strokeColor` | `string` | "#000000" |
| `uppercase` | `boolean` | per preset |
| `accentColor` | `string` | "#FFE81F" |
| `framesPerWord` | `number` | 14 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<WordCaptions captions={whisperWords} preset="beast" aspect="9:16" />
```

## Use when

- You have word-level timings from Whisper, CapCut or `@remotion/captions` and want them burned in.
- The video ships to social and must read with the sound off.
- A vertical cut needs the caption block inside the safe area — set `aspect`.

## Don't use when

- The line should fill word-by-word as it is spoken in a karaoke sweep — use `karaoke-captions`.
- You need one styled sentence as a design element, not a transcript — use `text-reveal`.
- You have no timings at all and the pacing matters; `framesPerWord` is even, not spoken.
