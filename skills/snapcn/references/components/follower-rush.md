# follower-rush

**Tier:** `snapcn` · **Vibe:** social · **Natural length:** 300f @ 30fps

An X-style follower notification that piles up — avatars stack in and the count explodes.

## Install

```bash
shadcn add @snapcn/follower-rush
```

Lands at `components/snap-cn/follower-rush.tsx`.

## Older names

These names came from the pre-consolidation registry and are **not installable**. `follower-rush` is what to reach for instead:

`github-stars` · `x-follow-card` · `x-followers-overview`

## Props

| Prop | Type | Default |
|---|---|---|
| `totalFollowers` | `number` | 5000 |
| `followers` | `Follower[]` | SAMPLE_FOLLOWERS |
| `accentColor` | `string` | theme `primary` |
| `orientation` | `"horizontal" | "vertical"` | "horizontal" |
| `theme` | `Partial<SnapCnTheme>` | — |
| `mode` | `"light" | "dark"` | — |
| `speed` | `number` | 1 |

Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<FollowerRush totalFollowers={12400} followers={people} orientation="vertical" />
```

## Use when

- Social proof is the beat — a launch that landed, a milestone, a waitlist filling.
- You need a vertical cut of the same scene — `orientation="vertical"`.
- The number is the payoff and the avatars are the texture.

## Don't use when

- The metric is not a follower count — nothing else in the registry animates numbers, so build a small one.
- You need star counts or a repo card — those do not ship.
- The budget is short; the pile-up needs its 300 frames to land the explosion.
