# laptop-frame

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 240f @ 30fps

MacBook-style laptop that opens, runs a dynamic-island notch notification, then dives the camera into the screen until the content fills the frame.

## Install

```bash
shadcn add @snapcn/laptop-frame
```

Lands at `components/snap-cn/laptop-frame.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | hero placeholder |
| `screenSrc` | `string` | — (image or video) |
| `entrance` | `"rise" | "open" | "none"` | "rise" |
| `finale` | `"none" | "zoom-to-screen"` | "none" |
| `bezelColor` | `string` | dark neutral |
| `screenColor` | `string` | theme `card` |
| `indicatorColor` | `string` | "#30D158" |
| `restTilt` | `number` | measured |
| `radius` | `number` | measured |
| `shadow` | `string` | — (empty string disables) |
| `scale` | `number` | 0.95 |
| `showNotch` | `boolean` | true |
| `notchLabel` | `string` | "AirPods Connected" |
| `batteryLevel` | `number` | 85 |
| `floatLoop` | `boolean` | true |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<LaptopFrame screenSrc="/demo/dashboard.mp4" entrance="open" finale="zoom-to-screen" />
```

## Use when

- A web or desktop product needs a device to sit in before the shot goes inside it.
- You want a screen takeover — `finale="zoom-to-screen"` un-tilts and fills the frame.
- The lid opening is the reveal — `entrance="open"` lifts it off the deck.

## Don't use when

- `finale="zoom-to-screen"` is used inside a smaller container — the cover scale is derived from `useVideoConfig()` and assumes the frame is the whole composition.
- The product is mobile — use `phone-frame`.
- You only need a static mock; every default here animates.
