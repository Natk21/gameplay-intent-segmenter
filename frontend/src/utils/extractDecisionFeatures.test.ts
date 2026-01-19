import { describe, expect, it } from "vitest";
import {
  buildFeatureContext,
  extractDecisionFeatures,
} from "./extractDecisionFeatures";
import type { ConsolidatedDecisionMoment } from "./consolidateDecisionMoments";

describe("extractDecisionFeatures", () => {
  it("returns 4 bounded feature values", () => {
    const moment: ConsolidatedDecisionMoment = {
      id: "m-1",
      time: 1,
      from_phase: "Explore",
      to_phase: "Execute",
      confidence: 0.8,
      change_type: "shift",
      explanation: "test",
      start_time: 1,
      end_time: 3,
      duration: 2,
      transition_count: 3,
      window_duration: 2,
      max_gap_between_transitions: 1,
      signal_intensity: 0.2,
      within_clip_percentile: 50,
      comparative_label: "normal",
      confidence_level: "medium",
      confidence_score: 0.66,
      confidence_reason: "test",
    };

    const times = [0, 1, 2, 3, 4];
    const motion = [0.1, 0.2, 0.9, 0.2, 0.1];
    const context = buildFeatureContext(times, motion, 4);
    context.clipMaxTransitionRate = 2;

    const features = extractDecisionFeatures(moment, context);
    expect(features).toHaveLength(4);
    features.forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });
});
