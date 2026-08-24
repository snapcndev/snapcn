# announce-title

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 170f @ 30fps

A four-shot launch title: the eyebrow rushes past the camera on a receding type plane, the product name assembles on paper, and the tagline is drained to white behind a mark.

## Install

```bash
shadcn add @snapcn/announce-title
```

Lands at `components/snap-cn/announce-title.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `eyebrow` | `string` | "Introducing" |
| `title` | `string` | "snapcn 1.0" |
| `tagline` | `string` | "Ready-made scenes for Remotion, in one command." |
| `voidColor` | `string` | "#100022" |
| `fieldColor` | `string` | "#5600f5" |
| `paperColor` | `string` | "#fcfcfa" |
| `titleColor` | `string` | "#4800c9" |
| `nightColor` | `string` | "#000028" |
| `glowColor` | `string` | "#08ff4b" |
| `glowStrength` | `number` | 0.139 |
| `taglineColor` | `string` | "#f2f8ff" |
| `symbolPath` | `string` | snapcn mark (SVG path in a `0 0 100 100` box) |
| `symbolColors` | `string[] | string` | ten measured stops |
| `symbolScale` | `number` | 1 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<AnnounceTitle eyebrow="Introducing" title="Acme 2.0" tagline="Billing that reconciles itself." />
```

## Use when

- A launch or version announcement needs a full title sequence, not a title card.
- You have a mark as an SVG path — pass `symbolPath`, or `""` for no mark.
- The brand has a strong colour and you want the whole sequence painted in it.

## Don't use when

- The budget is short — this is four shots in 170 frames and cutting it early lands mid-shot.
- You want the design-system palette; this scene ships concrete colours because it is a lit sequence, not a token surface.
- `glowStrength` above ~0.3 — the closing ground stops reading black.
