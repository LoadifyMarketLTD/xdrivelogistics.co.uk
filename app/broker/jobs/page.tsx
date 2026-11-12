'use client';

import { useMemo, useState } from 'react';
import Master3150OperationsKpis from '../../components/workspace/Master3150OperationsKpis';
import CxLoadCard, { cxDateParts } from '../../components/workspace/CxLoadCard';
import { useRouter, useSearchParams } from 'next/navigation';
import { classifyWorkspaceJobStage, normalizedJobStatus, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import JobLiveTrackingPanel from '../../components/tracking/JobLiveTrackingPanel';
import DriverInstructionPanel from '../../components/workspace/DriverInstructionPanel';
import { useAuth } from '../../components/AuthContext';
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

const statusOf = (job: WorkspaceJob) => normalizedJobStatus(job);

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
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const canEditOwnedJobs = ['owner', 'admin', 'dispatcher'].includes((user?.membershipRole ?? '').trim().toLowerCase());
  const deepJob = searchParams.get('job');

  const [tab, setTab] = useState<JobsTab>(() => searchParams.get('view') === 'awarded' ? 'awarded' : 'all');
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

  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      <PageHeader eyebrow="Broker operations" title="Jobs" description="Monitor awarded carrier work from allocation through execution and completion." />
      <Master3150OperationsKpis jobs={data.jobs} view="bookings" />
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
          <div className="workspace-record-meta workspace-list-controls" style={{ justifyContent: 'space-between' }}>
            <span><strong>{rows.length}</strong> job{rows.length === 1 ? '' : 's'}</span>
            <span className="workspace-list-controls__right"><ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton></span>
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
                  <CxLoadCard
                    key={job.id}
                    from={job.pickup_postcode || job.pickup_location || 'Collection not recorded'}
                    to={job.delivery_postcode || job.delivery_location || 'Delivery not recorded'}
                    pickup={cxDateParts(job.pickup_datetime)}
                    delivery={cxDateParts(job.delivery_datetime)}
                    band={workspaceJobOperationalLabel(job)}
                    posted={job.client_name || 'Customer'}
                    postedAt={job.awarded_carrier_company_id ? 'Carrier awarded' : 'Carrier not recorded'}
                    loadId={job.id.slice(0, 8).toUpperCase()}
                    vehicle={(job.vehicle_type || 'Vehicle not recorded').replaceAll('_',' ')}
                    dataState={statusOf(job)}
                    paymentTerms={job.payment_terms || 'Not supplied'}
                    expanded={open}
                    freight={<>
                      <div><span>Driver:</span><strong>{job.assigned_driver_id ? 'Allocated' : 'Unallocated'}</strong></div>
                      <div><span>Status:</span><strong><StatusBadge value={workspaceJobOperationalLabel(job)} /></strong></div>
                      <div><span>POD:</span><strong>{deliveryEvidenceAvailable ? 'Delivery evidence available' : 'Not recorded'}</strong></div>
                    </>}
                    commercial={<>
                      <div><span>Customer:</span><strong>{job.client_name || 'Not supplied'}</strong></div>
                      <div><span>Pickup:</span><strong>{when(job.pickup_datetime)}</strong></div>
                      <div><span>Delivery:</span><strong>{when(job.delivery_datetime)}</strong></div>
                      <div><span>Carrier:</span><strong>{job.awarded_carrier_company_id ? 'Awarded' : 'Not awarded'}</strong></div>
                    </>}
                    notes={<>
                      {(job.assigned_driver_id || job.awarded_carrier_company_id) && <JobLiveTrackingPanel jobId={job.id}/>}
                      <DriverInstructionPanel jobId={job.id}/>
                      <div className="workspace-detail-grid">
                        <div className="workspace-detail-item"><strong>Pickup</strong><div>{job.pickup_location || job.pickup_postcode || 'Not recorded'}</div></div>
                        <div className="workspace-detail-item"><strong>Delivery</strong><div>{job.delivery_location || job.delivery_postcode || 'Not recorded'}</div></div>
                        <div className="workspace-detail-item"><strong>Delivery evidence</strong><div>{deliveryEvidenceAvailable ? `${job.delivery_photos?.length || 0} photo(s) recorded` : 'Not recorded in this feed'}</div></div>
                      </div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <ActionButton tone="primary" onClick={() => router.push(`/broker/loads?job=${job.id}`)}>Open load</ActionButton>
                        {canEditOwnedJobs && job.company_id === data.companyId && <ActionButton tone="secondary" onClick={() => router.push(`/broker/jobs/${job.id}/edit`)}>Edit Job</ActionButton>}
                        <ActionButton tone="secondary" onClick={() => router.push(`/broker/compare-quotes?job=${job.id}`)}>Commercial</ActionButton>
                        {stage === 'completed' && <ActionButton tone="secondary" onClick={() => router.push('/broker/pod-review')}>POD review</ActionButton>}
                      </div>
                    </>}
                    footer={<>
                      <button type="button" onClick={() => setExpanded(open ? null : job.id)}>{open ? 'Collapse' : 'View Details'}</button>
                      <button type="button" className="xdrive-cx-load-footer__quote" onClick={() => router.push(`/broker/loads?job=${job.id}`)}>Open booking</button>
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
