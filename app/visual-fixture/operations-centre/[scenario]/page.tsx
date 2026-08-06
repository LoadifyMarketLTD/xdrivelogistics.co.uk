import { notFound } from 'next/navigation';
import OperationsCentrePage, { type OperationsCentreFixturePayload } from '../../../admin/operations-centre/page';

/**
 * Deterministic E2E fixture route for the Operations Centre.
 * Renders the real OperationsCentrePage with injected fixture data so CI can
 * prove layout bounds without live Supabase credentials.
 * Fail-closed: returns 404 outside of the explicit E2E fixture environment.
 */
const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

const WITH_DATA_PAYLOAD: OperationsCentreFixturePayload = {
  generatedAt: '2026-08-06T12:00:00.000Z',
  metrics: {
    todayJobs: 12,
    activeJobs: 5,
    completedToday: 7,
    delayedJobs: 2,
    driversOnline: 8,
    driversTotal: 12,
    vehiclesAvailable: 4,
    vehiclesTotal: 10,
    podMissing: 1,
    invoicesPending: 3,
    jobsAwaitingQuote: 4,
    jobsAwaitingCarrier: 2,
    companiesOnline: 15,
    customersOnline: 9,
    fleetCompaniesOnline: 6,
    ownerDriversOnline: 3,
    averageDeliveryTimeMinutes: 125,
    averageResponseTimeMinutes: 18,
    revenueToday: 4800,
    revenueThisMonth: 48000,
    platformHealth: 'Operational',
  },
  jobs: [
    {
      id: 'job-fx-1',
      shortId: 'FX001',
      pickup: 'London, UK',
      dropoff: 'Manchester, UK',
      start: '08:00',
      eta: '13:00',
      driver: 'Alice Driver',
      vehicle: 'VAN-001',
      progress: 60,
      status: 'In Transit',
      rawStatus: 'in_transit',
      tone: 'green',
      bidCount: 1,
      priority: 'High',
      nextStatus: 'delivered',
      nextStatusLabel: 'Mark Delivered',
      assignedDriverId: 'driver-fx-1',
    },
    {
      id: 'job-fx-2',
      shortId: 'FX002',
      pickup: 'Birmingham, UK',
      dropoff: 'Leeds, UK',
      start: '09:00',
      eta: '14:30',
      driver: 'Bob Driver',
      vehicle: 'VAN-002',
      progress: 20,
      status: 'Allocated',
      rawStatus: 'allocated',
      tone: 'amber',
      bidCount: 2,
      priority: 'Normal',
      nextStatus: null,
      nextStatusLabel: null,
      assignedDriverId: 'driver-fx-2',
    },
  ],
  mapPoints: [
    {
      id: 'pin-1',
      kind: 'driver',
      label: 'Alice Driver',
      lat: 52.48,
      lng: -1.9,
      status: 'active',
      updatedAt: '2026-08-06T11:55:00.000Z',
    },
    {
      id: 'pin-2',
      kind: 'pickup',
      label: 'FX001 Pickup',
      lat: 51.5,
      lng: -0.12,
      status: 'pending',
      updatedAt: '2026-08-06T11:50:00.000Z',
    },
  ],
  timeline: [
    {
      id: 'tl-1',
      time: '11:55',
      title: 'Job FX001 collected',
      detail: 'London → Manchester',
      owner: 'Alice Driver',
      tone: 'green',
    },
    {
      id: 'tl-2',
      time: '11:30',
      title: 'Job FX002 allocated',
      detail: 'Birmingham → Leeds',
      owner: 'Bob Driver',
      tone: 'blue',
    },
  ],
  alerts: [
    {
      id: 'alt-1',
      title: 'POD Missing',
      message: 'Job FX003 delivered without proof of delivery.',
      time: '10:00',
      severity: 'warning',
      type: 'pod',
    },
  ],
  errors: [],
};

const NO_DATA_PAYLOAD: OperationsCentreFixturePayload = {
  generatedAt: '2026-08-06T12:00:00.000Z',
  metrics: {
    todayJobs: 0,
    activeJobs: 0,
    completedToday: 0,
    delayedJobs: 0,
    driversOnline: 0,
    driversTotal: 0,
    vehiclesAvailable: 0,
    vehiclesTotal: 0,
    podMissing: 0,
    invoicesPending: 0,
    jobsAwaitingQuote: 0,
    jobsAwaitingCarrier: 0,
    companiesOnline: 0,
    customersOnline: 0,
    fleetCompaniesOnline: 0,
    ownerDriversOnline: 0,
    averageDeliveryTimeMinutes: 0,
    averageResponseTimeMinutes: 0,
    revenueToday: 0,
    revenueThisMonth: 0,
    platformHealth: 'Unknown',
  },
  jobs: [],
  mapPoints: [],
  timeline: [],
  alerts: [],
  errors: [],
};

const PARTIAL_ERROR_PAYLOAD: OperationsCentreFixturePayload = {
  ...WITH_DATA_PAYLOAD,
  generatedAt: '2026-08-06T12:05:00.000Z',
  metrics: {
    ...WITH_DATA_PAYLOAD.metrics,
    driversOnline: 6,
    platformHealth: 'Degraded',
  },
  mapPoints: [WITH_DATA_PAYLOAD.mapPoints[0]],
  errors: [
    { message: 'Driver location feed is temporarily unavailable for part of the fleet.' },
  ],
};

const SCENARIOS: Record<string, OperationsCentreFixturePayload> = {
  'with-data': WITH_DATA_PAYLOAD,
  'no-data': NO_DATA_PAYLOAD,
  'partial-error': PARTIAL_ERROR_PAYLOAD,
};

export default async function OperationsCentreFixturePage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  const { scenario } = await params;
  const payload = SCENARIOS[scenario];
  if (!payload) {
    notFound();
  }

  return <OperationsCentrePage fixturePayload={payload} />;
}
