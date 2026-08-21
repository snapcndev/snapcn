# dropdown-menu-item

**Tier:** `snap-cn-ui` (primitive) · **Vibe:** clean · **Natural length:** 120f @ 30fps

A dropdown menu action row whose idle/hover/press state is a pure function of the timeline; the row background and label color are keyframed presets. Composed inside the `dropdown-menu` panel; also reused by `context-menu`.

## Install

```bash
shadcn add @snapcn/dropdown-menu-item
```

Lands at `components/snap-cn/dropdown-menu-item.tsx`. Pulls `@snapcn/snap-cn-ui` automatically.

## Props

| Prop | Type | Default |
|---|---|---|
| `style` | `DropdownMenuItemStyle` | — |
| `state` | `DropdownMenuItemState` | `"idle"` |
| `label` | `string` | `"Profile"` |
| `width` | `number` | `ROW_WIDTH` |
| `theme` | `Partial<SnapCnTheme>` | — |

## Example

```tsx
<DropdownMenuItemRow state="idle" label="Log out" />
```

## Use when

- Animating a single row's hover or press state independently from the full menu panel.
- Building a custom menu layout where `dropdown-menu` is too opinionated about trigger or panel shape.
- Reusing a styled action row in a custom composition (e.g., a visible list of actions without a trigger).

## Don't use when

- You want the full dropdown with a button trigger and panel — use `dropdown-menu` instead.
- The row needs an icon and a keyboard shortcut — use `command-menu-item` instead.
- The row is a standalone CTA, not a menu entry — use `button` instead.
