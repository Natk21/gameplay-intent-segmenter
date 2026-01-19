import { describe, expect, it } from "vitest";
import type { ClipStructureMetrics } from "../clipStructureMetrics";
import { generateInsightHeadline } from "../insightHeadlineRules";
import { getPhaseCopy } from "../phaseMeta";

const baseMetrics: ClipStructureMetrics = {
  durationS: 60,
  transitionCount: 6,
  segmentCount: 6,
  transitionsPerMin: 6,
  avgSegmentDurationS: 10,
  executeCount: 0,
  avgExecuteDurationS: null,
  phaseTotalsS: {},
  phasePercents: {},
  primaryPhase: "Explore",
  secondaryPhase: null,
  primaryPercent: 0,
  secondaryPercent: null,
  isBalancedTop2: false,
};

describe("generateInsightHeadline", () => {
  it("uses fast switching rule for high tempo + short execute bursts", () => {
    const headline = generateInsightHeadline({
      ...baseMetrics,
      transitionsPerMin: 10,
      avgExecuteDurationS: 3.2,
      primaryPhase: "Explore",
      secondaryPhase: "Execute",
    });
    expect(headline.title).toBe("Fast switching with short bursts");
    expect(headline.sentence).toContain("avg 3.2s");
  });

  it("uses long build-up rule for low tempo + long pursue share", () => {
    const headline = generateInsightHeadline({
      ...baseMetrics,
      transitionsPerMin: 3,
      phasePercents: { Pursue: 35 },
    });
    expect(headline.title).toBe("Long build-up, rare bursts");
    expect(headline.sentence).toContain("Pursue (35%)");
  });

  it("uses exploration-heavy rule when Explore is dominant", () => {
    const headline = generateInsightHeadline({
      ...baseMetrics,
      phasePercents: { Explore: 45 },
    });
    expect(headline.title).toBe("Exploration-heavy clip");
    expect(headline.sentence).toContain("45%");
  });

  it("uses balanced top-2 rule when close", () => {
    const headline = generateInsightHeadline({
      ...baseMetrics,
      phasePercents: { Explore: 30, Execute: 28 },
      primaryPhase: "Explore",
      secondaryPhase: "Execute",
      primaryPercent: 30,
      secondaryPercent: 28,
      isBalancedTop2: true,
    });
    expect(headline.title).toBe("Balanced intent structure");
    expect(headline.sentence).toContain("Explore (30%)");
  });

  it("falls back to phase copy when no rules match", () => {
    const headline = generateInsightHeadline({
      ...baseMetrics,
      transitionsPerMin: 0,
      primaryPhase: "Execute",
    });
    expect(headline).toEqual(getPhaseCopy("Execute"));
  });
});
