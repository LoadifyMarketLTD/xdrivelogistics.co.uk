export type VehicleStatusInput = {
  status: string | null;
  current_status: string | null;
  is_available: boolean | null;
};

const normalize = (value: string | null | undefined) => (value ?? '').trim();

export function vehicleStatus(row: VehicleStatusInput): string {
  const current = normalize(row.current_status);
  const currentLower = current.toLowerCase();

  if (row.is_available === true || currentLower === 'waiting for next job (available)') {
    return 'WAITING FOR NEXT JOB (AVAILABLE)';
  }

  if (current) return current.toUpperCase();

  const fallback = normalize(row.status);
  if (fallback) return fallback.toUpperCase();

  return 'UNKNOWN';
}
