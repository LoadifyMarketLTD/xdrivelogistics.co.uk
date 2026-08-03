'use client';

/**
 * CustomerDashboardVisualFixture
 * Visual-fixture rendering of the Customer operational dashboard.
 * Uses static representative data — no Supabase auth required.
 * 6 KPI tiles per Section 8 of the Mandatory Numeric UI Contract.
 */

import WorkspaceShell from './WorkspaceShell';
import {
  ActionButton,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalCard,
  OperationalPageLayout,
  PageHeader,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
} from './WorkspaceUI';

const money = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

const noop = () => undefined;

const ACTIVE_DELIVERIES = [
  { id: 'cd-001', route: 'Coventry Parts → Rugby DC', pickup: '03 Aug 08:30', delivery: '03 Aug 10:15', status: 'on_my_way_to_delivery', delayed: false },
  { id: 'cd-002', route: 'Nuneaton Hub → Bedworth Retail', pickup: '03 Aug 09:00', delivery: '03 Aug 10:45', status: 'at_pickup', delayed: false },
  { id: 'cd-003', route: 'Leamington Spa → Kenilworth', pickup: '03 Aug 10:30', delivery: '03 Aug 12:00', status: 'allocated', delayed: false },
  { id: 'cd-004', route: 'Warwick Gate → Stratford Trade', pickup: '03 Aug 11:00', delivery: '03 Aug 13:30', status: 'accepted', delayed: true },
  { id: 'cd-005', route: 'Alcester DC → Redditch Hub', pickup: '03 Aug 06:00', delivery: '03 Aug 08:00', status: 'loaded', delayed: true },
];

const AWAITING_AWARD = [
  { id: 'ca-001', route: 'Birmingham Hub → Solihull DC', quotes: 3, pickup: '04 Aug 09:00', bestPrice: 342 },
  { id: 'ca-002', route: 'Wolverhampton Gate → Dudley Trade', quotes: 2, pickup: '04 Aug 10:30', bestPrice: 286 },
];

const OUTSTANDING_INVOICES = [
  { id: 'inv-001', ref: 'INV-2241', amount: 1_240, due: '10 Aug', status: 'unpaid' },
  { id: 'inv-002', ref: 'INV-2198', amount: 890, due: '05 Aug', status: 'overdue' },
  { id: 'inv-003', ref: 'INV-2156', amount: 620, due: '18 Aug', status: 'unpaid' },
];

export default function CustomerDashboardVisualFixture() {
  return (
    <WorkspaceShell
      forcedRole="customer"
      fixtureOverrides={{
        companyName: 'Midlands Retail Group',
        unreadCount: 4,
        tickerItems: [
          { id: 'cfx-1', label: 'Carrier quote received — Birmingham to Solihull', reference: 'Q-5512', created_at: '2026-08-03T07:45:00.000Z', href: '/customer/quotes' },
          { id: 'cfx-2', label: 'Delivery delayed — Warwick to Stratford', reference: 'J-3308', created_at: '2026-08-03T08:30:00.000Z', href: '/customer/deliveries' },
          { id: 'cfx-3', label: 'Invoice INV-2198 is overdue', reference: 'INV-2198', created_at: '2026-08-03T09:00:00.000Z', href: '/customer/invoices' },
        ],
      }}
    >
      <OperationalPageLayout>
        <PageHeader
          eyebrow="Customer transport"
          title="Customer Dashboard"
          description="Post transport requirements, compare carrier quotes, track delivery milestones and retrieve POD and invoices."
          actions={(
            <>
              <ActionButton tone="warning" onClick={noop}>Post Load</ActionButton>
              <ActionButton tone="secondary" onClick={noop}>Track Deliveries</ActionButton>
            </>
          )}
        />

        {/* Section 8: 6 KPI tiles exactly */}
        <KpiGrid>
          <KpiCard label="Open loads" value={4} detail="Awaiting carrier quotes" tone="blue" onClick={noop} />
          <KpiCard label="Quotes received" value={5} detail="Ready to compare" tone="purple" onClick={noop} />
          <KpiCard label="Awaiting award" value={2} detail="Your decision needed" tone="orange" onClick={noop} />
          <KpiCard label="Active deliveries" value={5} detail="In transit now" tone="green" onClick={noop} />
          <KpiCard label="Delayed" value={2} detail="Past delivery window" tone="red" onClick={noop} />
          <KpiCard label="POD ready" value={3} detail="Proof of delivery available" tone="navy" onClick={noop} />
        </KpiGrid>

        <OperationalCard
          title="Action required — awaiting your award decision"
          subtitle="These loads have carrier quotes ready. Review prices and award before quotes expire."
          actions={<ActionButton tone="warning" onClick={noop}>Review all quotes</ActionButton>}
          flush
        >
          <DataTable
            columns={['Route', 'Pickup', 'Quotes received', 'Best price', 'Action']}
            rows={AWAITING_AWARD.map((item) => [
              <strong key="route">{item.route}</strong>,
              item.pickup,
              item.quotes,
              money(item.bestPrice),
              <ActionButton key="action" tone="success" onClick={noop}>Compare &amp; award</ActionButton>,
            ])}
            empty={<EmptyState title="No loads awaiting award" />}
          />
        </OperationalCard>

        <TwoColumn>
          <OperationalCard
            title="Active deliveries"
            subtitle="Live transport — track progress, identify delays and access POD when ready."
            actions={<ActionButton tone="secondary" onClick={noop}>All deliveries</ActionButton>}
            flush
          >
            <DataTable
              columns={['Route', 'Pickup', 'Delivery window', 'Status', 'Action']}
              rows={ACTIVE_DELIVERIES.map((job) => [
                <strong key="route">{job.route}</strong>,
                job.pickup,
                job.delivery,
                <StatusBadge key="status" value={job.status} tone={job.delayed ? 'red' : undefined} />,
                <ActionButton key="action" tone="secondary" onClick={noop}>Track</ActionButton>,
              ])}
              empty={<EmptyState title="No active deliveries" description="Active deliveries appear here once a carrier accepts and starts a job." />}
            />
          </OperationalCard>

          <div style={{ display: 'grid', gap: '12px' }}>
            <OperationalCard title="Commercial summary" subtitle="Pipeline, delivery evidence and invoice urgency in one place.">
              <div style={{ display: 'grid', gap: '8px' }}>
                {([
                  ['Draft loads', 2, '#f8fafc', '#475569'],
                  ['Loads awaiting quotes', 4, '#eff6ff', '#1d4ed8'],
                  ['Carrier awards made', 3, '#f0fdf4', '#166534'],
                  ['POD ready', 3, '#f8fafc', '#334155'],
                  ['Unpaid invoices', 3, '#fff7ed', '#C62828'],
                  ['Invoices due soon', 1, '#fff7ed', '#c2410c'],
                ] as [string, number, string, string][]).map(([label, value, bg, color]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', background: bg, border: `1px solid ${color}20`, borderRadius: '4px', padding: '8px 10px', fontSize: '12px' }}>
                    <span style={{ color: '#475569' }}>{label}</span>
                    <strong style={{ color }}>{value}</strong>
                  </div>
                ))}
              </div>
            </OperationalCard>

            <OperationalCard
              title="Outstanding invoices"
              subtitle="Invoices addressed to your company that are pending payment."
              actions={<ActionButton tone="secondary" onClick={noop}>All invoices</ActionButton>}
            >
              {OUTSTANDING_INVOICES.map((inv) => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #E5E7EB', fontSize: '12px' }}>
                  <span>
                    <strong style={{ display: 'block', color: '#1A1F2B' }}>{inv.ref}</strong>
                    <small style={{ color: '#64748B' }}>Due {inv.due}</small>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#1A1F2B' }}>{money(inv.amount)}</strong>
                    <StatusBadge value={inv.status} tone={inv.status === 'overdue' ? 'red' : 'orange'} />
                  </span>
                </div>
              ))}
            </OperationalCard>

            <OperationalCard title="Quick actions" subtitle="Shortcuts for the customer workspace.">
              <QuickActionGrid
                actions={[
                  { key: 'post-load', label: 'Post new load', onClick: noop },
                  { key: 'compare', label: 'Compare quotes', onClick: noop },
                  { key: 'track', label: 'Track deliveries', onClick: noop },
                  { key: 'pod', label: 'View POD', onClick: noop },
                  { key: 'invoices', label: 'View invoices', onClick: noop },
                ]}
              />
            </OperationalCard>
          </div>
        </TwoColumn>
      </OperationalPageLayout>
    </WorkspaceShell>
  );
}
