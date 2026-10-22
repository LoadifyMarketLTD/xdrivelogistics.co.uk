/** Values and freshness for the read-only Platform Owner maps. */
export const finiteNumberOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isTimestampFresh = (
  timestamp: unknown,
  nowMs: number,
  maxAgeMs = 30 * 60_000,
): boolean => {
  const at = typeof timestamp === 'number'
    ? timestamp
    : typeof timestamp === 'string' && timestamp.trim() ? Date.parse(timestamp) : Number.NaN;
  return Number.isFinite(at) && at >= nowMs - maxAgeMs && at <= nowMs + 2 * 60_000;
};
