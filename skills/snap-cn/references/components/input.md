# input

**Tier:** `snap-cn-ui` (primitive) · **Vibe:** clean · **Natural length:** 120f @ 30fps

A text input whose idle/hover/active/typing/invalid state is a pure function of the timeline; the focus ring, border, caret, and value reveal are keyframed presets.

## Install

```bash
shadcn add @snapcn/input
```

Lands at `components/snap-cn/input.tsx`. Pulls `@snapcn/snap-cn-ui`, `@snapcn/caret` automatically.

## Props

| Prop | Type | Default |
|---|---|---|
| `state` | `InputState` | `"idle"` |
| `style` | `InputStyle` | — |
| `placeholder` | `string` | `"you@example.com"` |
| `value` | `string` | `"remotion@snapcn.dev"` |
| `size` | `InputSize` | `"default"` |
| `theme` | `Partial<SnapCnTheme>` | — |
| `primary` | `string` | — |
| `fullWidth` | `boolean` | `false` |

## Example

```tsx
<Input state="idle" placeholder="you@example.com" value="jane@acme.com" fullWidth />
```

## Use when

- Showing a text field being focused, typed into, or validated at a specific frame.
- Composing inside `field` for a labeled email/name/card input in a form scene.
- Demonstrating the invalid state (red border, shake) to highlight an error condition.

## Don't use when

- The trigger needs to open a searchable list — use `combobox` instead (which wraps input internally).
- You only need a blinking cursor with no field chrome — use `caret` instead.
- The control is a button-style CTA, not a text entry — use `button` instead.
