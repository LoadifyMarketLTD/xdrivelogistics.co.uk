'use client';

/**
 * JobsVisualFixture
 *
 * Deterministic fixture component for the Jobs operational surface.
 * Renders JobsOperationalTable with 12 static job records covering all
 * required scenarios: draft, posted, allocated, terminal, private/public
 * visibility, assigned/unassigned drivers, and full operational detail fields.
 *
 * Used by: app/visual-fixture/jobs/page.tsx
 * Validated by: e2e/jobs-visual-gate.spec.ts
 * Reference: docs/ui/cx/jobs.md
 */

import { useMemo, useState } from 'react';
import {
  filterJobsByDriver,
  type JobRow,
} from '../../../lib/jobs/jobOperationalContract';
import { JobsOperationalTable } from './JobsOperationalTable';
import { ExchangeKpiStrip, KpiCard, PageFrame } from './WorkspaceUI';
import WorkspaceShell from './WorkspaceShell';

/* ── Fixture drivers ─────────────────────────────────────────────────────── */

/** Deterministic driver records for the visual fixture. */
export const FIXTURE_DRIVERS = [
  { id: 'fixture-driver-aaa-111', displayName: 'James Mitchell' },
  { id: 'fixture-driver-bbb-222', displayName: 'Sarah Okafor' },
] as const;

/* ── Fixture jobs (12 records) ───────────────────────────────────────────── */

/**
 * Deterministic job records covering every required scenario:
 *  fx-job-001  draft · private · unassigned            → Post + Direct Invite
 *  fx-job-002  posted · private · no carrier            → Cancel + Direct Invite
 *  fx-job-003  allocated · private · driver A           → Cancel + Direct Invite
 *  fx-job-004  delivered · terminal                     → no actions
 *  fx-job-005  draft · public                           → Post only (public blocks Invite)
 *  fx-job-006  posted · private · awarded carrier       → Cancel only (carrier blocks Invite)
 *  fx-job-007  cancelled · terminal                     → no actions
 *  fx-job-008  in_transit · terminal                    → no actions
 *  fx-job-009  draft · private · driver B               → Post + Direct Invite
 *  fx-job-010  allocated · private · driver A           → Cancel + Direct Invite
 *  fx-job-011  posted · private · no carrier            → Cancel + Direct Invite (page 2)
 *  fx-job-012  draft · private · awarded carrier        → Post only (carrier blocks Invite) (page 2)
 */
export const FIXTURE_JOBS: JobRow[] = [
  /* 1 ── draft, private, unassigned ─────────────────────────────────────── */
  {
    id: 'fx-job-001',
    jobRef: 'JOB-F001',
    status: 'draft',
    client: { name: 'Acme Freight Ltd' },
    clientEmail: 'ops@acmefreight.co.uk',
    clientPhone: '0121 400 1001',
    pickup: { location: 'Birmingham', date: '2026-08-05', time: '09:00', postcode: 'B1 1AA' },
    delivery: { location: 'Manchester', date: '2026-08-05', time: '13:00', postcode: 'M1 1AB' },
    vehicleType: '7.5t curtainsider',
    distanceMiles: '86.4 mi',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    assignedDriverId: null,
    exchange_visibility: 'private',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '30 days',
    cargo: { type: 'Pallets', quantity: 4, notes: 'Fragile — handle with care' },
    loadDetailSummary: [
      { label: 'Weight', value: '1 200 kg' },
      { label: 'Pallets', value: '4' },
    ],
  },
  /* 2 ── posted, private, no carrier ────────────────────────────────────── */
  {
    id: 'fx-job-002',
    jobRef: 'JOB-F002',
    status: 'posted',
    client: { name: 'Beta Logistics plc' },
    clientEmail: 'dispatch@betalogistics.co.uk',
    clientPhone: '0161 500 2002',
    pickup: { location: 'London', date: '2026-08-06', time: '07:30', postcode: 'EC1A 1BB' },
    delivery: { location: 'Leeds', date: '2026-08-06', time: '13:00', postcode: 'LS1 1BA' },
    vehicleType: 'Transit van',
    distanceMiles: '194.1 mi',
    createdAt: '2026-08-02T07:00:00.000Z',
    updatedAt: '2026-08-02T07:00:00.000Z',
    assignedDriverId: null,
    exchange_visibility: 'private',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '14 days',
    cargo: { type: 'Boxes', quantity: 12, notes: 'Keep dry' },
    loadDetailSummary: [
      { label: 'Weight', value: '480 kg' },
      { label: 'Boxes', value: '12' },
    ],
  },
  /* 3 ── allocated, private, driver A ──────────────────────────────────── */
  {
    id: 'fx-job-003',
    jobRef: 'JOB-F003',
    status: 'allocated',
    client: { name: 'Gamma Transport Ltd' },
    clientEmail: 'jobs@gammatransport.co.uk',
    clientPhone: '0117 600 3003',
    pickup: { location: 'Bristol', date: '2026-08-07', time: '08:00', postcode: 'BS1 1AB' },
    delivery: { location: 'Nottingham', date: '2026-08-07', time: '12:30', postcode: 'NG1 1AA' },
    vehicleType: '3.5t Luton',
    distanceMiles: '127.3 mi',
    createdAt: '2026-08-03T06:30:00.000Z',
    updatedAt: '2026-08-03T09:00:00.000Z',
    assignedDriverId: null,
    exchange_visibility: 'private',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '7 days',
    cargo: { type: 'Furniture', quantity: 1, notes: 'Antique items — white glove required' },
    loadDetailSummary: [
      { label: 'Weight', value: '320 kg' },
      { label: 'Tail lift', value: 'Required' },
    ],
  },
  /* 4 ── delivered, terminal, no actions ───────────────────────────────── */
  {
    id: 'fx-job-004',
    jobRef: 'JOB-F004',
    status: 'delivered',
    client: { name: 'Delta Carriers Ltd' },
    clientEmail: 'accounts@deltacarriers.co.uk',
    clientPhone: '0141 700 4004',
    pickup: { location: 'Glasgow', date: '2026-08-03', time: '06:00', postcode: 'G1 1AB' },
    delivery: { location: 'Edinburgh', date: '2026-08-03', time: '08:30', postcode: 'EH1 1AA' },
    vehicleType: 'Sprinter van',
    distanceMiles: '47.2 mi',
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-08-03T08:45:00.000Z',
    assignedDriverId: 'fixture-driver-bbb-222',
    exchange_visibility: 'private',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '30 days',
    cargo: { type: 'Documents', quantity: 2, notes: 'Confidential' },
    loadDetailSummary: [
      { label: 'Weight', value: '8 kg' },
    ],
  },
  /* 5 ── draft, public, unassigned ────────────────────────────────────── */
  {
    id: 'fx-job-005',
    jobRef: 'JOB-F005',
    status: 'draft',
    client: { name: 'Epsilon Haulage Ltd' },
    clientEmail: 'ops@epsilonhaulage.co.uk',
    clientPhone: '0151 800 5005',
    pickup: { location: 'Liverpool', date: '2026-08-08', time: '10:00', postcode: 'L1 1AB' },
    delivery: { location: 'Sheffield', date: '2026-08-08', time: '14:00', postcode: 'S1 1AA' },
    vehicleType: '18t artic',
    distanceMiles: '99.8 mi',
    createdAt: '2026-08-04T09:00:00.000Z',
    updatedAt: '2026-08-04T09:00:00.000Z',
    assignedDriverId: null,
    exchange_visibility: 'public',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '60 days',
    cargo: { type: 'Steel coils', quantity: 6, notes: 'Requires flat-bed' },
    loadDetailSummary: [
      { label: 'Weight', value: '14 000 kg' },
      { label: 'Coils', value: '6' },
    ],
  },
  /* 6 ── posted, private, awarded carrier (blocks Invite) ─────────────── */
  {
    id: 'fx-job-006',
    jobRef: 'JOB-F006',
    status: 'posted',
    client: { name: 'Zeta Distribution Ltd' },
    clientEmail: 'logistics@zetadist.co.uk',
    clientPhone: '0191 900 6006',
    pickup: { location: 'Newcastle', date: '2026-08-09', time: '07:00', postcode: 'NE1 1AA' },
    delivery: { location: 'York', date: '2026-08-09', time: '10:30', postcode: 'YO1 1AB' },
    vehicleType: '3.5t box',
    distanceMiles: '79.4 mi',
    createdAt: '2026-08-04T11:00:00.000Z',
    updatedAt: '2026-08-04T11:00:00.000Z',
    assignedDriverId: null,
    exchange_visibility: 'private',
    awarded_carrier_company_id: 'fx-carrier-001',
    direct_invite_company_id: null,
    paymentTerms: '14 days',
    cargo: { type: 'Machinery', quantity: 1, notes: 'Oversized — requires route survey' },
    loadDetailSummary: [
      { label: 'Weight', value: '2 800 kg' },
      { label: 'Forklift', value: 'Required at delivery' },
    ],
  },
  /* 7 ── cancelled, terminal ───────────────────────────────────────────── */
  {
    id: 'fx-job-007',
    jobRef: 'JOB-F007',
    status: 'cancelled',
    client: { name: 'Eta Express Ltd' },
    clientEmail: 'cancel@etaexpress.co.uk',
    clientPhone: '029 2000 7007',
    pickup: { location: 'Cardiff', date: '2026-08-02', time: '09:00', postcode: 'CF1 1AB' },
    delivery: { location: 'Oxford', date: '2026-08-02', time: '12:00', postcode: 'OX1 1AA' },
    vehicleType: 'Transit van',
    distanceMiles: '110.5 mi',
    createdAt: '2026-07-30T14:00:00.000Z',
    updatedAt: '2026-08-02T08:00:00.000Z',
    assignedDriverId: null,
    exchange_visibility: 'private',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '30 days',
    cargo: { type: 'Electronics', quantity: 3, notes: '' },
    loadDetailSummary: [],
  },
  /* 8 ── in_transit, terminal ──────────────────────────────────────────── */
  {
    id: 'fx-job-008',
    jobRef: 'JOB-F008',
    status: 'in_transit',
    client: { name: 'Theta Parcels Ltd' },
    clientEmail: 'track@thetaparcels.co.uk',
    clientPhone: '01603 800 8008',
    pickup: { location: 'Norwich', date: '2026-08-05', time: '06:30', postcode: 'NR1 1AB' },
    delivery: { location: 'Cambridge', date: '2026-08-05', time: '09:00', postcode: 'CB1 1AA' },
    vehicleType: 'Sprinter van',
    distanceMiles: '64.2 mi',
    createdAt: '2026-08-04T15:00:00.000Z',
    updatedAt: '2026-08-05T06:45:00.000Z',
    assignedDriverId: 'fixture-driver-aaa-111',
    exchange_visibility: null,
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '7 days',
    cargo: { type: 'Parcels', quantity: 85, notes: '' },
    loadDetailSummary: [
      { label: 'Weight', value: '210 kg' },
    ],
  },
  /* 9 ── draft, private, driver B assigned ─────────────────────────────── */
  {
    id: 'fx-job-009',
    jobRef: 'JOB-F009',
    status: 'draft',
    client: { name: 'Iota Freight Ltd' },
    clientEmail: 'bookings@iotafreight.co.uk',
    clientPhone: '01752 900 9009',
    pickup: { location: 'Plymouth', date: '2026-08-10', time: '07:00', postcode: 'PL1 1AB' },
    delivery: { location: 'Exeter', date: '2026-08-10', time: '08:30', postcode: 'EX1 1AA' },
    vehicleType: 'Transit van',
    distanceMiles: '38.9 mi',
    createdAt: '2026-08-05T07:00:00.000Z',
    updatedAt: '2026-08-05T07:00:00.000Z',
    assignedDriverId: 'fixture-driver-bbb-222',
    exchange_visibility: 'private',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '14 days',
    cargo: { type: 'Food (chilled)', quantity: 20, notes: 'Temperature-controlled vehicle required' },
    loadDetailSummary: [
      { label: 'Weight', value: '600 kg' },
      { label: 'Temp', value: '2–6 °C' },
    ],
  },
  /* 10 ── allocated, private, driver A ────────────────────────────────── */
  {
    id: 'fx-job-010',
    jobRef: 'JOB-F010',
    status: 'allocated',
    client: { name: 'Kappa Logistics Ltd' },
    clientEmail: 'ops@kappalogistics.co.uk',
    clientPhone: '01332 100 1010',
    pickup: { location: 'Derby', date: '2026-08-08', time: '08:30', postcode: 'DE1 1AA' },
    delivery: { location: 'Leicester', date: '2026-08-08', time: '10:00', postcode: 'LE1 1AB' },
    vehicleType: '3.5t Luton',
    distanceMiles: '28.6 mi',
    createdAt: '2026-08-05T08:30:00.000Z',
    updatedAt: '2026-08-05T10:00:00.000Z',
    assignedDriverId: 'fixture-driver-aaa-111',
    exchange_visibility: 'private',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '30 days',
    cargo: { type: 'Office furniture', quantity: 8, notes: '' },
    loadDetailSummary: [
      { label: 'Weight', value: '560 kg' },
      { label: 'Handball', value: 'Required at delivery' },
    ],
  },
  /* 11 ── posted, private, no carrier (page 2) ─────────────────────────── */
  {
    id: 'fx-job-011',
    jobRef: 'JOB-F011',
    status: 'posted',
    client: { name: 'Lambda Carriers Ltd' },
    clientEmail: 'loads@lambdacarriers.co.uk',
    clientPhone: '023 8011 1111',
    pickup: { location: 'Southampton', date: '2026-08-09', time: '09:30', postcode: 'SO14 1AA' },
    delivery: { location: 'Brighton', date: '2026-08-09', time: '12:00', postcode: 'BN1 1AB' },
    vehicleType: 'Sprinter van',
    distanceMiles: '68.3 mi',
    createdAt: '2026-08-05T09:00:00.000Z',
    updatedAt: '2026-08-05T09:00:00.000Z',
    assignedDriverId: null,
    exchange_visibility: 'private',
    awarded_carrier_company_id: null,
    direct_invite_company_id: null,
    paymentTerms: '7 days',
    cargo: { type: 'Retail goods', quantity: 30, notes: '' },
    loadDetailSummary: [
      { label: 'Weight', value: '380 kg' },
    ],
  },
  /* 12 ── draft, private, awarded carrier (page 2) ─────────────────────── */
  {
    id: 'fx-job-012',
    jobRef: 'JOB-F012',
    status: 'draft',
    client: { name: 'Mu Transport Ltd' },
    clientEmail: 'jobs@mutransport.co.uk',
    clientPhone: '01224 120 1212',
    pickup: { location: 'Aberdeen', date: '2026-08-10', time: '06:00', postcode: 'AB10 1AA' },
    delivery: { location: 'Dundee', date: '2026-08-10', time: '08:00', postcode: 'DD1 1AB' },
    vehicleType: '7.5t box',
    distanceMiles: '66.7 mi',
    createdAt: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-05T10:00:00.000Z',
    assignedDriverId: null,
    exchange_visibility: 'private',
    awarded_carrier_company_id: 'fx-carrier-002',
    direct_invite_company_id: null,
    paymentTerms: '30 days',
    cargo: { type: 'Whisky casks', quantity: 2, notes: 'Extremely fragile — wooden crates' },
    loadDetailSummary: [
      { label: 'Weight', value: '920 kg' },
      { label: 'Casks', value: '2' },
    ],
  },
];

/* ── Per-page constant ───────────────────────────────────────────────────── */

/** Use a smaller page size than production (20) so pagination is exercised with 12 records. */
export const FIXTURE_PER_PAGE = 10;

/* ── Fixture component ───────────────────────────────────────────────────── */

export default function JobsVisualFixture() {
  /* Filter state */
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pickupFilter, setPickupFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');

  /* Pagination state */
  const [page, setPage] = useState(0);

  /* Derived: all filtered jobs (pre-pagination) */
  const allFiltered = useMemo(() => {
    let result = [...FIXTURE_JOBS];

    if (statusFilter !== 'All') {
      result = result.filter((j) => j.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (j) =>
          j.jobRef.toLowerCase().includes(term) ||
          j.client.name.toLowerCase().includes(term) ||
          j.pickup.location.toLowerCase().includes(term) ||
          j.delivery.location.toLowerCase().includes(term),
      );
    }

    if (pickupFilter.trim()) {
      const term = pickupFilter.trim().toLowerCase();
      result = result.filter((j) => j.pickup.location.toLowerCase().includes(term));
    }

    if (deliveryFilter.trim()) {
      const term = deliveryFilter.trim().toLowerCase();
      result = result.filter((j) => j.delivery.location.toLowerCase().includes(term));
    }

    if (customerFilter.trim()) {
      const term = customerFilter.trim().toLowerCase();
      result = result.filter((j) => j.client.name.toLowerCase().includes(term));
    }

    if (dateFilter) {
      result = result.filter(
        (j) => j.pickup.date === dateFilter || j.delivery.date === dateFilter,
      );
    }

    return filterJobsByDriver(result, driverFilter);
  }, [statusFilter, searchTerm, pickupFilter, deliveryFilter, customerFilter, dateFilter, driverFilter]);

  /* Derived: paginated slice passed to table */
  const paginatedJobs = useMemo(
    () => allFiltered.slice(page * FIXTURE_PER_PAGE, (page + 1) * FIXTURE_PER_PAGE),
    [allFiltered, page],
  );

  const handlePageChange = (next: number) => {
    setPage(next);
  };

  const handleFilterChange =
    <T extends string>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(0);
    };

  return (
    <WorkspaceShell
      forcedRole="company_admin"
      fixtureOverrides={{
        companyName: 'XDrive Logistics — Jobs Fixture',
        unreadCount: 2,
        tickerItems: [
          {
            id: 'fx-jobs-ticker-1',
            label: 'JOB-F001 ready to post',
            reference: 'JOB-F001',
            created_at: '2026-08-05T09:00:00.000Z',
            href: '/admin/jobs',
          },
          {
            id: 'fx-jobs-ticker-2',
            label: 'JOB-F003 driver allocated',
            reference: 'JOB-F003',
            created_at: '2026-08-05T09:05:00.000Z',
            href: '/admin/jobs',
          },
        ],
      }}
    >
      <PageFrame>
        <ExchangeKpiStrip>
          <KpiCard label="All jobs" value={FIXTURE_JOBS.length} tone="blue" onClick={() => undefined} />
          <KpiCard label="Draft jobs" value={FIXTURE_JOBS.filter((job) => job.status === 'draft').length} tone="orange" onClick={() => undefined} />
          <KpiCard label="Allocated jobs" value={FIXTURE_JOBS.filter((job) => job.status === 'allocated').length} tone="purple" onClick={() => undefined} />
          <KpiCard label="Assigned drivers" value={new Set(FIXTURE_JOBS.map((job) => job.assignedDriverId).filter(Boolean)).size} tone="green" onClick={() => undefined} />
        </ExchangeKpiStrip>
        <JobsOperationalTable
          filteredJobs={paginatedJobs}
          page={page}
          perPage={FIXTURE_PER_PAGE}
          totalFiltered={allFiltered.length}
          onPageChange={handlePageChange}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          pickupFilter={pickupFilter}
          deliveryFilter={deliveryFilter}
          dateFilter={dateFilter}
          customerFilter={customerFilter}
          driverFilter={driverFilter}
          onDriverFilterChange={handleFilterChange(setDriverFilter)}
          drivers={[...FIXTURE_DRIVERS]}
          onSearchTermChange={handleFilterChange(setSearchTerm)}
          onStatusFilterChange={handleFilterChange(setStatusFilter)}
          onPickupFilterChange={handleFilterChange(setPickupFilter)}
          onDeliveryFilterChange={handleFilterChange(setDeliveryFilter)}
          onDateFilterChange={handleFilterChange(setDateFilter)}
          onCustomerFilterChange={handleFilterChange(setCustomerFilter)}
          onNewJob={() => undefined}
          onViewJob={() => undefined}
          onDirectInvite={() => undefined}
          onStatusChange={() => undefined}
          onPostJob={() => undefined}
          newJobDisabled={false}
          companyError={null}
          dbError={null}
          hasSupabaseSession={false}
        />
      </PageFrame>
    </WorkspaceShell>
  );
}
