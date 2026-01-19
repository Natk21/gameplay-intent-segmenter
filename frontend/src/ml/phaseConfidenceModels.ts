import {
  predictConfidence,
  trainConfidenceModel,
  type ConfidenceModel,
} from "../utils/trainConfidenceModel";

export type PhaseModelKey = "Explore" | "Execute" | "Outcome" | "Global";

type PhaseContext = "Explore" | "Execute" | "Outcome" | "Unknown";

export type TrainedPhaseModels = {
  models: Partial<Record<PhaseModelKey, ConfidenceModel>>;
  diagnostics: {
    sampleCounts: Record<PhaseModelKey, number>;
    usedFallbackFor: PhaseModelKey[];
  };
};

const PHASE_KEYS: PhaseModelKey[] = ["Explore", "Execute", "Outcome"];

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function trainPhaseModels(args: {
  rows: Array<{
    phase_context: PhaseContext;
    features: number[];
    label: number;
  }>;
  minSamplesPerPhase?: number;
}): TrainedPhaseModels {
  const minSamplesPerPhase = args.minSamplesPerPhase ?? 25;
  const sampleCounts: Record<PhaseModelKey, number> = {
    Explore: 0,
    Execute: 0,
    Outcome: 0,
    Global: 0,
  };
  const perPhaseRows: Record<PhaseModelKey, typeof args.rows> = {
    Explore: [],
    Execute: [],
    Outcome: [],
    Global: [],
  };

  for (const row of args.rows) {
    if (row.phase_context !== "Unknown") {
      perPhaseRows.Global.push(row);
      sampleCounts.Global += 1;
    }
    if (row.phase_context === "Explore") {
      perPhaseRows.Explore.push(row);
      sampleCounts.Explore += 1;
    }
    if (row.phase_context === "Execute") {
      perPhaseRows.Execute.push(row);
      sampleCounts.Execute += 1;
    }
    if (row.phase_context === "Outcome") {
      perPhaseRows.Outcome.push(row);
      sampleCounts.Outcome += 1;
    }
  }

  const models: Partial<Record<PhaseModelKey, ConfidenceModel>> = {};
  const usedFallbackFor: PhaseModelKey[] = [];

  if (perPhaseRows.Global.length > 0) {
    models.Global = trainConfidenceModel(
      perPhaseRows.Global.map((row) => ({
        features: row.features,
        label: row.label,
      }))
    );
  }

  PHASE_KEYS.forEach((phaseKey) => {
    const rows = perPhaseRows[phaseKey];
    if (rows.length >= minSamplesPerPhase) {
      models[phaseKey] = trainConfidenceModel(
        rows.map((row) => ({
          features: row.features,
          label: row.label,
        }))
      );
    } else {
      usedFallbackFor.push(phaseKey);
    }
  });

  return {
    models,
    diagnostics: {
      sampleCounts,
      usedFallbackFor,
    },
  };
}

export function predictWithPhaseModels(args: {
  phaseModels: TrainedPhaseModels;
  phase_context: PhaseContext;
  features: number[];
}): {
  confidence_score: number;
  model_used: PhaseModelKey;
} {
  const { phaseModels, phase_context, features } = args;
  const modelKey: PhaseModelKey =
    phase_context === "Explore" && phaseModels.models.Explore
      ? "Explore"
      : phase_context === "Execute" && phaseModels.models.Execute
      ? "Execute"
      : phase_context === "Outcome" && phaseModels.models.Outcome
      ? "Outcome"
      : "Global";
  const model =
    phaseModels.models[modelKey] ?? phaseModels.models.Global;
  if (!model) {
    return { confidence_score: 0, model_used: "Global" };
  }
  const prediction = predictConfidence(features, model);
  return {
    confidence_score: clamp01(prediction),
    model_used: modelKey,
  };
}
