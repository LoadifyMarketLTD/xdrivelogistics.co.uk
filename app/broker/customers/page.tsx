'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import { useBrokerCommercialWorkspaceData } from '../useBrokerCommercialWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type CustomerRow = {
  name: string;
  jobs: number;
  open: number;
  awarded: number;
  active: number;
  completed: number;
  budgetValue: number;
  last: string | null;
};

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';
const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export default function BrokerCustomersPage() {
  const router = useRouter();
  const data = useBrokerCommercialWorkspaceData();
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<'all' | 'active' | 'completed'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const commercialAvailable = data.commercialTermsAvailability === 'available';
  const commercialLoading = data.commercialTermsAvailability === 'loading';
  const privateValueLabel = commercialLoading ? 'Loading…' : 'Unavailable';

  const customers = useMemo(() => {
    const map = new Map<string, CustomerRow>();
    for (const job of data.jobs) {
      const name = job.client_name?.trim() || 'Unassigned customer';
      const stage = classifyWorkspaceJobStage(job);
      const current = map.get(name) ?? { name, jobs: 0, open: 0, awarded: 0, active: 0, completed: 0, budgetValue: 0, last: null };
      current.jobs += 1;
      if (stage === 'open') current.open += 1;
      if (stage === 'awarded' || stage === 'allocated') current.awarded += 1;
      if (stage === 'in_progress') current.active += 1;
      if (stage === 'completed') current.completed += 1;
      if (commercialAvailable) current.budgetValue += Number(job.budget_amount ?? 0);
      const candidate = job.updated_at ?? job.created_at ?? null;
      if (candidate && (!current.last || candidate > current.last)) current.last = candidate;
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => String(b.last ?? '').localeCompare(String(a.last ?? '')));
  }, [commercialAvailable, data.jobs]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (term && !customer.name.toLowerCase().includes(term)) return false;
      if (activity === 'active' && customer.active === 0) return false;
      if (activity === 'completed' && customer.completed === 0) return false;
      return true;
    });
  }, [activity, customers, search]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker customers"
        title="Customers"
        description="Customer relationships derived from broker-managed transport activity. Customer commercial history remains private to the Broker workspace."
        actions={<ActionButton tone="warning" onClick={() => router.push('/broker/post-load')}>Create Load</ActionButton>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Customer filters">
          <div className="workspace-filter-rail__header">Search Customers</div>
          <div className="workspace-filter-rail__body">
            <label>CUSTOMER<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Customer name" /></label>
            <label>ACTIVITY<select value={activity} onChange={(event) => setActivity(event.target.value as typeof activity)}><option value="all">All relationships</option><option value="active">Active execution</option><option value="completed">Completed history</option></select></label>
            <ActionButton tone="secondary" onClick={() => { setSearch(''); setActivity('all'); }}>Clear</ActionButton>
          </div>
        </aside>

        <main className="workspace-board-main">
          <div className="workspace-record-meta"><span><strong>{rows.length}</strong> customer relationship{rows.length === 1 ? '' : 's'}</span><span>Source: broker-owned job history</span></div>
          {rows.length === 0 ? (
            <div className="workspace-panel"><EmptyState compact title="No matching customers" description="Post the first customer load or adjust the filters." /></div>
          ) : (
            <div className="workspace-record-list">
              {rows.map((customer) => {
                const open = expanded === customer.name;
                return (
                  <article key={customer.name} className="workspace-operational-row" data-state={customer.active ? 'active' : customer.completed ? 'completed' : 'relationship'}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Customer</span><strong>{customer.name}</strong><div>{customer.jobs} managed load{customer.jobs === 1 ? '' : 's'}</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Operational work</span><strong>{customer.active} active</strong><div>{customer.awarded} awarded / allocated · {customer.open} open</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Commercial history</span><strong>{commercialAvailable ? money(customer.budgetValue) : privateValueLabel}</strong><div>Private customer revenue · {customer.completed} completed</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Last activity</span><strong>{when(customer.last)}</strong><div style={{ marginTop: 4 }}><ActionButton tone="secondary" onClick={() => setExpanded(open ? null : customer.name)}>{open ? 'Close' : 'Details'}</ActionButton></div></div>
                    </div>
                    <div className="workspace-record-meta"><span>{customer.active ? <StatusBadge value="Active execution" tone="green" /> : customer.awarded ? <StatusBadge value="Awarded work" tone="blue" /> : <StatusBadge value="Relationship" tone="grey" />}</span><span>{customer.completed} completed booking{customer.completed === 1 ? '' : 's'}</span></div>
                    {open && (
                      <div className="workspace-record-details">
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Total loads</strong><div>{customer.jobs}</div></div>
                          <div className="workspace-detail-item"><strong>Open</strong><div>{customer.open}</div></div>
                          <div className="workspace-detail-item"><strong>Awarded / allocated</strong><div>{customer.awarded}</div></div>
                          <div className="workspace-detail-item"><strong>In execution</strong><div>{customer.active}</div></div>
                          <div className="workspace-detail-item"><strong>Completed</strong><div>{customer.completed}</div></div>
                          <div className="workspace-detail-item"><strong>Private customer revenue</strong><div>{commercialAvailable ? money(customer.budgetValue) : privateValueLabel}</div></div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                          <ActionButton tone="secondary" onClick={() => router.push(`/broker/loads?customer=${encodeURIComponent(customer.name)}`)}>View loads</ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push('/broker/post-load')}>New load</ActionButton>
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
