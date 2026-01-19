import type { ConsolidatedDecisionMoment } from "../utils/consolidateDecisionMoments";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function extractDecisionFeatures(
  decision: ConsolidatedDecisionMoment
): number[] {
  const duration = clamp01(decision.normalized_duration ?? 0);
  const transitionRate = clamp01(
    decision.normalized_transition_rate ?? 0
  );
  const volatility = clamp01(decision.normalized_volatility ?? 0);
  const intensity = clamp01(
    decision.normalized_signal_intensity ?? 0
  );

  return [duration, transitionRate, volatility, intensity];
}
