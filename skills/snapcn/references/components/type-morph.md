# type-morph

**Tier:** `snapcn` · **Vibe:** premium · **Natural length:** 94f @ 30fps

A headline that types itself under a glowing caret, sheds its lead, morphs letter by letter, and ends under a colour flood.

## Install

```bash
shadcn add @snapcn/type-morph
```

Lands at `components/snap-cn/type-morph.tsx`. Pulls in `@snapcn/text-reveal`.

## Props

| Prop | Type | Default |
|---|---|---|
| `lead` | `string` | "Not just " |
| `emphasis` | `string` | "communicator." |
| `morphTo` | `string` | "something more." |
| `finally_` | `string` | "more." |
| `accent` | `string` | theme `primary` |
| `background` | `string` | "#ffffff" |
| `ink` | `string` | "#000000" |
| `speed` | `number` | 1 |

Four strings, one sentence: `lead + emphasis` is typed, the lead is cut away, `emphasis` morphs into `morphTo`, and `finally_` is what the flood lands on. Unlike the rest of the text family this takes explicit `background` and `ink` rather than a `mode` switch. Full prop list and per-prop notes are in the source you install.

## Example

```tsx
<TypeMorph lead="Not just " emphasis="communicator." morphTo="something more." finally_="more." />
```

## Use when

- The line has to say two things in sequence and the *second* is the payoff — the morph is the argument.
- You want a typed opening without a full typing scene; the caret is a beat here, not the subject.
- A single word should end the shot alone under a colour wash.

## Don't use when

- The two strings share no letters — the per-letter morph reads as a scramble. Use `text-swap` with `transition="fade-through"`.
- The whole line should stay put and only one phrase changes colour — use `text-highlight`.
- You need light/dark to follow a theme; pass `background` and `ink` explicitly or use `text-rewrite`.
