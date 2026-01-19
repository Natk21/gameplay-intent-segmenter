import { computeWithinVideoBaselines } from "./withinVideoBaselines";

export const CONSOLIDATION_PARAMS = {
  // Gaps larger than this usually read as separate decisions in real clips.
  MAX_GAP_SECONDS: 4,
  // A stable stretch this long usually indicates a committed phase shift.
  MIN_STABLE_SECONDS: 6,
  // Longer oscillation windows stop feeling like a single hesitation episode.
  MAX_WINDOW_SECONDS: 15,
};

export const DEBUG_CONSOLIDATION = true;

export const CONFIDENCE_PARAMS = {
  // Windows at least this long tend to reflect sustained hesitation.
  MIN_DURATION_SECONDS: 4,
  // More switches than this usually indicate a stronger decision moment.
  MIN_TRANSITIONS: 3,
  // Uncertainty above this percentile reads as stronger evidence.
  MIN_INTENSITY_PERCENTILE: 0.75,
};

export type ConfidenceLevel = "low" | "medium" | "high";
export type ComparativeLabel = "normal" | "elevated" | "extreme";

type BaseTransition = {
  id: string;
  time: number;
  from_phase: string;
  to_phase: string;
  confidence: number;
  change_type: "commitment" | "resolution" | "shift" | "hesitation";
  explanation: string;
  hesitation?: boolean;
  confidence_level?: ConfidenceLevel;
  confidence_score?: number;
  confidence_reason?: string;
};

export type ConsolidatedDecisionMoment = BaseTransition & {
  start_time: number;
  end_time: number;
  duration: number;
  transition_count: number;
  window_duration: number;
  max_gap_between_transitions: number;
  signal_intensity: number;
  within_clip_percentile: number;
  comparative_label: ComparativeLabel;
};

type DecisionConfidenceInput = {
  duration: number;
  transitionCount: number;
  intensityPercentile: number;
};

type DecisionConfidence = {
  confidence_level: ConfidenceLevel;
  confidence_score: number;
  confidence_reason: string;
};

type ComparativeData = {
  signal_intensity: number;
  within_clip_percentile: number;
  comparative_label: ComparativeLabel;
};

function rollingVariance(values: number[], radius: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length - 1, index + radius);
    const window = values.slice(start, end + 1);
    const mean =
      window.reduce((sum, value) => sum + value, 0) / window.length;
    const variance =
      window.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      window.length;
    return variance;
  });
}

function getPercentileRank(value: number, values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  for (const item of sorted) {
    if (item <= value) count += 1;
  }
  return count / sorted.length;
}

function getUncertaintySeries(times: number[], motion: number[]) {
  if (!times.length || !motion.length) {
    return { timeValues: [], uncertainty: [] };
  }
  const length = Math.min(times.length, motion.length);
  const timeValues = times.slice(0, length);
  const motionValues = motion.slice(0, length);
  return {
    timeValues,
    uncertainty: rollingVariance(motionValues, 6),
  };
}

function getPeakUncertaintyStatsFromSeries(
  startTime: number,
  endTime: number,
  timeValues: number[],
  uncertainty: number[]
) {
  if (!timeValues.length || !uncertainty.length) {
    return { peak: 0, percentile: 0 };
  }
  let peak = 0;
  let hasSample = false;
  for (let index = 0; index < timeValues.length; index += 1) {
    const time = timeValues[index];
    if (time < startTime || time > endTime) continue;
    const value = uncertainty[index] ?? 0;
    if (!hasSample || value > peak) {
      peak = value;
      hasSample = true;
    }
  }
  if (!hasSample) return { peak: 0, percentile: 0 };
  return {
    peak,
    percentile: getPercentileRank(peak, uncertainty),
  };
}

export function getPeakUncertaintyStats(
  startTime: number,
  endTime: number,
  times: number[],
  motion: number[]
) {
  const series = getUncertaintySeries(times, motion);
  return getPeakUncertaintyStatsFromSeries(
    startTime,
    endTime,
    series.timeValues,
    series.uncertainty
  );
}

export function getPeakUncertaintyPercentile(
  startTime: number,
  endTime: number,
  times: number[],
  motion: number[]
) {
  return getPeakUncertaintyStats(startTime, endTime, times, motion).percentile;
}

function getComparativeLabel(percentile: number): ComparativeLabel {
  if (percentile >= 90) return "extreme";
  if (percentile >= 75) return "elevated";
  return "normal";
}

export function computeDecisionConfidence(
  input: DecisionConfidenceInput
): DecisionConfidence {
  const durationOk =
    input.duration >= CONFIDENCE_PARAMS.MIN_DURATION_SECONDS;
  const transitionsOk =
    input.transitionCount >= CONFIDENCE_PARAMS.MIN_TRANSITIONS;
  const intensityOk =
    input.intensityPercentile >=
    CONFIDENCE_PARAMS.MIN_INTENSITY_PERCENTILE;
  const metCount = [durationOk, transitionsOk, intensityOk].filter(
    Boolean
  ).length;

  let confidence_level: ConfidenceLevel = "low";
  if (metCount === 3) confidence_level = "high";
  else if (metCount === 2) confidence_level = "medium";

  let confidence_reason = "Brief fluctuation with limited supporting signal.";
  if (confidence_level === "high") {
    confidence_reason = `Sustained instability over ${input.duration.toFixed(
      1
    )}s with repeated phase switching.`;
  } else if (confidence_level === "medium") {
    if (durationOk && transitionsOk) {
      confidence_reason = `Sustained switching over ${input.duration.toFixed(
        1
      )}s with modest signal support.`;
    } else if (durationOk && intensityOk) {
      confidence_reason = `Sustained fluctuation over ${input.duration.toFixed(
        1
      )}s with a strong signal spike.`;
    } else {
      confidence_reason =
        "Repeated switching with strong signal spike over a short window.";
    }
  }

  return {
    confidence_score: metCount / 3,
    confidence_level,
    confidence_reason,
  };
}

function isAlternatingPair(
  previous: BaseTransition,
  current: BaseTransition,
  phaseA: string,
  phaseB: string
) {
  if (previous.to_phase !== current.from_phase) return false;
  if (previous.from_phase !== current.to_phase) return false;
  const fromValid =
    current.from_phase === phaseA || current.from_phase === phaseB;
  const toValid =
    current.to_phase === phaseA || current.to_phase === phaseB;
  return fromValid && toValid;
}

function canJoinGroup(
  group: BaseTransition[],
  candidate: BaseTransition
) {
  if (group.length === 0) return true;
  const previous = group[group.length - 1];
  const delta = candidate.time - previous.time;
  if (!Number.isFinite(delta) || delta < 0) return false;
  if (delta > CONSOLIDATION_PARAMS.MAX_GAP_SECONDS) return false;
  if (delta >= CONSOLIDATION_PARAMS.MIN_STABLE_SECONDS) return false;
  const windowDuration = candidate.time - group[0].time;
  if (windowDuration > CONSOLIDATION_PARAMS.MAX_WINDOW_SECONDS) return false;
  const phaseA = group[0].from_phase;
  const phaseB = group[0].to_phase;
  if (!phaseA || !phaseB || phaseA === phaseB) return false;
  return isAlternatingPair(previous, candidate, phaseA, phaseB);
}

function buildConsolidatedMoment(
  group: BaseTransition[]
): ConsolidatedDecisionMoment {
  const first = group[0];
  const last = group[group.length - 1];
  const confidence = Math.max(...group.map((item) => item.confidence));
  const gaps = group.slice(1).map((item, index) => {
    return item.time - group[index].time;
  });
  const maxGap =
    gaps.length > 0 ? Math.max(...gaps) : 0;
  const windowDuration = last.time - first.time;
  return {
    ...first,
    id: `hesitation-${first.id}-${last.id}`,
    time: first.time,
    start_time: first.time,
    end_time: last.time,
    duration: last.time - first.time,
    window_duration: windowDuration,
    max_gap_between_transitions: maxGap,
    from_phase: first.from_phase,
    to_phase: "unstable",
    change_type: "hesitation",
    hesitation: true,
    confidence,
    transition_count: group.length,
    explanation:
      "Repeated switching between phases over a short period suggests uncertainty.",
  };
}

export function consolidateDecisionMoments<
  T extends BaseTransition
>(
  transitions: T[],
  times: number[] = [],
  motion: number[] = []
): Array<
  (T & DecisionConfidence & ComparativeData) |
    (ConsolidatedDecisionMoment & DecisionConfidence)
> {
  if (!transitions.length) return [];
  const sorted = [...transitions].sort((a, b) => a.time - b.time);
  const result: Array<T | ConsolidatedDecisionMoment> = [];
  let group: BaseTransition[] = [];

  function flushGroup() {
    if (group.length >= 2) {
      result.push(buildConsolidatedMoment(group));
    } else if (group.length === 1) {
      result.push(group[0] as T);
    }
    group = [];
  }

  for (const transition of sorted) {
    if (group.length === 0) {
      group = [transition];
      continue;
    }

    if (canJoinGroup(group, transition)) {
      group = [...group, transition];
      continue;
    }

    flushGroup();
    group = [transition];
  }

  flushGroup();
  const withConfidence = result.map((moment) => {
    const startTime =
      (moment as ConsolidatedDecisionMoment).start_time ?? moment.time;
    const endTime =
      (moment as ConsolidatedDecisionMoment).end_time ?? moment.time;
    const duration =
      (moment as ConsolidatedDecisionMoment).duration ?? 0;
    const transitionCount =
      (moment as ConsolidatedDecisionMoment).transition_count ?? 1;
    const uncertaintyStats = getPeakUncertaintyStats(
      startTime,
      endTime,
      times,
      motion
    );
    const intensityPercentile = uncertaintyStats.percentile;
    const withinClipPercentile = Math.round(intensityPercentile * 100);
    const comparativeLabel = getComparativeLabel(withinClipPercentile);
    const confidence = computeDecisionConfidence({
      duration,
      transitionCount,
      intensityPercentile,
    });
    return {
      ...moment,
      start_time: startTime,
      end_time: endTime,
      duration,
      transition_count: transitionCount,
      ...confidence,
      signal_intensity: uncertaintyStats.peak,
      within_clip_percentile: withinClipPercentile,
      comparative_label: comparativeLabel,
    };
  });

  return computeWithinVideoBaselines(
    withConfidence as ConsolidatedDecisionMoment[],
    {
      onDiagnostics: (diagnostics) => {
        if (process.env.NODE_ENV === "production") return;
        console.debug("[WithinVideoBaseline]", diagnostics);
      },
    }
  ) as typeof withConfidence;
}

export type ConsolidationSummary = {
  rawTransitions: number;
  consolidatedMoments: number;
  avgMergedTransitions: number;
  avgWindowDuration: number;
  maxWindowDuration: number;
};

export function getConsolidationSummary(
  rawTransitions: BaseTransition[],
  consolidated: Array<BaseTransition | ConsolidatedDecisionMoment>
): ConsolidationSummary {
  const consolidatedMoments = consolidated.filter(
    (item) => (item as ConsolidatedDecisionMoment).transition_count
  ) as ConsolidatedDecisionMoment[];
  const rawCount = rawTransitions.length;
  const consolidatedCount = consolidatedMoments.length;
  const mergedCounts = consolidatedMoments.map(
    (item) => item.transition_count
  );
  const windowDurations = consolidatedMoments.map(
    (item) => item.window_duration
  );
  const avgMergedTransitions =
    consolidatedCount === 0
      ? 0
      : mergedCounts.reduce((sum, value) => sum + value, 0) /
        consolidatedCount;
  const avgWindowDuration =
    consolidatedCount === 0
      ? 0
      : windowDurations.reduce((sum, value) => sum + value, 0) /
        consolidatedCount;
  const maxWindowDuration =
    windowDurations.length === 0 ? 0 : Math.max(...windowDurations);

  return {
    rawTransitions: rawCount,
    consolidatedMoments: consolidatedCount,
    avgMergedTransitions,
    avgWindowDuration,
    maxWindowDuration,
  };
}

export function logConsolidationSummary(
  summary: ConsolidationSummary
) {
  console.log("Decision Consolidation Summary");
  console.log(`- Raw transitions: ${summary.rawTransitions}`);
  console.log(
    `- Consolidated moments: ${summary.consolidatedMoments}`
  );
  console.log(
    `- Avg merged transitions per moment: ${summary.avgMergedTransitions.toFixed(
      1
    )}`
  );
  console.log(
    `- Avg hesitation window: ${summary.avgWindowDuration.toFixed(1)}s`
  );
  console.log(
    `- Max hesitation window: ${summary.maxWindowDuration.toFixed(1)}s`
  );
}
