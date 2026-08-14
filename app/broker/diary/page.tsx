'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCompanyWorkspaceData,
  type WorkspaceJob,
} from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type DiaryTab = 'all' | 'unallocated' | 'allocated' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'feedback';

const ACTIVE = new Set([
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
]);

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const postcodeOrLocation = (postcode: string | null | undefined, location: string | null | undefined) =>
  postcode || location || 'Not set';

function statusOf(job: WorkspaceJob) {
  return String(job.current_status || job.status || '').toLowerCase();
}

function matchesTab(job: WorkspaceJob, tab: DiaryTab) {
  const status = statusOf(job);
  if (tab === 'all') return true;
  if (tab === 'unallocated') {
    return !job.awarded_carrier_company_id
      && !job.assigned_driver_id
      && ['draft', 'posted', 'quoted'].includes(status);
  }
  if (tab === 'allocated') {
    return Boolean(job.awarded_carrier_company_id || job.assigned_driver_id)
      && ['awarded', 'allocated', 'accepted'].includes(status);
  }
  if (tab === 'in_progress') return ACTIVE.has(status);
  if (tab === 'completed') return ['delivered', 'completed'].includes(status);
  if (tab === 'cancelled') return status === 'cancelled';
  if (tab === 'expired') return status === 'expired';
  return false;
}

export default function BrokerDiaryPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [tab, setTab] = useState<DiaryTab>('all');
  const [reference, setReference] = useState('');
  const [customer, setCustomer] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const refTerm = reference.trim().toLowerCase();
    const customerTerm = customer.trim().toLowerCase();
    const pickupTerm = pickup.trim().toLowerCase();
    const deliveryTerm = delivery.trim().toLowerCase();

    return data.jobs
      .filter((job) => matchesTab(job, tab))
      .filter((job) => !refTerm || job.id.toLowerCase().includes(refTerm))
      .filter((job) => !customerTerm || String(job.client_name || '').toLowerCase().includes(customerTerm))
      .filter((job) => {
        const haystack = `${job.pickup_postcode || ''} ${job.pickup_location || ''}`.toLowerCase();
        return !pickupTerm || haystack.includes(pickupTerm);
      })
      .filter((job) => {
        const haystack = `${job.delivery_postcode || ''} ${job.delivery_location || ''}`.toLowerCase();
        return !deliveryTerm || haystack.includes(deliveryTerm);
      })
      .filter((job) => !date || String(job.pickup_datetime || '').slice(0, 10) === date)
      .sort((a, b) => String(b.pickup_datetime || b.created_at).localeCompare(String(a.pickup_datetime || a.created_at)));
  }, [customer, data.jobs, date, delivery, pickup, reference, tab]);

  const counts = useMemo(() => ({
    all: data.jobs.length,
    unallocated: data.jobs.filter((job) => matchesTab(job, 'unallocated')).length,
    allocated: data.jobs.filter((job) => matchesTab(job, 'allocated')).length,
    in_progress: data.jobs.filter((job) => matchesTab(job, 'in_progress')).length,
    completed: data.jobs.filter((job) => matchesTab(job, 'completed')).length,
    cancelled: data.jobs.filter((job) => matchesTab(job, 'cancelled')).length,
    expired: data.jobs.filter((job) => matchesTab(job, 'expired')).length,
  }), [data.jobs]);

  const reset = () => {
    setReference('');
    setCustomer('');
    setPickup('');
    setDelivery('');
    setDate('');
  };

  const tabs: Array<{ id: DiaryTab; label: string; count?: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'unallocated', label: 'Unallocated', count: counts.unallocated },
    { id: 'allocated', label: 'Allocated', count: counts.allocated },
    { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { id: 'expired', label: 'Expired', count: counts.expired },
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker operations"
        title="Diary"
        description="Search, scan and inspect broker-managed work in one operational register."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />

      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Diary filters">
          <div className="workspace-filter-rail__header">Search Diary</div>
          <div className="workspace-filter-rail__body">
            <label>
              DATE
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              PICKUP
              <input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Town / postcode" />
            </label>
            <label>
              DELIVERY
              <input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Town / postcode" />
            </label>
            <label>
              LOAD ID / REF
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Load reference" />
            </label>
            <label>
              MEMBER / CUSTOMER
              <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" />
            </label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <ActionButton tone="primary" onClick={() => undefined}>Search</ActionButton>
              <ActionButton tone="secondary" onClick={reset}>Clear</ActionButton>
            </div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={tab === item.id ? 'true' : 'false'}
                onClick={() => setTab(item.id)}
                title={item.id === 'feedback' ? 'Feedback records require a dedicated broker feedback data source.' : undefined}
              >
                {item.label}{typeof item.count === 'number' ? ` ${item.count}` : ''}
              </button>
            ))}
          </div>

          {tab === 'feedback' ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}>
              <EmptyState
                title="Feedback feed not exposed"
                description="The current broker workspace data contract does not expose a dedicated feedback dataset, so no synthetic feedback records are shown here."
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}>
              <EmptyState title="No diary records" description="Adjust the filters or select another operational status." />
            </div>
          ) : (
            <div className="workspace-record-list">
              {rows.map((job) => {
                const open = expanded === job.id;
                const podReady = (job.delivery_photos?.length || 0) > 0;
                return (
                  <article className="workspace-operational-row" key={job.id}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell">
                        <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>FROM</div>
                        <strong>{postcodeOrLocation(job.pickup_postcode, job.pickup_location)}</strong>
                        <div style={{ color: '#64748b', marginTop: 2 }}>{when(job.pickup_datetime)}</div>
                      </div>
                      <div className="workspace-operational-cell">
                        <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>TO</div>
                        <strong>{postcodeOrLocation(job.delivery_postcode, job.delivery_location)}</strong>
                        <div style={{ color: '#64748b', marginTop: 2 }}>{when(job.delivery_datetime)}</div>
                      </div>
                      <div className="workspace-operational-cell">
                        <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>LOAD</div>
                        <strong>{(job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ')}</strong>
                        <div style={{ color: '#64748b', marginTop: 2 }}>{job.client_name || 'Customer'}</div>
                      </div>
                      <div className="workspace-operational-cell">
                        <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>STATUS</div>
                        <StatusBadge value={job.current_status || job.status} />
                        <div style={{ marginTop: 4 }}>
                          <ActionButton tone="secondary" onClick={() => setExpanded(open ? null : job.id)}>{open ? 'Collapse' : 'Open'}</ActionButton>
                        </div>
                      </div>
                    </div>

                    <div className="workspace-record-meta">
                      <span>Load #{job.id.slice(0, 8).toUpperCase()}</span>
                      <span>Customer: {job.client_name || 'Not set'}</span>
                      <span>POD: {podReady ? 'Captured' : 'Pending'}</span>
                    </div>

                    {open && (
                      <div className="workspace-record-details">
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Pickup</strong><div>{when(job.pickup_datetime)}</div></div>
                          <div className="workspace-detail-item"><strong>Delivery</strong><div>{when(job.delivery_datetime)}</div></div>
                          <div className="workspace-detail-item"><strong>Carrier allocation</strong><div>{job.awarded_carrier_company_id ? 'Awarded carrier' : 'Not awarded'}</div></div>
                          <div className="workspace-detail-item"><strong>POD</strong><div>{podReady ? `${job.delivery_photos?.length || 0} file(s)` : 'Pending'}</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                          <ActionButton tone="primary" onClick={() => router.push(`/broker/jobs?job=${job.id}`)}>Open job</ActionButton>
                          {['delivered', 'completed'].includes(statusOf(job)) && (
                            <ActionButton tone="secondary" onClick={() => router.push('/broker/pod-review')}>POD review</ActionButton>
                          )}
                          <ActionButton tone="secondary" onClick={() => router.push('/broker/customer-invoices')}>Invoices</ActionButton>
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
