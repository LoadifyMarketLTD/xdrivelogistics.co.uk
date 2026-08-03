'use client';

/**
 * CarrierDashboardVisualFixture
 * Visual-fixture rendering of the Carrier operational dashboard.
 * Uses static representative data — no Supabase auth required.
 * The /carrier route uses the same CarrierDashboard composition as /admin
 * (company_admin role) but is accessed by carrier-type companies.
 * 6 KPI tiles per Section 8 of the Mandatory Numeric UI Contract.
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
  { id: 'cj-001', route: 'Swindon Hub → Oxford Trade', pickup: '03 Aug 07:30', vehicle: 'Curtainsider', status: 'allocated' },
  { id: 'cj-002', route: 'Reading Gate → Basingstoke DC', pickup: '03 Aug 09:00', vehicle: 'Luton Van', status: 'on_my_way_to_pickup' },
  { id: 'cj-003', route: 'Winchester Depot → Eastleigh Retail', pickup: '03 Aug 10:15', vehicle: 'Sprinter', status: 'awaiting_allocation' },
  { id: 'cj-004', route: 'Southampton Quay → Portsmouth Hub', pickup: '03 Aug 11:30', vehicle: 'Luton Van', status: 'awaiting_allocation' },
  { id: 'cj-005', route: 'Salisbury Industrial → Andover Gate', pickup: '03 Aug 13:00', vehicle: 'Sprinter', status: 'pod_pending' },
  { id: 'cj-006', route: 'Andover Hub → Newbury Trade', pickup: '03 Aug 14:30', vehicle: 'Curtainsider', status: 'allocated' },
];

const QUOTES = [
  { id: 'cq-1', route: 'Swindon → Chippenham', submitted: '02 Aug 14:40', value: 318, status: 'accepted' },
  { id: 'cq-2', route: 'Bristol → Bath', submitted: '02 Aug 16:10', value: 204, status: 'submitted' },
  { id: 'cq-3', route: 'Trowbridge → Melksham', submitted: '01 Aug 10:55', value: 148, status: 'submitted' },
  { id: 'cq-4', route: 'Frome → Shepton Mallet', submitted: '01 Aug 08:30', value: 276, status: 'rejected' },
];

const STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'grey'> = {
  accepted: 'green',
  submitted: 'orange',
  rejected: 'red',
  withdrawn: 'grey',
};

export default function CarrierDashboardVisualFixture() {
  return (
    <WorkspaceShell
      forcedRole="carrier_admin"
      fixtureOverrides={{
        companyName: 'Southern Haulage Ltd',
        unreadCount: 4,
        tickerItems: [
          { id: 'cfx-1', label: 'Quote accepted — Swindon to Chippenham', reference: 'Q-6614', created_at: '2026-08-03T08:10:00.000Z', href: '/carrier/quotes' },
          { id: 'cfx-2', label: 'New load on marketplace — Portsmouth route', reference: 'MKT-2209', created_at: '2026-08-03T08:40:00.000Z', href: '/carrier/marketplace' },
          { id: 'cfx-3', label: 'Driver document expiring — K. Hughes', reference: 'DOC-31', created_at: '2026-08-03T09:10:00.000Z', href: '/carrier/documents/expiry' },
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
          <KpiCard label="Quotes submitted" value={11} detail="Awaiting a commercial decision" onClick={noop} />
          <KpiCard label="Won work" value={4} detail="Accepted carrier quotes" tone="green" onClick={noop} />
          <KpiCard label="Awaiting allocation" value={2} detail="Jobs requiring driver and vehicle" tone="orange" onClick={noop} />
          <KpiCard label="Active jobs" value={6} detail="Collections and deliveries in progress" tone="purple" onClick={noop} />
          <KpiCard label="POD outstanding" value={1} detail="Delivered jobs missing proof" tone="red" onClick={noop} />
          <KpiCard label="Overdue invoices" value={0} detail="Past due date" tone="navy" onClick={noop} />
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
                  ['Available drivers', 3],
                  ['Busy drivers', 4],
                  ['Total vehicles', 8],
                  ['Unassigned vehicles', 2],
                  ['Exceptions', 0],
                  ['Won work value', money(12_840)],
                ] as [string, string | number][]).map(([label, value]) => (
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
                { id: 'd1', doc_type: 'Driver CPC — K. Hughes', days: 9 },
                { id: 'd2', doc_type: 'Vehicle MOT — SH14 TXR', days: 17 },
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
              { label: 'Won work value', value: money(12_840), background: workspaceTheme.surfaceSoft, color: workspaceTheme.green },
              { label: 'Invoiced', value: money(9_420), background: workspaceTheme.surfaceSoft, color: workspaceTheme.blue },
              { label: 'Paid', value: money(7_200), background: workspaceTheme.surfaceSoft, color: workspaceTheme.green },
              { label: 'Outstanding', value: money(2_220), background: workspaceTheme.surfaceSoft, color: workspaceTheme.orange },
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
