"use client";

import { useEffect, useMemo, useState } from "react";

type SignalAnalysisChartProps = {
  times: number[];
  motion: number[];
  onSeek?: (t: number) => void;
  decisionMoments?: DecisionMoment[];
  onActiveTimeChange?: (time: number | null) => void;
};

type SignalSeries = {
  key: string;
  name: string;
  explanation: string;
  lineClass: string;
  dotClass: string;
  pointClass: string;
  values: number[];
};

type DecisionMoment = {
  time: number;
  from_phase?: string;
  to_phase?: string;
  change_type?: "commitment" | "resolution" | "shift";
  hesitation?: boolean;
};

const VIEWBOX_WIDTH = 1000;
const CHART_HEIGHT = 160;
const PADDING = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function findNearestIndex(times: number[], target: number) {
  let low = 0;
  let high = times.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value = times[mid];
    if (value === target) return mid;
    if (value < target) low = mid + 1;
    else high = mid - 1;
  }
  return clamp(low, 0, times.length - 1);
}

function normalizeValues(values: number[]) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(() => 50);
  }
  return values.map((value) => ((value - min) / (max - min)) * 100);
}

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

function standardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean =
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function rollingDensity(flags: boolean[], radius: number) {
  return flags.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(flags.length - 1, index + radius);
    const window = flags.slice(start, end + 1);
    const count = window.filter(Boolean).length;
    return count / window.length;
  });
}

export function SignalAnalysisChart({
  times,
  motion,
  onSeek,
  decisionMoments = [],
  onActiveTimeChange,
}: SignalAnalysisChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [lockedIndex, setLockedIndex] = useState<number | null>(null);

  const length = Math.min(times.length, motion.length);
  const timeValues = times.slice(0, length);
  const motionValues = motion.slice(0, length);

  const sceneUncertainty = useMemo(() => {
    return rollingVariance(motionValues, 6);
  }, [motionValues]);

  const focusedActivity = useMemo(() => {
    if (motionValues.length === 0) return [];
    const mean =
      motionValues.reduce((sum, value) => sum + value, 0) /
      motionValues.length;
    const std = standardDeviation(motionValues);
    const threshold = mean + std * 0.6;
    const spikes = motionValues.map((value) => value > threshold);
    return rollingDensity(spikes, 8);
  }, [motionValues]);

  const series = useMemo<SignalSeries[]>(() => {
    return [
      {
        key: "visual-change",
        name: "Visual Change",
        explanation: "How much the image changes from moment to moment.",
        lineClass: "stroke-blue-500",
        dotClass: "bg-blue-500",
        pointClass: "fill-blue-500",
        values: normalizeValues(motionValues),
      },
      {
        key: "scene-uncertainty",
        name: "Scene Uncertainty",
        explanation:
          "How unpredictable the visual content is at this time.",
        lineClass: "stroke-purple-500",
        dotClass: "bg-purple-500",
        pointClass: "fill-purple-500",
        values: normalizeValues(sceneUncertainty),
      },
      {
        key: "focused-activity",
        name: "Focused Activity",
        explanation: "Whether activity is concentrated or scattered.",
        lineClass: "stroke-amber-400",
        dotClass: "bg-amber-400",
        pointClass: "fill-amber-400",
        values: normalizeValues(focusedActivity),
      },
    ];
  }, [motionValues, sceneUncertainty, focusedActivity]);

  const minTime = timeValues.length ? timeValues[0] : 0;
  const maxTime = timeValues.length
    ? timeValues[timeValues.length - 1]
    : 1;
  const timeSpan = maxTime - minTime || 1;

  function getIndexFromEvent(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    if (timeValues.length === 0) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp(
      (event.clientX - rect.left) / rect.width,
      0,
      1
    );
    const targetTime = minTime + ratio * timeSpan;
    return findNearestIndex(timeValues, targetTime);
  }

  function getRatioForIndex(index: number) {
    if (timeValues.length === 0) return 0;
    return (timeValues[index] - minTime) / timeSpan;
  }

  const activeIndex = lockedIndex ?? hoverIndex;
  const activeRatio =
    activeIndex !== null ? getRatioForIndex(activeIndex) : null;
  const yRange = CHART_HEIGHT - PADDING * 2;

  const markers = useMemo(() => {
    if (timeValues.length === 0) return [];
    return decisionMoments
      .filter((moment) => Number.isFinite(moment.time))
      .map((moment) => {
        const index = findNearestIndex(timeValues, moment.time);
        return {
          ...moment,
          index,
          ratio: getRatioForIndex(index),
        };
      });
  }, [decisionMoments, timeValues]);

  const markerAtActive =
    activeIndex !== null
      ? markers.find((marker) => marker.index === activeIndex)
      : null;

  useEffect(() => {
    if (!onActiveTimeChange) return;
    if (activeIndex === null) {
      onActiveTimeChange(null);
      return;
    }
    onActiveTimeChange(timeValues[activeIndex] ?? null);
  }, [activeIndex, onActiveTimeChange, timeValues]);

  function getMarkerLabel(marker: DecisionMoment) {
    if (marker.hesitation) return "Hesitation";
    if (marker.change_type === "commitment") return "Commitment";
    return "Shift";
  }

  function getMarkerClass(marker: DecisionMoment) {
    if (marker.hesitation) return "stroke-yellow-400/80";
    if (marker.change_type === "commitment") return "stroke-emerald-400/80";
    return "stroke-blue-400/70";
  }

  const paths = useMemo(() => {
    if (timeValues.length === 0) return [];
    return series.map((signal) =>
      timeValues
        .map((time, idx) => {
          const x = ((time - minTime) / timeSpan) * VIEWBOX_WIDTH;
          const value = signal.values[idx] ?? 0;
          const y = PADDING + (1 - value / 100) * yRange;
          return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ")
    );
  }, [series, timeValues, minTime, timeSpan, yRange]);

  if (timeValues.length === 0) {
    return (
      <div className="h-56 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center text-sm text-muted-foreground">
        Signal data not available
      </div>
    );
  }

  return (
    <div className="relative space-y-5">
      {series.map((signal, index) => (
        <div key={signal.key} className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`h-2.5 w-2.5 rounded-full ${signal.dotClass}`}
              />
              <span className="text-sm font-medium text-foreground">
                {signal.name}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {signal.explanation}
            </div>
          </div>

          <div
            className="relative h-40 w-full rounded border bg-card/40"
            onMouseMove={(event) => {
              if (lockedIndex !== null) return;
              const idx = getIndexFromEvent(event);
              if (idx !== null) setHoverIndex(idx);
            }}
            onMouseLeave={() => {
              if (lockedIndex === null) setHoverIndex(null);
            }}
            onClick={(event) => {
              const idx = getIndexFromEvent(event);
              if (idx === null) return;
              if (lockedIndex === idx) {
                setLockedIndex(null);
                return;
              }
              setLockedIndex(idx);
              setHoverIndex(null);
              onSeek?.(timeValues[idx]);
            }}
          >
            <svg
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${CHART_HEIGHT}`}
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
            >
              {[0, 1, 2, 3, 4].map((step) => (
                <line
                  key={`grid-${signal.key}-${step}`}
                  x1={0}
                  x2={VIEWBOX_WIDTH}
                  y1={PADDING + (yRange / 4) * step}
                  y2={PADDING + (yRange / 4) * step}
                  className="stroke-muted-foreground/20"
                  strokeWidth={1}
                />
              ))}

              {markers.map((marker) => (
                <line
                  key={`marker-${signal.key}-${marker.time}`}
                  x1={marker.ratio * VIEWBOX_WIDTH}
                  x2={marker.ratio * VIEWBOX_WIDTH}
                  y1={PADDING}
                  y2={CHART_HEIGHT - PADDING}
                  className={getMarkerClass(marker)}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  onMouseEnter={() => {
                    if (lockedIndex !== null) return;
                    setHoverIndex(marker.index);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (lockedIndex === marker.index) {
                      setLockedIndex(null);
                      return;
                    }
                    setLockedIndex(marker.index);
                    setHoverIndex(null);
                    onSeek?.(timeValues[marker.index]);
                  }}
                />
              ))}

              <path
                d={paths[index]}
                className={`fill-none ${signal.lineClass}`}
                strokeWidth={2}
              />

              {activeRatio !== null && (
                <line
                  x1={activeRatio * VIEWBOX_WIDTH}
                  x2={activeRatio * VIEWBOX_WIDTH}
                  y1={PADDING}
                  y2={CHART_HEIGHT - PADDING}
                  className="stroke-slate-200/60"
                  strokeWidth={1}
                />
              )}

              {activeIndex !== null && (
                <circle
                  cx={activeRatio ? activeRatio * VIEWBOX_WIDTH : 0}
                  cy={
                    PADDING +
                    (1 - (signal.values[activeIndex] ?? 0) / 100) *
                      yRange
                  }
                  r={3.5}
                  className={signal.pointClass}
                />
              )}
            </svg>
          </div>
        </div>
      ))}

      {activeIndex !== null && activeRatio !== null && (
        <div
          className={`absolute top-2 z-20 rounded px-3 py-2 text-xs text-white shadow ${
            lockedIndex !== null ? "bg-blue-600/90" : "bg-black/80"
          }`}
          style={{
            left: `${activeRatio * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div>Time: {timeValues[activeIndex].toFixed(1)}s</div>
          <div>
            Visual Change: {Math.round(series[0].values[activeIndex])}%
          </div>
          <div>
            Scene Uncertainty:{" "}
            {Math.round(series[1].values[activeIndex])}%
          </div>
          <div>
            Focused Activity:{" "}
            {Math.round(series[2].values[activeIndex])}%
          </div>
        </div>
      )}

      {markerAtActive && activeRatio !== null && (
        <div
          className="absolute top-16 z-20 rounded bg-black/85 px-3 py-2 text-xs text-white shadow"
          style={{
            left: `${activeRatio * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-medium">Decision moment</div>
          {markerAtActive.from_phase && markerAtActive.to_phase && (
            <div className="text-white/80">
              {markerAtActive.from_phase} → {markerAtActive.to_phase}
            </div>
          )}
          <div className="text-white/70">
            {getMarkerLabel(markerAtActive)}
          </div>
        </div>
      )}
    </div>
  );
}
