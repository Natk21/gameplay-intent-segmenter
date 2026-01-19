import { describe, expect, it } from "vitest";
import { applyLearnedConfidence } from "./applyLearnedConfidence";
import { consolidateDecisionMoments } from "./consolidateDecisionMoments";

type Transition = {
  id: string;
  time: number;
  from_phase: string;
  to_phase: string;
  confidence: number;
  change_type: "commitment" | "resolution" | "shift" | "hesitation";
  explanation: string;
};

const base = {
  confidence: 0.8,
  change_type: "shift" as const,
  explanation: "test",
};

describe("applyLearnedConfidence", () => {
  it("falls back to heuristic when fewer than three moments exist", () => {
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
        time: 10,
        from_phase: "Execute",
        to_phase: "Explore",
        ...base,
      },
    ];
    const moments = consolidateDecisionMoments(transitions, [], []);
    const result = applyLearnedConfidence(moments, [], [], [
      "explore",
      "execute",
    ]);
    expect(result.moments).toHaveLength(2);
    result.moments.forEach((moment) => {
      expect(moment.confidence_score_ml).toBe(
        moment.confidence_score
      );
      expect(moment.heuristic_confidence_score).toBe(
        moment.confidence_score
      );
      expect(moment.confidence_source).toBe("heuristic_fallback");
    });
  });

  it("uses phase models when enough samples exist", () => {
    const transitions: Transition[] = Array.from({ length: 10 }, (_, i) => ({
      id: `t-${i}`,
      time: i * 2,
      from_phase: "Explore",
      to_phase: "Execute",
      ...base,
    }));
    const times = Array.from({ length: 25 }, (_, i) => i);
    const motion = times.map((value) =>
      value % 6 === 0 ? 1 : 0.1
    );
    const phaseContexts = [
      ...Array.from({ length: 5 }, () => "explore" as const),
      ...Array.from({ length: 5 }, () => "execute" as const),
    ];
    const moments = consolidateDecisionMoments(
      transitions,
      times,
      motion
    );
    const result = applyLearnedConfidence(
      moments,
      times,
      motion,
      phaseContexts
    );
    expect(result.moments).toHaveLength(10);
    result.moments.forEach((moment) => {
      expect(moment.confidence_score_ml).toBeDefined();
      expect(moment.heuristic_confidence_score).toBeDefined();
      expect(moment.confidence_breakdown).toBeDefined();
      expect(Number.isFinite(moment.confidence_score_ml)).toBe(true);
      expect(moment.confidence_source).toBe("learned_phase_model");
    });
  });

  it("falls back when phase samples are below the minimum", () => {
    const transitions: Transition[] = Array.from({ length: 6 }, (_, i) => ({
      id: `t-${i}`,
      time: i * 3,
      from_phase: "Explore",
      to_phase: "Execute",
      ...base,
    }));
    const times = Array.from({ length: 30 }, (_, i) => i);
    const motion = times.map((value) =>
      value % 4 === 0 ? 1 : 0.1
    );
    const phaseContexts = [
      ...Array.from({ length: 5 }, () => "explore" as const),
      "execute" as const,
    ];
    const moments = consolidateDecisionMoments(
      transitions,
      times,
      motion
    );
    const result = applyLearnedConfidence(
      moments,
      times,
      motion,
      phaseContexts
    );
    const executeMoment = result.moments[5];
    expect(executeMoment.confidence_source).toBe("heuristic_fallback");
  });
});
