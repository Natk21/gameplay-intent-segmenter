import type { ConsolidatedDecisionMoment } from "./consolidateDecisionMoments";

type FeatureContext = {
  clipDurationSeconds: number;
  clipMaxTransitionRate: number;
  clipUncertaintyStd: number;
  timeValues: number[];
  motionValues: number[];
  uncertaintyValues: number[];
};

const UNCERTAINTY_RADIUS = 6;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
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

export function buildFeatureContext(
  times: number[],
  motion: number[],
  clipDurationSeconds: number
): FeatureContext {
  const length = Math.min(times.length, motion.length);
  const timeValues = times.slice(0, length);
  const motionValues = motion.slice(0, length);
  const uncertaintyValues = motionValues.map((_, index) => {
    const start = Math.max(0, index - UNCERTAINTY_RADIUS);
    const end = Math.min(motionValues.length - 1, index + UNCERTAINTY_RADIUS);
    const window = motionValues.slice(start, end + 1);
    const avg = mean(window);
    const variance =
      window.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
      window.length;
    return variance;
  });
  return {
    clipDurationSeconds,
    clipMaxTransitionRate: 0,
    clipUncertaintyStd: stdDev(uncertaintyValues),
    timeValues,
    motionValues,
    uncertaintyValues,
  };
}

export function extractDecisionFeatures(
  decision: ConsolidatedDecisionMoment,
  context: FeatureContext
): number[] {
  const duration = Math.max(0, decision.duration);
  const durationNorm =
    context.clipDurationSeconds > 0
      ? duration / context.clipDurationSeconds
      : 0;

  const transitionRate =
    duration > 0 ? decision.transition_count / duration : 0;
  const transitionRateNorm =
    context.clipMaxTransitionRate > 0
      ? transitionRate / context.clipMaxTransitionRate
      : 0;

  const windowUncertainty = context.timeValues
    .map((time, index) => ({ time, value: context.uncertaintyValues[index] }))
    .filter(
      ({ time }) =>
        Number.isFinite(time) &&
        time >= decision.start_time &&
        time <= decision.end_time
    )
    .map(({ value }) => value ?? 0);
  const windowVolatility = stdDev(windowUncertainty);
  const volatilityNorm =
    context.clipUncertaintyStd > 0
      ? windowVolatility / context.clipUncertaintyStd
      : 0;

  const windowMotion = context.timeValues
    .map((time, index) => ({ time, value: context.motionValues[index] }))
    .filter(
      ({ time }) =>
        Number.isFinite(time) &&
        time >= decision.start_time &&
        time <= decision.end_time
    )
    .map(({ value }) => value ?? 0);
  const windowMotionMean = mean(windowMotion);
  const motionIntensityNorm = percentileRank(
    windowMotionMean,
    context.motionValues
  );

  return [
    clamp01(durationNorm),
    clamp01(transitionRateNorm),
    clamp01(volatilityNorm),
    clamp01(motionIntensityNorm),
  ];
}
