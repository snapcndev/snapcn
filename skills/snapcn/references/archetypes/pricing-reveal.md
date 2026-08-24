# pricing-reveal

**Family:** I. Sales & Conversion · **Default duration:** ~12s (360f @30fps) · **Format:** 16:9 · **Vibe:** premium

A sales scene that walks viewers through pricing tiers, elevates the recommended plan, and closes on a CTA. The recommended tier is the single focal point — every other element frames it. Restrained by design: one accent color, one highlighted column, one ask.
Read `../anatomy.md` first; pick components from `../components/index.md`.

## Beats

A 5-beat specialization of the anatomy (Positioning → Features → CTA), compressed into a single unbroken scene followed by a CTA cut.

| Frames | Beat | What happens |
|---|---|---|
| 0–55f | **Lead** | "Simple pricing" headline resolves; a kicker line fades up beneath it |
| 55–150f | **ColumnsEnter** | Three tier cards rise from below with a left-to-right stagger |
| 150–250f | **RecommendFocus** | Recommended column lifts and scales up; flanking columns dim; feature checks draw in; "Popular" badge springs in |
| 250–320f | **PriceLand** | Recommended price rolls in with `$` prefix and lands; `/mo` gets a brief inline highlight |
| 320–360f | **CTA** | CTA headline builds word by word; button springs in and takes a single shimmer sweep |

Transitions: Lead→ColumnsEnter `text-swap` (spring, 16f); grid→CTA `@remotion/transitions` upward (linearTiming, 20f).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| Lead | `text-reveal` (title, blur 14→0 over 20f), `text-reveal` (kicker), `backdrop` (bg, dark fill) | — |
| ColumnsEnter | `text-reveal` (column group, 8f stagger, spring `damping:18`) | **`pricing-column`** — tier card atom |
| RecommendFocus | `text-reveal` (recommended lift + scale 1→1.05), `text-reveal` ("Popular" badge), `text-reveal` (features drawing in, 6f stagger) | orchestrated by **`plan-table`** |
| PriceLand | a number component you build (price with `$` prefix + suffix `/mo`), `text-highlight` (/mo emphasis) | — |
| CTA | `text-build` (CTA headline, word-by-word), `text-reveal` (button entrance, `damping:8`), `text-highlight` (single sweep on button) | — |

`pricing-column` and `plan-table` are not in the catalog — build both:

- **`pricing-column`** (build new) — atomic tier card: name, price slot (passed as a rendered node so a number component you build lives inside), period, feature list, `recommended` flag. When `recommended` is true, renders an accent border and exposes a lifted position for the parent orchestrator. Transparent background. Props: `{ name: string; price: number; period?: string; features: string[]; recommended?: boolean }`.
- **`plan-table`** (build new) — orchestrator: lays out a `pricing-column[]` row, sequences the ColumnsEnter → RecommendFocus → PriceLand phases by splitting total frames into thirds, synchronizes the background light position with the recommended column's x-offset. Props: `{ columns: PricingColumn[]; durationInFrames: number }`. Transparent; caller supplies the backdrop.

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `tiers[]` | yes | `{ name: string; price: number; period?: string; features: string[]; recommended?: boolean }` — exactly one tier should have `recommended: true` |
| `headline` | yes | Short, 2–4 words — "Simple pricing", "Plans that scale" |
| `kicker` | no | One line beneath the headline — "No hidden fees", "Cancel anytime" |
| `cta.headline` | yes | 3–5 words — "Start your free trial" |
| `cta.label` | yes | Button label — "Get started", "Start free trial" |
| `brand` | no | `{ accent }` → one accent color applied to the recommended column border, badge, and shimmer; everything else neutral |

Use real plan names and real feature copy. Never use "Plan A / Feature 1" filler. If the user's product has no pricing yet, use the sample data below unchanged — it is honest placeholder, not lorem.

Sample data:

```ts
columns: [
  { name: "Hobby", price: 0, period: "mo", features: ["3 projects", "720p export", "Community support"] },
  { name: "Pro", price: 19, period: "mo", features: ["Unlimited projects", "4K export", "Priority render", "Custom domain"], recommended: true },
  { name: "Team", price: 49, period: "mo", features: ["Everything in Pro", "5 seats", "SSO", "Audit log"] },
]
```

## Notes

- **One accent only.** Apply the accent color to: the recommended column border, the "Popular" badge, the shimmer sweep on the CTA button. Secondary tiers stay neutral — dimming opacity (1→0.55) is the only treatment they receive.
- **Light is motivated, not a glow.** The light shifts toward the recommended column during RecommendFocus to justify the visual emphasis. Do not add a radial gradient or blur halo behind the column.
- **a number component you build for prices.** It handles the `$` prefix and `/mo` suffix natively — pass `prefix="$"` and `suffix="/mo"` rather than formatting the string by hand. Use a number component you build only for pure large integers with no currency symbol.
- **Three tiers is the canonical count.** If the user has two or four, adjust the stagger timing accordingly; do not force a third empty column.
- **Background stays dark.** A solid `#09090b` / `backdrop` theme `dark`, or a slow, muted shader (a solid theme background) at low `speed` both work — keep the canvas dark so the recommended-column emphasis reads. If the background moves, keep it muted and gentle; avoid light, colorful, or fast fills.
- **CTA is calm, not celebratory.** `text-highlight` runs once — no loop, no bounce, no confetti. The energy peaks at PriceLand; the CTA is a composed close.
