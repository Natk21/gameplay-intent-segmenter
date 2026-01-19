import {
  type ConsolidatedDecisionMoment,
  type ConfidenceLevel,
} from "./consolidateDecisionMoments";
import {
  buildFeatureContext,
  extractDecisionFeatures,
} from "./extractDecisionFeatures";
import type { PhaseName } from "./phaseLookup";
import {
  predictConfidence,
  trainConfidenceModel,
  type ConfidenceModel,
} from "./trainConfidenceModel";

type ConfidenceBreakdown = {
  duration: number;
  transition_rate: number;
  volatility: number;
  motion_intensity: number;
};

type LearnedConfidenceMoment = ConsolidatedDecisionMoment & {
  confidence_score_ml: number;
  heuristic_confidence_score: number;
  confidence_breakdown: ConfidenceBreakdown;
  confidence_source: "learned_phase_model" | "heuristic_fallback";
  confidence_model_used?: PhaseLabel;
  phase_context?: PhaseLabel;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function getClipDurationSeconds(
  times: number[],
  transitions: { time: number }[]
) {
  if (times.length >= 2) {
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const span = maxTime - minTime;
    if (Number.isFinite(span) && span > 0) return span;
  }
  if (transitions.length > 0) {
    const maxTime = Math.max(...transitions.map((item) => item.time));
    if (Number.isFinite(maxTime) && maxTime > 0) return maxTime;
  }
  return 0;
}

function deriveLevel(score: number): ConfidenceLevel {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function buildBreakdown(
  features: number[],
  model: ConfidenceModel
): ConfidenceBreakdown {
  return {
    duration: (features[0] ?? 0) * (model.weights[0] ?? 0),
    transition_rate: (features[1] ?? 0) * (model.weights[1] ?? 0),
    volatility: (features[2] ?? 0) * (model.weights[2] ?? 0),
    motion_intensity: (features[3] ?? 0) * (model.weights[3] ?? 0),
  };
}

type PhaseLabel = "explore" | "execute" | "hesitate" | "unknown";

type PhaseModelBundle = {
  models: Partial<Record<PhaseLabel, ConfidenceModel>>;
  sampleCounts: Record<PhaseLabel, number>;
  fallbackPhases: PhaseLabel[];
  confidenceStats: Record<
    PhaseLabel,
    { min: number; max: number; mean: number }
  >;
};

function normalizePhaseLabel(label: PhaseName | PhaseLabel | undefined) {
  if (!label) return "unknown";
  if (label === "Unknown") return "unknown";
  if (label === "Explore") return "explore";
  if (label === "Execute") return "execute";
  if (label === "Outcome") return "unknown";
  return label;
}

function buildPhaseReason(
  phase: PhaseLabel,
  baseReason: string
) {
  const phaseReason =
    phase === "explore"
      ? "Brief but intense exploratory instability."
      : phase === "execute"
      ? "Sustained disruption during an execution phase."
      : phase === "hesitate"
      ? "Repeated switching without resolution."
      : "Confidence estimated from overall context.";
  return baseReason ? `${phaseReason} ${baseReason}` : phaseReason;
}

function trainPhaseModels(
  rows: Array<{ phase: PhaseLabel; features: number[]; label: number }>,
  minSamplesPerPhase: number
): PhaseModelBundle {
  const sampleCounts: Record<PhaseLabel, number> = {
    explore: 0,
    execute: 0,
    hesitate: 0,
    unknown: 0,
  };
  const grouped: Record<
    PhaseLabel,
    Array<{ features: number[]; label: number }>
  > = {
    explore: [],
    execute: [],
    hesitate: [],
    unknown: [],
  };

  rows.forEach((row) => {
    sampleCounts[row.phase] += 1;
    if (row.phase !== "unknown") {
      grouped[row.phase].push({
        features: row.features,
        label: row.label,
      });
    }
  });

  const models: Partial<Record<PhaseLabel, ConfidenceModel>> = {};
  const fallbackPhases: PhaseLabel[] = [];
  (["explore", "execute", "hesitate"] as const).forEach(
    (phase) => {
      if (grouped[phase].length >= minSamplesPerPhase) {
        models[phase] = trainConfidenceModel(grouped[phase]);
      } else {
        fallbackPhases.push(phase);
      }
    }
  );

  const confidenceStats: PhaseModelBundle["confidenceStats"] = {
    explore: { min: 1, max: 0, mean: 0 },
    execute: { min: 1, max: 0, mean: 0 },
    hesitate: { min: 1, max: 0, mean: 0 },
    unknown: { min: 1, max: 0, mean: 0 },
  };

  return {
    models,
    sampleCounts,
    fallbackPhases,
    confidenceStats,
  };
}

function updateConfidenceStats(
  stats: PhaseModelBundle["confidenceStats"],
  phase: PhaseLabel,
  value: number
) {
  const bucket = stats[phase];
  bucket.min = Math.min(bucket.min, value);
  bucket.max = Math.max(bucket.max, value);
  bucket.mean += value;
}

export function applyLearnedConfidence<
  T extends { time: number; confidence?: number }
>(
  moments: Array<T & ConsolidatedDecisionMoment>,
  times: number[] = [],
  motion: number[] = [],
  phaseContexts: Array<PhaseName | PhaseLabel> = []
): {
  moments: Array<(T & LearnedConfidenceMoment) | LearnedConfidenceMoment>;
  diagnostics: {
    sampleCounts: PhaseModelBundle["sampleCounts"];
    fallbackPhases: PhaseModelBundle["fallbackPhases"];
    confidenceStats: PhaseModelBundle["confidenceStats"];
  } | null;
} {
  if (moments.length < 3) {
    return {
      moments: moments.map((moment, index) => ({
        ...moment,
        heuristic_confidence_score: moment.confidence_score ?? 0,
        confidence_score_ml: moment.confidence_score ?? 0,
        confidence_source: "heuristic_fallback",
        phase_context: normalizePhaseLabel(phaseContexts[index]),
        confidence_breakdown: {
          duration: 0,
          transition_rate: 0,
          volatility: 0,
          motion_intensity: 0,
        },
      })),
      diagnostics: null,
    };
  }

  const clipDurationSeconds = getClipDurationSeconds(times, moments);
  const context = buildFeatureContext(
    times,
    motion,
    clipDurationSeconds
  );

  const maxTransitionRate = moments.reduce((maxValue, moment) => {
    const rate =
      moment.duration > 0
        ? moment.transition_count / moment.duration
        : 0;
    return Math.max(maxValue, rate);
  }, 0);
  context.clipMaxTransitionRate = maxTransitionRate;

  const rows = moments.map((moment, index) => ({
    phase: normalizePhaseLabel(phaseContexts[index]),
    features: extractDecisionFeatures(moment, context),
    label: moment.confidence_score ?? 0,
  }));

  const phaseBundle = trainPhaseModels(rows, 5);

  const learnedMoments: Array<T & LearnedConfidenceMoment> = moments.map(
    (moment, index) => {
      const phase = normalizePhaseLabel(phaseContexts[index]);
      const features = extractDecisionFeatures(moment, context);
      const model = phaseBundle.models[phase];
      const usesLearned = Boolean(model);
      const score = model
        ? clamp(predictConfidence(features, model), 0.05, 0.95)
        : moment.confidence_score ?? 0;
      const confidence_source: LearnedConfidenceMoment["confidence_source"] =
        usesLearned ? "learned_phase_model" : "heuristic_fallback";
      updateConfidenceStats(phaseBundle.confidenceStats, phase, score);
      const confidence_breakdown = model
        ? buildBreakdown(features, model)
        : {
            duration: 0,
            transition_rate: 0,
            volatility: 0,
            motion_intensity: 0,
          };
      return {
        ...moment,
        phase_context: phase,
        confidence_model_used: usesLearned ? phase : undefined,
        confidence_score_ml: score,
        heuristic_confidence_score: moment.confidence_score ?? 0,
        confidence_score: score,
        confidence_level: deriveLevel(score),
        confidence_source,
        confidence_reason: buildPhaseReason(
          phase,
          moment.confidence_reason ?? ""
        ),
        confidence_breakdown,
      };
    }
  );

  (["explore", "execute", "hesitate", "unknown"] as const).forEach(
    (phase) => {
      const count = phaseBundle.sampleCounts[phase];
      if (count > 0) {
        phaseBundle.confidenceStats[phase].mean =
          phaseBundle.confidenceStats[phase].mean / count;
      } else {
        phaseBundle.confidenceStats[phase] = {
          min: 0,
          max: 0,
          mean: 0,
        };
      }
    }
  );

  return {
    moments: learnedMoments,
    diagnostics: {
      sampleCounts: phaseBundle.sampleCounts,
      fallbackPhases: phaseBundle.fallbackPhases,
      confidenceStats: phaseBundle.confidenceStats,
    },
  };
}
