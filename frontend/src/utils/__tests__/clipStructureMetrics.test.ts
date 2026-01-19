import { describe, expect, it } from "vitest";
import { computeClipStructureMetrics } from "../clipStructureMetrics";

describe("computeClipStructureMetrics", () => {
  it("computes transitions per minute for 60s duration", () => {
    const metrics = computeClipStructureMetrics({
      durationS: 60,
      transitionCount: 8,
      segments: [],
      primaryPhaseFallback: "Explore",
    });
    expect(metrics.transitionsPerMin).toBe(8);
  });

  it("computes avg segment duration", () => {
    const metrics = computeClipStructureMetrics({
      durationS: 100,
      transitionCount: 4,
      segments: [
        { start: 0, end: 25, phase: "Explore" },
        { start: 25, end: 50, phase: "Execute" },
        { start: 50, end: 75, phase: "Outcome" },
        { start: 75, end: 100, phase: "Explore" },
      ],
      primaryPhaseFallback: "Explore",
    });
    expect(metrics.avgSegmentDurationS).toBe(25);
  });

  it("computes execute count and avg execute duration", () => {
    const metrics = computeClipStructureMetrics({
      durationS: 20,
      transitionCount: 3,
      segments: [
        { start: 0, end: 5, phase: "Execute" },
        { start: 5, end: 12, phase: "Explore" },
        { start: 12, end: 15, phase: "Execute" },
      ],
      primaryPhaseFallback: "Explore",
    });
    expect(metrics.executeCount).toBe(2);
    expect(metrics.avgExecuteDurationS).toBe(4);
  });

  it("derives primary and secondary phase from percents", () => {
    const metrics = computeClipStructureMetrics({
      durationS: 70,
      transitionCount: 6,
      segments: [
        { start: 0, end: 40, phase: "Explore" },
        { start: 40, end: 60, phase: "Execute" },
        { start: 60, end: 70, phase: "Outcome" },
      ],
      primaryPhaseFallback: "Explore",
    });
    expect(metrics.primaryPhase).toBe("Explore");
    expect(metrics.secondaryPhase).toBe("Execute");
    expect(metrics.primaryPercent).toBeCloseTo(57.14, 1);
  });

  it("handles missing segments gracefully", () => {
    const metrics = computeClipStructureMetrics({
      durationS: 0,
      transitionCount: 0,
      segments: undefined,
      primaryPhaseFallback: "Execute",
    });
    expect(metrics.durationS).toBe(0);
    expect(metrics.avgExecuteDurationS).toBeNull();
    expect(metrics.primaryPhase).toBe("Execute");
    expect(metrics.secondaryPhase).toBeNull();
  });
});
