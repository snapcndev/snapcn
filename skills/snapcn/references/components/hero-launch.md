# hero-launch

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 170f @ 30fps

Cinematic product-launch hero — two cards slide into formation as the headline reveals above them.

## Install

```bash
shadcn add @snapcn/hero-launch
```

Lands at `components/snap-cn/hero-launch.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `heading` | `string` | "npx shadcn add @snapcn" |
| `image1` | `string` | showcase clip (image URL, video URL, or a CSS `linear-gradient(...)`) |
| `image2` | `string` | showcase clip |
| `theme` | `Partial<SnapCnTheme>` | — |
| `mode` | `"light" | "dark"` | "dark" |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<HeroLaunch heading="Demo videos, in React" image1="/shots/a.mp4" image2="/shots/b.png" />
```

## Use when

- An opening shot needs two pieces of media plus a line, with no further choreography to manage.
- The media is mixed — each card takes an image, a video, or a gradient.
- You want a cinematic dark stage without configuring one; `mode` defaults to `"dark"`.

## Don't use when

- You have more than two pieces of media — use `orbit-gallery` or `moodboard-reveal`.
- The headline needs its own animation choices; this scene owns the reveal.
- The shot must be light — the composition is lit for dark.
