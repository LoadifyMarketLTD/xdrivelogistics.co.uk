export async function publishAvailabilityLocation(lat: number, lng: number, token: string): Promise<string> {
 try {
  const headers = { Authorization: 'Bearer ' + token };
  const stateResponse = await fetch('/api/driver/availability-presence', { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!stateResponse.ok) return 'GPS detected, but availability status could not be checked.';
  const state = await stateResponse.json() as { active?: boolean };
  if (!state.active) return 'GPS detected. Enable location sharing in Availability to appear to nearby job posters.';
  const response = await fetch('/api/driver/availability-presence', {
   method: 'PUT',
   headers: { ...headers, 'Content-Type': 'application/json' },
   body: JSON.stringify({ lat, lng }),
   signal: AbortSignal.timeout(8000),
  });
  if (response.ok) return 'GPS updated in XDrive Live Availability.';
  return 'GPS detected, but Live Availability rejected the update (' + response.status + ').';
 } catch { return 'GPS detected, but Live Availability could not be reached.'; }
}
