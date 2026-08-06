import { notFound } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../../../admin/fleet/FleetPositionMap';

/**
 * Deterministic E2E fixture route for the Leaflet-based Fleet Position Map.
 * Renders the real FleetPositionMap component with injected coordinates so CI
 * can prove the map container is bounded without live Supabase or tile-server
 * availability.
 * Fail-closed: returns 404 outside of the explicit E2E fixture environment.
 */

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

// Valid UK coordinates — used to prove valid-point rendering and bounding.
const WITH_COORDS_POINTS: FleetMapPoint[] = [
  { driverId: 'driver-fx-1', driverName: 'Alice Driver', lat: 51.5, lng: -0.12, jobId: 'job-fx-1', timestamp: '2026-08-06T11:55:00.000Z', stale: false },
  { driverId: 'driver-fx-2', driverName: 'Bob Driver', lat: 52.48, lng: -1.9, jobId: 'job-fx-2', timestamp: '2026-08-06T09:00:00.000Z', stale: true },
  { driverId: 'driver-fx-3', driverName: 'Carol Driver', lat: 53.8, lng: -1.55, jobId: null, timestamp: null, stale: false },
];

const SCENARIOS: Record<string, { points: FleetMapPoint[]; selectedDriverId: string | null }> = {
  'with-coords': { points: WITH_COORDS_POINTS, selectedDriverId: 'driver-fx-1' },
  'no-coords': { points: [], selectedDriverId: null },
};

export default async function FleetMapFixturePage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  const { scenario } = await params;
  const fixture = SCENARIOS[scenario];
  if (!fixture) {
    notFound();
  }

  return (
    <div style={{ padding: '24px', background: '#0d1b2a', minHeight: '100vh' }}>
      <h1 style={{ color: '#eef6ff', fontFamily: 'sans-serif', marginBottom: '16px', fontSize: '1.1rem' }}>
        Fleet Position Map — {scenario}
      </h1>
      <div data-testid="fleet-map-container">
        <FleetPositionMap
          points={fixture.points}
          selectedDriverId={fixture.selectedDriverId}
        />
      </div>
    </div>
  );
}
