import { describe, expect, it } from "vitest";
import {
  ANCHOR,
  FADE,
  GROUP_GAP,
  layout,
  MSG_GAP,
  NAME_GAP,
  read,
  SCROLL,
  START_Y,
  toMessages,
} from "../index";

const SCRIPT = [
  { person: "abby", time: "1:01 PM", lines: ["one", "two"] },
  { person: "finn", time: "1:02 PM", lines: ["three", "four"] },
];

/**
 * The arithmetic is the component. Everything visible is `layout` plus a single
 * scroll, so a spacing that drifts or an anchor that scrolls the wrong message
 * is not a wobble — it is the whole scene in the wrong place, and it looks
 * deliberate enough in review to survive one.
 *
 * These are the recording's own numbers, checked end to end: four rows from
 * 158.90 land the newest baseline at 357.51, and the oldest at 20.87 once the
 * two arrivals have scrolled.
 */
describe("channel-thread", () => {
  const lines = layout(SCRIPT);

  it("stacks the transcript on the measured grid", () => {
    expect(lines.map((l) => l.y)).toEqual([
      START_Y,
      START_Y + MSG_GAP,
      START_Y + MSG_GAP + GROUP_GAP + NAME_GAP,
      START_Y + MSG_GAP + GROUP_GAP + NAME_GAP + MSG_GAP,
    ]);
    expect(lines[2]?.y).toBeCloseTo(311.5, 2);
    expect(lines[3]?.y).toBeCloseTo(357.51, 2);
  });

  it("heads a group with its name and never repeats it", () => {
    expect(lines.map((l) => l.head)).toEqual([true, false, true, false]);
    expect(lines[0]?.nameY).toBeCloseTo(START_Y - NAME_GAP, 5);
  });

  it("scrolls only for the messages that reach the anchor", () => {
    // The second message is the one the recording leaves motionless.
    const want = lines.map((l) => Math.max(0, l.y - ANCHOR));
    expect(want[0]).toBe(0);
    expect(want[1]).toBe(0);
    expect(want[2]).toBeCloseTo(92.02, 2);
    expect(want[3]).toBeCloseTo(138.03, 2);
    // …and the oldest line ends up where the recording's last frame has it.
    expect(START_Y - (want[3] ?? 0)).toBeCloseTo(20.87, 2);
  });

  it("rolls the scroll forwards only, and arrives", () => {
    expect(read(SCROLL, 0)).toBe(0);
    expect(read(SCROLL, 5)).toBe(1);
    for (let i = 1; i < SCROLL.length; i++) {
      const prev = SCROLL[i - 1];
      const here = SCROLL[i];
      if (!prev || !here) throw new Error("table hole");
      expect(here[0]).toBeGreaterThan(prev[0]);
      expect(here[1]).toBeGreaterThan(prev[1]);
    }
  });

  it("fades toward the top of the frame and stops at full ink", () => {
    expect(read(FADE, 0)).toBeLessThan(0.11);
    expect(read(FADE, 300)).toBe(1);
    for (let i = 1; i < FADE.length; i++) {
      const prev = FADE[i - 1];
      const here = FADE[i];
      if (!prev || !here) throw new Error("table hole");
      expect(here[1]).toBeGreaterThan(prev[1]);
    }
  });

  it("reads the string form, a bare line continuing the speaker above", () => {
    expect(toMessages("/a.jpg > rhea 9:41 AM > Hi | There | sam > Yo")).toEqual(
      [
        { author: "rhea", time: "9:41 AM", avatar: "/a.jpg", text: "Hi" },
        { author: "rhea", time: "9:41 AM", avatar: "/a.jpg", text: "There" },
        { author: "sam", time: "", avatar: "", text: "Yo" },
      ],
    );
  });
});
