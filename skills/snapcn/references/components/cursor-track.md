# cursor-track

**Tier:** `snapcn` · **Vibe:** clean · **Natural length:** 132f @ 30fps

A wrapper. Renders `children` full-bleed and walks a synthetic cursor over them through normalized waypoints, pulsing a ring wherever you say there was a click. The arrow is a hand-drawn macOS-style pointer with an outline stroked outside the ink, so it reads over arbitrary footage without a drop shadow.

## Install

```bash
shadcn add @snapcn/cursor-track
```

Lands at `components/snap-cn/cursor-track.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | — (what the cursor moves over) |
| `path` | `CursorWaypoint[]` | `DEMO_PATH` — **a demo track, not `[]`** |
| `variant` | `"arrow" \| "dot"` | "arrow" |
| `size` | `number` | 3.9% of the composition height |
| `color` | `string` | theme `foreground` |
| `outlineColor` | `string` | theme `background` |
| `ringColor` | `string` | theme `primary` |
| `clickFrames` | `number` | 14 |
| `showBefore` | `boolean` | false |
| `speed` | `number` | 1 |

`CursorWaypoint` is `{ at, x, y, duration?, click? }`. `at` is the frame the cursor starts travelling **towards** the point (absolute, not relative to the previous waypoint); it then rests there until the next `at` — the hold is the gap. `click` pulses on **arrival**, at `at + duration`. Values outside 0–1 are legal and mean off-frame. Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<CursorTrack
  path={[
    { at: 0, x: -0.06, y: 0.86, duration: 6 },
    { at: 8, x: 0.34, y: 0.44, duration: 22, click: true },
    { at: 52, x: 0.68, y: 0.62, duration: 20, click: true },
    { at: 96, x: 0.82, y: 0.28, duration: 18 },
  ]}
>
  <ScreenRecording src="/recordings/checkout.mp4" camera={[]} />
</CursorTrack>
```

## Use when

- A UI simulation (`prompt-send`, `answer-stream`, `terminal-simulator`, a hand-built screen) needs a pointer doing the clicking.
- A real screen recording has no cursor in it — most capture tools drop it — and the clicks need to read.
- A mobile sim needs taps: `variant="dot"` is a touch puck.

## Don't use when

- The recording already has a cursor in it. Two pointers is worse than none, and this cannot remove the one in the file.
- The motion is meant to look like a person browsing — travel is a straight line on an ease-in-out, which reads deliberate for a demo and robotic for wandering.
- The shot needs emphasis rather than a pointer. A cursor says *someone clicked here*; it does not say *look here*. Push the camera instead — `screen-recording`'s `camera`.

## Note

`path` defaults to `DEMO_PATH`, not an empty array (`ControlType` has no array control). Pass `path={[]}` to use it as a no-op wrapper.

Waypoints are **frame** coordinates and do not ride an inner `screen-recording` camera — a push-in moves the UI under the cursor but not the cursor. Keyframe both, or push in on a shot the cursor is already resting in. `speed` does not propagate; pass the same value to every layer.

The first waypoint has nothing to travel from, so it *places* the cursor and its `duration` is the fade-up window instead. Give it an off-frame `x` to have the cursor walk in.

Canonical nesting for the screen set: `CursorTrack` > `ScreenRecording`. The cursor is the top layer; the recording is the only thing under it. A beat that carries a cursor wants `camera={[]}` on the recording, because the waypoints do not ride the push.
