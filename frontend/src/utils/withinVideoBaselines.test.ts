import { describe, expect, it } from "vitest";
import {
  computeWithinVideoBaselines,
  getWithinVideoSummary,
  percentileRank,
  type WithinVideoBaseline,
} from "./withinVideoBaselines";

describe("percentileRank", () => {
  it("returns null for small populations", () => {
    expect(percentileRank(3, [1, 2, 3, 4])).toBeNull();
  });

  it("returns fraction of values less than or equal to value", () => {
    const population = [1, 2, 3, 4, 5];
    expect(percentileRank(3, population)).toBe(3 / 5);
    expect(percentileRank(5, population)).toBe(1);
  });
});

describe("getWithinVideoSummary", () => {
  it("returns typical when strongest percentile is below 60%", () => {
    const baseline: WithinVideoBaseline = {
      volatility_percentile: 0.5,
      transition_percentile: 0.4,
      duration_percentile: 0.2,
      sample_size: 6,
    };
    expect(getWithinVideoSummary(baseline)).toBe(
      "This moment is typical for this session."
    );
  });

  it("picks the strongest signal for the summary", () => {
    const baseline: WithinVideoBaseline = {
      volatility_percentile: 0.92,
      transition_percentile: 0.7,
      duration_percentile: 0.4,
      sample_size: 8,
    };
    expect(getWithinVideoSummary(baseline)).toContain("92%");
  });
});

describe("computeWithinVideoBaselines", () => {
  it("attaches baseline fields to moments", () => {
    const moments = Array.from({ length: 5 }, (_, index) => ({
      id: `m-${index}`,
      time: index,
      from_phase: "Explore",
      to_phase: "Execute",
      confidence: 0.8,
      change_type: "shift" as const,
      explanation: "test",
      start_time: index,
      end_time: index + 1,
      duration: index + 1,
      transition_count: index + 2,
      window_duration: 1,
      max_gap_between_transitions: 1,
      signal_intensity: index * 0.1,
      within_clip_percentile: 50,
      comparative_label: "normal" as const,
      confidence_level: "medium" as const,
      confidence_score: 0.6,
      confidence_reason: "test",
    }));
    const enriched = computeWithinVideoBaselines(moments);
    enriched.forEach((moment) => {
      expect(moment.within_video_baseline).toBeDefined();
      expect(moment.within_video_summary).toBeDefined();
      expect(moment.within_video_baseline.sample_size).toBe(5);
    });
  });
});
