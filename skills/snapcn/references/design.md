# snapcn Design Defaults

These are defaults for content **you author** — your own text, scene chrome, cards, and overlays.
They keep output from reading as generic AI-slop. They are **not** retroactive rules for the
prebuilt snapcn components.

> **Scope & exception.** Never strip these traits from a component whose essence *is* the effect:
> `text-reveal` is letter-spacing; a solid theme background and the social cards are
> gradients; some primitives use subtle elevation. The rules govern your additions, not the library.

---

## No decorative letter-spacing

Don't widen tracking on text you add. It reads as "designed by AI".

```tsx
// ✅ default tracking
<div style={{ fontSize: 64, fontWeight: 600 }}>Ship faster</div>

// ❌ decorative wide tracking
<div style={{ letterSpacing: "0.3em", textTransform: "uppercase" }}>SHIP FASTER</div>
```

**Exception:** `text-reveal` animates letter-spacing as its whole effect — that's intentional.

## No uppercase / ALL-CAPS defaults

Prefer sentence case. Don't `text-transform: uppercase` and don't write ALL-CAPS string literals
as defaults.

```tsx
// ✅
<TextReveal text="Launch week" />

// ❌
<TextReveal text="LAUNCH WEEK" />
```

Use ALL-CAPS only when the design genuinely calls for it (e.g. a glitch/tech label), not as a
reflex for emphasis.

## No gradient text-fills or decorative washes

Gradients belong on **backgrounds** that are meant to be gradients — not as text fills or
decorative overlays sprinkled on cards.

```tsx
// ✅ gradient as an intentional background you own (no background component ships)
<AbsoluteFill style={{ background: "linear-gradient(120deg,#0ea5e9,#9333ea)" }} />
<div style={{ color: "#fafafa" }}>Clear, solid text on top</div>

// ❌ gradient-clipped text + decorative wash
<h1 style={{
  background: "linear-gradient(90deg,#0ea5e9,#9333ea)",
  WebkitBackgroundClip: "text",
  color: "transparent",
}}>Slop headline</h1>
```

**Exception:** `text-highlight` uses `background-clip: text` deliberately; social-card cover/avatar
fallbacks render gradients by design.

## No glow / heavy shadows

No colored glows, no large blur radii, no multi-layer drop-shadows. Use a 1px border or a small,
neutral elevation if you need separation.

```tsx
// ✅ subtle elevation
boxShadow: "0 1px 2px rgba(0,0,0,0.08)"
border: "1px solid #e5e5e5"

// ❌ glow / oversized shadow
boxShadow: "0 0 80px 20px rgba(14,165,233,0.6)"
filter: "blur(60px)"   // decorative glow blob
```

Threshold to avoid: shadow/`filter` blur `> ~24px`, any `spread`, any colored/glow shadow,
stacked shadow layers. See also: decorative radial-gradient/blur "glow blobs" are never acceptable.

**Exception:** components that intentionally model real UI elevation (cards, modals) keep their
designed shadow — don't flatten them.

---

## Design tokens

When you author your own text, surfaces, or chrome, pull from the palette the library already
uses so your additions don't clash with the components.

### Canvas

`1280×720 @ 30fps`. Font weights in use: `400 · 500 · 600 · 700`.

### Palette

| Role | Hex |
|---|---|
| Primary text (on light) | `#171717` |
| Text on dark | `#fafafa` / `#ffffff` |
| Background — near-black | `#0a0a0a` / `#050505` |
| Surface — zinc | `#27272a` |
| Accent — green / success | `#22c55e` |
| Accent — sky | `#0ea5e9` |
| Accent — violet | `#a855f7` / `#7c3aed` |
| Brand — warm (Claude) | `#D97757` |

Stay within this set for your own elements. Brand cards (`answer-stream`, `v0`) carry their
own brand hex — don't override it.

### Fonts (`@remotion/google-fonts`)

| Use | Font |
|---|---|
| UI / body | `Inter` |
| Display | `Manrope` |
| Serif display | `Fraunces` |
| Code / mono | `JetBrainsMono` / `GeistMono` |

Load fonts before render (`@remotion/google-fonts/Inter` → `loadFont()`), never mid-frame.
