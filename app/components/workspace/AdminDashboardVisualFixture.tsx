'use client';

/**
 * AdminDashboardVisualFixture
 * Visual-fixture rendering of the Admin (CarrierDashboard) operational page.
 * Uses static representative data — no Supabase auth required.
 * Mirrors the real CarrierDashboard structure exactly, including the 6-tile
 * KPI strip mandated by Section 8 of the Mandatory Numeric UI Contract.
 */

import WorkspaceShell from './WorkspaceShell';
import {
  ActionButton,
  DataTable,
  EmptyState,
  FinancialSummaryPanel,
  KpiCard,
  KpiGrid,
  OperationalCard,
  OperationalPageLayout,
  PageHeader,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from './WorkspaceUI';
import styles from './WorkspaceUI.module.css';

const money = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

const noop = () => undefined;

const JOBS = [
  { id: 'job-001', route: 'Manchester Hub → Sheffield DC', pickup: '03 Aug 09:00', vehicle: 'Curtainsider', status: 'allocated' },
  { id: 'job-002', route: 'Leeds Depot → Wakefield Trade', pickup: '03 Aug 10:30', vehicle: 'Luton Van', status: 'on_my_way_to_pickup' },
  { id: 'job-003', route: 'Sheffield DC → Doncaster Retail', pickup: '03 Aug 11:45', vehicle: 'Sprinter', status: 'awaiting_allocation' },
  { id: 'job-004', route: 'Bradford Parts → Halifax Hub', pickup: '03 Aug 13:00', vehicle: 'Luton Van', status: 'awaiting_allocation' },
  { id: 'job-005', route: 'Huddersfield Industrial → Dewsbury Gate', pickup: '03 Aug 14:15', vehicle: 'Sprinter', status: 'pod_pending' },
  { id: 'job-006', route: 'Halifax Hub → Bradford Parts', pickup: '03 Aug 15:00', vehicle: 'Curtainsider', status: 'allocated' },
  { id: 'job-007', route: 'Leeds Depot → Leeds Centre', pickup: '03 Aug 16:00', vehicle: 'Sprinter', status: 'accepted' },
  { id: 'job-008', route: 'Sheffield Meadowhall → Rotherham', pickup: '03 Aug 16:30', vehicle: 'Luton Van', status: 'allocated' },
];

const QUOTES = [
  { id: 'q-1', route: 'Bristol → Bath', submitted: '02 Aug 16:22', value: 412, status: 'accepted' },
  { id: 'q-2', route: 'Exeter → Taunton', submitted: '02 Aug 14:05', value: 286, status: 'submitted' },
  { id: 'q-3', route: 'Plymouth → Truro', submitted: '01 Aug 11:30', value: 538, status: 'submitted' },
  { id: 'q-4', route: 'Swindon → Oxford', submitted: '01 Aug 09:10', value: 194, status: 'rejected' },
  { id: 'q-5', route: 'Gloucester → Cheltenham', submitted: '31 Jul 17:45', value: 320, status: 'accepted' },
];

const STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'grey'> = {
  accepted: 'green',
  submitted: 'orange',
  rejected: 'red',
  withdrawn: 'grey',
};

export default function AdminDashboardVisualFixture() {
  return (
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
      <OperationalPageLayout>
        <PageHeader
          eyebrow="Carrier operations"
          title="Carrier Dashboard"
          description="Find work, price opportunities, allocate resources and complete transport with a controlled POD-to-invoice workflow."
          actions={(
            <>
              <ActionButton tone="success" onClick={noop}>Find Loads</ActionButton>
              <ActionButton tone="secondary" onClick={noop}>Open Diary</ActionButton>
            </>
          )}
        />

        {/* Section 8: 6 KPI tiles exactly */}
        <KpiGrid>
          <KpiCard label="Quotes submitted" value={14} detail="Awaiting a commercial decision" onClick={noop} />
          <KpiCard label="Won work" value={6} detail="Accepted carrier quotes" tone="green" onClick={noop} />
          <KpiCard label="Awaiting allocation" value={3} detail="Jobs requiring driver and vehicle" tone="orange" onClick={noop} />
          <KpiCard label="Active jobs" value={8} detail="Collections and deliveries in progress" tone="purple" onClick={noop} />
          <KpiCard label="POD outstanding" value={2} detail="Delivered jobs missing proof" tone="red" onClick={noop} />
          <KpiCard label="Overdue invoices" value={1} detail="Past due date" tone="red" onClick={noop} />
        </KpiGrid>

        <TwoColumn>
          <OperationalCard
            title="Jobs requiring attention"
            subtitle="Unallocated, active and POD-pending work is prioritised before general reporting."
            actions={<ActionButton tone="secondary" onClick={noop}>All jobs</ActionButton>}
            flush
          >
            <DataTable
              columns={['Route', 'Pickup', 'Vehicle', 'Status', 'Action']}
              rows={JOBS.map((job) => [
                <strong key="route">{job.route}</strong>,
                job.pickup,
                job.vehicle,
                <StatusBadge key="status" value={job.status} />,
                <ActionButton key="action" tone="secondary" onClick={noop}>Open</ActionButton>,
              ])}
              empty={<EmptyState title="No jobs need attention" description="Won work and active jobs will appear here." />}
            />
          </OperationalCard>
          <div className={styles.roleDashboardColumn}>
            <OperationalCard title="Resource readiness" subtitle="Live capacity, exceptions and commercial position.">
              <div className={styles.roleDashboardSummaryList}>
                {([
                  ['Available drivers', 4, '/admin/drivers'],
                  ['Busy drivers', 6, '/admin/drivers'],
                  ['Total vehicles', 12, '/admin/vehicles'],
                  ['Unassigned vehicles', 3, '/admin/vehicles'],
                  ['Exceptions', 1, '/admin/incidents'],
                  ['Won work value', money(18_420), '/admin/invoices'],
                ] as [string, string | number, string][]).map(([label, value]) => (
                  <button key={label} type="button" onClick={noop} className={styles.roleDashboardSummaryButton}>
                    <span>{label}</span><strong>{value}</strong>
                  </button>
                ))}
              </div>
            </OperationalCard>
            <OperationalCard title="Commercial shortcuts" subtitle="Fast access to the carrier workflow.">
              <QuickActionGrid
                actions={[
                  { key: 'marketplace', label: 'Find marketplace loads', onClick: noop },
                  { key: 'submitted', label: 'Review submitted quotes', onClick: noop },
                  { key: 'allocate', label: 'Allocate awarded work', onClick: noop },
                  { key: 'active-jobs', label: 'Track active jobs', onClick: noop },
                  { key: 'invoices', label: 'Open invoices', onClick: noop },
                ]}
              />
            </OperationalCard>
            <OperationalCard
              title="Compliance alerts"
              subtitle="Documents expiring within 30 days."
              actions={<ActionButton tone="secondary" onClick={noop}>View all</ActionButton>}
            >
              {[
                { id: 'd1', doc_type: 'Operator licence', days: 6 },
                { id: 'd2', doc_type: 'Vehicle insurance — YF03 RXK', days: 14 },
                { id: 'd3', doc_type: 'Driver CPC — J. Patel', days: 22 },
              ].map((doc) => (
                <div key={doc.id} className={styles.roleDashboardListRow}>
                  <span>{doc.doc_type}</span>
                  <StatusBadge value={`${doc.days} days`} tone="orange" />
                </div>
              ))}
            </OperationalCard>
          </div>
        </TwoColumn>

        <OperationalCard
          title="Revenue & finance overview"
          subtitle="Financial position based on accepted bids, raised invoices and payment receipts."
          actions={<ActionButton tone="secondary" onClick={noop}>Finance</ActionButton>}
        >
          <FinancialSummaryPanel
            items={[
              { label: 'Won work value', value: money(18_420), background: workspaceTheme.surfaceSoft, color: workspaceTheme.green },
              { label: 'Invoiced', value: money(12_640), background: workspaceTheme.surfaceSoft, color: workspaceTheme.blue },
              { label: 'Paid', value: money(9_820), background: workspaceTheme.surfaceSoft, color: workspaceTheme.green },
              { label: 'Outstanding', value: money(2_820), background: workspaceTheme.surfaceSoft, color: workspaceTheme.orange },
            ]}
          />
        </OperationalCard>

        <OperationalCard
          title="Recent quote activity"
          subtitle="Latest commercial responses from the carrier account."
          actions={<ActionButton tone="secondary" onClick={noop}>All quotes</ActionButton>}
          flush
        >
          <DataTable
            columns={['Route', 'Submitted', 'Value', 'Status', 'Action']}
            rows={QUOTES.map((q) => [
              <strong key="route">{q.route}</strong>,
              q.submitted,
              money(q.value),
              <StatusBadge key="status" value={q.status} tone={STATUS_TONE[q.status]} />,
              <ActionButton key="action" tone="secondary" onClick={noop}>Open</ActionButton>,
            ])}
            empty={<EmptyState title="No recent quote activity" description="Submitted or accepted quotes will appear here." />}
          />
        </OperationalCard>
      </OperationalPageLayout>
    </WorkspaceShell>
  );
}
