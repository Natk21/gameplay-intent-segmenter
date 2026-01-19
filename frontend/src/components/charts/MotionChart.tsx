"use client";

type Segment = {
  start: number;
  end: number;
  phase: string;
};

type Props = {
  times: number[];
  motion: number[];
  segments: Segment[];
};

const PHASE_STROKE: Record<string, string> = {
  Explore: "#2563eb",   // blue
  Execute: "#dc2626",   // red
  Outcome: "#6b7280",   // gray
};

export function MotionChart({ times, motion, segments }: Props) {
  if (times.length === 0) return null;

  const height = 600;
  const maxMotion = Math.max(...motion);

  // Helper: indices for segment
  const indicesForSegment = (start: number, end: number) =>
    times
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t >= start && t <= end)
      .map(({ i }) => i);

  return (
    <div className="border rounded p-4">
      <svg viewBox={`0 0 ${times.length} ${height}`} className="w-full h-[240px]">

        {/* Draw each segment as its own polyline */}
        {segments.map((seg, idx) => {
          const indices = indicesForSegment(seg.start, seg.end);
          if (indices.length < 2) return null;

          const points = indices
            .map((i) => {
              const x = i;
              const y = height - (motion[i] / maxMotion) * height;
              return `${x},${y}`;
            })
            .join(" ");

          return (
            <polyline
              key={idx}
              fill="none"
              stroke={PHASE_STROKE[seg.phase] || "black"}
              strokeWidth={seg.phase === "Execute" ? 2.5 : 1.5}
              points={points}
            />
          );
        })}

        {/* Phase boundaries */}
        {segments.map((seg, i) => {
          const idx = times.findIndex((t) => t >= seg.start);
          if (idx === -1) return null;

          return (
            <line
              key={i}
              x1={idx}
              x2={idx}
              y1={0}
              y2={height}
              stroke="#9ca3af"
              strokeDasharray="2 4"
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-6 mt-3 text-sm">
        <Legend color="#2563eb" label="Explore (low commitment)" />
        <Legend color="#dc2626" label="Execute (action burst)" />
        <Legend color="#6b7280" label="Outcome (resolution)" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
