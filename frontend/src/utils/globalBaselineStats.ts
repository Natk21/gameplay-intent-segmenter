export type GlobalBaselineStats = {
  clipCount: number;
  hesitationDuration: number[];
  hesitationTransitionCount: number[];
  hesitationIntensity: number[];
  clipVolatilityScore: number[];
};

export type ClipSummary = {
  clipVolatilityScore: number;
  hesitationMoments: Array<{
    duration: number;
    transition_count: number;
    intensity: number;
  }>;
};

const STORAGE_KEY = "intent_segmenter_global_stats_v1";

const DEFAULT_STATS: GlobalBaselineStats = {
  clipCount: 0,
  hesitationDuration: [],
  hesitationTransitionCount: [],
  hesitationIntensity: [],
  clipVolatilityScore: [],
};

function loadStats(): GlobalBaselineStats {
  if (typeof window === "undefined") return { ...DEFAULT_STATS };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_STATS };
  try {
    const parsed = JSON.parse(raw) as GlobalBaselineStats;
    return {
      clipCount: parsed.clipCount ?? 0,
      hesitationDuration: parsed.hesitationDuration ?? [],
      hesitationTransitionCount: parsed.hesitationTransitionCount ?? [],
      hesitationIntensity: parsed.hesitationIntensity ?? [],
      clipVolatilityScore: parsed.clipVolatilityScore ?? [],
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function saveStats(stats: GlobalBaselineStats) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function getPercentile(
  value: number,
  distribution: number[],
  minClips = 5
): number | null {
  if (distribution.length < minClips) return null;
  const sorted = [...distribution].sort((a, b) => a - b);
  let count = 0;
  for (const item of sorted) {
    if (item <= value) count += 1;
  }
  return count / sorted.length;
}

export function hasSufficientData(minClips = 5) {
  const stats = loadStats();
  return stats.clipCount >= minClips;
}

export function addClipToGlobalStats(summary: ClipSummary) {
  const stats = loadStats();
  stats.clipCount += 1;
  stats.clipVolatilityScore.push(summary.clipVolatilityScore);
  summary.hesitationMoments.forEach((moment) => {
    stats.hesitationDuration.push(moment.duration);
    stats.hesitationTransitionCount.push(moment.transition_count);
    stats.hesitationIntensity.push(moment.intensity);
  });
  saveStats(stats);
}

export function getGlobalBaselineStats() {
  return loadStats();
}
