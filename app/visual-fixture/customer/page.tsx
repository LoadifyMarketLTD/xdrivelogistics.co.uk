'use client';

import WorkspaceFixtureProvider from '../../components/workspace/WorkspaceFixtureProvider';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import { CustomerDashboard } from '../../customer/CustomerWorkspaceModules';
import type { WorkspaceDataState } from '../../components/workspace/useCompanyWorkspaceData';

const COMPANY_ID = 'fixture-customer-001';

const FIXTURE_DATA: WorkspaceDataState = {
  companyId: COMPANY_ID,
  loading: false,
  error: '',
  jobs: [
    { id: 'cj-01', company_id: COMPANY_ID, status: 'posted', current_status: 'posted', pickup_location: 'Coventry Parts', delivery_location: 'Rugby DC', pickup_postcode: 'CV1 1AA', delivery_postcode: 'CV21 2BB', pickup_datetime: '2026-08-04T09:00:00Z', delivery_datetime: '2026-08-04T11:00:00Z', vehicle_type: 'sprinter', client_name: 'Midlands Retail Group', created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'cj-02', company_id: COMPANY_ID, status: 'posted', current_status: 'posted', pickup_location: 'Nuneaton Hub', delivery_location: 'Bedworth Retail', pickup_postcode: 'CV11 4AA', delivery_postcode: 'CV12 2BB', pickup_datetime: '2026-08-04T10:00:00Z', delivery_datetime: '2026-08-04T11:30:00Z', vehicle_type: 'luton_van', client_name: 'Midlands Retail Group', created_at: '2026-08-02T11:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'cj-03', company_id: COMPANY_ID, status: 'awarded', current_status: 'allocated', pickup_location: 'Leamington Spa', delivery_location: 'Kenilworth', pickup_postcode: 'CV32 4AA', delivery_postcode: 'CV8 2BB', pickup_datetime: '2026-08-03T10:30:00Z', delivery_datetime: '2026-08-03T12:00:00Z', vehicle_type: 'sprinter', client_name: 'Midlands Retail Group', created_at: '2026-08-02T12:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'cj-04', company_id: COMPANY_ID, status: 'allocated', current_status: 'on_my_way_to_delivery', pickup_location: 'Warwick Gate', delivery_location: 'Stratford Trade', pickup_postcode: 'CV34 4AA', delivery_postcode: 'CV37 2BB', pickup_datetime: '2026-08-03T08:00:00Z', delivery_datetime: '2026-08-03T10:00:00Z', vehicle_type: 'luton_van', client_name: 'Midlands Retail Group', created_at: '2026-08-02T08:00:00Z', updated_at: '2026-08-03T09:30:00Z' },
    { id: 'cj-05', company_id: COMPANY_ID, status: 'allocated', current_status: 'loaded', pickup_location: 'Alcester DC', delivery_location: 'Redditch Hub', pickup_postcode: 'B49 5AA', delivery_postcode: 'B97 6BB', pickup_datetime: '2026-08-03T06:00:00Z', delivery_datetime: '2026-08-03T08:00:00Z', vehicle_type: 'sprinter', client_name: 'Midlands Retail Group', created_at: '2026-08-02T07:00:00Z', updated_at: '2026-08-03T07:30:00Z' },
    { id: 'cj-06', company_id: COMPANY_ID, status: 'delivered', current_status: 'delivered', pickup_location: 'Birmingham Hub', delivery_location: 'Solihull DC', pickup_postcode: 'B1 1AA', delivery_postcode: 'B91 2BB', pickup_datetime: '2026-08-02T09:00:00Z', delivery_datetime: '2026-08-02T10:30:00Z', vehicle_type: 'curtainsider', client_name: 'Midlands Retail Group', delivery_photos: ['pod1.jpg', 'pod2.jpg'], created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-02T11:00:00Z' },
    { id: 'cj-07', company_id: COMPANY_ID, status: 'delivered', current_status: 'delivered', pickup_location: 'Wolverhampton Gate', delivery_location: 'Dudley Trade', pickup_postcode: 'WV1 1AA', delivery_postcode: 'DY1 2BB', pickup_datetime: '2026-08-02T11:00:00Z', delivery_datetime: '2026-08-02T12:30:00Z', vehicle_type: 'luton_van', client_name: 'Midlands Retail Group', delivery_photos: ['pod3.jpg'], created_at: '2026-08-01T09:00:00Z', updated_at: '2026-08-02T13:00:00Z' },
    { id: 'cj-08', company_id: COMPANY_ID, status: 'delivered', current_status: 'delivered', pickup_location: 'Derby DC', delivery_location: 'Nottingham Hub', pickup_postcode: 'DE1 1AA', delivery_postcode: 'NG1 2BB', pickup_datetime: '2026-08-01T09:00:00Z', delivery_datetime: '2026-08-01T10:30:00Z', vehicle_type: 'sprinter', client_name: 'Midlands Retail Group', delivery_photos: ['pod4.jpg'], created_at: '2026-07-31T10:00:00Z', updated_at: '2026-08-01T11:00:00Z' },
    { id: 'cj-09', company_id: COMPANY_ID, status: 'draft', current_status: 'draft', pickup_location: 'Stoke-on-Trent', delivery_location: 'Stafford Gate', pickup_postcode: 'ST1 1AA', delivery_postcode: 'ST16 2BB', pickup_datetime: '2026-08-06T09:00:00Z', delivery_datetime: '2026-08-06T11:00:00Z', vehicle_type: 'luton_van', client_name: 'Midlands Retail Group', created_at: '2026-08-03T09:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
  ],
  bids: [
    // Submitted bids on customer's jobs — quotes received
    { id: 'cb-01', job_id: 'cj-01', company_id: 'carrier-a', status: 'submitted', amount: 342, bid_price_gbp: 342, created_at: '2026-08-03T07:00:00Z' },
    { id: 'cb-02', job_id: 'cj-01', company_id: 'carrier-b', status: 'submitted', amount: 380, bid_price_gbp: 380, created_at: '2026-08-03T07:30:00Z' },
    { id: 'cb-03', job_id: 'cj-01', company_id: 'carrier-c', status: 'submitted', amount: 395, bid_price_gbp: 395, created_at: '2026-08-03T08:00:00Z' },
    { id: 'cb-04', job_id: 'cj-02', company_id: 'carrier-a', status: 'submitted', amount: 286, bid_price_gbp: 286, created_at: '2026-08-03T07:15:00Z' },
    { id: 'cb-05', job_id: 'cj-02', company_id: 'carrier-d', status: 'submitted', amount: 310, bid_price_gbp: 310, created_at: '2026-08-03T07:45:00Z' },
    // Accepted bids
    { id: 'cb-06', job_id: 'cj-03', company_id: 'carrier-b', status: 'accepted', amount: 420, bid_price_gbp: 420, created_at: '2026-08-02T14:00:00Z' },
    { id: 'cb-07', job_id: 'cj-04', company_id: 'carrier-c', status: 'accepted', amount: 560, bid_price_gbp: 560, created_at: '2026-08-02T15:00:00Z' },
  ],
  invoices: [
    { id: 'cinv-01', company_id: COMPANY_ID, buyer_company_id: COMPANY_ID, status: 'invoiced', payment_status: 'unpaid', amount: 1240, created_at: '2026-08-02T12:00:00Z', invoice_number: 'INV-2241', due_date: '2026-08-10T00:00:00Z', delivery_state: 'sent', client_name: 'Midlands Retail Group' },
    { id: 'cinv-02', company_id: COMPANY_ID, buyer_company_id: COMPANY_ID, status: 'invoiced', payment_status: 'unpaid', amount: 890, created_at: '2026-08-02T13:00:00Z', invoice_number: 'INV-2198', due_date: '2026-08-05T00:00:00Z', delivery_state: 'sent', client_name: 'Midlands Retail Group' },
    { id: 'cinv-03', company_id: COMPANY_ID, buyer_company_id: COMPANY_ID, status: 'invoiced', payment_status: 'unpaid', amount: 620, created_at: '2026-08-02T14:00:00Z', invoice_number: 'INV-2243', due_date: '2026-08-18T00:00:00Z', delivery_state: 'sent', client_name: 'Midlands Retail Group' },
    { id: 'cinv-04', company_id: COMPANY_ID, buyer_company_id: COMPANY_ID, status: 'paid', payment_status: 'paid', amount: 540, created_at: '2026-08-01T10:00:00Z', invoice_number: 'INV-2156', due_date: '2026-08-16T00:00:00Z', delivery_state: 'sent', client_name: 'Midlands Retail Group' },
  ],
  drivers: [],
  vehicles: [],
  driverDocuments: [],
  vehicleDocuments: [],
  locations: [],
  refresh: async () => { /* no-op in fixture */ },
};

export default function CustomerDashboardFixturePage() {
  return (
    <WorkspaceFixtureProvider data={FIXTURE_DATA}>
      <WorkspaceShell
        forcedRole="customer"
        fixtureOverrides={{
          companyName: 'Midlands Retail Group',
          unreadCount: 4,
          tickerItems: [
            { id: 'cfx-1', label: 'Carrier quote received — Coventry to Rugby', reference: 'Q-5512', created_at: '2026-08-03T07:45:00.000Z', href: '/customer/quotes' },
            { id: 'cfx-2', label: 'Delivery in progress — Warwick to Stratford', reference: 'J-3308', created_at: '2026-08-03T08:30:00.000Z', href: '/customer/deliveries' },
          ],
        }}
      >
        <CustomerDashboard />
      </WorkspaceShell>
    </WorkspaceFixtureProvider>
  );
}
