"use client";

import { Compass, Crosshair, Zap, CheckCircle2, Circle } from "lucide-react";

type Segment = {
  start: number;
  end: number;
  phase: string;
  confidence: number;
  explanation: string;
  dominant_signals?: string[];
};

type SegmentDetailsProps = {
  segment: Segment | null;
};

const PHASE_STYLES: Record<
  string,
  { label: string; color: string; icon: typeof Compass }
> = {
  Explore: { label: "Explore", color: "bg-blue-500", icon: Compass },
  Pursue: { label: "Pursue", color: "bg-green-500", icon: Crosshair },
  Execute: { label: "Execute", color: "bg-red-500", icon: Zap },
  Outcome: { label: "Outcome", color: "bg-gray-400", icon: CheckCircle2 },
};

export function SegmentDetails({ segment }: SegmentDetailsProps) {
  if (!segment) {
    return (
      <div className="border rounded p-6 bg-card text-sm text-muted-foreground">
        Play the video or select a segment to see details.
      </div>
    );
  }

  const phaseStyle =
    PHASE_STYLES[segment.phase] ?? {
      label: segment.phase,
      color: "bg-slate-400",
      icon: Circle,
    };
  const duration = Math.max(segment.end - segment.start, 0);
  const Icon = phaseStyle.icon;

  return (
    <div className="border rounded p-6 bg-card space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-8 w-8 rounded-full ${phaseStyle.color} flex items-center justify-center text-white text-sm`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-medium">
              {phaseStyle.label}
            </div>
            <div className="text-xs text-muted-foreground">
              {segment.start.toFixed(1)}s → {segment.end.toFixed(1)}s
              {" · "}
              {duration.toFixed(1)}s duration
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Confidence:{" "}
          <span className="font-medium text-foreground">
            {Math.round(segment.confidence * 100)}%
          </span>
        </div>
      </div>

      <div className="text-sm leading-relaxed">
        {segment.explanation}
      </div>

      <div className="flex flex-wrap gap-2">
        {(segment.dominant_signals ?? []).length > 0 ? (
          segment.dominant_signals?.map((signal) => (
            <span
              key={signal}
              className="px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground"
            >
              {signal}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">
            No dominant signals available.
          </span>
        )}
      </div>
    </div>
  );
}
