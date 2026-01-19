import { describe, expect, it, vi } from "vitest";
import {
  CONFIDENCE_PARAMS,
  computeDecisionConfidence,
  consolidateDecisionMoments,
  getConsolidationSummary,
  getPeakUncertaintyPercentile,
  logConsolidationSummary,
} from "./consolidateDecisionMoments";

type Transition = {
  id: string;
  time: number;
  from_phase: string;
  to_phase: string;
  confidence: number;
  change_type: "commitment" | "resolution" | "shift";
  explanation: string;
};

const base = {
  confidence: 0.8,
  change_type: "shift" as const,
  explanation: "test",
};

describe("consolidateDecisionMoments", () => {
  it("consolidates rapid alternating transitions with metadata", () => {
    const transitions: Transition[] = [
      {
        id: "a",
        time: 10,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "b",
        time: 12,
        from_phase: "Execute",
        to_phase: "Explore",
        ...base,
      },
      {
        id: "c",
        time: 14,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
    ];

    const times = [10, 12, 14];
    const motion = [0.2, 0.4, 0.8];
    const result = consolidateDecisionMoments(
      transitions,
      times,
      motion
    );
    expect(result).toHaveLength(1);
    const consolidated = result[0] as any;
    expect(consolidated.start_time).toBe(10);
    expect(consolidated.end_time).toBe(14);
    expect(consolidated.duration).toBe(4);
    expect(consolidated.window_duration).toBe(4);
    expect(consolidated.transition_count).toBe(3);
    expect(consolidated.max_gap_between_transitions).toBe(2);
    expect(consolidated.time).toBe(10);
    expect(consolidated.change_type).toBe("hesitation");
    expect(consolidated.to_phase).toBe("unstable");
    expect(consolidated.hesitation).toBe(true);
    expect(consolidated.confidence_level).toBeDefined();
  });

  it("does not consolidate when gaps exceed the allowed max", () => {
    const transitions: Transition[] = [
      {
        id: "a",
        time: 10,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "b",
        time: 15,
        from_phase: "Execute",
        to_phase: "Explore",
        ...base,
      },
    ];

    const result = consolidateDecisionMoments(transitions, [], []);
    expect(result).toHaveLength(2);
  });

  it("does not consolidate non-alternating phases", () => {
    const transitions: Transition[] = [
      {
        id: "a",
        time: 5,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "b",
        time: 7,
        from_phase: "Execute",
        to_phase: "Pursue",
        ...base,
      },
      {
        id: "c",
        time: 9,
        from_phase: "Pursue",
        to_phase: "Outcome",
        ...base,
      },
    ];

    const result = consolidateDecisionMoments(transitions, [], []);
    expect(result).toHaveLength(3);
  });

  it("stops consolidation when window exceeds max duration", () => {
    const transitions: Transition[] = [
      {
        id: "a",
        time: 0,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "b",
        time: 4,
        from_phase: "Execute",
        to_phase: "Explore",
        ...base,
      },
      {
        id: "c",
        time: 8,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "d",
        time: 12,
        from_phase: "Execute",
        to_phase: "Explore",
        ...base,
      },
      {
        id: "e",
        time: 16,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
    ];

    const result = consolidateDecisionMoments(transitions, [], []);
    expect(result).toHaveLength(2);
    expect((result[0] as any).start_time).toBe(0);
    expect((result[0] as any).end_time).toBe(12);
    expect((result[1] as any).time).toBe(16);
  });

  it("assigns confidence levels for every moment", () => {
    const transitions: Transition[] = [
      {
        id: "a",
        time: 1,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "b",
        time: 3,
        from_phase: "Execute",
        to_phase: "Explore",
        ...base,
      },
    ];
    const result = consolidateDecisionMoments(
      transitions,
      [1, 3],
      [0.1, 0.9]
    ) as any[];
    result.forEach((moment) => {
      expect(moment.confidence_level).toBeDefined();
    });
  });
});

describe("computeDecisionConfidence", () => {
  it("returns high when all criteria are met", () => {
    const confidence = computeDecisionConfidence({
      duration: CONFIDENCE_PARAMS.MIN_DURATION_SECONDS,
      transitionCount: CONFIDENCE_PARAMS.MIN_TRANSITIONS,
      intensityPercentile: CONFIDENCE_PARAMS.MIN_INTENSITY_PERCENTILE,
    });
    expect(confidence.confidence_level).toBe("high");
  });

  it("returns medium when exactly two criteria are met", () => {
    const confidence = computeDecisionConfidence({
      duration: CONFIDENCE_PARAMS.MIN_DURATION_SECONDS,
      transitionCount: CONFIDENCE_PARAMS.MIN_TRANSITIONS - 1,
      intensityPercentile: CONFIDENCE_PARAMS.MIN_INTENSITY_PERCENTILE,
    });
    expect(confidence.confidence_level).toBe("medium");
  });

  it("returns low when fewer than two criteria are met", () => {
    const confidence = computeDecisionConfidence({
      duration: CONFIDENCE_PARAMS.MIN_DURATION_SECONDS - 0.5,
      transitionCount: 1,
      intensityPercentile: 0.2,
    });
    expect(confidence.confidence_level).toBe("low");
  });
});

describe("getPeakUncertaintyPercentile", () => {
  it("returns higher percentiles for high-uncertainty windows", () => {
    const times = Array.from({ length: 15 }, (_, i) => i);
    const motion = [
      0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0,
    ];
    const peakPercentile = getPeakUncertaintyPercentile(
      7,
      7,
      times,
      motion
    );
    const lowPercentile = getPeakUncertaintyPercentile(
      0,
      0,
      times,
      motion
    );
    expect(peakPercentile).toBeGreaterThan(lowPercentile);
    expect(lowPercentile).toBeLessThan(0.5);
  });
});

describe("consolidation summary logging", () => {
  it("computes and logs summary stats", () => {
    const rawTransitions: Transition[] = [
      {
        id: "a",
        time: 0,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "b",
        time: 2,
        from_phase: "Execute",
        to_phase: "Explore",
        ...base,
      },
      {
        id: "c",
        time: 4,
        from_phase: "Explore",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "d",
        time: 20,
        from_phase: "Pursue",
        to_phase: "Execute",
        ...base,
      },
      {
        id: "e",
        time: 22,
        from_phase: "Execute",
        to_phase: "Pursue",
        ...base,
      },
    ];

    const consolidated = consolidateDecisionMoments(
      rawTransitions,
      [],
      []
    ) as any[];
    const summary = getConsolidationSummary(
      rawTransitions,
      consolidated
    );

    expect(summary.rawTransitions).toBe(5);
    expect(summary.consolidatedMoments).toBe(2);
    expect(summary.avgMergedTransitions).toBeCloseTo(2.5);
    expect(summary.avgWindowDuration).toBeCloseTo(3);
    expect(summary.maxWindowDuration).toBeCloseTo(4);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logConsolidationSummary(summary);
    expect(spy).toHaveBeenCalledWith(
      "Decision Consolidation Summary"
    );
    expect(spy).toHaveBeenCalledWith("- Raw transitions: 5");
    expect(spy).toHaveBeenCalledWith(
      "- Consolidated moments: 2"
    );
    expect(spy).toHaveBeenCalledWith(
      "- Avg merged transitions per moment: 2.5"
    );
    expect(spy).toHaveBeenCalledWith(
      "- Avg hesitation window: 3.0s"
    );
    expect(spy).toHaveBeenCalledWith(
      "- Max hesitation window: 4.0s"
    );
    spy.mockRestore();
  });
});
