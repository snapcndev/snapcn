# tabs

**Tier:** `snap-cn-ui` (primitive) · **Vibe:** clean · **Natural length:** 120f @ 30fps

Tabs widget whose active-tab state is a pure function of the timeline; the sliding indicator, label colors, and panel crossfade are keyframed/derived presets.

## Install

```bash
shadcn add @snapcn/tabs
```

Lands at `components/snap-cn/tabs.tsx`. Pulls `@snapcn/snap-cn-ui` automatically.

## Props

| Prop | Type | Default |
|---|---|---|
| `state` | `TabsState` | `DEFAULT_ITEMS[0]` |
| `style` | `TabsStyle` | — |
| `items` | `string[]` | `DEFAULT_ITEMS` |
| `contents` | `string[]` | `DEFAULT_CONTENTS` |
| `contentHeight` | `number` | `72` |
| `variant` | `TabsVariant` | `"pill"` |
| `theme` | `Partial<SnapCnTheme>` | — |

## Example

```tsx
<Tabs items={["Overview", "Features", "Pricing"]} contents={["…", "…", "…"]} variant="pill" />
```

## Use when

- Showing a tabbed UI switching between content panels in a product demo.
- Demonstrating a pill or underline tab indicator sliding between sections.
- Showing a content crossfade between different sections of a layout.

## Don't use when

- Steps are sequential and ordered — use `stepper` instead (numbered connectors + check marks).
- You need a compact segmented control without content panels — use `toggle-group` instead (no panel area).
- You need a sidebar or vertical navigation structure — compose a nav layout directly instead.
