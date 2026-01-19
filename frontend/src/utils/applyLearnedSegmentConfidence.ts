import { buildFeatureContext } from "./extractDecisionFeatures";
import {
  predictConfidence,
  trainConfidenceModel,
  type ConfidenceModel,
} from "./trainConfidenceModel";

type SegmentInput = {
  start: number;
  end: number;
  confidence?: number;
};

type TransitionInput = {
  time: number;
};

type SegmentMetrics = {
  duration: number;
  transitionCount: number;
  transitionRate: number;
  windowVolatility: number;
  windowMotionMean: number;
};

type SegmentSample = {
  features: number[];
  label: number;
};

type SegmentConfidenceResult<T> = T & {
  confidence: number;
  confidence_level: "low" | "medium" | "high";
  confidence_source: "learned_segment_model" | "heuristic_fallback";
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]) {
  if (!values.length) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function percentileRank(value: number, values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  for (const item of sorted) {
    if (item <= value) count += 1;
  }
  return count / sorted.length;
}

function resolveClipDurationSeconds<T extends SegmentInput>(
  segments: T[],
  times: number[],
  override?: number
) {
  if (Number.isFinite(override) && (override as number) > 0) {
    return override as number;
  }
  if (segments.length > 0) {
    const maxEnd = Math.max(...segments.map((segment) => segment.end));
    if (Number.isFinite(maxEnd) && maxEnd > 0) return maxEnd;
  }
  if (times.length >= 2) {
    const span = Math.max(...times) - Math.min(...times);
    if (Number.isFinite(span) && span > 0) return span;
  }
  return 0;
}

function getWindowValues(
  timeValues: number[],
  values: number[],
  start: number,
  end: number
) {
  const window: number[] = [];
  for (let index = 0; index < timeValues.length; index += 1) {
    const time = timeValues[index];
    if (!Number.isFinite(time) || time < start || time > end) continue;
    const value = values[index];
    if (Number.isFinite(value)) window.push(value);
  }
  return window;
}

function deriveLevel(score: number) {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function buildHeuristicLabel(features: number[]) {
  const [durationNorm, transitionRateNorm, volatilityNorm, intensityNorm] =
    features;
  const score =
    0.4 * durationNorm +
    0.3 * (1 - transitionRateNorm) +
    0.2 * (1 - volatilityNorm) +
    0.1 * intensityNorm;
  return clamp01(score);
}

function computeSegmentMetrics<T extends SegmentInput>(
  segment: T,
  transitions: TransitionInput[],
  context: ReturnType<typeof buildFeatureContext>
): SegmentMetrics {
  const duration = Math.max(0, segment.end - segment.start);
  const transitionCount = transitions.filter((transition) => {
    if (!Number.isFinite(transition.time)) return false;
    return transition.time >= segment.start && transition.time <= segment.end;
  }).length;
  const transitionRate = duration > 0 ? transitionCount / duration : 0;

  const uncertaintyWindow = getWindowValues(
    context.timeValues,
    context.uncertaintyValues,
    segment.start,
    segment.end
  );
  const windowVolatility = stdDev(uncertaintyWindow);

  const motionWindow = getWindowValues(
    context.timeValues,
    context.motionValues,
    segment.start,
    segment.end
  );
  const windowMotionMean = mean(motionWindow);

  return {
    duration,
    transitionCount,
    transitionRate,
    windowVolatility,
    windowMotionMean,
  };
}

function buildSegmentFeatures(
  metrics: SegmentMetrics,
  clipDurationSeconds: number,
  maxTransitionRate: number,
  context: ReturnType<typeof buildFeatureContext>
) {
  const durationNorm =
    clipDurationSeconds > 0 ? metrics.duration / clipDurationSeconds : 0;
  const transitionRateNorm =
    maxTransitionRate > 0 ? metrics.transitionRate / maxTransitionRate : 0;
  const volatilityNorm =
    context.clipUncertaintyStd > 0
      ? metrics.windowVolatility / context.clipUncertaintyStd
      : 0;
  const intensityNorm = percentileRank(
    metrics.windowMotionMean,
    context.motionValues
  );
  return [
    clamp01(durationNorm),
    clamp01(transitionRateNorm),
    clamp01(volatilityNorm),
    clamp01(intensityNorm),
  ];
}

function chooseLabels<T extends SegmentInput>(
  segments: T[],
  featuresList: number[][]
): SegmentSample[] {
  const labels = segments
    .map((segment) =>
      Number.isFinite(segment.confidence)
        ? clamp01(segment.confidence as number)
        : null
    )
    .filter((value): value is number => value !== null);
  let minLabel = 1;
  let maxLabel = 0;
  labels.forEach((label) => {
    minLabel = Math.min(minLabel, label);
    maxLabel = Math.max(maxLabel, label);
  });
  const useHeuristic =
    labels.length < 3 || maxLabel - minLabel < 0.05;

  return segments.map((segment, index) => {
    const features = featuresList[index] ?? [0, 0, 0, 0];
    const label =
      !useHeuristic && Number.isFinite(segment.confidence)
        ? clamp01(segment.confidence as number)
        : buildHeuristicLabel(features);
    return { features, label };
  });
}

function trainModel(samples: SegmentSample[]): ConfidenceModel {
  return trainConfidenceModel(samples);
}

export function applyLearnedSegmentConfidence<
  T extends SegmentInput
>(
  segments: T[],
  transitions: TransitionInput[] = [],
  times: number[] = [],
  motion: number[] = [],
  clipDurationSeconds?: number
): Array<SegmentConfidenceResult<T>> {
  if (segments.length === 0) return [];

  const resolvedClipDuration = resolveClipDurationSeconds(
    segments,
    times,
    clipDurationSeconds
  );
  const context = buildFeatureContext(
    times,
    motion,
    resolvedClipDuration
  );

  const metricsList = segments.map((segment) =>
    computeSegmentMetrics(segment, transitions, context)
  );
  const maxTransitionRate = Math.max(
    0,
    ...metricsList.map((metrics) => metrics.transitionRate)
  );

  const featuresList = metricsList.map((metrics) =>
    buildSegmentFeatures(
      metrics,
      resolvedClipDuration,
      maxTransitionRate,
      context
    )
  );

  const samples = chooseLabels(segments, featuresList);
  let model: ConfidenceModel | null = null;
  try {
    model = trainModel(samples);
  } catch (error) {
    model = null;
  }

  return segments.map((segment, index) => {
    const features = featuresList[index] ?? [0, 0, 0, 0];
    const score = model
      ? predictConfidence(features, model)
      : buildHeuristicLabel(features);
    return {
      ...segment,
      confidence: score,
      confidence_level: deriveLevel(score),
      confidence_source: model
        ? "learned_segment_model"
        : "heuristic_fallback",
    };
  });
}
