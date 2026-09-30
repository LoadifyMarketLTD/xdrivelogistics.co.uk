'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import TopWorkspaceShell from './TopWorkspaceShell';
import carrierStyles from './CarrierDashboard.module.css';
import {
  ActionButton,
  DataTable,
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalFilters,
  OperationalPageLayout,
  OperationalToolbar,
  StatusBadge,
} from './WorkspaceUI';

const signals = [
  ['Needs attention', '7', 'Allocation, evidence or exception', '#F5A300'],
  ['Awaiting allocation', '3', 'Awarded work awaiting driver', '#F5A300'],
  ['Live jobs', '12', 'Currently in execution', '#1D57D8'],
  ['Photo evidence', '2', 'Completed work needing photos', '#0B2F6B'],
  ['Available drivers', '18', 'Active + available', '#198754'],
  ['Exceptions', '1', 'Immediate recovery required', '#C62828'],
] as const;

function Panel({ title, subtitle, children, flush = false }: { title: string; subtitle?: string; children: ReactNode; flush?: boolean }) {
  return (
    <section className={carrierStyles.panel}>
      <header className={carrierStyles.panelHeader}>
        <div className={carrierStyles.panelHeaderText}>
          <h3 className={carrierStyles.panelTitle}>{title}</h3>
          {subtitle ? <p className={carrierStyles.panelSubtitle}>{subtitle}</p> : null}
        </div>
      </header>
      <div className={flush ? carrierStyles.panelBodyFlush : carrierStyles.panelBody}>{children}</div>
    </section>
  );
}

function Row({ label, detail, value }: { label: string; detail: string; value?: string }) {
  return (
    <button type="button" style={{ width: '100%', minHeight: '44px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 8, padding: '6px 0', border: 0, borderBottom: '1px solid #E5E7EB', background: 'transparent', textAlign: 'left' }}>
      <span><strong style={{ display: 'block', fontSize: 12, lineHeight: '16px' }}>{label}</strong><span style={{ display: 'block', color: '#64748B', fontSize: 11, lineHeight: '14px' }}>{detail}</span></span>
      <strong style={{ color: '#0B2F6B', fontSize: 13 }}>{value ?? '→'}</strong>
    </button>
  );
}

export default function CarrierDashboardVisualFixture() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState('attention');
  return (
    <div className="xdrive-workspace-measured xdrive-operational-top-workspace">
      <TopWorkspaceShell forcedRole="company_admin">
        <div className={carrierStyles.page} data-testid="carrier-dashboard-fixture">
          <header className={carrierStyles.header} data-testid="carrier-page-header">
            <div className={carrierStyles.headerCopy}>
              <div className={carrierStyles.eyebrow}>Carrier operations</div>
              <h1 className={carrierStyles.title}>Carrier Control Desk</h1>
              <p className={carrierStyles.description}>Awarded carrier work, allocation, live delivery, delivery photo evidence and exceptions in one operational desk.</p>
              <div className={carrierStyles.headerMeta}>Carrier-awarded work · live operational control</div>
            </div>
          </header>

          <OperationalToolbar>
            <div className={carrierStyles.toolbarCopy}><strong style={{ color: '#0B2F6B', fontSize: 12 }}>Operations</strong><span style={{ color: '#64748B', fontSize: 11 }}>Allocation · execution · delivery photo evidence · exception recovery</span></div>
            <div className={carrierStyles.toolbarActions}>
              {['Jobs', 'Live Availability', 'Live Positions', 'Freight Vision', 'Directory', 'Messages', 'Event Log'].map((label) => <ActionButton key={label} tone="secondary">{label}</ActionButton>)}
              <ActionButton tone="primary">Refresh</ActionButton>
            </div>
          </OperationalToolbar>

          <section className={carrierStyles.signals} aria-label="Carrier control signals" data-testid="carrier-signal-strip">
            {signals.map(([label, value, detail, tone], index) => (
              <button key={label} type="button" className={carrierStyles.signal} aria-pressed={index === 0} style={{ '--carrier-signal-tone': tone } as CSSProperties}>
                <span className={carrierStyles.signalLabel}>{label}</span>
                <strong className={carrierStyles.signalValue}>{value}</strong>
                <span className={carrierStyles.signalDetail}>{detail}</span>
              </button>
            ))}
          </section>

          <OperationalPageLayout
            style={{ padding: 0 }}
            searchAsideStyle={{ top: '102px' }}
            stackAt1024
            searchPanel={
              <OperationalFilters title="Control filters" onSearch={() => undefined} onClear={() => { setQuery(''); setView('attention'); }} footer={
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #D8DEE8' }}>
                  <div style={{ marginBottom: 3, color: '#0B2F6B', fontSize: 11, lineHeight: '14px', fontWeight: 800, textTransform: 'uppercase' }}>Resource readiness</div>
                  <Row label="Available drivers" detail="" value="18" />
                  <Row label="Busy drivers" detail="" value="9" />
                  <Row label="Unassigned vehicles" detail="" value="2" />
                  <Row label="Document expiry alerts" detail="" value="4" />
                </div>
              }>
                <OperationalFilterField label="Find work" htmlFor="fixture-find"><OperationalFilterInput id="fixture-find" value={query} onChange={setQuery} placeholder="Ref, route, client" /></OperationalFilterField>
                <OperationalFilterField label="Work view" htmlFor="fixture-view"><OperationalFilterSelect id="fixture-view" value={view} onChange={setView} options={[{ value: 'attention', label: 'Needs attention' }, { value: 'unallocated', label: 'Unallocated' }, { value: 'live', label: 'Live jobs' }]} /></OperationalFilterField>
                <OperationalFilterField label="Driver" htmlFor="fixture-driver"><OperationalFilterSelect id="fixture-driver" value="" onChange={() => undefined} options={[{ value: '', label: 'All drivers' }]} /></OperationalFilterField>
                <OperationalFilterField label="Required vehicle" htmlFor="fixture-vehicle"><OperationalFilterSelect id="fixture-vehicle" value="" onChange={() => undefined} options={[{ value: '', label: 'All required vehicles' }]} /></OperationalFilterField>
              </OperationalFilters>
            }
          >
            <section className={carrierStyles.workboard} aria-label="Carrier operational workboard" data-testid="carrier-workboard">
              <div className={carrierStyles.workboardHeader} data-testid="carrier-workboard-header">
                <div><h2>Operational workboard</h2><p>Needs attention · carrier-awarded work only</p></div>
                <div style={{ color: '#64748B', fontSize: 11 }}>3 visible</div>
              </div>
              <div role="tablist" aria-label="Carrier work views" className={carrierStyles.tabs} data-testid="carrier-tabs">
                {['Needs attention', 'Unallocated', 'Live jobs', 'Photo evidence', 'Exceptions', 'All carrier work'].map((label, index) => <button key={label} type="button" role="tab" aria-selected={index === 0} data-selected={index === 0 ? 'true' : 'false'} className={carrierStyles.tab}>{label}<span className={carrierStyles.tabCount}>{index === 0 ? 7 : index + 1}</span></button>)}
              </div>
              <div className={carrierStyles.workboardTable}>
                <DataTable
                  columns={['Ref / priority', 'Route', 'Pickup', 'Vehicle', 'Driver', 'Status', 'Action']}
                  rows={[
                    [<span key="rp1"><strong style={{ display: 'block', fontSize: 11, lineHeight: '14px' }}>A81F22C1</strong><span style={{ display: 'block', color: '#92400E', fontSize: 10, lineHeight: '12px', fontWeight: 700 }}>Allocate</span></span>, <strong key="r1">BB1 → M1</strong>, 'Today 10:30', 'Luton Van', 'Unassigned', <StatusBadge key="s1" value="Awarded" tone="orange" />, <button key="a1" type="button" className={carrierStyles.microAction} data-tone="success">Allocate</button>],
                    [<span key="rp2"><strong style={{ display: 'block', fontSize: 11, lineHeight: '14px' }}>B77D93F2</strong><span style={{ display: 'block', color: '#1D57D8', fontSize: 10, lineHeight: '12px', fontWeight: 700 }}>Monitor</span></span>, <strong key="r2">M4 → L1</strong>, 'Today 11:15', 'LWB', 'D. Smith', <StatusBadge key="s2" value="In transit" tone="blue" />, <button key="a2" type="button" className={carrierStyles.microAction} data-tone="secondary">Open</button>],
                    [<span key="rp3"><strong style={{ display: 'block', fontSize: 11, lineHeight: '14px' }}>C91A44E8</strong><span style={{ display: 'block', color: '#0B2F6B', fontSize: 10, lineHeight: '12px', fontWeight: 700 }}>Evidence</span></span>, <strong key="r3">LS1 → B1</strong>, 'Today 12:05', 'Small Van', 'A. Jones', <StatusBadge key="s3" value="Delivered" tone="green" />, <button key="a3" type="button" className={carrierStyles.microAction} data-tone="secondary">Open</button>],
                  ]}
                />
              </div>
              <div className={carrierStyles.workboardFooter} data-testid="carrier-workboard-footer"><span>Showing 3 of 3 matching jobs</span><button type="button" className={carrierStyles.workboardFooterButton}>Open full jobs register →</button></div>
            </section>

            <div className={carrierStyles.lowerGrid} data-testid="carrier-lower-grid">
              <div className={carrierStyles.lowerColumn}>
                <Panel title="Commercial position" subtitle="Verified XDrive commercial signals.">
                  <Row label="Won work value" detail="Accepted carrier quotes backed by an award" value="£4,820" />
                  <Row label="Overdue invoices" detail="Past-due carrier invoices" value="2 · £940" />
                  <Row label="Submitted quotes" detail="Marketplace pricing awaiting an outcome" value="6" />
                  <Row label="Compliance due" detail="Evidence expiring within 30 days" value="4" />
                </Panel>
                <Panel title="Reports & finance" subtitle="Verified XDrive registers only.">
                  <Row label="Invoices / accounts" detail="Invoice register and payment state" />
                  <Row label="Gross margin / subcontract reporting" detail="Finance reports and exports" />
                  <Row label="Bookings / Diary" detail="Booking history and evidence" />
                  <Row label="Return Journeys" detail="Published return capacity" />
                </Panel>
              </div>
              <div className={carrierStyles.lowerColumn}>
                <Panel title="Activity at a glance" subtitle="Latest carrier-awarded bookings." flush>
                  <DataTable columns={['Route / vehicle', 'Pickup', 'Status / evidence', 'Action']} rows={[
                    [<span key="rr1"><strong style={{ display: 'block' }}>BB1 → M1</strong><span style={{ display: 'block', color: '#64748B', fontSize: 10, lineHeight: '12px' }}>Luton Van · #A81F22C1</span></span>, '10:30', <StatusBadge key="ss1" value="Awarded" tone="orange" />, <button key="aa1" type="button" className={carrierStyles.microAction} data-tone="success">Allocate</button>],
                    [<span key="rr2"><strong style={{ display: 'block' }}>M4 → L1</strong><span style={{ display: 'block', color: '#64748B', fontSize: 10, lineHeight: '12px' }}>LWB · #B77D93F2</span></span>, '11:15', <StatusBadge key="ss2" value="In transit" tone="blue" />, <button key="aa2" type="button" className={carrierStyles.microAction} data-tone="secondary">Open booking</button>],
                  ]} />
                </Panel>
                <Panel title="Carrier workflow" subtitle="Exchange operating sequence.">
                  <Row label="1. Find marketplace work" detail="Search suitable loads and lanes" />
                  <Row label="2. Price and review marketplace quotes" detail="Manage submitted commercial offers" />
                  <Row label="3. Allocate awarded work" detail="Select an eligible executing driver" />
                  <Row label="4. Control live execution" detail="Monitor active jobs and positions" />
                  <Row label="5. Review POD, evidence and exceptions" detail="Review completed delivery evidence" />
                </Panel>
              </div>
            </div>
          </OperationalPageLayout>
        </div>
      </TopWorkspaceShell>
    </div>
  );
}
