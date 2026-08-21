# switch

**Tier:** `snap-cn-ui` (primitive) · **Vibe:** clean · **Natural length:** 120f @ 30fps

Switch whose checked/unchecked state is a pure function of the timeline; the track fill and sliding thumb are keyframed presets.

## Install

```bash
shadcn add @snapcn/switch
```

Lands at `components/snap-cn/switch.tsx`. Pulls `@snapcn/snap-cn-ui` automatically.

## Props

| Prop | Type | Default |
|---|---|---|
| `state` | `SwitchState` | `"unchecked"` |
| `style` | `SwitchStyle` | — |
| `label` | `string` | — |
| `size` | `SwitchSize` | `"default"` |
| `theme` | `Partial<SnapCnTheme>` | — |
| `primary` | `string` | — |

## Example

```tsx
<Switch state="unchecked" label="Enable notifications" />
```

## Use when

- Showing a toggle being flipped in a settings panel walkthrough.
- Demonstrating a binary on/off control with an animated thumb slide and track fill.
- Composing a settings scene alongside `select` and `slider` (used in `settings-toggle-flow`).

## Don't use when

- The choice is one of multiple mutually exclusive options — use `radio` or `select` instead.
- You need a compact segmented control — use `toggle-group` instead (continuous sliding indicator between segments).
- The state is a range value — use `slider` instead.
