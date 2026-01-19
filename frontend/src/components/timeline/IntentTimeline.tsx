"use client";

type Segment = {
  id?: string;
  start: number;
  end: number;
  phase: string;
  why: string;
};

const PHASE_COLORS: Record<string, string> = {
  Explore: "bg-blue-500",
  Pursue: "bg-emerald-500",
  Execute: "bg-red-500",
  Outcome: "bg-gray-400",
};

const PHASE_ORDER = ["Explore", "Pursue", "Execute", "Outcome"];

export function IntentTimeline({
  segments,
  duration,
  onSelectSegment,
  onHoverSegment,
  currentTime = 0,
}: {
  segments: Segment[];
  duration: number;
  onSelectSegment?: (startTime: number) => void;
  onHoverSegment?: (segmentIndex: number | null) => void;
  currentTime?: number;
}) {
  if (!segments || segments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No intent segments available.
      </div>
    );
  }

  const maxSegmentEnd = Math.max(...segments.map((seg) => seg.end), 0);
  const videoDuration =
    Number.isFinite(duration) && duration > 0 ? duration : null;

  let safeDuration = 1;
  if (videoDuration && videoDuration > 0) {
    safeDuration = videoDuration;
  } else if (maxSegmentEnd > 0) {
    safeDuration = maxSegmentEnd;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    videoDuration &&
    maxSegmentEnd > videoDuration + 0.5
  ) {
    console.warn(
      "[IntentTimeline] Segment times exceed video duration",
      {
        videoDuration,
        maxSegmentEnd,
      }
    );
  }

  const playheadLeft = Math.min(
    Math.max((currentTime / safeDuration) * 100, 0),
    100
  );

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    return (safeDuration * index) / (tickCount - 1);
  });
  const formatTick = (seconds: number) => {
    const clamped = Math.max(0, Math.round(seconds));
    if (clamped === 0) return "0:00";
    if (clamped < 60) return `${clamped}s`;
    const minutes = Math.floor(clamped / 60);
    const remainder = clamped - minutes * 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  };

  function handleTimelineClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!onSelectSegment) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const clamped = Math.min(Math.max(ratio, 0), 1);
    onSelectSegment(clamped * safeDuration);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card/40 px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {PHASE_ORDER.map((phase) => {
            const color = PHASE_COLORS[phase] ?? "bg-slate-400";
            const textColor =
              phase === "Outcome" ? "text-black" : "text-white";
            return (
              <span
                key={phase}
                className={`rounded-full px-3 py-1 text-xs font-medium ${color} ${textColor}`}
              >
                {phase}
              </span>
            );
          })}
        </div>
        <div
          className="relative w-full h-10 rounded-full overflow-hidden border bg-muted/40"
          onMouseLeave={() => onHoverSegment?.(null)}
          onClick={handleTimelineClick}
        >
          {segments.map((seg, idx) => {
            const clampedStart = Math.max(
              0,
              Math.min(seg.start, safeDuration)
            );
            const clampedEnd = Math.max(
              0,
              Math.min(seg.end, safeDuration)
            );
            const segDuration = Math.max(0, clampedEnd - clampedStart);
            const leftPct = (clampedStart / safeDuration) * 100;
            const widthPct = (segDuration / safeDuration) * 100;
            if (leftPct >= 100 || widthPct <= 0) return null;
            const color = PHASE_COLORS[seg.phase] ?? "bg-slate-400";

            return (
              <div
                key={idx}
                data-testid="intent-segment"
                className={`${color} h-full absolute group cursor-pointer`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectSegment?.(clampedStart);
                }}
                onMouseEnter={() => onHoverSegment?.(idx)}
              />
            );
          })}
          <div
            data-testid="intent-playhead"
            className="absolute top-0 h-full w-[2px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]"
            style={{ left: `${playheadLeft}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          {ticks.map((tick) => (
            <span key={tick}>{formatTick(tick)}</span>
          ))}
        </div>
      </div>

    </div>
  );
}
