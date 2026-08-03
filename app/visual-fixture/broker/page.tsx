import { notFound } from 'next/navigation';
import WorkspaceFixtureProvider from '../../components/workspace/WorkspaceFixtureProvider';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import { BrokerDashboard } from '../../broker/BrokerWorkspaceModules';
import type { WorkspaceDataState } from '../../components/workspace/useCompanyWorkspaceData';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

const COMPANY_ID = 'fixture-broker-001';

const FIXTURE_DATA: WorkspaceDataState = {
  companyId: COMPANY_ID,
  loading: false,
  error: '',
  jobs: [
    { id: 'bj-01', company_id: COMPANY_ID, status: 'posted', current_status: 'posted', pickup_location: 'Chester Gate', delivery_location: 'Ellesmere Port', pickup_postcode: 'CH1 1AA', delivery_postcode: 'CH65 2BB', pickup_datetime: '2026-08-04T09:00:00Z', delivery_datetime: '2026-08-04T11:00:00Z', vehicle_type: 'sprinter', budget_amount: 520, client_name: 'Mersey Parts', created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'bj-02', company_id: COMPANY_ID, status: 'posted', current_status: 'posted', pickup_location: 'Wrexham Industrial', delivery_location: 'Deeside Trade', pickup_postcode: 'LL13 7AA', delivery_postcode: 'CH5 2BB', pickup_datetime: '2026-08-04T10:30:00Z', delivery_datetime: '2026-08-04T12:00:00Z', vehicle_type: 'luton_van', budget_amount: 680, client_name: 'Border Logistics', created_at: '2026-08-02T11:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'bj-03', company_id: COMPANY_ID, status: 'posted', current_status: 'posted', pickup_location: 'Macclesfield Hub', delivery_location: 'Congleton DC', pickup_postcode: 'SK10 1AA', delivery_postcode: 'CW12 2BB', pickup_datetime: '2026-08-04T11:00:00Z', delivery_datetime: '2026-08-04T12:30:00Z', vehicle_type: 'sprinter', budget_amount: 310, client_name: 'Peak Retail Ltd', created_at: '2026-08-02T12:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'bj-04', company_id: COMPANY_ID, status: 'allocated', current_status: 'on_my_way_to_pickup', pickup_location: 'Liverpool Central', delivery_location: 'Manchester Piccadilly', pickup_postcode: 'L1 1AA', delivery_postcode: 'M1 2BB', pickup_datetime: '2026-08-03T08:00:00Z', delivery_datetime: '2026-08-03T09:30:00Z', vehicle_type: 'curtainsider', client_name: 'Nexus Parts Ltd', created_at: '2026-08-02T08:00:00Z', updated_at: '2026-08-03T07:30:00Z' },
    { id: 'bj-05', company_id: COMPANY_ID, status: 'allocated', current_status: 'at_pickup', pickup_location: 'Warrington DC', delivery_location: 'Bolton Trade', pickup_postcode: 'WA1 1AA', delivery_postcode: 'BL1 2BB', pickup_datetime: '2026-08-03T09:30:00Z', delivery_datetime: '2026-08-03T11:00:00Z', vehicle_type: 'luton_van', client_name: 'Retail Freight Co', created_at: '2026-08-02T09:00:00Z', updated_at: '2026-08-03T08:30:00Z' },
    { id: 'bj-06', company_id: COMPANY_ID, status: 'allocated', current_status: 'loaded', pickup_location: 'Salford Quays', delivery_location: 'Trafford Park', pickup_postcode: 'M5 2AA', delivery_postcode: 'M17 1BB', pickup_datetime: '2026-08-03T10:00:00Z', delivery_datetime: '2026-08-03T11:30:00Z', vehicle_type: 'sprinter', client_name: 'Summit Logistics', created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'bj-07', company_id: COMPANY_ID, status: 'allocated', current_status: 'on_my_way_to_delivery', pickup_location: 'Stockport Hub', delivery_location: 'Hyde Industrial', pickup_postcode: 'SK1 1AA', delivery_postcode: 'SK14 2BB', pickup_datetime: '2026-08-03T11:15:00Z', delivery_datetime: '2026-08-03T12:30:00Z', vehicle_type: 'luton_van', client_name: 'Atlas Distribution', created_at: '2026-08-02T11:00:00Z', updated_at: '2026-08-03T10:00:00Z' },
    { id: 'bj-08', company_id: COMPANY_ID, status: 'delivered', current_status: 'delivered', pickup_location: 'Oldham Depot', delivery_location: 'Rochdale Hub', pickup_postcode: 'OL1 1AA', delivery_postcode: 'OL16 2BB', pickup_datetime: '2026-08-03T12:00:00Z', delivery_datetime: '2026-08-03T13:30:00Z', vehicle_type: 'sprinter', client_name: 'Peak Courier', delivery_photos: [], created_at: '2026-08-02T12:00:00Z', updated_at: '2026-08-03T13:30:00Z' },
    { id: 'bj-09', company_id: COMPANY_ID, status: 'draft', current_status: 'draft', pickup_location: 'Bury Trade', delivery_location: 'Ramsbottom Retail', pickup_postcode: 'BL9 1AA', delivery_postcode: 'BL0 2BB', pickup_datetime: '2026-08-05T09:00:00Z', delivery_datetime: '2026-08-05T10:30:00Z', vehicle_type: 'luton_van', client_name: 'Northern Freight', created_at: '2026-08-03T08:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'bj-10', company_id: COMPANY_ID, status: 'draft', current_status: 'draft', pickup_location: 'Bolton Central', delivery_location: 'Wigan Gate', pickup_postcode: 'BL1 3AA', delivery_postcode: 'WN1 2BB', pickup_datetime: '2026-08-05T11:00:00Z', delivery_datetime: '2026-08-05T12:30:00Z', vehicle_type: 'sprinter', client_name: 'West Lancs Parts', created_at: '2026-08-03T09:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
  ],
  bids: [
    // Submitted bids on broker's jobs — carrier quotes received
    { id: 'bb-01', job_id: 'bj-01', company_id: 'carrier-ext-1', status: 'submitted', amount: 388, bid_price_gbp: 388, created_at: '2026-08-03T07:00:00Z' },
    { id: 'bb-02', job_id: 'bj-01', company_id: 'carrier-ext-2', status: 'submitted', amount: 412, bid_price_gbp: 412, created_at: '2026-08-03T07:30:00Z' },
    { id: 'bb-03', job_id: 'bj-01', company_id: 'carrier-ext-3', status: 'submitted', amount: 445, bid_price_gbp: 445, created_at: '2026-08-03T08:00:00Z' },
    { id: 'bb-04', job_id: 'bj-02', company_id: 'carrier-ext-1', status: 'submitted', amount: 495, bid_price_gbp: 495, created_at: '2026-08-03T07:15:00Z' },
    { id: 'bb-05', job_id: 'bj-02', company_id: 'carrier-ext-4', status: 'submitted', amount: 520, bid_price_gbp: 520, created_at: '2026-08-03T07:45:00Z' },
    { id: 'bb-06', job_id: 'bj-03', company_id: 'carrier-ext-2', status: 'submitted', amount: 226, bid_price_gbp: 226, created_at: '2026-08-03T08:10:00Z' },
    { id: 'bb-07', job_id: 'bj-03', company_id: 'carrier-ext-3', status: 'submitted', amount: 248, bid_price_gbp: 248, created_at: '2026-08-03T08:30:00Z' },
    { id: 'bb-08', job_id: 'bj-03', company_id: 'carrier-ext-5', status: 'submitted', amount: 262, bid_price_gbp: 262, created_at: '2026-08-03T08:45:00Z' },
    { id: 'bb-09', job_id: 'bj-03', company_id: 'carrier-ext-6', status: 'submitted', amount: 278, bid_price_gbp: 278, created_at: '2026-08-03T09:00:00Z' },
    // Accepted bid on active job
    { id: 'bb-10', job_id: 'bj-04', company_id: 'carrier-ext-1', status: 'accepted', amount: 580, bid_price_gbp: 580, created_at: '2026-08-02T14:00:00Z' },
    { id: 'bb-11', job_id: 'bj-08', company_id: 'carrier-ext-2', status: 'accepted', amount: 320, bid_price_gbp: 320, created_at: '2026-08-02T15:00:00Z' },
  ],
  invoices: [
    { id: 'binv-01', company_id: COMPANY_ID, supplier_company_id: 'carrier-ext-1', status: 'invoiced', payment_status: 'unpaid', amount: 620, net_amount: 516.67, vat_amount: 103.33, created_at: '2026-08-02T12:00:00Z', invoice_number: 'INV-8810', due_date: '2026-08-17T00:00:00Z', client_name: 'Nexus Parts Ltd' },
    { id: 'binv-02', company_id: COMPANY_ID, supplier_company_id: 'carrier-ext-2', status: 'invoiced', payment_status: 'unpaid', amount: 890, net_amount: 741.67, vat_amount: 148.33, created_at: '2026-08-02T13:00:00Z', invoice_number: 'INV-8811', due_date: '2026-08-01T00:00:00Z', client_name: 'Retail Freight Co' },
    { id: 'binv-03', company_id: COMPANY_ID, status: 'paid', payment_status: 'paid', amount: 1240, net_amount: 1033.33, vat_amount: 206.67, created_at: '2026-08-01T10:00:00Z', invoice_number: 'INV-8790', due_date: '2026-08-16T00:00:00Z', delivery_state: 'sent', client_name: 'Summit Logistics' },
  ],
  drivers: [],
  vehicles: [],
  driverDocuments: [],
  vehicleDocuments: [],
  locations: [],
  refresh: async () => { /* no-op in fixture */ },
};

export default function BrokerDashboardFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  return (
    <WorkspaceFixtureProvider data={FIXTURE_DATA}>
      <WorkspaceShell
        forcedRole="broker"
        fixtureOverrides={{
          companyName: 'Northwest Broker Services',
          unreadCount: 7,
          tickerItems: [
            { id: 'bfx-1', label: 'Carrier quote received — Chester to Deeside', reference: 'Q-4421', created_at: '2026-08-03T07:50:00.000Z', href: '/broker/bids' },
            { id: 'bfx-2', label: 'Customer load posted — Macclesfield to Congleton', reference: 'L-8832', created_at: '2026-08-03T08:20:00.000Z', href: '/broker/loads' },
          ],
        }}
      >
        <BrokerDashboard />
      </WorkspaceShell>
    </WorkspaceFixtureProvider>
  );
}
