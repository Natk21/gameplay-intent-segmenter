"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Segment = {
  id: string;
  start: number;
  end: number;
  phase: string;
  confidence?: number;
  explanation?: string;
  dominant_signals?: string[];
};

type SegmentListProps = {
  segments: Segment[];
  activeSegmentId: string | null;
  onSelect: (startTime: number) => void;
};

export function SegmentList({
  segments,
  activeSegmentId,
  onSelect,
}: SegmentListProps) {
  const hasSegments = segments && segments.length > 0;
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
          <div className="text-base font-medium">Segments</div>
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
          expanded ? "max-h-[420px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        <div className="max-h-[320px] overflow-y-auto space-y-2">
          <div className="text-xs text-muted-foreground">
            <div className="font-medium text-foreground">What this shows</div>
            <div>
              We split the clip into phases that show what the player is trying
              to do at each moment — exploring options, taking action, or
              reacting to what happens next. This makes it easier to understand
              the flow of decisions instead of watching the clip as one long
              video.
            </div>
          </div>
          {!hasSegments && (
            <div className="text-sm text-muted-foreground">
              No segments available.
            </div>
          )}
          {segments.map((segment) => {
            const isActive = segment.id === activeSegmentId;
            const confidenceText =
              typeof segment.confidence === "number"
                ? `${Math.round(segment.confidence * 100)}%`
                : "—";
            const explanationText = segment.explanation ?? "—";

            return (
              <button
                key={segment.id}
                type="button"
                onClick={() => onSelect(segment.start)}
                className={`w-full text-left border rounded p-3 transition
                  ${isActive ? "bg-muted/60 border-muted-foreground/30" : "bg-background"}
                  hover:bg-muted/40`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{segment.phase}</div>
                  <div className="text-xs text-muted-foreground">
                    {segment.start.toFixed(1)}–{segment.end.toFixed(1)}s
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Confidence: {confidenceText}</span>
                  <span className="truncate">{explanationText}</span>
                </div>
                {isActive && (
                  <div className="mt-2 h-[2px] bg-foreground/70 rounded" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
