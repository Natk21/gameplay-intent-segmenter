export type PhaseName = "Explore" | "Execute" | "Outcome" | "Unknown";

type Segment = {
  start: number;
  end: number;
  phase: PhaseName;
};

export function getPhaseAtTime(
  segments: Segment[],
  time: number
): PhaseName {
  if (!Number.isFinite(time)) return "Unknown";
  const match = segments.find(
    (segment) => time >= segment.start && time <= segment.end
  );
  return match?.phase ?? "Unknown";
}
