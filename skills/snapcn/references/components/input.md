# input

**Tier:** `snap-cn-ui` · **Vibe:** clean · **Natural length:** 120f @ 30fps

A text input whose idle/hover/active/typing/invalid state is a pure function of the timeline — the shadcn `Input` surface, keyframed.

## Install

```bash
shadcn add @snapcn/input
```

Lands at `components/snap-cn/input.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `input` is what to reach for instead:

`field` · `combobox`

## Props

| Prop | Type | Default |
|---|---|---|
| `state` | `"idle" | "hover" | "active" | "typing" | "blur" | "invalid"` | "idle" |
| `style` | `InputStyle` | — |
| `placeholder` | `string` | "you@example.com" |
| `value` | `string` | "remotion@snapcn.dev" |
| `size` | `InputSize` | "default" |
| `theme` | `Partial<SnapCnTheme>` | — |
| `primary` | `string` | — |
| `fullWidth` | `boolean` | false |
| `className` | `string` | — |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<Input state="typing" value="acme@example.com" />
```

## Use when

- A form field is part of a larger scene and its state should be driven by the timeline, not by React state.
- You want the exact surface shadcn's `Input` paints so the two cannot drift.
- You are composing your own chat or search scene rather than using `prompt-zoom` / `search-typing`.

## Don't use when

- You want the whole typing scene choreographed — use `search-typing` or `prompt-zoom`.
- You reach for `speed`: primitives are state-based, not frame-multiplied. There is no `speed` prop.
- You need a select, dialog, drawer or command menu — only `input` and `caret` ship in this tier.
