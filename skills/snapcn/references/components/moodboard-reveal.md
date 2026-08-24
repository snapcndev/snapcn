# moodboard-reveal

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 150f @ 30fps

A kinetic headline with a swapping inline image, then a scattered gallery of photos flies through and lands on one hero image, crossfading dark to light across the shot.

## Install

```bash
shadcn add @snapcn/moodboard-reveal
```

Lands at `components/snap-cn/moodboard-reveal.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `leadIn` | `string` | "that lets you" |
| `emphasis` | `string` | "filter" |
| `tailIn` | `string` | "out AI." |
| `images` | `string[]` | DEFAULT_IMAGES |
| `heroImage` | `string` | `images[3]` |
| `darkColor` | `string` | dark theme `background` |
| `lightColor` | `string` | light theme `background` |
| `theme` | `Partial<SnapCnTheme>` | applied to both ends of the crossfade |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<MoodboardReveal leadIn="the fastest way to" emphasis="ship" tailIn="a demo." images={shots} heroImage={hero} />
```

## Use when

- One image has to be the payoff and the rest are context — `heroImage` is where the montage lands.
- The scene has to travel from dark to light (or open one act and close another).
- The headline should carry an inline image inside the sentence.

## Don't use when

- You need the scene to stay in one mode — it spans light and dark and takes no `mode` prop.
- The images should keep moving rather than settle — use `orbit-gallery`.
- The headline is long; the inline image slot assumes a short three-part line.
