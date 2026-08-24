# phone-frame

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 240f @ 30fps

iPhone-style device frame with a dynamic island and a screen slot — flat, lightly 3D-tilted, or a cinematic crane move that sweeps up the screen and settles frontal.

## Install

```bash
shadcn add @snapcn/phone-frame
```

Lands at `components/snap-cn/phone-frame.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | ride-summary placeholder |
| `screenSrc` | `string` | — (image or video) |
| `variant` | `"flat" | "tilt" | "showcase"` | "flat" |
| `entrance` | `"rise" | "rotate-in" | "float"` | "rise" |
| `bezelColor` | `string` | theme `foreground` |
| `screenColor` | `string` | theme `card` |
| `radius` | `number` | real-device curvature |
| `screenRadius` | `number` | `radius - bezel` |
| `shadow` | `string` | — (empty string disables) |
| `scale` | `number` | 1 |
| `showDynamicIsland` | `boolean` | true |
| `floatLoop` | `boolean` | true |
| `floatAmplitude` | `number` | 6 |
| `tiltAngle` | `number` | -12 |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<PhoneFrame screenSrc="/demo/app.mp4" variant="showcase" />
```

## Use when

- A mobile product needs its UI on a real device rather than a bare screenshot.
- You want the screen recording to carry the shot — pass `screenSrc`; videos play through `<OffthreadVideo>`.
- The reveal itself should be cinematic — `variant="showcase"` is a full crane move.

## Don't use when

- The product is desktop or web — use `laptop-frame`.
- The screen content is a terminal — use `terminal-simulator`, which animates the output too.
- You need the device static as set dressing behind other motion; `floatLoop` and the entrance both animate by default.
