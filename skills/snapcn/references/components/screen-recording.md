# screen-recording

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 139f @ 30fps

Takes a raw screen capture and makes a shot of it: crops the browser and OS chrome off each edge as a fraction of the source, fits what is left to the frame, and runs a keyframed camera that pushes in on whatever matters at a given frame and holds there until the next move. A video and a still take the same track.

## Install

```bash
shadcn add @snapcn/screen-recording
```

Lands at `components/snap-cn/screen-recording.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `src` | `string` | — (required; video or image) |
| `crop` | `ScreenCrop` | `{}` — fractions per edge |
| `cropTop` / `cropRight` / `cropBottom` / `cropLeft` | `number` | — (flat overrides for `crop`) |
| `sourceAspect` | `number` | — (width ÷ height of the file) |
| `fit` | `"cover" \| "contain"` | "cover" |
| `backdropColor` | `string` | theme `background` |
| `camera` | `CameraMove[]` | `DEMO_CAMERA` (a push and a pull-back) |
| `radius` | `number` | 0 |
| `trimBefore` | `number` | 0 |
| `audio` | `boolean` | false |
| `entrance` | `"fade" \| "none"` | "fade" |
| `speed` | `number` | 1 |

`CameraMove` is `{ at, duration?, zoom?, x?, y? }`. A move eases to that pose over `duration` frames (default 25) and then **holds until the next move's `at`** — there is no hold field, the hold is the gap. `zoom` is absolute (`1` is the fitted shot); omitting `zoom`, `x` or `y` carries the previous value, which makes a pure pan one line. Focal points are clamped to what the current zoom can hold, so at `zoom: 1.2` an `x: 0.95` resolves to `0.583` rather than dragging the shot's own edge into frame. Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<ScreenRecording
  src="/recordings/checkout.mp4"
  crop={{ top: 0.11 }}
  camera={[
    { at: 34, duration: 25, zoom: 1.6, x: 0.36, y: 0.42 },
    { at: 96, duration: 25, zoom: 1 },
  ]}
/>
```

## Use when

- The user has an actual screen recording of their product and it needs to become a demo shot — this is the only component that treats one.
- The recording has browser or OS chrome in it. `crop` is fractions of an edge, never pixels, so the numbers survive a re-record at another resolution.
- One part of the UI has to win the eye. `camera` is how a screen shot points at something — push to the focal point and come back out. It rides the footage by construction, so it cannot drift off the thing it names. `camera={[]}` is a locked-off treated shot when nothing needs emphasis.
- You need the recording inside a device: drop it in `laptop-frame` or `phone-frame`'s `children`.

## Don't use when

- The capture is already cropped, clean and locked off — an `<OffthreadVideo>` of your own does that, and this adds nothing.
- The UI does not exist yet. Simulate it with `terminal-simulator`, `answer-stream` or `prompt-send` instead, and put `cursor-track` over it.
- You want a wrapper to follow the camera push: `cursor-track` is in **frame** coordinates and does not ride this component's camera. Keyframe the wrapper too, or give that beat `camera={[]}`.

## Note

`sourceAspect` is worth passing whenever the source's aspect differs from the composition's. Omit it and the source is aspect-filled to the composition first, so `crop` fractions are measured on the fitted shot rather than on the file. Identical when the two aspects already match, which is the usual case. There is no `chrome="browser"` preset by design — a fraction that guesses an unknown recording's chrome is wrong more often than right.

The layout is a fraction of whatever box the component is mounted in, so it fills a device frame's screen as correctly as it fills the composition. The one exception is `sourceAspect`, which is compared against the *composition's* aspect — inside a device frame, omit it.
