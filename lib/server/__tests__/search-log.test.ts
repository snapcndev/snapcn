import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetSearchLog,
  flushSettled,
  IDLE_MS,
  recordSearch,
} from "@/lib/server/search-log";

const T0 = 1_800_000_000_000;
const type = (query: string, at: number, distinctId = "p1", results = 0) =>
  recordSearch({ distinctId, query, results, at }, at).map((s) => s.query);

beforeEach(__resetSearchLog);

describe("search-log", () => {
  it("collapses the burst that was actually logged", () => {
    // Verbatim from thirty days of production: four events for one search.
    let emitted: string[] = [];
    ["combo", "combob", "comboboc", "combobox"].forEach((q, i) => {
      emitted = emitted.concat(type(q, T0 + i * 180));
    });
    expect(emitted).toEqual([]); // nothing while they are still typing
    expect(flushSettled(T0 + 5_000).map((s) => s.query)).toEqual(["combobox"]);
  });

  it("keeps a correction, which is not a prefix", () => {
    // `comboboc` → `combobox` diverges at the last character. Longest-prefix
    // matching would have emitted both; last-write-wins emits one.
    type("comboboc", T0);
    type("combobox", T0 + 150);
    expect(flushSettled(T0 + 5_000).map((s) => s.query)).toEqual(["combobox"]);
  });

  it("does not merge two deliberate searches", () => {
    type("dropdown", T0);
    const settled = type("combobox", T0 + IDLE_MS + 1);
    expect(settled).toEqual(["dropdown"]); // the first went out on its own
    expect(flushSettled(T0 + 99_999).map((s) => s.query)).toEqual(["combobox"]);
  });

  it("never emits the search it was just handed", () => {
    expect(type("dropdown", T0)).toEqual([]);
  });

  it("keeps people apart", () => {
    type("dropdown", T0, "p1");
    type("waveform", T0 + 10, "p2");
    expect(
      flushSettled(T0 + 5_000)
        .map((s) => s.query)
        .sort(),
    ).toEqual(["dropdown", "waveform"]);
  });

  it("emits the time of the search, not of the flush", () => {
    // A query held overnight must still count against the day it was typed.
    type("confetti", T0);
    const [out] = flushSettled(T0 + 12 * 60 * 60_000);
    expect(out?.at).toBe(T0);
  });

  it("carries the result count through, so zero_results survives", () => {
    recordSearch(
      { distinctId: "p1", query: "ken burns", results: 0, at: T0 },
      T0,
    );
    const [out] = flushSettled(T0 + 5_000);
    expect(out).toMatchObject({ query: "ken burns", results: 0 });
  });
});
