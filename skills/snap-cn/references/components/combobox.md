# combobox

**Tier:** `snap-cn-ui` (primitive) · **Vibe:** clean · **Natural length:** 120f @ 30fps

A combobox whose opened/closed state is a pure function of the timeline; the panel fade/scale/lift are keyframed presets. The trigger reuses Input presets (typed query + caret reveal), the list is filtered by a pure case-insensitive substring on the visible query prefix, and rows reuse the SelectItem row.

## Install

```bash
shadcn add @snapcn/combobox
```

Lands at `components/snap-cn/combobox.tsx`. Pulls `@snapcn/snap-cn-ui`, `@snapcn/input`, `@snapcn/select-item` automatically.

## Props

| Prop | Type | Default |
|---|---|---|
| `state` | `ComboboxState` | `"closed"` |
| `style` | `ComboboxStyle` | — |
| `query` | `string` | `""` |
| `revealCount` | `number` | — |
| `placeholder` | `string` | `"Select a fruit…"` |
| `items` | `string[]` | `["Apple", "Banana", "Orange", "Grape"]` |
| `selectedIndex` | `number` | `-1` |
| `highlightedIndex` | `number` | `-1` |
| `pressedIndex` | `number` | `-1` |
| `itemStyles` | `(SelectItemStyle \| undefined)[]` | — |
| `inputStyle` | `InputStyle` | — |
| `theme` | `Partial<SnapCnTheme>` | — |

## Example

```tsx
<Combobox state="closed" query="App" items={["Apple", "Banana", "Orange"]} selectedIndex={0} />
```

## Use when

- Showing a searchable/filterable dropdown with a typed query narrowing the list on the timeline.
- Demoing autocomplete or type-ahead selection UX in a product walkthrough.
- A form field needs a constrained set of options but with search, not free-form text.

## Don't use when

- The list is not filterable and selection is direct — use `select` (non-filterable dropdown) instead.
- The overlay is a command palette with icons and keyboard shortcuts — use `command-menu` instead.
- The input is free-form text entry with no list — use `input` instead.
