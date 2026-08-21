# x-follow-card

**Tier:** `snapcn` (animation) · **Vibe:** social · **Natural length:** 165f @ 30fps

Animated X profile follow card — spring bounce-in, staggered blur-in, and a synthetic cursor that clicks Follow and flips it to Following. Light/dark, horizontal or vertical.

## Install

```bash
shadcn add @snapcn/x-follow-card
```

Lands at `components/snap-cn/x-follow-card.tsx`. Pulls `@snapcn/cursor` automatically. Renders offline — `avatarUrl=""` / `coverUrl=""` fall back to gradients, no network fetch.

## Props

| Prop | Type | Default |
|---|---|---|
| `name` | `string` | `"snapcn"` |
| `handle` | `string` | `"snapcn"` |
| `bio` | `string` | `"Cinematic video components for React"` |
| `avatarUrl` | `string` | `""` |
| `coverUrl` | `string` | `""` |
| `location` | `string` | `"Internet"` |
| `website` | `string` | `"snapcn.dev"` |
| `joined` | `string` | `"January 2024"` |
| `verified` | `boolean` | `true` |
| `accentColor` | `string` | `"#1d9bf0"` |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` |
| `speed` | `number` | `1` |

## Example

```tsx
<XFollowCard name="snapcn" handle="snapcn" bio="Cinematic video components for React" verified />
```

## Use when

- Showcasing a single X profile with the recognizable click-to-Follow payoff as the action beat.
- A social-proof or creator-intro scene needs one branded profile card with the cursor interaction.
- You want an offline-safe card (gradient avatar fallback) without wiring real image URLs.

## Don't use when

- You're aggregating follower growth or notifications rather than one profile — use `x-followers-overview`.
- The brand is GitHub, not X — use `github-stars`.
- You need a generic testimonial/quote card, not an X profile — compose a plain card.
