import { describe, expect, it } from "vitest";
import { orbSwarmConfig } from "../config";
import {
  BEATS_PER_SECOND,
  END_BEAT,
  orbsAt,
  parseScript,
  rise,
  sample,
  typeAt,
} from "../index";

/**
 * The scene is tables read on a beat clock, so what can go wrong without looking
 * wrong in review is a table that is short a beat, a phase that hands over with
 * the wrong number of orbs, or a chain bead that wanders off to infinity between
 * two measured beats. These check the seams.
 */

describe("the clock", () => {
  it("fits the recording's beats into the composition", () => {
    const seconds = orbSwarmConfig.durationInFrames / orbSwarmConfig.fps;
    expect(seconds * BEATS_PER_SECOND).toBeGreaterThanOrEqual(END_BEAT);
  });

  it("samples a table through its knots and holds past the ends", () => {
    const t = [0, 1, 4, 9];
    expect(sample(t, -3)).toBe(0);
    expect(sample(t, 2)).toBe(4);
    expect(sample(t, 7)).toBe(9);
    const mid = sample(t, 1.5);
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(4);
  });
});

describe("the orbs", () => {
  const count = (beat: number) =>
    orbsAt(beat).filter((b) => b.scale > 0.01).length;

  it("burst in four, split to eight and sixteen", () => {
    expect(count(5)).toBe(0);
    expect(count(10)).toBe(4);
    expect(count(33.9)).toBe(4);
    expect(count(34)).toBe(8);
    expect(count(45)).toBe(16);
    expect(count(76.5)).toBe(16);
  });

  it("shrink away to nothing by the end", () => {
    expect(count(END_BEAT - 1)).toBe(0);
  });

  it("never leave the neighbourhood of the card between two beats", () => {
    for (let beat = 10; beat < END_BEAT; beat += 0.2) {
      for (const b of orbsAt(beat)) {
        if (b.scale <= 0.01) continue;
        expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
        expect(b.x).toBeGreaterThan(-400);
        expect(b.x).toBeLessThan(1100);
        expect(b.y).toBeGreaterThan(-400);
        expect(b.y).toBeLessThan(800);
        expect(b.scale).toBeLessThanOrEqual(1.1);
      }
    }
  });

  it("hands the swarm to the chain without a jump", () => {
    const before = orbsAt(75.999).map((b) => [b.x, b.y] as const);
    const after = orbsAt(76).map((b) => [b.x, b.y] as const);
    // Different order (the chain is drawn tail or head first), same places.
    for (const [x, y] of before) {
      const near = Math.min(...after.map(([u, v]) => Math.hypot(u - x, v - y)));
      expect(near).toBeLessThan(2);
    }
  });
});

describe("the script", () => {
  it("splits cards on | and words on whitespace", () => {
    expect(parseScript(" a b |c|  | d  e f ")).toEqual([
      ["a", "b"],
      ["c"],
      ["d", "e", "f"],
    ]);
  });

  it("weights an arriving card's letters to a mean of one", () => {
    for (const n of [1, 2, 6, 11]) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += rise(j, n);
      expect(sum / n).toBeCloseTo(1, 6);
    }
  });

  it("draws nothing until the type has been measured", () => {
    expect(typeAt(20, null, "#000").glyphs).toEqual([]);
  });

  it("shows the right words on each beat", () => {
    const words = parseScript(
      "all at once | what if | every one | of them | got an answer | in seconds",
    );
    // A fake measure: one unit per character is enough to lay a line out.
    const layouts = words.map((card) => {
      const text = card.join(" ");
      let word = 0;
      const letters: { ch: string; x: number; word: number }[] = [];
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") {
          word++;
          continue;
        }
        letters.push({ ch: text[i] as string, x: i, word });
      }
      return {
        letters,
        ends: card.map((_, n) => card.slice(0, n + 1).join(" ").length),
      };
    });
    const at = (beat: number) =>
      typeAt(beat, layouts, "#000")
        .glyphs.map((g) => g.ch)
        .join("");
    expect(at(0)).toBe("allatonce");
    expect(at(12)).toBe("whatif");
    expect(at(24)).toBe("every");
    expect(at(30)).toBe("everyone");
    expect(at(46)).toBe("got");
    expect(at(60)).toBe("gotananswer");
    expect(at(80)).toBe("");
    expect(at(110)).toBe("inseconds");
  });
});
