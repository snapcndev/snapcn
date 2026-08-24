# snap-cn-ui

**Tier:** `snap-cn-ui`

The shared core lib for the UI-primitive tier: the timeline-fold hook, the `SnapCnTheme` context, and the OKLCH colour maths. Installed transitively — you rarely add it directly.

## Install

```bash
shadcn add @snapcn/snap-cn-ui
```

Lands at `components/snap-cn/snap-cn-ui.tsx`.

## Props

| Prop | Type | Default |
|---|---|---|
| `useSnapCnTheme(theme, mode)` | `hook` | resolves a `Partial<SnapCnTheme>` + mode to concrete tokens |
| `SnapCnTheme` | `type` | the token surface every component accepts |
| `mixOklch(a, b, t)` | `fn` | interpolate two colours — `var(--token)` does not survive a render |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
import { useSnapCnTheme, mixOklch } from "@/components/snap-cn/snap-cn-ui";
```

## Use when

- You are writing your own component and need the same tokens the registry uses.
- You need to animate a colour — interpolate with `mixOklch`, never a CSS variable.
- You want a component's state derived from the timeline the way the primitives do it.

## Don't use when

- You are only installing components — `shadcn` pulls this in for you.
- You want to hand-roll a palette; the whole point of this lib is that you do not.
- You expect runtime CSS custom properties to work in a render — they do not.
