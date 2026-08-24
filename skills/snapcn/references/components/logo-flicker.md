# logo-flicker

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 100f @ 30fps

Images flip across a central card very fast, the flicker decelerates and fades, and the logo resolves out of it.

## Install

```bash
shadcn add @snapcn/logo-flicker
```

Lands at `components/snap-cn/logo-flicker.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `logo-flicker` is what to reach for instead:

`logo-enter`

## Props

| Prop | Type | Default |
|---|---|---|
| `logoSrc` | `string` | snapcn white mark |
| `brandName` | `string` | "snapcn" |
| `images` | `string[]` | DEFAULT_IMAGES |
| `flipInterval` | `number` | measured |
| `background` | `string` | theme `background` |
| `mode` | `"light" | "dark"` | "dark" |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<LogoFlicker logoSrc="/logo/mark.svg" brandName="Acme" images={shots} />
```

## Use when

- A short, high-energy bumper — 100 frames from first flip to resolved mark.
- You want the images to read as a blur of range rather than as individual shots.
- The scene opens or closes a fast-cut edit and an orbit would drag.

## Don't use when

- The images deserve to be seen — the flip interval is short by design. Use `logo-assemble` or `moodboard-reveal`.
- You need the brand name and a tagline to hold; only `brandName` sits under the mark.
- The mark is dark on a light stage — pass `mode="light"` with a dark asset.
