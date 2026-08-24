# terminal-simulator

**Tier:** `snapcn` · **Vibe:** tech · **Natural length:** 200f @ 30fps

Terminal window with chunked command playback, freeze-frame pauses, step scrolling, and an optional landing zoom, moving between camera stations for the intro, the command panel and the output.

## Install

```bash
shadcn add @snapcn/terminal-simulator
```

Lands at `components/snap-cn/terminal-simulator.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `terminal-simulator` is what to reach for instead:

`glass-code-block`

## Props

| Prop | Type | Default |
|---|---|---|
| `lines` | `TerminalLine[]` | DEFAULT_LINES (`command`/`log`/`success`/`error`) |
| `intro` | `string | null` | default headline (`*asterisks*` tint with the accent) |
| `command` | `CommandSpec | null` | DEFAULT_COMMAND |
| `background` | `string` | theme `card` |
| `borderColor` | `string` | theme `border` |
| `mode` | `"light" | "dark"` | "dark" |
| `fontSize` | `number` | 18 |
| `charsPerFrame` | `number` | 2 |
| `chunkSize` | `number` | 3 |
| `zoom` | `boolean | TerminalZoom` | false (`true` = 2.4x) |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TerminalSimulator command={{ text: "npx shadcn add @snapcn/text-reveal" }} lines={buildLines} zoom />
```

## Use when

- The product is a CLI, or the install command is the pitch.
- Output should appear in bursts the way a real terminal writes — the reveal is chunked, not char-by-char.
- You want the headline and the command as separate camera stations — pass `intro` and `command`, or `null` to skip either.

## Don't use when

- You need a syntax-highlighted source block rather than terminal output — that does not ship; build a small one.
- The scroll should ease; terminal scroll is a step function on purpose and easing it looks wrong.
- The surface is a GUI, not a shell — use `phone-frame` or `laptop-frame`.
