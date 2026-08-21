# x-followers-overview

**Tier:** `snapcn` (animation) · **Vibe:** data · **Natural length:** 360f @ 30fps

X follow notifications cycle through as 3D flipping text — '<name> followed you · 7h' — then the total follower count pops in with a confetti burst. Ships a hardcoded sample list (X API ready). Light/dark, horizontal or vertical.

## Install

```bash
shadcn add @snapcn/x-followers-overview
```

Lands at `components/snap-cn/x-followers-overview.tsx`. Pulls `@snapcn/confetti` automatically. Renders offline from the sample list — no network fetch.

## Props

| Prop | Type | Default |
|---|---|---|
| `notifications` | `FollowerNotification[]` | `SAMPLE_FOLLOWERS` |
| `totalFollowers` | `number` | `1709` |
| `handle` | `string` | `"snapcn"` |
| `avatarUrl` | `string` | `"/logo.svg"` |
| `accentColor` | `string` | `"#1d9bf0"` |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` |
| `speed` | `number` | `1` |

## Example

```tsx
<XFollowersOverview notifications={SAMPLE_FOLLOWERS} totalFollowers={1709} handle="snapcn" />
```

## Use when

- A milestone or social-proof scene needs cycling follow notifications building to a total reveal.
- You want the confetti-backed follower-count payoff at the end of a growth story.
- Depicting X audience growth with multiple recent followers, not a single profile.

## Don't use when

- You're highlighting one profile and a Follow click — use `x-follow-card`.
- The metric is GitHub stars — use `github-stars`.
- You only need a bare count-up with no notification feed or confetti — use `rolling-number` or `number-wheel`.
