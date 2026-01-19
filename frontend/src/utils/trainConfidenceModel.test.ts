import { describe, expect, it } from "vitest";
import {
  predictConfidence,
  trainConfidenceModel,
} from "./trainConfidenceModel";

describe("trainConfidenceModel", () => {
  it("trains finite weights and bias", () => {
    const model = trainConfidenceModel([
      { features: [0.1, 0.2, 0.3, 0.4], label: 0.2 },
      { features: [0.9, 0.8, 0.7, 0.6], label: 0.9 },
    ]);
    expect(model.weights).toHaveLength(4);
    model.weights.forEach((weight) => {
      expect(Number.isFinite(weight)).toBe(true);
    });
    expect(Number.isFinite(model.bias)).toBe(true);
  });

  it("predicts higher confidence for stronger features", () => {
    const model = trainConfidenceModel([
      { features: [0.1, 0.1, 0.1, 0.1], label: 0.1 },
      { features: [0.9, 0.9, 0.9, 0.9], label: 0.9 },
    ]);
    const low = predictConfidence([0.1, 0.1, 0.1, 0.1], model);
    const high = predictConfidence([1, 1, 1, 1], model);
    expect(high).toBeGreaterThan(low);
  });
});
