import { notFound } from 'next/navigation';
import WorkspaceFixtureProvider from '../../components/workspace/WorkspaceFixtureProvider';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import DriverDashboard from '../../driver/page';
import type { WorkspaceDataState } from '../../components/workspace/useCompanyWorkspaceData';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

const COMPANY_ID = 'fixture-driver-001';

const FIXTURE_DATA: WorkspaceDataState = {
  companyId: COMPANY_ID,
  loading: false,
  error: '',
  jobs: [
    // Jobs assigned to this driver (assigned_driver_id matches the fixture driver user)
    // DriverDashboard uses filterJobsForDriver(data.jobs, user) — without real user, all are shown
    { id: 'dj-01', company_id: COMPANY_ID, status: 'allocated', current_status: 'on_my_way_to_pickup', pickup_location: 'Leicester Hub', delivery_location: 'Coventry Depot', pickup_postcode: 'LE1 1AA', delivery_postcode: 'CV1 2BB', pickup_datetime: '2026-08-03T08:30:00Z', delivery_datetime: '2026-08-03T10:45:00Z', vehicle_type: 'luton_van', created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'dj-02', company_id: COMPANY_ID, status: 'allocated', current_status: 'accepted', pickup_location: 'Birmingham Trade Gate', delivery_location: 'Wolverhampton Estate', pickup_postcode: 'B1 1AA', delivery_postcode: 'WV1 2BB', pickup_datetime: '2026-08-03T12:15:00Z', delivery_datetime: '2026-08-03T14:00:00Z', vehicle_type: 'sprinter', created_at: '2026-08-02T11:00:00Z', updated_at: '2026-08-03T07:00:00Z' },
    { id: 'dj-03', company_id: COMPANY_ID, status: 'allocated', current_status: 'accepted', pickup_location: 'Nottingham Retail Park', delivery_location: 'Derby City Centre', pickup_postcode: 'NG1 1AA', delivery_postcode: 'DE1 2BB', pickup_datetime: '2026-08-03T15:30:00Z', delivery_datetime: '2026-08-03T17:10:00Z', vehicle_type: 'sprinter', created_at: '2026-08-02T12:00:00Z', updated_at: '2026-08-03T07:00:00Z' },
    { id: 'dj-04', company_id: COMPANY_ID, status: 'allocated', current_status: 'accepted', pickup_location: 'Sheffield Industrial', delivery_location: 'Leeds Cross Dock', pickup_postcode: 'S1 1AA', delivery_postcode: 'LS1 2BB', pickup_datetime: '2026-08-04T07:45:00Z', delivery_datetime: '2026-08-04T09:35:00Z', vehicle_type: 'luton_van', created_at: '2026-08-02T13:00:00Z', updated_at: '2026-08-03T07:00:00Z' },
    { id: 'dj-05', company_id: COMPANY_ID, status: 'allocated', current_status: 'accepted', pickup_location: 'Milton Keynes Parts Hub', delivery_location: 'Northampton DC', pickup_postcode: 'MK9 1AA', delivery_postcode: 'NN1 2BB', pickup_datetime: '2026-08-05T09:00:00Z', delivery_datetime: '2026-08-05T10:25:00Z', vehicle_type: 'sprinter', created_at: '2026-08-02T14:00:00Z', updated_at: '2026-08-03T07:00:00Z' },
    { id: 'dj-06', company_id: COMPANY_ID, status: 'delivered', current_status: 'delivered', pickup_location: 'Luton Consolidation', delivery_location: 'Bedford Trade', pickup_postcode: 'LU1 1AA', delivery_postcode: 'MK40 2BB', pickup_datetime: '2026-08-02T08:05:00Z', delivery_datetime: '2026-08-02T09:20:00Z', vehicle_type: 'sprinter', delivery_photos: ['pod1.jpg'], created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-02T09:30:00Z' },
    { id: 'dj-07', company_id: COMPANY_ID, status: 'paid', current_status: 'paid', pickup_location: 'Manchester Freight', delivery_location: 'Stockport Retail', pickup_postcode: 'M1 1AA', delivery_postcode: 'SK1 2BB', pickup_datetime: '2026-08-01T10:10:00Z', delivery_datetime: '2026-08-01T12:40:00Z', vehicle_type: 'luton_van', delivery_photos: ['pod2.jpg'], created_at: '2026-07-31T10:00:00Z', updated_at: '2026-08-01T13:00:00Z' },
  ],
  bids: [],
  invoices: [],
  drivers: [],
  vehicles: [],
  driverDocuments: [
    { id: 'ddoc-1', status: 'active', expiry_date: '2026-08-08T00:00:00Z', doc_type: 'operator_licence', driver_id: 'drv-fixture', vehicle_id: null },
    { id: 'ddoc-2', status: 'active', expiry_date: '2026-08-18T00:00:00Z', doc_type: 'vehicle_insurance', driver_id: 'drv-fixture', vehicle_id: null },
  ],
  vehicleDocuments: [],
  locations: [],
  refresh: async () => { /* no-op in fixture */ },
};

export default function DriverDashboardFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  return (
    <WorkspaceFixtureProvider data={FIXTURE_DATA}>
      <WorkspaceShell
        forcedRole="driver"
        fixtureOverrides={{
          companyName: 'XDrive Owner Driver',
          unreadCount: 2,
          tickerItems: [
            { id: 'dfx-1', label: 'Customer confirmed quote', reference: 'Q-1028', created_at: '2026-08-03T08:55:00.000Z', href: '/driver/quotes' },
            { id: 'dfx-2', label: 'Vehicle insurance expiring soon', reference: 'DOC-22', created_at: '2026-08-03T09:05:00.000Z', href: '/driver/documents' },
          ],
        }}
      >
        <DriverDashboard />
      </WorkspaceShell>
    </WorkspaceFixtureProvider>
  );
}
