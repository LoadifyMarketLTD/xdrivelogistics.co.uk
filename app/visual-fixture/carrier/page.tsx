'use client';

import WorkspaceFixtureProvider from '../../components/workspace/WorkspaceFixtureProvider';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import { CarrierDashboard } from '../../components/workspace/RoleDashboards';
import type { WorkspaceDataState } from '../../components/workspace/useCompanyWorkspaceData';

// Carrier-specific fixture data (different company, routes and branding from admin fixture)
const COMPANY_ID = 'fixture-carrier-south-001';

const FIXTURE_DATA: WorkspaceDataState = {
  companyId: COMPANY_ID,
  loading: false,
  error: '',
  jobs: [
    { id: 'cj-01', company_id: COMPANY_ID, status: 'allocated', current_status: 'allocated', pickup_location: 'Swindon Hub', delivery_location: 'Oxford Trade', pickup_postcode: 'SN1 1AA', delivery_postcode: 'OX1 2BB', pickup_datetime: '2026-08-03T07:30:00Z', delivery_datetime: '2026-08-03T09:30:00Z', vehicle_type: 'curtainsider', assigned_driver_id: 'cdrv-1', created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-03T07:00:00Z' },
    { id: 'cj-02', company_id: COMPANY_ID, status: 'allocated', current_status: 'on_my_way_to_pickup', pickup_location: 'Reading Gate', delivery_location: 'Basingstoke DC', pickup_postcode: 'RG1 1AA', delivery_postcode: 'RG21 2BB', pickup_datetime: '2026-08-03T09:00:00Z', delivery_datetime: '2026-08-03T11:00:00Z', vehicle_type: 'luton_van', assigned_driver_id: 'cdrv-2', created_at: '2026-08-01T11:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'cj-03', company_id: COMPANY_ID, status: 'awarded', current_status: 'awaiting_allocation', pickup_location: 'Winchester Depot', delivery_location: 'Eastleigh Retail', pickup_postcode: 'SO23 1AA', delivery_postcode: 'SO50 2BB', pickup_datetime: '2026-08-03T10:15:00Z', delivery_datetime: '2026-08-03T11:45:00Z', vehicle_type: 'sprinter', assigned_driver_id: null, created_at: '2026-08-02T08:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'cj-04', company_id: COMPANY_ID, status: 'awarded', current_status: 'awaiting_allocation', pickup_location: 'Southampton Quay', delivery_location: 'Portsmouth Hub', pickup_postcode: 'SO14 1AA', delivery_postcode: 'PO1 2BB', pickup_datetime: '2026-08-03T11:30:00Z', delivery_datetime: '2026-08-03T13:00:00Z', vehicle_type: 'luton_van', assigned_driver_id: null, created_at: '2026-08-02T09:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'cj-05', company_id: COMPANY_ID, status: 'delivered', current_status: 'pod_pending', pickup_location: 'Salisbury Industrial', delivery_location: 'Andover Gate', pickup_postcode: 'SP1 1AA', delivery_postcode: 'SP10 2BB', pickup_datetime: '2026-08-03T08:00:00Z', delivery_datetime: '2026-08-03T09:30:00Z', vehicle_type: 'sprinter', assigned_driver_id: 'cdrv-3', delivery_photos: [], created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-03T10:00:00Z' },
    { id: 'cj-06', company_id: COMPANY_ID, status: 'allocated', current_status: 'allocated', pickup_location: 'Andover Hub', delivery_location: 'Newbury Trade', pickup_postcode: 'SP10 1AA', delivery_postcode: 'RG14 2BB', pickup_datetime: '2026-08-03T14:30:00Z', delivery_datetime: '2026-08-03T16:00:00Z', vehicle_type: 'curtainsider', assigned_driver_id: 'cdrv-1', created_at: '2026-08-02T11:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'cj-07', company_id: COMPANY_ID, status: 'paid', current_status: 'paid', pickup_location: 'Southampton', delivery_location: 'Fareham', pickup_postcode: 'SO14 1AA', delivery_postcode: 'PO16 2BB', pickup_datetime: '2026-08-02T09:00:00Z', delivery_datetime: '2026-08-02T10:30:00Z', vehicle_type: 'sprinter', delivery_photos: ['pod1.jpg'], created_at: '2026-08-01T09:00:00Z', updated_at: '2026-08-02T11:00:00Z' },
  ],
  bids: [
    { id: 'cb-01', job_id: 'ext-job-a', company_id: COMPANY_ID, status: 'submitted', amount: 318, bid_price_gbp: 318, created_at: '2026-08-03T07:00:00Z', message: null },
    { id: 'cb-02', job_id: 'ext-job-b', company_id: COMPANY_ID, status: 'submitted', amount: 204, bid_price_gbp: 204, created_at: '2026-08-03T07:30:00Z', message: null },
    { id: 'cb-03', job_id: 'cj-01', company_id: COMPANY_ID, status: 'accepted', amount: 560, bid_price_gbp: 560, created_at: '2026-08-02T14:00:00Z', message: null },
    { id: 'cb-04', job_id: 'cj-02', company_id: COMPANY_ID, status: 'accepted', amount: 380, bid_price_gbp: 380, created_at: '2026-08-02T15:00:00Z', message: null },
    { id: 'cb-05', job_id: 'cj-06', company_id: COMPANY_ID, status: 'accepted', amount: 420, bid_price_gbp: 420, created_at: '2026-08-02T16:00:00Z', message: null },
    { id: 'cb-06', job_id: 'ext-job-c', company_id: COMPANY_ID, status: 'rejected', amount: 148, bid_price_gbp: 148, created_at: '2026-08-01T16:00:00Z', message: null },
  ],
  invoices: [
    { id: 'cinv-01', company_id: COMPANY_ID, status: 'invoiced', payment_status: 'unpaid', amount: 560, created_at: '2026-08-02T12:00:00Z', invoice_number: 'SH-INV-441', due_date: '2026-08-17T00:00:00Z' },
    { id: 'cinv-02', company_id: COMPANY_ID, status: 'invoiced', payment_status: 'unpaid', amount: 380, created_at: '2026-08-02T13:00:00Z', invoice_number: 'SH-INV-442', due_date: '2026-08-01T00:00:00Z' }, // overdue
    { id: 'cinv-03', company_id: COMPANY_ID, status: 'paid', payment_status: 'paid', amount: 420, created_at: '2026-08-01T10:00:00Z', invoice_number: 'SH-INV-398', due_date: '2026-08-16T00:00:00Z' },
  ],
  drivers: [
    { id: 'cdrv-1', display_name: 'Kevin Hughes', email: 'k.hughes@southernhaulage.co.uk', phone: '07700 900101', status: 'active', availability_status: 'busy' },
    { id: 'cdrv-2', display_name: 'Diane Morris', email: 'd.morris@southernhaulage.co.uk', phone: '07700 900102', status: 'active', availability_status: 'busy' },
    { id: 'cdrv-3', display_name: 'Paul Garrett', email: 'p.garrett@southernhaulage.co.uk', phone: '07700 900103', status: 'active', availability_status: 'available' },
    { id: 'cdrv-4', display_name: 'Emma Sutton', email: 'e.sutton@southernhaulage.co.uk', phone: '07700 900104', status: 'active', availability_status: 'available' },
    { id: 'cdrv-5', display_name: 'Rob Finch', email: 'r.finch@southernhaulage.co.uk', phone: '07700 900105', status: 'inactive', availability_status: 'offline' },
  ],
  vehicles: [
    { id: 'cveh-1', reg_plate: 'SH14 TXR', type: 'curtainsider', make: 'Volvo', model: 'FH', assigned_driver_id: 'cdrv-1' },
    { id: 'cveh-2', reg_plate: 'SH16 ARP', type: 'luton_van', make: 'Ford', model: 'Transit', assigned_driver_id: 'cdrv-2' },
    { id: 'cveh-3', reg_plate: 'SH19 MKP', type: 'sprinter', make: 'Mercedes', model: 'Sprinter', assigned_driver_id: null },
    { id: 'cveh-4', reg_plate: 'SH21 QRW', type: 'sprinter', make: 'Mercedes', model: 'Sprinter', assigned_driver_id: null },
  ],
  driverDocuments: [
    { id: 'cddoc-1', status: 'active', expiry_date: '2026-08-12T00:00:00Z', doc_type: 'driver_cpc', driver_id: 'cdrv-1', vehicle_id: null },
  ],
  vehicleDocuments: [
    { id: 'cvdoc-1', status: 'active', expiry_date: '2026-08-20T00:00:00Z', doc_type: 'vehicle_insurance', driver_id: null, vehicle_id: 'cveh-1' },
  ],
  locations: [],
  refresh: async () => { /* no-op in fixture */ },
};

export default function CarrierDashboardFixturePage() {
  return (
    <WorkspaceFixtureProvider data={FIXTURE_DATA}>
      <WorkspaceShell
        forcedRole="carrier_admin"
        fixtureOverrides={{
          companyName: 'Southern Haulage Ltd',
          unreadCount: 3,
          tickerItems: [
            { id: 'carfx-1', label: 'Quote accepted — Swindon to Chippenham', reference: 'Q-6614', created_at: '2026-08-03T08:10:00.000Z', href: '/carrier/quotes' },
            { id: 'carfx-2', label: 'Driver document expiring — K. Hughes', reference: 'DOC-31', created_at: '2026-08-03T09:10:00.000Z', href: '/carrier/documents/expiry' },
          ],
        }}
      >
        <CarrierDashboard />
      </WorkspaceShell>
    </WorkspaceFixtureProvider>
  );
}
