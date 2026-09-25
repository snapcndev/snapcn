import { describe, expect, it } from "vitest";
import {
  ANGLE,
  CARD_H,
  CARD_TOP,
  CARD_W,
  DEPTH,
  FLICK,
  GAP,
  HORIZON,
  read,
  TILT,
  TRAVEL,
  toCards,
} from "../index";

/**
 * The plane and the flick are both arithmetic, and both are wrong in ways that
 * survive a code review: a tilt that leans the wrong way still renders, and a
 * curve that runs backwards for one entry still animates.
 *
 * The scale check is the one worth having. Under the projection this component
 * builds, the horizontal scale grows linearly with height, and the recording's
 * own gradient is 0.00078 per pixel. Reproducing that number from the three
 * plane constants is the whole claim the component makes about looking right.
 */
describe("card-rail", () => {
  it("reproduces the measured scale gradient from the plane's constants", () => {
    const rad = (TILT * Math.PI) / 180;
    // s(y) grows by tan(TILT)/DEPTH per pixel of screen height.
    expect(Math.tan(rad) / DEPTH).toBeCloseTo(0.00078, 5);
  });

  it("puts the card across the horizon, so the rail recedes and approaches", () => {
    expect(CARD_TOP).toBeLessThan(HORIZON);
    expect(CARD_TOP + CARD_H).toBeGreaterThan(HORIZON);
  });

  it("flicks forwards only, from rest, and arrives", () => {
    expect(read(FLICK, 0)).toBe(0);
    expect(read(FLICK, 5)).toBe(1);
    for (let i = 1; i < FLICK.length; i++) {
      const prev = FLICK[i - 1];
      const here = FLICK[i];
      if (!prev || !here) throw new Error("table hole");
      expect(here[0]).toBeGreaterThan(prev[0]);
      expect(here[1]).toBeGreaterThan(prev[1]);
    }
  });

  it("travels about a card, but is not snapped to one", () => {
    const pitch = CARD_W + GAP;
    expect(TRAVEL).toBeGreaterThan(pitch * 0.95);
    expect(TRAVEL).toBeLessThan(pitch * 1.1);
    expect(TRAVEL).not.toBe(pitch);
  });

  it("runs its backdrop across the frame rather than down it", () => {
    expect(ANGLE).toBeGreaterThan(90);
    expect(ANGLE).toBeLessThan(180);
  });

  it("reads one card per `|` entry, a URL alone being only a picture", () => {
    expect(
      toCards(
        "data:image/png;base64,iVB= > Inbox > 4 screens > @acme/inbox | https://x.dev/a.webp | ",
      ),
    ).toEqual([
      {
        image: "data:image/png;base64,iVB=",
        title: "Inbox",
        note: "4 screens",
        tag: "@acme/inbox",
      },
      { image: "https://x.dev/a.webp", title: "", note: "", tag: "" },
    ]);
  });
});
