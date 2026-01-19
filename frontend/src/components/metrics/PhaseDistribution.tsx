"use client";

import { useMemo, useState } from "react";
import {
  Compass,
  Crosshair,
  Zap,
  CheckCircle2,
} from "lucide-react";

type Segment = {
  start: number;
  end: number;
  phase: string;
};

type Metrics = {
  segments_count: number;
  transitions_count: number;
  clip_duration_s: number;
  transitions_per_min: number;
  volatility: {
    label: "Low" | "Medium" | "High";
    score: number;
  };
};

type PhaseDistributionProps = {
  segments: Segment[];
  metrics: Metrics;
  exportData?: unknown;
};

const PHASE_META: Record<
  string,
  {
    label: string;
    color: string;
    icon: typeof Compass;
    iconClass: string;
    description: string;
  }
> = {
  Explore: {
    label: "Explore",
    color: "bg-blue-500",
    icon: Compass,
    iconClass: "text-blue-400",
    description: "High entropy, camera scanning, low commitment.",
  },
  Pursue: {
    label: "Pursue",
    color: "bg-emerald-500",
    icon: Crosshair,
    iconClass: "text-emerald-400",
    description: "Directed movement toward inferred goal.",
  },
  Execute: {
    label: "Execute",
    color: "bg-red-500",
    icon: Zap,
    iconClass: "text-red-400",
    description: "High-action burst or interaction.",
  },
  Outcome: {
    label: "Outcome",
    color: "bg-slate-400",
    icon: CheckCircle2,
    iconClass: "text-slate-300",
    description: "Resolution, pause, or reset.",
  },
};

export function PhaseDistribution({
  segments,
  metrics,
  exportData,
}: PhaseDistributionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const clipDuration = metrics.clip_duration_s || 0;
  const totalSegmentDuration = useMemo(() => {
    return segments.reduce(
      (sum, seg) => sum + Math.max(seg.end - seg.start, 0),
      0
    );
  }, [segments]);
  const safeTotalDuration =
    clipDuration > 0 ? clipDuration : totalSegmentDuration || 1;

  const phaseStats = useMemo(() => {
    const stats = new Map<
      string,
      { total: number; count: number }
    >();
    segments.forEach((segment) => {
      const duration = Math.max(segment.end - segment.start, 0);
      const entry = stats.get(segment.phase) ?? {
        total: 0,
        count: 0,
      };
      entry.total += duration;
      entry.count += 1;
      stats.set(segment.phase, entry);
    });
    return stats;
  }, [segments]);

  function handleExport() {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "intent_analysis.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border rounded p-6 bg-card space-y-4">
      <button
        type="button"
        className="w-full flex items-center justify-between"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <div className="text-lg font-medium">
          Phase Distribution
        </div>
        <div className="text-xs text-muted-foreground">
          {isCollapsed ? "Show" : "Hide"}
        </div>
      </button>

      {!isCollapsed && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
              {Object.entries(PHASE_META).map(
                ([phase, meta]) => {
                  const stat = phaseStats.get(phase) ?? {
                    total: 0,
                    count: 0,
                  };
                  const percentage =
                    (stat.total / safeTotalDuration) * 100;
                  return (
                    <div
                      key={phase}
                      className={`group relative border rounded p-3 space-y-1 cursor-help ${
                        phase === "Explore"
                          ? "border-blue-500/40 bg-blue-500/10"
                          : phase === "Pursue"
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : phase === "Execute"
                          ? "border-red-500/40 bg-red-500/10"
                          : "border-slate-500/40 bg-slate-500/10"
                      }`}
                    >
                      <div className="pointer-events-none absolute left-1/2 top-0 z-10 w-max max-w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-slate-950/90 px-3 py-2 text-center text-xs text-slate-100 opacity-0 shadow-lg backdrop-blur transition-opacity duration-150 group-hover:opacity-100">
                        {meta.description}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-8 w-8 rounded-full border border-border/50 bg-muted/40 flex items-center justify-center">
                          <meta.icon
                            className={`h-4 w-4 ${meta.iconClass}`}
                            aria-hidden="true"
                          />
                        </span>
                        <span
                          className={`font-medium ${
                            phase === "Explore"
                              ? "text-blue-300"
                              : phase === "Pursue"
                              ? "text-emerald-300"
                              : phase === "Execute"
                              ? "text-red-300"
                              : "text-slate-300"
                          }`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-sm">
                        {percentage.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stat.total.toFixed(1)}s · {stat.count}{" "}
                        segments
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-2 border rounded text-xs"
              disabled={!exportData}
            >
              Export JSON
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              Time distribution
            </div>
            <div className="flex w-full h-3 rounded overflow-hidden border">
              {segments.map((segment, index) => {
                const duration = Math.max(
                  segment.end - segment.start,
                  0
                );
                const widthPct =
                  (duration / safeTotalDuration) * 100;
                const color =
                  PHASE_META[segment.phase]?.color ??
                  "bg-slate-400";
                return (
                  <div
                    key={`${segment.phase}-${index}`}
                    className={color}
                    style={{ width: `${widthPct}%` }}
                    title={`${segment.phase} · ${duration.toFixed(
                      1
                    )}s`}
                  />
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="border rounded p-3 text-center flex flex-col items-center justify-center gap-2">
              <div className="text-xs text-muted-foreground">
                Segments
              </div>
              <div className="font-medium">
                {metrics.segments_count}
              </div>
            </div>
            <div className="border rounded p-3 text-center flex flex-col items-center justify-center gap-2">
              <div className="text-xs text-muted-foreground">
                Transitions
              </div>
              <div className="font-medium">
                {metrics.transitions_count}
              </div>
            </div>
            <div className="border rounded p-3 text-center flex flex-col items-center justify-center gap-2">
              <div className="text-xs text-muted-foreground">
                Avg segment
              </div>
              <div className="font-medium">
                {metrics.segments_count > 0
                  ? (metrics.clip_duration_s /
                      metrics.segments_count
                    ).toFixed(1)
                  : "—"}
                s
              </div>
            </div>
            <div className="border rounded p-3 text-center flex flex-col items-center justify-center gap-2">
              <div className="text-xs text-muted-foreground">
                Clip duration
              </div>
              <div className="font-medium">
                {metrics.clip_duration_s.toFixed(1)}s
              </div>
            </div>
            <div className="border rounded p-3 text-center flex flex-col items-center justify-center gap-2">
              <div className="text-xs text-muted-foreground">
                Volatility
              </div>
              <div className="font-medium text-sm text-foreground">
                {metrics.volatility.label}:{" "}
                {metrics.volatility.score.toFixed(1)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
