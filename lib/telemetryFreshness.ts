export type TelemetryFreshnessState = 'fresh' | 'aging' | 'stale' | 'unavailable';

export type TelemetryFreshness = {
  state: TelemetryFreshnessState;
  ageMinutes: number | null;
  label: string;
};

export function telemetryFreshness(recordedAt: string | null | undefined, nowMs = Date.now()): TelemetryFreshness {
  if (!recordedAt) return { state: 'unavailable', ageMinutes: null, label: 'No telemetry' };
  const stamp = new Date(recordedAt).getTime();
  if (!Number.isFinite(stamp)) return { state: 'unavailable', ageMinutes: null, label: 'Timestamp unavailable' };
  const ageMinutes = Math.max(0, Math.round((nowMs - stamp) / 60_000));
  if (ageMinutes <= 5) return { state: 'fresh', ageMinutes, label: `${ageMinutes}m ago` };
  if (ageMinutes <= 20) return { state: 'aging', ageMinutes, label: `${ageMinutes}m ago` };
  const label = ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.floor(ageMinutes / 60)}h ago`;
  return { state: 'stale', ageMinutes, label };
}
