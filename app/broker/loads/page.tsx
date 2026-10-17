'use client';

import { OperationalExpandAllControl } from '../../components/workspace/OperationalExpandAllControl';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { classifyWorkspaceJobStage, normalizedJobStatus, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import { useAuth } from '../../components/AuthContext';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import CxLoadCard from '../../components/workspace/CxLoadCard';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
} from '../../components/workspace/WorkspaceUI';

type LoadTab = 'all' | 'draft' | 'open' | 'awarded' | 'active' | 'completed';

const cxTimeParts = (value: string | null | undefined) => {
  if (!value) return { primary: 'ASAP', meta: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { primary: 'Not set', meta: '' };
  const zone = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  return { primary: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }), meta: `${zone ? ` (${zone})` : ''} ${date.toLocaleDateString('en-GB')}` };
};

const money = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
    : 'Not priced';

const statusOf = (job: WorkspaceJob) => normalizedJobStatus(job);

function matchesTab(job: WorkspaceJob, tab: LoadTab) {
  if (tab === 'all') return true;
  const status = statusOf(job);
  const stage = classifyWorkspaceJobStage(job);
  if (tab === 'draft') return status === 'draft';
  if (tab === 'open') return stage === 'open' && status !== 'draft';
  if (tab === 'awarded') return stage === 'awarded' || stage === 'allocated';
  if (tab === 'active') return stage === 'in_progress';
  return stage === 'completed';
}

export default function BrokerLoadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const canEditOwnedJobs = ['owner', 'admin', 'dispatcher'].includes((user?.membershipRole ?? '').trim().toLowerCase());
  const deepJob = searchParams.get('job');
  const deepCustomer = searchParams.get('customer');

  const [tab, setTab] = useState<LoadTab>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [customer, setCustomer] = useState(deepCustomer || '');
  const [reference, setReference] = useState(deepJob || '');
  const [expanded, setExpanded] = useState<string | null>(deepJob);
  const [expandedAllIds, setExpandedAllIds] = useState<Set<string>>(() => new Set());

  const rows = useMemo(() => {
    const fromTerm = from.trim().toLowerCase();
    const toTerm = to.trim().toLowerCase();
    const vehicleTerm = vehicle.trim().toLowerCase();
    const customerTerm = customer.trim().toLowerCase();
    const referenceTerm = reference.trim().toLowerCase();

    return data.jobs
      .filter((job) => matchesTab(job, tab))
      .filter((job) => !referenceTerm || job.id.toLowerCase().includes(referenceTerm))
      .filter((job) => !customerTerm || String(job.client_name || '').toLowerCase().includes(customerTerm))
      .filter((job) => !fromTerm || `${job.pickup_postcode || ''} ${job.pickup_location || ''}`.toLowerCase().includes(fromTerm))
      .filter((job) => !toTerm || `${job.delivery_postcode || ''} ${job.delivery_location || ''}`.toLowerCase().includes(toTerm))
      .filter((job) => !vehicleTerm || String(job.vehicle_type || '').replaceAll('_', ' ').toLowerCase().includes(vehicleTerm))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [customer, data.jobs, from, reference, tab, to, vehicle]);

  const counts = useMemo(() => ({
    all: data.jobs.length,
    draft: data.jobs.filter((job) => matchesTab(job, 'draft')).length,
    open: data.jobs.filter((job) => matchesTab(job, 'open')).length,
    awarded: data.jobs.filter((job) => matchesTab(job, 'awarded')).length,
    active: data.jobs.filter((job) => matchesTab(job, 'active')).length,
    completed: data.jobs.filter((job) => matchesTab(job, 'completed')).length,
  }), [data.jobs]);

  const allVisibleExpanded = rows.length > 0 && rows.every((job) => expandedAllIds.has(job.id));
  const toggleExpandAll = () => { setExpanded(null); setExpandedAllIds((current) => { const next = new Set(current); for (const job of rows) { if (allVisibleExpanded) next.delete(job.id); else next.add(job.id); } return next; }); };

  const tabs: Array<{ id: LoadTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'draft', label: 'Draft', count: counts.draft },
    { id: 'open', label: 'Open', count: counts.open },
    { id: 'awarded', label: 'Awarded', count: counts.awarded },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  const clearFilters = () => {
    setFrom(''); setTo(''); setVehicle(''); setCustomer(''); setReference('');
    if (deepJob || deepCustomer) router.push('/broker/loads');
  };

  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <div className="workspace-board-layout xdrive-admin-marketplace-identity">
        <aside className="workspace-filter-rail" aria-label="Load filters">
          <div className="workspace-filter-rail__header">Search Loads</div>
          <div className="workspace-filter-rail__body">
            <label>FROM<input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Pickup town / postcode" /></label>
            <label>TO<input value={to} onChange={(event) => setTo(event.target.value)} placeholder="Delivery town / postcode" /></label>
            <label>VEHICLE<input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Vehicle type" /></label>
            <label>CUSTOMER<input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" /></label>
            <label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Load reference" /></label>
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Filters apply as you type.</span><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton></div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta workspace-list-controls" style={{ justifyContent: 'space-between', marginBottom: 0 }}><span><strong>Loads</strong> · {rows.length} loads</span><span className="workspace-list-controls__right"><OperationalExpandAllControl expanded={allVisibleExpanded} disabled={!rows.length} onToggle={toggleExpandAll} noun="loads" /><ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton></span></div>
          <div className="workspace-tab-strip" role="tablist" aria-label="Broker load states" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} {item.count}</button>)}
          </div>
          {rows.length === 0 ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}><EmptyState compact title="No matching loads" description="Adjust the filters or use Post Load from the workspace header." /></div>
          ) : (
            <div className="workspace-record-list">
              {rows.map((job) => {
                const open = expanded === job.id || expandedAllIds.has(job.id);
                const quotes = data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted');
                const bestQuote = quotes.map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0)).filter((amount) => amount > 0).sort((a, b) => a - b)[0];
                const budget = Number(job.budget_amount ?? 0);
                const stage = classifyWorkspaceJobStage(job);

                const vehicleLabel = (job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ');
                return (
                  <CxLoadCard
                    key={job.id}
                    from={job.pickup_postcode || job.pickup_location || 'Collection not set'}
                    to={job.delivery_postcode || job.delivery_location || 'Delivery not set'}
                    pickup={cxTimeParts(job.pickup_datetime)}
                    delivery={cxTimeParts(job.delivery_datetime)}
                    band={workspaceJobOperationalLabel(job)}
                    posted={job.client_name || 'Customer'}
                    postedAt={<>{budget > 0 ? `Budget ${money(budget)}` : 'Budget not set'} · {quotes.length} quote{quotes.length === 1 ? '' : 's'}</>}
                    loadId={job.id.slice(0, 8).toUpperCase()}
                    vehicle={vehicleLabel}
                    expanded={open}
                    dataState={statusOf(job)}
                    freight={<>
                      <div><span>Quotes:</span><strong>{quotes.length}</strong></div>
                      <div><span>Best quote:</span><strong>{bestQuote ? money(bestQuote) : 'No live quote'}</strong></div>
                      <div><span>Budget:</span><strong>{budget > 0 ? money(budget) : 'Not set'}</strong></div>
                      <div><span>Spread:</span><strong>{bestQuote && budget > 0 ? money(budget - bestQuote) : '—'}</strong></div>
                    </>}
                    commercial={<>
                      <div><span>Customer:</span><strong>{job.client_name || 'Not supplied'}</strong></div>
                      <div><span>Status:</span><strong>{workspaceJobOperationalLabel(job)}</strong></div>
                    </>}
                    footer={<>
                      <button type="button" className="xdrive-cx-load-footer__expander" onClick={() => { setExpandedAllIds((current) => { const next = new Set(current); next.delete(job.id); return next; }); setExpanded(open ? null : job.id); }} aria-label={open ? 'Collapse load' : 'Expand load'}>{open ? '▴' : '▾'}</button>
                      <button type="button" className="xdrive-cx-load-footer__quote" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Quotes & award</button>
                      {canEditOwnedJobs && job.company_id === data.companyId && <button type="button" onClick={() => router.push(`/broker/jobs/${job.id}/edit`)}>Edit Job</button>}
                      <button type="button" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Job view</button>
                      {stage === 'completed' && <button type="button" onClick={() => router.push('/broker/pod-review')}>POD</button>}
                      <span style={{ marginLeft: 'auto' }}>{stage === 'awarded' || stage === 'allocated' ? 'Carrier awarded' : stage === 'in_progress' ? 'Carrier executing' : stage === 'completed' ? 'Completed' : 'Awaiting carrier decision'}</span>
                    </>}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
