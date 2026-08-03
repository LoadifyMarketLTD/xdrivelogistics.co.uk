'use client';

/**
 * BrokerDashboardVisualFixture
 * Visual-fixture rendering of the Broker operational dashboard.
 * Uses static representative data — no Supabase auth required.
 * 6 KPI tiles per Section 8 of the Mandatory Numeric UI Contract.
 */

import WorkspaceShell from './WorkspaceShell';
import {
  ActionButton,
  DataTable,
  EmptyState,
  ExchangeKpiStrip,
  FinancialSummaryPanel,
  KpiCard,
  OperationalCard,
  OperationalPageLayout,
  PageHeader,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from './WorkspaceUI';

const money = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

const noop = () => undefined;

const ACTIVE_JOBS = [
  { id: 'bj-001', route: 'Liverpool Central → Manchester Piccadilly', customer: 'Nexus Parts Ltd', pickup: '03 Aug 08:00', status: 'on_my_way_to_pickup', pod: false },
  { id: 'bj-002', route: 'Warrington DC → Bolton Trade', customer: 'Retail Freight Co', pickup: '03 Aug 09:30', status: 'at_pickup', pod: false },
  { id: 'bj-003', route: 'Salford Quays → Trafford Park', customer: 'Summit Logistics', pickup: '03 Aug 10:00', status: 'loaded', pod: false },
  { id: 'bj-004', route: 'Stockport Hub → Hyde Industrial', customer: 'Atlas Distribution', pickup: '03 Aug 11:15', status: 'on_my_way_to_delivery', pod: false },
  { id: 'bj-005', route: 'Oldham Depot → Rochdale Hub', customer: 'Peak Courier', pickup: '03 Aug 12:00', status: 'delivered', pod: true },
  { id: 'bj-006', route: 'Bury Trade → Ramsbottom Retail', customer: 'Northern Freight', pickup: '03 Aug 13:00', status: 'allocated', pod: false },
];

const AWAITING_AWARD = [
  { id: 'aw-001', route: 'Chester Gate → Ellesmere Port', customer: 'Mersey Parts', quotes: 3, budget: 520, bestPrice: 388 },
  { id: 'aw-002', route: 'Wrexham Industrial → Deeside Trade', customer: 'Border Logistics', quotes: 2, budget: 680, bestPrice: 495 },
  { id: 'aw-003', route: 'Macclesfield Hub → Congleton DC', customer: 'Peak Retail Ltd', quotes: 4, budget: 310, bestPrice: 226 },
];

const RECENT_LOADS = [
  { id: 'rl-001', customer: 'Nexus Parts Ltd', route: 'Liverpool → Manchester', status: 'active' },
  { id: 'rl-002', customer: 'Retail Freight Co', route: 'Warrington → Bolton', status: 'allocated' },
  { id: 'rl-003', customer: 'Summit Logistics', route: 'Salford → Trafford', status: 'awarded' },
  { id: 'rl-004', customer: 'Atlas Distribution', route: 'Stockport → Hyde', status: 'delivered' },
  { id: 'rl-005', customer: 'Peak Courier', route: 'Oldham → Rochdale', status: 'draft' },
];

export default function BrokerDashboardVisualFixture() {
  return (
    <WorkspaceShell
      forcedRole="broker"
      fixtureOverrides={{
        companyName: 'Northwest Broker Services',
        unreadCount: 7,
        tickerItems: [
          { id: 'bfx-1', label: 'Carrier quote received — Chester to Deeside', reference: 'Q-4421', created_at: '2026-08-03T07:50:00.000Z', href: '/broker/bids' },
          { id: 'bfx-2', label: 'Customer load posted — Macclesfield to Congleton', reference: 'L-8832', created_at: '2026-08-03T08:20:00.000Z', href: '/broker/loads' },
          { id: 'bfx-3', label: 'POD received — Oldham to Rochdale', reference: 'J-2204', created_at: '2026-08-03T08:55:00.000Z', href: '/broker/pod-review' },
        ],
      }}
    >
      <OperationalPageLayout>
        <PageHeader
          eyebrow="Broker operations"
          title="Broker Dashboard"
          description="Post and price customer loads, manage carrier selection, track active jobs and control invoice-to-payment flow."
          actions={(
            <>
              <ActionButton tone="warning" onClick={noop}>Post Load</ActionButton>
              <ActionButton tone="secondary" onClick={noop}>Compare Quotes</ActionButton>
            </>
          )}
        />

        {/* Section 8: 6 KPI tiles exactly */}
        <ExchangeKpiStrip>
          <KpiCard label="Open loads" value={8} detail="Published for carrier pricing" tone="blue" onClick={noop} />
          <KpiCard label="Carrier quotes" value={19} detail="Commercial responses received" tone="purple" onClick={noop} />
          <KpiCard label="Awaiting award" value={3} detail="Your decision needed" tone="orange" onClick={noop} />
          <KpiCard label="Active jobs" value={6} detail="Collections and deliveries" tone="green" onClick={noop} />
          <KpiCard label="POD missing" value={2} detail="Delivered without proof" tone="red" onClick={noop} />
          <KpiCard label="Gross margin" value={money(4_820)} detail="12.4% margin" tone="green" onClick={noop} />
        </ExchangeKpiStrip>

        <OperationalCard
          title="Award decisions needed"
          subtitle="These loads have carrier quotes ready. Review prices and award before capacity moves elsewhere."
          actions={<ActionButton tone="warning" onClick={noop}>Compare all</ActionButton>}
          flush
        >
          <DataTable
            columns={['Customer load', 'Route', 'Quotes', 'Customer budget (est.)', 'Best carrier quote (est.)', 'Estimated margin', 'Action']}
            rows={AWAITING_AWARD.map((item) => [
              item.customer,
              <strong key="route">{item.route}</strong>,
              item.quotes,
              money(item.budget),
              money(item.bestPrice),
              money(item.budget - item.bestPrice),
              <ActionButton key="action" tone="success" onClick={noop}>Compare &amp; award</ActionButton>,
            ])}
            empty={<EmptyState title="No loads awaiting award" />}
          />
        </OperationalCard>

        <TwoColumn>
          <OperationalCard
            title="Active jobs"
            subtitle="Carrier-confirmed jobs in transit. Monitor for delays and exceptions before the customer is affected."
            actions={<ActionButton tone="secondary" onClick={noop}>All jobs</ActionButton>}
            flush
          >
            <DataTable
              columns={['Route', 'Customer', 'Pickup', 'Status', 'POD', 'Action']}
              rows={ACTIVE_JOBS.map((job) => [
                <strong key="route">{job.route}</strong>,
                job.customer,
                job.pickup,
                <StatusBadge key="status" value={job.status} />,
                job.pod
                  ? <StatusBadge key="pod" value="ready" tone="green" />
                  : <StatusBadge key="pod" value="pending" tone="orange" />,
                <ActionButton key="action" tone="secondary" onClick={noop}>Track</ActionButton>,
              ])}
              empty={<EmptyState title="No active jobs" description="Jobs appear here once a carrier is awarded and confirmed." />}
            />
          </OperationalCard>

          <div style={{ display: 'grid', gap: '12px' }}>
            <OperationalCard
              title="Commercial summary"
              subtitle="Invoiced net amounts, draft loads and payment status in one place."
            >
              <FinancialSummaryPanel
                items={[
                  { label: 'Invoiced revenue (net)', value: money(38_920), background: workspaceTheme.surfaceSoft, color: workspaceTheme.green },
                  { label: 'Carrier payables (net)', value: money(34_100), background: workspaceTheme.surfaceSoft, color: '#c2410c' },
                  { label: 'Gross margin', value: money(4_820), background: workspaceTheme.surfaceSoft, color: workspaceTheme.green },
                  { label: 'Est. customer budget', value: money(41_500), background: workspaceTheme.surfaceSoft, color: workspaceTheme.blue },
                  { label: 'Est. carrier quote cost', value: money(36_200), background: workspaceTheme.surfaceSoft, color: '#c2410c' },
                ]}
              />
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {([
                  ['Draft loads', 5],
                  ['Awaiting customer payment', 4],
                  ['Due within 7 days', 2],
                  ['Overdue invoices', 1],
                ] as [string, number][]).map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={noop}
                    style={{ display: 'flex', justifyContent: 'space-between', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    <span style={{ color: '#64748B' }}>{label}</span>
                    <strong style={{ color: value > 0 && label.toLowerCase().includes('overdue') ? '#C62828' : '#1A1F2B' }}>{value}</strong>
                  </button>
                ))}
              </div>
            </OperationalCard>

            <OperationalCard title="Recent customer loads" subtitle="Latest activity in the broker book." actions={<ActionButton tone="secondary" onClick={noop}>All loads</ActionButton>}>
              {RECENT_LOADS.map((load) => (
                <button
                  key={load.id}
                  type="button"
                  onClick={noop}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto', textAlign: 'left', width: '100%', background: 'transparent', border: 'none', padding: '6px 0', borderBottom: '1px solid #E5E7EB', cursor: 'pointer' }}
                >
                  <span>
                    <strong style={{ display: 'block', fontSize: '12px', color: '#1A1F2B' }}>{load.customer}</strong>
                    <small style={{ color: '#64748B', fontSize: '11px' }}>{load.route}</small>
                  </span>
                  <StatusBadge value={load.status} />
                </button>
              ))}
            </OperationalCard>

            <OperationalCard title="Quick actions" subtitle="Shortcuts for the broker control desk.">
              <QuickActionGrid
                actions={[
                  { key: 'post-load', label: 'Post customer load', onClick: noop },
                  { key: 'compare-quotes', label: 'Compare carrier quotes', onClick: noop },
                  { key: 'disputes', label: 'Open disputes', onClick: noop },
                  { key: 'carrier-network', label: 'Manage carrier network', onClick: noop },
                  { key: 'invoices', label: 'Review invoices', onClick: noop },
                  { key: 'margins', label: 'View margins', onClick: noop },
                ]}
              />
            </OperationalCard>
          </div>
        </TwoColumn>
      </OperationalPageLayout>
    </WorkspaceShell>
  );
}
