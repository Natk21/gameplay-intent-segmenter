import { describe, expect, it } from "vitest";
import { getPhaseAtTime } from "./phaseLookup";

describe("getPhaseAtTime", () => {
  const segments = [
    { start: 0, end: 5, phase: "Explore" as const },
    { start: 5, end: 10, phase: "Execute" as const },
  ];

  it("returns the phase when time is inside a segment", () => {
    expect(getPhaseAtTime(segments, 2)).toBe("Explore");
  });

  it("treats boundary times as inside the segment", () => {
    expect(getPhaseAtTime(segments, 5)).toBe("Explore");
    expect(getPhaseAtTime(segments, 10)).toBe("Execute");
  });

  it("returns Unknown when no segment matches", () => {
    expect(getPhaseAtTime(segments, 12)).toBe("Unknown");
  });
});
