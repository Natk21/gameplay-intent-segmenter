import { describe, expect, it } from "vitest";
import { getSeekTime, SEEK_EPSILON } from "./seek";

describe("getSeekTime", () => {
  it("returns null for non-finite start time", () => {
    expect(getSeekTime(Number.NaN, 10, 10)).toBeNull();
    expect(
      getSeekTime(Number.POSITIVE_INFINITY, 10, 10)
    ).toBeNull();
  });

  it("clamps to [0, duration - epsilon] when duration is valid", () => {
    expect(getSeekTime(-5, 10, 10)).toBe(0);
    expect(getSeekTime(3.5, 10, 10)).toBe(3.5);
    expect(getSeekTime(12, 10, 10)).toBeCloseTo(
      10 - SEEK_EPSILON
    );
  });

  it("uses start time when duration is missing or invalid", () => {
    expect(getSeekTime(4.2, undefined, 10)).toBe(4.2);
    expect(getSeekTime(4.2, null, 10)).toBe(4.2);
    expect(getSeekTime(4.2, Number.NaN, 10)).toBe(4.2);
  });

  it("ignores segment max end when provided", () => {
    expect(getSeekTime(50, 100, 101)).toBe(50);
  });
});
