export type DriverMapStatus = 'online' | 'busy' | 'offline' | 'sold';

export function deriveDriverMapStatus({
  driverStatus,
  isActive,
  availabilityStatus,
  locationFresh,
}: {
  driverStatus?: string | null;
  isActive?: boolean | null;
  availabilityStatus?: string | null;
  locationFresh: boolean;
}): DriverMapStatus {
  // A recent GPS fix alone is not evidence that a driver is available.
  if (isActive === false || String(driverStatus ?? '').toLowerCase() !== 'active' || !locationFresh) {
    return 'offline';
  }
  const availability = String(availabilityStatus ?? '').toLowerCase();
  if (availability === 'busy') return 'busy';
  if (availability === 'available') return 'online';
  return 'offline';
}
