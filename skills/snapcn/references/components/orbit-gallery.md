# orbit-gallery

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 300f @ 30fps

An image-universe hero: a continuous stream of photos flows along an Archimedean spiral into the centre, behind a title, subtitle and pill CTA.

## Install

```bash
shadcn add @snapcn/orbit-gallery
```

Lands at `components/snap-cn/orbit-gallery.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `orbit-gallery` is what to reach for instead:

`infinite-marquee` · `perspective-marquee`

## Props

| Prop | Type | Default |
|---|---|---|
| `title` | `string` | "A whole new universe" |
| `subtitle` | `string` | "Article — The Design Process" |
| `buttonLabel` | `string` | "Explore" |
| `images` | `string[]` | editorial gradient tiles when `[]` |
| `turns` | `number` | 3 |
| `spacing` | `number` | 5 |
| `spread` | `number` | 7 |
| `sizeAttenuation` | `number` | 2 |
| `imageSize` | `number` | 172 |
| `cardAspect` | `number` | 0.78 |
| `fadeIn` | `number` | 20 |
| `fadeOut` | `number` | 0 |
| `cornerRadius` | `number` | 5 |
| `orbitSeconds` | `number` | 40 |
| `mode` | `"light" | "dark"` | "dark" |
| `footerLeft/Center/Right` | `string` | "" |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<OrbitGallery title="Every shot, in React" images={shots} turns={3} />
```

## Use when

- A long hero that has to hold — 300 frames of continuous motion with no beat to hit.
- You have many images and none of them individually matter.
- You need it to run with no network: pass `[]` and it renders self-contained gradient tiles.

## Don't use when

- A specific image has to land — the stream never stops on one. Use `moodboard-reveal`.
- The budget is short; below ~180 frames the spiral never completes a turnover.
- You want a light stage — the orbit is lit for dark.
