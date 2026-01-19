import type { ClipStructureMetrics } from "./clipStructureMetrics";
import { getPhaseCopy } from "./phaseMeta";

export type HeadlineResult = { title: string; sentence: string; tags?: string[] };

function roundPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(1)}`;
}

export function generateInsightHeadline(
  metrics: ClipStructureMetrics
): HeadlineResult {
  const transitionsPerMin = metrics.transitionsPerMin;
  const avgExecuteDurationS = metrics.avgExecuteDurationS;
  const primaryPhase = metrics.primaryPhase;
  const secondaryPhase = metrics.secondaryPhase;
  const phasePercents = metrics.phasePercents;

  const highTempo = transitionsPerMin > 8;
  const lowTempo = transitionsPerMin < 4;
  const shortExecuteBursts =
    avgExecuteDurationS !== null && avgExecuteDurationS < 4;

  const getPercent = (phase: string) => phasePercents[phase] ?? 0;
  const pursuePct = getPercent("Pursue");
  const explorePct = getPercent("Explore");
  const executePct = getPercent("Execute");
  const outcomePct = getPercent("Outcome");

  const longPursueShare = pursuePct >= 30;
  const exploreHeavy = explorePct >= 40;
  const executeHeavy = executePct >= 35;
  const pursueHeavy = pursuePct >= 40;
  const outcomeHeavy = outcomePct >= 35;
  const balancedTop2 = metrics.isBalancedTop2 === true;

  if (highTempo && shortExecuteBursts) {
    const avgExec = formatSeconds(avgExecuteDurationS ?? 0);
    const secondaryLabel = secondaryPhase ?? "other phases";
    return {
      title: "Fast switching with short bursts",
      sentence: `The clip flips between ${primaryPhase} and ${secondaryLabel}, with brief execution moments (avg ${avgExec}s).`,
    };
  }

  if (lowTempo && longPursueShare) {
    return {
      title: "Long build-up, rare bursts",
      sentence: `Most of the time is spent in Pursue (${roundPercent(
        pursuePct
      )}%), with fewer transitions and occasional Execute moments.`,
    };
  }

  if (highTempo && primaryPhase === "Explore") {
    return {
      title: "Rapid probing",
      sentence:
        "A lot of quick switching suggests the player is testing options rather than committing.",
    };
  }

  if (highTempo && primaryPhase === "Execute") {
    return {
      title: "High action density",
      sentence:
        "Frequent transitions plus a strong Execute share suggest constant pressure and quick decisions.",
    };
  }

  if (exploreHeavy) {
    return {
      title: "Exploration-heavy clip",
      sentence: `The player spends most of the time gathering info and trying routes (${roundPercent(
        explorePct
      )}%).`,
    };
  }

  if (pursueHeavy) {
    return {
      title: "Goal-chasing focus",
      sentence: `Long Pursue stretches (${roundPercent(
        pursuePct
      )}%) suggest the player is driving toward a plan before acting.`,
    };
  }

  if (executeHeavy) {
    return {
      title: "Action-heavy clip",
      sentence: `Execute shows up often (${roundPercent(
        executePct
      )}%) with repeated bursts across the clip.`,
    };
  }

  if (outcomeHeavy) {
    return {
      title: "Closing things out",
      sentence: `A big Outcome share (${roundPercent(
        outcomePct
      )}%) suggests resolution and follow-through after key moments.`,
    };
  }

  if (balancedTop2 && secondaryPhase) {
    return {
      title: "Balanced intent structure",
      sentence: `${primaryPhase} (${roundPercent(
        metrics.primaryPercent
      )}%) and ${secondaryPhase} (${roundPercent(
        metrics.secondaryPercent ?? 0
      )}%) trade off throughout the clip.`,
    };
  }

  return getPhaseCopy(primaryPhase);
}
