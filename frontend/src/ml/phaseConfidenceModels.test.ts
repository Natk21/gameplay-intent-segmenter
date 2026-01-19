import { describe, expect, it } from "vitest";
import {
  predictWithPhaseModels,
  trainPhaseModels,
} from "./phaseConfidenceModels";

describe("trainPhaseModels", () => {
  it("falls back to Global when phase samples are below min", () => {
    const rows = [
      {
        phase_context: "Explore" as const,
        features: [0.1, 0.1, 0.1, 0.1],
        label: 0.2,
      },
      {
        phase_context: "Execute" as const,
        features: [0.9, 0.9, 0.9, 0.9],
        label: 0.9,
      },
    ];
    const phaseModels = trainPhaseModels({
      rows,
      minSamplesPerPhase: 3,
    });
    expect(phaseModels.models.Explore).toBeUndefined();
    expect(phaseModels.models.Global).toBeDefined();
    const prediction = predictWithPhaseModels({
      phaseModels,
      phase_context: "Explore",
      features: [0.2, 0.2, 0.2, 0.2],
    });
    expect(prediction.model_used).toBe("Global");
  });

  it("uses a phase model when enough samples exist", () => {
    const rows = Array.from({ length: 3 }, () => ({
      phase_context: "Explore" as const,
      features: [0.2, 0.2, 0.2, 0.2],
      label: 0.3,
    }));
    const phaseModels = trainPhaseModels({
      rows,
      minSamplesPerPhase: 2,
    });
    expect(phaseModels.models.Explore).toBeDefined();
    const prediction = predictWithPhaseModels({
      phaseModels,
      phase_context: "Explore",
      features: [0.2, 0.2, 0.2, 0.2],
    });
    expect(prediction.model_used).toBe("Explore");
  });
});
