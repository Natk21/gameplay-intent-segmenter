"use client";

import { useRef, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { SignalAnalysisChart } from "@/components/charts/SignalAnalysisChart";

type SignalAnalysisPanelProps = {
  times: number[];
  motion: number[];
  onSeek?: (t: number) => void;
  segments: Array<{
    start: number;
    end: number;
    phase: string;
  }>;
  decisionMoments: Array<{
    time: number;
    from_phase?: string;
    to_phase?: string;
    change_type?: "commitment" | "resolution" | "shift";
    hesitation?: boolean;
  }>;
};

export function SignalAnalysisPanel({
  times,
  motion,
  onSeek,
  segments,
  decisionMoments,
}: SignalAnalysisPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTime, setActiveTime] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const activeSegment =
    activeTime === null
      ? null
      : segments.find(
          (segment) => activeTime >= segment.start && activeTime < segment.end
        ) ?? null;

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

  return (
    <div ref={panelRef} className="border rounded bg-card/40 px-5 py-4">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-base font-medium">Signal Analysis</div>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          {!expanded && (
            <div className="text-xs text-muted-foreground">
              Click to expand
            </div>
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
          expanded ? "max-h-[900px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        <div className="relative">
          {activeSegment && (
            <div className="absolute right-2 top-0 rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] text-muted-foreground shadow-sm">
              {activeSegment.phase}
            </div>
          )}
          <div className="text-sm text-muted-foreground mb-4">
            <span className="font-medium text-foreground">
              Signal Analysis shows the raw evidence behind the intent labels.
            </span>{" "}
            Instead of telling you <em>what</em> the system thinks is happening,
            this view shows <em>why</em> — how much the scene changes, how
            predictable it is, and whether activity is scattered or focused over
            time.
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            Percentages are relative within this clip: 0% is the lowest observed
            signal value and 100% is the highest.
          </div>
          <SignalAnalysisChart
            times={times}
            motion={motion}
            onSeek={onSeek}
            decisionMoments={decisionMoments}
            onActiveTimeChange={setActiveTime}
          />
        </div>
      </div>
    </div>
  );
}
