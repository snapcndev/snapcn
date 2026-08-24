# logo-assemble

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 108f @ 30fps

A single ring of image cards revolves around a centred title, then spins inward and drains away to leave the logo lockup.

## Install

```bash
shadcn add @snapcn/logo-assemble
```

Lands at `components/snap-cn/logo-assemble.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `logo-assemble` is what to reach for instead:

`logo-enter`

## Props

| Prop | Type | Default |
|---|---|---|
| `logoSrc` | `string` | snapcn white mark |
| `brandName` | `string` | "snapcn" |
| `middleText` | `string` | "Cinematic components\nfor React" |
| `images` | `string[]` | DEFAULT_IMAGES |
| `count` | `number` | 10 |
| `background` | `string` | theme `background` |
| `mode` | `"light" | "dark"` | "dark" |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<LogoAssemble logoSrc="/logo/mark.svg" brandName="Acme" images={shots} count={10} />
```

## Use when

- A closing lockup needs the product's own screenshots to resolve into the brand mark.
- You have 6–12 images worth showing and no time to show them individually.
- The bumper should feel composed rather than fast — the ring revolves before it drains.

## Don't use when

- You have one or two images — the ring needs a population to read as one.
- You want a fast, punchy flicker instead of an orbit — use `logo-flicker`.
- The mark is dark; the default `mode` is `"dark"` because the shipped logo is white.
