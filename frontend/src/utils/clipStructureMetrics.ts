export type Segment = { start: number; end: number; phase: string };

export type ClipStructureMetrics = {
  durationS: number;
  transitionCount: number;
  segmentCount: number;
  transitionsPerMin: number;
  avgSegmentDurationS: number;
  executeCount: number;
  avgExecuteDurationS: number | null;
  phaseTotalsS: Record<string, number>;
  phasePercents: Record<string, number>;
  primaryPhase: string;
  secondaryPhase: string | null;
  primaryPercent: number;
  secondaryPercent: number | null;
  isBalancedTop2: boolean;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function getDerivedDuration(segments?: Segment[]) {
  if (!segments || segments.length === 0) return 0;
  const starts = segments.map((segment) => segment.start).filter(Number.isFinite);
  const ends = segments.map((segment) => segment.end).filter(Number.isFinite);
  if (starts.length === 0 || ends.length === 0) return 0;
  const minStart = Math.min(...starts);
  const maxEnd = Math.max(...ends);
  const derived = Math.max(0, maxEnd - minStart);
  return Number.isFinite(derived) ? derived : 0;
}

export function computeClipStructureMetrics({
  segments,
  durationS,
  transitionCount,
  primaryPhaseFallback,
}: {
  segments?: Segment[];
  durationS: number;
  transitionCount: number;
  primaryPhaseFallback: string;
}): ClipStructureMetrics {
  const derivedDuration = durationS > 0 ? durationS : getDerivedDuration(segments);
  const safeDuration = derivedDuration > 0 ? derivedDuration : 0;
  const segmentCount = segments?.length ?? 0;
  const transitionsPerMin =
    safeDuration > 0 ? (transitionCount / safeDuration) * 60 : 0;
  const avgSegmentDurationS =
    segmentCount > 0 && safeDuration > 0 ? safeDuration / segmentCount : 0;

  const phaseTotalsS: Record<string, number> = {};
  let executeCount = 0;
  const executeDurations: number[] = [];

  segments?.forEach((segment) => {
    const duration = Math.max(0, segment.end - segment.start);
    if (!Number.isFinite(duration)) return;
    phaseTotalsS[segment.phase] = (phaseTotalsS[segment.phase] ?? 0) + duration;
    if (segment.phase === "Execute") {
      executeCount += 1;
      executeDurations.push(duration);
    }
  });

  const avgExecuteDurationS =
    executeCount > 0
      ? executeDurations.reduce((acc, value) => acc + value, 0) /
        executeCount
      : null;

  const phasePercents: Record<string, number> = {};
  if (safeDuration > 0) {
    Object.entries(phaseTotalsS).forEach(([phase, total]) => {
      const percent = (total / safeDuration) * 100;
      phasePercents[phase] = clampPercent(percent);
    });
  }

  const sortedPhases = Object.entries(phasePercents).sort(
    ([, a], [, b]) => b - a
  );
  const primaryPhase =
    sortedPhases.length > 0 ? sortedPhases[0][0] : primaryPhaseFallback;
  const secondaryPhase =
    sortedPhases.length > 1 ? sortedPhases[1][0] : null;
  const primaryPercent = clampPercent(phasePercents[primaryPhase] ?? 0);
  const secondaryPercent = secondaryPhase
    ? clampPercent(phasePercents[secondaryPhase] ?? 0)
    : null;
  const isBalancedTop2 =
    secondaryPercent !== null &&
    Math.abs(primaryPercent - secondaryPercent) <= 10;

  return {
    durationS: safeDuration,
    transitionCount,
    segmentCount,
    transitionsPerMin,
    avgSegmentDurationS,
    executeCount,
    avgExecuteDurationS,
    phaseTotalsS,
    phasePercents,
    primaryPhase,
    secondaryPhase,
    primaryPercent,
    secondaryPercent,
    isBalancedTop2,
  };
}
