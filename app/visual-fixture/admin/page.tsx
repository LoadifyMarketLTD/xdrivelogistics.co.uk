import { notFound } from 'next/navigation';
import WorkspaceFixtureProvider from '../../components/workspace/WorkspaceFixtureProvider';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import { CarrierDashboard } from '../../components/workspace/RoleDashboards';
import type { WorkspaceDataState } from '../../components/workspace/useCompanyWorkspaceData';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

// ---------------------------------------------------------------------------
// Static fixture data — realistic mock for the admin / CarrierDashboard view.
// The companyId is used by CarrierDashboard metrics to filter bids/invoices.
// ---------------------------------------------------------------------------
const COMPANY_ID = 'fixture-carrier-001';

const FIXTURE_DATA: WorkspaceDataState = {
  companyId: COMPANY_ID,
  loading: false,
  error: '',
  jobs: [
    { id: 'j-01', company_id: COMPANY_ID, status: 'allocated', current_status: 'allocated', pickup_location: 'Manchester Hub', delivery_location: 'Sheffield DC', pickup_postcode: 'M60 1AA', delivery_postcode: 'S1 2PP', pickup_datetime: '2026-08-03T09:00:00Z', delivery_datetime: '2026-08-03T11:30:00Z', vehicle_type: 'curtainsider', assigned_driver_id: 'drv-1', created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-03T08:00:00Z' },
    { id: 'j-02', company_id: COMPANY_ID, status: 'allocated', current_status: 'on_my_way_to_pickup', pickup_location: 'Leeds Depot', delivery_location: 'Wakefield Trade', pickup_postcode: 'LS1 4AA', delivery_postcode: 'WF1 2BB', pickup_datetime: '2026-08-03T10:30:00Z', delivery_datetime: '2026-08-03T12:00:00Z', vehicle_type: 'luton_van', assigned_driver_id: 'drv-2', created_at: '2026-08-01T11:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'j-03', company_id: COMPANY_ID, status: 'awarded', current_status: 'awaiting_allocation', pickup_location: 'Sheffield DC', delivery_location: 'Doncaster Retail', pickup_postcode: 'S2 5TT', delivery_postcode: 'DN1 3RR', pickup_datetime: '2026-08-03T11:45:00Z', delivery_datetime: '2026-08-03T13:15:00Z', vehicle_type: 'sprinter', assigned_driver_id: null, created_at: '2026-08-02T08:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'j-04', company_id: COMPANY_ID, status: 'awarded', current_status: 'awaiting_allocation', pickup_location: 'Bradford Parts', delivery_location: 'Halifax Hub', pickup_postcode: 'BD1 1AA', delivery_postcode: 'HX1 2SS', pickup_datetime: '2026-08-03T13:00:00Z', delivery_datetime: '2026-08-03T14:30:00Z', vehicle_type: 'luton_van', assigned_driver_id: null, created_at: '2026-08-02T09:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'j-05', company_id: COMPANY_ID, status: 'delivered', current_status: 'pod_pending', pickup_location: 'Huddersfield Industrial', delivery_location: 'Dewsbury Gate', pickup_postcode: 'HD1 3PP', delivery_postcode: 'WF13 2AA', pickup_datetime: '2026-08-03T08:00:00Z', delivery_datetime: '2026-08-03T09:30:00Z', vehicle_type: 'sprinter', assigned_driver_id: 'drv-3', delivery_photos: [], created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-03T10:00:00Z' },
    { id: 'j-06', company_id: COMPANY_ID, status: 'allocated', current_status: 'allocated', pickup_location: 'Halifax Hub', delivery_location: 'Bradford Parts', pickup_postcode: 'HX1 2SS', delivery_postcode: 'BD1 1AA', pickup_datetime: '2026-08-03T15:00:00Z', delivery_datetime: '2026-08-03T16:30:00Z', vehicle_type: 'curtainsider', assigned_driver_id: 'drv-1', created_at: '2026-08-02T11:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'j-07', company_id: COMPANY_ID, status: 'allocated', current_status: 'accepted', pickup_location: 'Leeds Depot', delivery_location: 'Leeds Centre', pickup_postcode: 'LS1 4AA', delivery_postcode: 'LS1 1BB', pickup_datetime: '2026-08-03T16:00:00Z', delivery_datetime: '2026-08-03T17:00:00Z', vehicle_type: 'sprinter', assigned_driver_id: 'drv-4', created_at: '2026-08-02T12:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    { id: 'j-08', company_id: COMPANY_ID, status: 'allocated', current_status: 'allocated', pickup_location: 'Sheffield Meadowhall', delivery_location: 'Rotherham', pickup_postcode: 'S9 1EA', delivery_postcode: 'S60 1BB', pickup_datetime: '2026-08-03T16:30:00Z', delivery_datetime: '2026-08-03T17:30:00Z', vehicle_type: 'luton_van', assigned_driver_id: 'drv-2', created_at: '2026-08-02T13:00:00Z', updated_at: '2026-08-03T09:00:00Z' },
    // Terminal (completed) — should not appear in attention table
    { id: 'j-09', company_id: COMPANY_ID, status: 'paid', current_status: 'paid', pickup_location: 'Manchester', delivery_location: 'Salford', pickup_postcode: 'M1 1AA', delivery_postcode: 'M5 3PP', pickup_datetime: '2026-08-02T09:00:00Z', delivery_datetime: '2026-08-02T10:00:00Z', vehicle_type: 'sprinter', assigned_driver_id: 'drv-3', delivery_photos: ['pod1.jpg'], created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-02T11:00:00Z' },
    { id: 'j-10', company_id: COMPANY_ID, status: 'delivered', current_status: 'delivered', pickup_location: 'Leeds', delivery_location: 'York', pickup_postcode: 'LS1 1AA', delivery_postcode: 'YO1 9AA', pickup_datetime: '2026-08-02T11:00:00Z', delivery_datetime: '2026-08-02T12:30:00Z', vehicle_type: 'luton_van', assigned_driver_id: 'drv-4', delivery_photos: ['pod2.jpg'], created_at: '2026-08-01T09:00:00Z', updated_at: '2026-08-02T13:00:00Z' },
  ],
  bids: [
    // Submitted bids (company_id = COMPANY_ID) — count as submittedQuotes
    { id: 'b-01', job_id: 'ext-job-1', company_id: COMPANY_ID, status: 'submitted', amount: 412, bid_price_gbp: 412, created_at: '2026-08-03T07:00:00Z', message: 'Ready for same day collection' },
    { id: 'b-02', job_id: 'ext-job-2', company_id: COMPANY_ID, status: 'submitted', amount: 286, bid_price_gbp: 286, created_at: '2026-08-03T07:30:00Z', message: null },
    { id: 'b-03', job_id: 'ext-job-3', company_id: COMPANY_ID, status: 'submitted', amount: 538, bid_price_gbp: 538, created_at: '2026-08-03T08:00:00Z', message: 'Curtainsider available' },
    // Accepted bids — count as won + acceptedRevenue
    { id: 'b-04', job_id: 'j-01', company_id: COMPANY_ID, status: 'accepted', amount: 620, bid_price_gbp: 620, created_at: '2026-08-02T14:00:00Z', message: null },
    { id: 'b-05', job_id: 'j-02', company_id: COMPANY_ID, status: 'accepted', amount: 380, bid_price_gbp: 380, created_at: '2026-08-02T15:00:00Z', message: null },
    { id: 'b-06', job_id: 'j-06', company_id: COMPANY_ID, status: 'accepted', amount: 510, bid_price_gbp: 510, created_at: '2026-08-02T16:00:00Z', message: null },
    { id: 'b-07', job_id: 'j-07', company_id: COMPANY_ID, status: 'accepted', amount: 290, bid_price_gbp: 290, created_at: '2026-08-02T17:00:00Z', message: null },
    { id: 'b-08', job_id: 'j-08', company_id: COMPANY_ID, status: 'accepted', amount: 340, bid_price_gbp: 340, created_at: '2026-08-02T18:00:00Z', message: null },
    { id: 'b-09', job_id: 'j-03', company_id: COMPANY_ID, status: 'accepted', amount: 450, bid_price_gbp: 450, created_at: '2026-08-02T19:00:00Z', message: null },
    // Rejected bid — recent quote activity
    { id: 'b-10', job_id: 'ext-job-4', company_id: COMPANY_ID, status: 'rejected', amount: 194, bid_price_gbp: 194, created_at: '2026-08-01T16:50:00Z', message: null },
  ],
  invoices: [
    { id: 'inv-01', company_id: COMPANY_ID, status: 'invoiced', payment_status: 'unpaid', amount: 620, created_at: '2026-08-02T12:00:00Z', job_id: 'j-01', invoice_number: 'INV-2241', due_date: '2026-08-17T00:00:00Z' },
    { id: 'inv-02', company_id: COMPANY_ID, status: 'invoiced', payment_status: 'unpaid', amount: 380, created_at: '2026-08-02T13:00:00Z', job_id: 'j-02', invoice_number: 'INV-2242', due_date: '2026-08-01T00:00:00Z' }, // overdue
    { id: 'inv-03', company_id: COMPANY_ID, status: 'paid', payment_status: 'paid', amount: 510, created_at: '2026-08-01T10:00:00Z', job_id: 'j-06', invoice_number: 'INV-2198', due_date: '2026-08-16T00:00:00Z' },
    { id: 'inv-04', company_id: COMPANY_ID, status: 'paid', payment_status: 'paid', amount: 290, created_at: '2026-08-01T11:00:00Z', job_id: 'j-07', invoice_number: 'INV-2199', due_date: '2026-08-16T00:00:00Z' },
    { id: 'inv-05', company_id: COMPANY_ID, status: 'invoiced', payment_status: 'unpaid', amount: 340, created_at: '2026-08-02T14:00:00Z', job_id: 'j-08', invoice_number: 'INV-2243', due_date: '2026-08-17T00:00:00Z' },
  ],
  drivers: [
    { id: 'drv-1', display_name: 'James Patel', email: 'j.patel@yorkshirefreight.co.uk', phone: '07700 900001', status: 'active', availability_status: 'busy' },
    { id: 'drv-2', display_name: 'Sarah Khan', email: 's.khan@yorkshirefreight.co.uk', phone: '07700 900002', status: 'active', availability_status: 'busy' },
    { id: 'drv-3', display_name: 'Tom Hughes', email: 't.hughes@yorkshirefreight.co.uk', phone: '07700 900003', status: 'active', availability_status: 'available' },
    { id: 'drv-4', display_name: 'Lisa Chen', email: 'l.chen@yorkshirefreight.co.uk', phone: '07700 900004', status: 'active', availability_status: 'available' },
    { id: 'drv-5', display_name: 'Mark Wilson', email: 'm.wilson@yorkshirefreight.co.uk', phone: '07700 900005', status: 'active', availability_status: 'available' },
    { id: 'drv-6', display_name: 'Amy Brooks', email: 'a.brooks@yorkshirefreight.co.uk', phone: '07700 900006', status: 'inactive', availability_status: 'offline' },
  ],
  vehicles: [
    { id: 'veh-1', reg_plate: 'YF03 RXK', type: 'curtainsider', make: 'DAF', model: 'CF', assigned_driver_id: 'drv-1' },
    { id: 'veh-2', reg_plate: 'YF14 TQM', type: 'luton_van', make: 'Ford', model: 'Transit', assigned_driver_id: 'drv-2' },
    { id: 'veh-3', reg_plate: 'YF16 ABD', type: 'sprinter', make: 'Mercedes', model: 'Sprinter', assigned_driver_id: 'drv-3' },
    { id: 'veh-4', reg_plate: 'YF19 KLP', type: 'sprinter', make: 'Mercedes', model: 'Sprinter', assigned_driver_id: null },
    { id: 'veh-5', reg_plate: 'YF21 NMR', type: 'luton_van', make: 'Iveco', model: 'Daily', assigned_driver_id: null },
    { id: 'veh-6', reg_plate: 'YF22 XST', type: 'curtainsider', make: 'Volvo', model: 'FH', assigned_driver_id: null },
  ],
  driverDocuments: [
    { id: 'ddoc-1', status: 'active', expiry_date: '2026-08-09T00:00:00Z', doc_type: 'driver_cpc', driver_id: 'drv-1', vehicle_id: null },
    { id: 'ddoc-2', status: 'active', expiry_date: '2026-08-21T00:00:00Z', doc_type: 'driving_licence', driver_id: 'drv-2', vehicle_id: null },
    { id: 'ddoc-3', status: 'active', expiry_date: '2026-10-15T00:00:00Z', doc_type: 'driver_cpc', driver_id: 'drv-3', vehicle_id: null },
  ],
  vehicleDocuments: [
    { id: 'vdoc-1', status: 'active', expiry_date: '2026-08-17T00:00:00Z', doc_type: 'vehicle_insurance', driver_id: null, vehicle_id: 'veh-1' },
    { id: 'vdoc-2', status: 'active', expiry_date: '2026-09-30T00:00:00Z', doc_type: 'mot', driver_id: null, vehicle_id: 'veh-2' },
  ],
  locations: [],
  refresh: async () => { /* no-op in fixture */ },
};

export default function AdminDashboardFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  return (
    <WorkspaceFixtureProvider data={FIXTURE_DATA}>
      <WorkspaceShell
        forcedRole="company_admin"
        fixtureOverrides={{
          companyName: 'Yorkshire Freight Ltd',
          unreadCount: 5,
          tickerItems: [
            { id: 'fx-1', label: 'Quote accepted — Leeds to Wakefield', reference: 'Q-7821', created_at: '2026-08-03T08:20:00.000Z', href: '/admin/quotes' },
            { id: 'fx-2', label: 'New load posted on marketplace', reference: 'MKT-3304', created_at: '2026-08-03T08:45:00.000Z', href: '/admin/marketplace' },
            { id: 'fx-3', label: 'Driver document expiring in 6 days', reference: 'DOC-18', created_at: '2026-08-03T09:00:00.000Z', href: '/admin/documents/expiry' },
          ],
        }}
      >
        <CarrierDashboard />
      </WorkspaceShell>
    </WorkspaceFixtureProvider>
  );
}
