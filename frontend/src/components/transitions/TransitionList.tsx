"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Target,
  CheckCircle2,
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
} from "lucide-react";
import {
  getGlobalBaselineStats,
  getPercentile,
} from "@/utils/globalBaselineStats";

type Transition = {
  id: string;
  time: number;
  from_phase: string;
  to_phase: string;
  confidence: number;
  change_type: "commitment" | "resolution" | "shift" | "hesitation";
  hesitation?: boolean;
  explanation: string;
  start_time?: number;
  end_time?: number;
  duration?: number;
  transition_count?: number;
  confidence_level?: "low" | "medium" | "high";
  confidence_score?: number;
  confidence_reason?: string;
  within_video_summary?: string | null;
  signal_intensity?: number;
  within_clip_percentile?: number;
  comparative_label?: "normal" | "elevated" | "extreme";
};

type TransitionListProps = {
  transitions: Transition[];
  onSelect: (transition: Transition) => void;
  activeTransitionId?: string | null;
  selectedTransition?: Transition | null;
  signalTimes?: number[];
  motionSignal?: number[];
};

const FILTERS = ["all", "hesitation", "commitment", "resolution"] as const;
type Filter = (typeof FILTERS)[number];
const ENABLE_CROSS_SESSION_BASELINE = false;

export function TransitionList({
  transitions,
  onSelect,
  activeTransitionId,
  selectedTransition,
  signalTimes = [],
  motionSignal = [],
}: TransitionListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedTransition || !expanded) return;
    if (!detailRef.current) return;
    detailRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedTransition, expanded]);

  function handleToggle() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    requestAnimationFrame(() => {
      if (!panelRef.current) return;
      panelRef.current.scrollIntoView({
        behavior: "smooth",
        block: nextExpanded ? "center" : "start",
      });
    });
  }

  function getIcon(transition: Transition) {
    if (transition.hesitation) return AlertTriangle;
    if (transition.change_type === "commitment") return Target;
    if (transition.change_type === "resolution") return CheckCircle2;
    return ArrowLeftRight;
  }

  function getConfidenceLevel(transition: Transition) {
    return transition.confidence_level ?? "medium";
  }

  function getConfidenceLabel(transition: Transition) {
    const level = getConfidenceLevel(transition);
    return level.charAt(0).toUpperCase() + level.slice(1);
  }

  function getConfidenceReason(transition: Transition) {
    return (
      transition.confidence_reason ??
      "Confidence details unavailable for this moment."
    );
  }

  function getCrossSessionCopy(transition: Transition) {
    if (!transition.transition_count) {
      return "Not enough past data to compare yet.";
    }
    const stats = getGlobalBaselineStats();
    const percentile = getPercentile(
      transition.transition_count,
      stats.hesitationTransitionCount
    );
    if (percentile === null) {
      return "Not enough past data to compare yet.";
    }
    return `More unstable than ${Math.round(
      percentile * 100
    )}% of similar moments across sessions.`;
  }

  function getComparisonCopy(percentile: number) {
    if (percentile >= 90) {
      return "This moment is among the most unstable parts of this session.";
    }
    if (percentile >= 75) {
      return "This moment shows higher uncertainty than most of the session.";
    }
    return "This moment is within the normal range of variability for this session.";
  }

  function improveCopy(text: string) {
    return text.replace(
      "Gradual change in behavior suggests a strategy shift",
      "Repeated switching between explore and execute suggests uncertainty."
    );
  }

  function getTypeLabel(transition: Transition) {
    if (transition.hesitation) return "Hesitation";
    if (transition.change_type === "resolution") return "Commitment";
    if (transition.change_type === "commitment") return "Commitment";
    return "Shift";
  }

  function getTimeLabel(transition: Transition) {
    if (
      Number.isFinite(transition.start_time) &&
      Number.isFinite(transition.end_time)
    ) {
      return `${transition.start_time!.toFixed(1)}s – ${transition.end_time!.toFixed(1)}s`;
    }
    return `${transition.time.toFixed(1)}s`;
  }

  function getSwitchLabel(transition: Transition) {
    if (!transition.transition_count) return null;
    const count = transition.transition_count;
    if (count < 2) return null;
    return `${count} rapid ${count === 1 ? "switch" : "switches"}`;
  }

  function findNearestIndex(times: number[], target: number) {
    if (times.length === 0) return null;
    let low = 0;
    let high = times.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const value = times[mid];
      if (value === target) return mid;
      if (value < target) low = mid + 1;
      else high = mid - 1;
    }
    return Math.max(0, Math.min(low, times.length - 1));
  }

  function getWindowAverage(
    times: number[],
    values: number[],
    center: number,
    windowSeconds: number
  ) {
    if (times.length === 0 || values.length === 0) return null;
    const samples = times.reduce<number[]>((acc, time, index) => {
      if (Math.abs(time - center) <= windowSeconds) {
        const value = values[index];
        if (Number.isFinite(value)) acc.push(value);
      }
      return acc;
    }, []);
    if (samples.length < 2) return null;
    const sum = samples.reduce((total, value) => total + value, 0);
    return sum / samples.length;
  }

  function getMotionEvidence(
    time: number,
    times: number[],
    motion: number[]
  ) {
    if (times.length === 0 || motion.length === 0) return null;
    const localAvg = getWindowAverage(times, motion, time, 1.5);
    const nearbyAvg = getWindowAverage(times, motion, time, 5);
    if (localAvg === null || nearbyAvg === null) return null;
    if (localAvg > nearbyAvg * 1.25) {
      return "Abrupt activity spike compared to nearby moments.";
    }
    if (localAvg < nearbyAvg * 0.75) {
      return "Noticeable lull in activity compared to nearby moments.";
    }
    return null;
  }

  function getPhaseEvidence(transition: Transition) {
    const fromPhase = transition.from_phase;
    const toPhase = transition.to_phase;
    if (!fromPhase || !toPhase) return null;
    if (transition.change_type === "commitment") {
      return `Move from ${fromPhase} to ${toPhase} looks like a committed choice.`;
    }
    if (transition.change_type === "resolution") {
      return `Move from ${fromPhase} to ${toPhase} suggests a resolved change.`;
    }
    return `Move from ${fromPhase} to ${toPhase} marks a shift in behavior.`;
  }

  function getEvidenceBullets(
    transition: Transition,
    allTransitions: Transition[],
    times: number[],
    motion: number[]
  ) {
    const bullets: string[] = [];
    const phaseEvidence = getPhaseEvidence(transition);
    if (phaseEvidence) bullets.push(phaseEvidence);

    const nearbyCount = allTransitions.filter(
      (item) =>
        item.id !== transition.id &&
        Math.abs(item.time - transition.time) <= 5
    ).length;
    if (nearbyCount >= 2) {
      bullets.push("Repeated switching suggests uncertainty.");
    } else if (nearbyCount === 1) {
      bullets.push("Switching back-to-back suggests uncertainty.");
    } else {
      bullets.push("This change stands out from nearby moments.");
    }

    if (transition.hesitation) {
      bullets.push("Behavior looked unstable before settling.");
    }

    const motionEvidence = getMotionEvidence(transition.time, times, motion);
    if (motionEvidence) bullets.push(motionEvidence);

    return bullets.slice(0, 4);
  }

  const filteredTransitions = useMemo(() => {
    const sorted = [...transitions].sort(
      (a, b) => a.time - b.time
    );
    if (filter === "all") return sorted;
    if (filter === "hesitation") {
      return sorted.filter((t) => t.hesitation);
    }
    return sorted.filter((t) => t.change_type === filter);
  }, [transitions, filter]);

  return (
    <div ref={panelRef} className="border rounded bg-card/40 px-5 py-4">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <div className="space-y-1">
          <div className="text-base font-medium">Decision Moments</div>
          {!expanded && (
            <div className="text-xs text-muted-foreground">Click to expand</div>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            expanded ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          expanded ? "max-h-[1400px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-4">
          <div className="border rounded p-4 bg-muted/40 space-y-2">
            <div className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">
                What this shows
              </div>
              <div>
                This panel explains why a moment was flagged as a decision. It
                highlights how the player&apos;s behavior changed, and whether
                that change felt smooth, uncertain, or decisive.
              </div>
            </div>
            {!selectedTransition && (
              <div className="text-xs text-muted-foreground">
                Select a moment to see the detailed explanation.
              </div>
            )}
          </div>

          {selectedTransition && (
            <div
              ref={detailRef}
              className="border rounded p-4 bg-muted/40 space-y-3"
            >
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-medium">
                    {selectedTransition.from_phase} →{" "}
                    {selectedTransition.to_phase}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getTimeLabel(selectedTransition)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    Confidence:{" "}
                    {Math.round(selectedTransition.confidence * 100)}%
                  </span>
                  <span>
                    Type: {getTypeLabel(selectedTransition)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Confidence:
                  </span>{" "}
                  {getConfidenceLabel(selectedTransition)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {getConfidenceReason(selectedTransition)}
                </div>
                {selectedTransition.within_video_summary && (
                  <div className="text-xs text-muted-foreground">
                    {selectedTransition.within_video_summary}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {getCrossSessionCopy(selectedTransition)}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="text-xs font-medium text-foreground">
                  Why this moment was flagged
                </div>
                <div className="space-y-1.5">
                  {getEvidenceBullets(
                    selectedTransition,
                    transitions,
                    signalTimes,
                    motionSignal
                  ).map((item) => (
                    <div key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  This explanation reflects patterns in the observed signals,
                  not a definitive interpretation.
                </div>
              </div>

              {Number.isFinite(
                selectedTransition.within_clip_percentile
              ) && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <BarChart3 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {getComparisonCopy(
                        selectedTransition
                          .within_clip_percentile as number
                      )}
                    </span>
                  </div>
                  <div className="pl-5 text-[11px] text-muted-foreground">
                    Higher than{" "}
                    <span className="font-medium text-foreground/80">
                      {Math.round(
                        selectedTransition
                          .within_clip_percentile as number
                      )}
                      %
                    </span>{" "}
                    of moments in this session.
                  </div>
                </div>
              )}

              {ENABLE_CROSS_SESSION_BASELINE && (
                <div className="space-y-2 rounded border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      Preview — cross-session baseline coming soon
                    </span>
                  </div>
                  <div>
                    Compared to similar sessions, this level of
                    instability appears elevated.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 text-xs">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`px-2 py-1 rounded border
                  ${
                    filter === item
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {item === "all"
                  ? "All"
                  : item === "hesitation"
                  ? "Hesitation"
                  : item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          {filteredTransitions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No transitions available.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransitions.map((transition) => {
                const isActive =
                  transition.id === activeTransitionId;
                const hesitationStyle = transition.hesitation
                  ? "border-yellow-400/70 bg-yellow-500/10"
                  : "border-muted";
                const confidenceLevel =
                  getConfidenceLevel(transition);
                const confidenceBorder =
                  confidenceLevel === "high"
                    ? "border-l-4"
                    : confidenceLevel === "low"
                    ? "border-l"
                    : "border-l-2";
                const confidenceOpacity =
                  confidenceLevel === "high"
                    ? "opacity-100"
                    : confidenceLevel === "low"
                    ? "opacity-70"
                    : "opacity-80";

                return (
                  <button
                    key={transition.id}
                    type="button"
                    onClick={() => onSelect(transition)}
                    className={`w-full text-left border rounded p-3 transition
                      ${hesitationStyle}
                      ${confidenceBorder}
                      ${isActive ? "ring-2 ring-foreground/40" : ""}
                      hover:border-foreground/40`}
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`text-base ${confidenceOpacity}`}>
                          {(() => {
                            const Icon = getIcon(transition);
                            return <Icon className="h-4 w-4" />;
                          })()}
                        </span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">
                      {getTimeLabel(transition)}
                    </span>
                    {getSwitchLabel(transition) && (
                      <span className="text-xs text-muted-foreground">
                        {getSwitchLabel(transition)}
                      </span>
                    )}
                  </div>
                        <span className="text-muted-foreground">
                          {transition.from_phase} →{" "}
                          {transition.to_phase}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground truncate md:max-w-[50%]">
                        {improveCopy(transition.explanation)}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded border">
                          {getTypeLabel(transition)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
