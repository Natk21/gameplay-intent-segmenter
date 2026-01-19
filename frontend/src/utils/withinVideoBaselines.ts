import type { ConsolidatedDecisionMoment } from "./consolidateDecisionMoments";

export type WithinVideoBaseline = {
  volatility_percentile: number | null;
  transition_percentile: number | null;
  duration_percentile: number | null;
  sample_size: number;
};

export function percentileRank(
  value: number,
  population: number[]
): number | null {
  if (population.length < 5) return null;
  const sorted = [...population].sort((a, b) => a - b);
  let count = 0;
  for (const item of sorted) {
    if (item <= value) count += 1;
  }
  return count / sorted.length;
}

function formatPercentile(value: number) {
  return Math.round(value * 100);
}

export function getWithinVideoSummary(
  baseline: WithinVideoBaseline
): string | null {
  const entries: Array<{ key: string; value: number | null }> = [
    { key: "volatility", value: baseline.volatility_percentile },
    { key: "transition", value: baseline.transition_percentile },
    { key: "duration", value: baseline.duration_percentile },
  ];
  const sorted = entries
    .filter((entry) => entry.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  if (!sorted.length) return null;
  const strongest = sorted[0];
  if ((strongest.value ?? 0) < 0.6) {
    return "This moment is typical for this session.";
  }
  const percent = formatPercentile(strongest.value ?? 0);
  if (strongest.key === "duration") {
    return `One of the longest decision windows in this clip (top ${100 - percent}%).`;
  }
  if (strongest.key === "transition") {
    return `More oscillatory than ${percent}% of moments in this session.`;
  }
  return `More unstable than ${percent}% of moments in this session.`;
}

type BaselineDiagnostics = {
  momentCount: number;
  volatilityRange: { min: number; max: number };
  durationRange: { min: number; max: number };
};

export function computeWithinVideoBaselines<
  T extends ConsolidatedDecisionMoment
>(decisionMoments: T[], options?: {
  onDiagnostics?: (diagnostics: BaselineDiagnostics) => void;
}): Array<T & {
  within_video_baseline: WithinVideoBaseline;
  within_video_summary: string | null;
}> {
  const volatilityValues = decisionMoments.map(
    (moment) => moment.signal_intensity ?? 0
  );
  const transitionValues = decisionMoments.map(
    (moment) => moment.transition_count ?? 0
  );
  const durationValues = decisionMoments.map(
    (moment) => moment.duration ?? 0
  );
  const sampleSize = decisionMoments.length;

  if (options?.onDiagnostics) {
    const volatilityRange = volatilityValues.length
      ? {
          min: Math.min(...volatilityValues),
          max: Math.max(...volatilityValues),
        }
      : { min: 0, max: 0 };
    const durationRange = durationValues.length
      ? {
          min: Math.min(...durationValues),
          max: Math.max(...durationValues),
        }
      : { min: 0, max: 0 };
    options.onDiagnostics({
      momentCount: sampleSize,
      volatilityRange,
      durationRange,
    });
  }

  return decisionMoments.map((moment) => {
    const volatilityPercentile = percentileRank(
      moment.signal_intensity ?? 0,
      volatilityValues
    );
    const transitionPercentile = percentileRank(
      moment.transition_count ?? 0,
      transitionValues
    );
    const durationPercentile = percentileRank(
      moment.duration ?? 0,
      durationValues
    );
    const baseline: WithinVideoBaseline = {
      volatility_percentile: volatilityPercentile,
      transition_percentile: transitionPercentile,
      duration_percentile: durationPercentile,
      sample_size: sampleSize,
    };
    return {
      ...moment,
      within_video_baseline: baseline,
      within_video_summary: getWithinVideoSummary(baseline),
    };
  });
}
