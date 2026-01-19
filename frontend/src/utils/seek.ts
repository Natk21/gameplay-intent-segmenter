export const SEEK_EPSILON = 0.01;

export function getSeekTime(
  startTime: number,
  duration?: number | null,
  segmentMaxEnd?: number | null
): number | null {
  if (!Number.isFinite(startTime)) return null;

  const safeDuration = Number.isFinite(duration ?? NaN)
    ? (duration as number)
    : null;

  const target = Math.max(startTime, 0);

  if (safeDuration && safeDuration > 0) {
    const maxTime = Math.max(0, safeDuration - SEEK_EPSILON);
    return Math.min(Math.max(target, 0), maxTime);
  }

  return Math.max(target, 0);
}
