"use client";

import {
  getGlobalBaselineStats,
  getPercentile,
} from "@/utils/globalBaselineStats";
import {
  computeClipStructureMetrics,
  type Segment,
} from "@/utils/clipStructureMetrics";
import { generateInsightHeadline } from "@/utils/insightHeadlineRules";
import { FALLBACK_META, PHASE_META } from "@/utils/phaseMeta";

type InsightSummaryCardProps = {
  primaryPhase: string;
  phasePercent: number;
  transitions: number;
  segments: number;
  clipDurationSeconds?: number;
  segmentsData?: Segment[];
};

export function InsightSummaryCard({
  primaryPhase,
  phasePercent,
  transitions,
  segments,
  clipDurationSeconds,
  segmentsData,
}: InsightSummaryCardProps) {
  const meta = PHASE_META[primaryPhase] ?? FALLBACK_META;
  const Icon = meta.icon;
  const roundedPercent = Number.isFinite(phasePercent)
    ? Math.round(phasePercent)
    : 0;
  const metrics = computeClipStructureMetrics({
    segments: segmentsData,
    durationS: clipDurationSeconds ?? 0,
    transitionCount: transitions,
    primaryPhaseFallback: primaryPhase,
  });
  const headline = generateInsightHeadline(metrics);
  const globalStats = getGlobalBaselineStats();
  const clipVolatilityScore =
    clipDurationSeconds && clipDurationSeconds > 0
      ? transitions / clipDurationSeconds
      : segments > 0
      ? transitions / Math.max(1, segments)
      : 0;
  const volatilityPercentile = getPercentile(
    clipVolatilityScore,
    globalStats.clipVolatilityScore
  );
  const volatilityCopy =
    volatilityPercentile === null
      ? "Cross-session comparison will appear as more clips are analyzed."
      : `This session shows more volatility than ${Math.round(
          volatilityPercentile * 100
        )}% of previously analyzed clips.`;

  return (
    <section className="relative overflow-hidden rounded-2xl border shadow-md bg-card">
      <div
        className={`absolute inset-y-0 left-0 w-2 ${meta.accent}`}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-0 bg-gradient-to-br ${meta.glow}`}
        aria-hidden="true"
      />
      <div className="relative p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <span
            className={`h-10 w-10 rounded-full ${meta.accent} text-white flex items-center justify-center text-lg shadow-sm`}
          >
            <Icon className="h-5 w-5" />
          </span>
          Insight Summary
        </div>

        <div className="text-2xl md:text-3xl font-semibold text-foreground">
          {headline.title}
        </div>

        <div className="text-base md:text-lg text-muted-foreground">
          {roundedPercent}% of the clip spent {meta.verb} ·{" "}
          {transitions} phase transitions
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <div className="px-3 py-1 rounded-full border bg-background/70">
            {segments} segments
          </div>
          <div className="px-3 py-1 rounded-full border bg-background/70">
            Dominant phase: {primaryPhase}
          </div>
        </div>

        <p className="text-sm text-foreground/80">{headline.sentence}</p>
        <p className="text-sm text-muted-foreground">{volatilityCopy}</p>

      </div>
    </section>
  );
}
