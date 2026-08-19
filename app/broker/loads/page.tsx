'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type LoadTab = 'all' | 'draft' | 'open' | 'awarded' | 'active' | 'completed';

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const money = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
    : 'Not priced';

const statusOf = (job: WorkspaceJob) => String(job.current_status || job.status || '').toLowerCase();

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
  const data = useCompanyWorkspaceData();
  const deepJob = searchParams.get('job');
  const deepCustomer = searchParams.get('customer');

  const [tab, setTab] = useState<LoadTab>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [customer, setCustomer] = useState(deepCustomer || '');
  const [reference, setReference] = useState(deepJob || '');
  const [expanded, setExpanded] = useState<string | null>(deepJob);

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

  const labelStyle = { fontSize: 'var(--ws-font-label, 11px)', color: '#64748b', fontWeight: 700 } as const;
  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      <PageHeader eyebrow="Customer loads" title="Loads" description="Scan customer transport requests, quote activity and operational state from one broker board." actions={<ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post Load</ActionButton>} />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
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
          <div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {tabs.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} {item.count}</button>)}
          </div>

          {rows.length === 0 ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}><EmptyState compact title="No matching loads" description="Adjust the filters or post a new customer load." action={<ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Post Load</ActionButton>} /></div>
          ) : (
            <div className="workspace-record-list">
              {rows.map((job) => {
                const open = expanded === job.id;
                const quotes = data.bids.filter((bid) => bid.job_id === job.id && bid.status === 'submitted');
                const bestQuote = quotes.map((bid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0)).filter((amount) => amount > 0).sort((a, b) => a - b)[0];
                const budget = Number(job.budget_amount ?? 0);
                const stage = classifyWorkspaceJobStage(job);

                return (
                  <article className="workspace-operational-row" key={job.id} data-state={statusOf(job)}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{job.pickup_postcode || job.pickup_location || 'Collection not set'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{job.delivery_postcode || job.delivery_location || 'Delivery not set'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.delivery_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>LOAD</div><strong>{(job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ')}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{job.client_name || 'Customer'}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>COMMERCIAL</div><strong>{budget > 0 ? money(budget) : 'Budget not set'}</strong><div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}><StatusBadge value={job.current_status || job.status} /><ActionButton tone="secondary" onClick={() => setExpanded(open ? null : job.id)}>{open ? 'Close' : 'Open'}</ActionButton></div></div>
                    </div>
                    <div className="workspace-record-meta"><span>Load #{job.id.slice(0, 8).toUpperCase()}</span><span>Quotes: {quotes.length}</span><span>{bestQuote ? `Best quote: ${money(bestQuote)}` : 'No live quote'}</span><span>{stage === 'awarded' || stage === 'allocated' ? 'Carrier awarded' : stage === 'in_progress' ? 'Carrier executing' : stage === 'completed' ? 'Completed' : 'Awaiting carrier decision'}</span></div>
                    {open && (
                      <div className="workspace-record-details">
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Customer</strong><div>{job.client_name || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Pickup</strong><div>{job.pickup_location || job.pickup_postcode || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Delivery</strong><div>{job.delivery_location || job.delivery_postcode || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Vehicle</strong><div>{(job.vehicle_type || 'Not specified').replaceAll('_', ' ')}</div></div>
                          <div className="workspace-detail-item"><strong>Customer budget</strong><div>{budget > 0 ? money(budget) : 'Not set'}</div></div>
                          <div className="workspace-detail-item"><strong>Live carrier quotes</strong><div>{quotes.length}</div></div>
                          <div className="workspace-detail-item"><strong>Best carrier quote</strong><div>{bestQuote ? money(bestQuote) : '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Estimated spread</strong><div>{bestQuote && budget > 0 ? money(budget - bestQuote) : '—'}</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                          <ActionButton tone="primary" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Quotes & award</ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Job view</ActionButton>
                          {stage === 'completed' && <ActionButton tone="secondary" onClick={() => router.push('/broker/pod-review')}>POD</ActionButton>}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
