import { describe, expect, it, beforeEach } from "vitest";
import {
  addClipToGlobalStats,
  getGlobalBaselineStats,
  getPercentile,
} from "./globalBaselineStats";

function resetStorage() {
  window.localStorage.clear();
}

describe("globalBaselineStats", () => {
  beforeEach(() => {
    resetStorage();
  });

  it("returns null percentile when distribution is too small", () => {
    expect(getPercentile(3, [1, 2, 3, 4], 5)).toBeNull();
  });

  it("computes percentile for a distribution", () => {
    const percentile = getPercentile(3, [1, 2, 3, 4, 5], 5);
    expect(percentile).toBe(3 / 5);
  });

  it("persists stats in localStorage", () => {
    addClipToGlobalStats({
      clipVolatilityScore: 0.4,
      hesitationMoments: [
        { duration: 2, transition_count: 3, intensity: 0.6 },
      ],
    });
    const stats = getGlobalBaselineStats();
    expect(stats.clipCount).toBe(1);
    expect(stats.clipVolatilityScore).toEqual([0.4]);
    expect(stats.hesitationTransitionCount).toEqual([3]);
  });
});
