'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import JobLiveTrackingPanel from '../../components/tracking/JobLiveTrackingPanel';
import DriverInstructionPanel from '../../components/workspace/DriverInstructionPanel';
import { useCompanyWorkspaceData, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type JobsTab = 'all' | 'awarded' | 'active' | 'loaded' | 'in_transit' | 'completed';

const LOADED = new Set(['loaded', 'collected']);
const IN_TRANSIT = new Set(['in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const statusOf = (job: WorkspaceJob) => String(job.current_status || job.status || '').toLowerCase();

function matchesTab(job: WorkspaceJob, tab: JobsTab) {
  if (tab === 'all') {
    const stage = classifyWorkspaceJobStage(job);
    return ['awarded', 'allocated', 'in_progress', 'completed'].includes(stage);
  }
  const status = statusOf(job);
  const stage = classifyWorkspaceJobStage(job);
  if (tab === 'awarded') return stage === 'awarded' || stage === 'allocated';
  if (tab === 'active') return stage === 'in_progress';
  if (tab === 'loaded') return LOADED.has(status);
  if (tab === 'in_transit') return IN_TRANSIT.has(status);
  return stage === 'completed';
}

export default function BrokerJobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = useCompanyWorkspaceData();
  const deepJob = searchParams.get('job');

  const [tab, setTab] = useState<JobsTab>('all');
  const [customer, setCustomer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reference, setReference] = useState(deepJob || '');
  const [expanded, setExpanded] = useState<string | null>(deepJob);

  const rows = useMemo(() => {
    const customerTerm = customer.trim().toLowerCase();
    const fromTerm = from.trim().toLowerCase();
    const toTerm = to.trim().toLowerCase();
    const referenceTerm = reference.trim().toLowerCase();

    return data.jobs
      .filter((job) => matchesTab(job, tab))
      .filter((job) => !customerTerm || String(job.client_name || '').toLowerCase().includes(customerTerm))
      .filter((job) => !fromTerm || `${job.pickup_postcode || ''} ${job.pickup_location || ''}`.toLowerCase().includes(fromTerm))
      .filter((job) => !toTerm || `${job.delivery_postcode || ''} ${job.delivery_location || ''}`.toLowerCase().includes(toTerm))
      .filter((job) => !referenceTerm || job.id.toLowerCase().includes(referenceTerm))
      .sort((a, b) => String(a.pickup_datetime || a.created_at).localeCompare(String(b.pickup_datetime || b.created_at)));
  }, [customer, data.jobs, from, reference, tab, to]);

  const counts = useMemo(() => ({
    all: data.jobs.filter((job) => matchesTab(job, 'all')).length,
    awarded: data.jobs.filter((job) => matchesTab(job, 'awarded')).length,
    active: data.jobs.filter((job) => matchesTab(job, 'active')).length,
    loaded: data.jobs.filter((job) => matchesTab(job, 'loaded')).length,
    in_transit: data.jobs.filter((job) => matchesTab(job, 'in_transit')).length,
    completed: data.jobs.filter((job) => matchesTab(job, 'completed')).length,
  }), [data.jobs]);

  const tabs: Array<{ id: JobsTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'awarded', label: 'Awarded / Allocated', count: counts.awarded },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'loaded', label: 'Loaded', count: counts.loaded },
    { id: 'in_transit', label: 'In Transit', count: counts.in_transit },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  const clearFilters = () => {
    setCustomer(''); setFrom(''); setTo(''); setReference('');
    if (deepJob) router.push('/broker/jobs');
  };

  const labelStyle = { fontSize: 'var(--ws-font-label, 11px)', color: '#64748b', fontWeight: 700 } as const;
  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      <PageHeader eyebrow="Broker operations" title="Jobs" description="Monitor awarded carrier work from allocation through live execution, traffic ETA, delivery evidence and completion in one operational board." actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>} />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Job filters">
          <div className="workspace-filter-rail__header">Search Jobs</div>
          <div className="workspace-filter-rail__body">
            <label>CUSTOMER<input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" /></label>
            <label>FROM<input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Pickup town / postcode" /></label>
            <label>TO<input value={to} onChange={(event) => setTo(event.target.value)} placeholder="Delivery town / postcode" /></label>
            <label>JOB / LOAD REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference" /></label>
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Filters apply as you type.</span><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton></div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {tabs.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} {item.count}</button>)}
          </div>

          {rows.length === 0 ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}><EmptyState compact title="No matching jobs" description="Awarded, allocated and active carrier work will appear here." /></div>
          ) : (
            <div className="workspace-record-list">
              {rows.map((job) => {
                const open = expanded === job.id;
                const deliveryEvidenceAvailable = (job.delivery_photos?.length || 0) > 0;
                const stage = classifyWorkspaceJobStage(job);

                return (
                  <article className="workspace-operational-row" key={job.id} data-state={statusOf(job)}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{job.pickup_postcode || job.pickup_location || 'Collection not set'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{job.delivery_postcode || job.delivery_location || 'Delivery not set'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.delivery_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>JOB</div><strong>{(job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ')}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{job.client_name || 'Customer'}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>STATUS</div><StatusBadge value={job.current_status || job.status} /><div style={{ marginTop: 4 }}><ActionButton tone="secondary" onClick={() => setExpanded(open ? null : job.id)}>{open ? 'Close' : 'Open'}</ActionButton></div></div>
                    </div>

                    <div className="workspace-record-meta">
                      <span>Job #{job.id.slice(0, 8).toUpperCase()}</span>
                      <span>{job.awarded_carrier_company_id ? 'Carrier awarded' : 'Carrier not recorded'}</span>
                      <span>{job.assigned_driver_id ? 'Driver allocated' : 'Driver not allocated'}</span>
                      <span>Delivery evidence: {deliveryEvidenceAvailable ? `${job.delivery_photos?.length || 0} photo(s)` : 'Not recorded'}</span>
                    </div>

                    {open && (
                      <div className="workspace-record-details" style={{ display: 'grid', gap: 8 }}>
                        {job.awarded_carrier_company_id && <JobLiveTrackingPanel jobId={job.id} />}
                        <DriverInstructionPanel jobId={job.id} />
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Customer</strong><div>{job.client_name || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Pickup</strong><div>{job.pickup_location || job.pickup_postcode || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Delivery</strong><div>{job.delivery_location || job.delivery_postcode || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Vehicle</strong><div>{(job.vehicle_type || 'Not specified').replaceAll('_', ' ')}</div></div>
                          <div className="workspace-detail-item"><strong>Pickup time</strong><div>{when(job.pickup_datetime)}</div></div>
                          <div className="workspace-detail-item"><strong>Delivery time</strong><div>{when(job.delivery_datetime)}</div></div>
                          <div className="workspace-detail-item"><strong>Operational status</strong><div>{statusOf(job).replaceAll('_', ' ')}</div></div>
                          <div className="workspace-detail-item"><strong>Delivery evidence</strong><div>{deliveryEvidenceAvailable ? `${job.delivery_photos?.length || 0} photo(s) recorded` : 'Not recorded in this feed'}</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                          <ActionButton tone="primary" onClick={() => router.push(`/broker/loads?job=${job.id}`)}>Open load</ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Commercial</ActionButton>
                          {stage === 'completed' && <ActionButton tone="secondary" onClick={() => router.push('/broker/pod-review')}>POD review</ActionButton>}
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
