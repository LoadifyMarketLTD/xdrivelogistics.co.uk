'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../components/AuthContext';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
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

type SavedCustomer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';
const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export default function BrokerCustomersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<'all' | 'active' | 'completed'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savedCustomers, setSavedCustomers] = useState<SavedCustomer[]>([]);
  const [customerError, setCustomerError] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' });

  useEffect(() => {
    let cancelled = false;
    const loadCustomers = async () => {
      if (!data.companyId || !isSupabaseConfigured) {
        setSavedCustomers([]);
        return;
      }
      const { data: rows, error } = await supabase
        .from('company_customers')
        .select('id,name,email,phone,address,notes,created_at')
        .eq('company_id', data.companyId)
        .order('name');
      if (cancelled) return;
      if (error) {
        setCustomerError(error.message);
        setSavedCustomers([]);
        return;
      }
      setCustomerError('');
      setSavedCustomers((rows ?? []) as SavedCustomer[]);
    };
    void loadCustomers();
    return () => { cancelled = true; };
  }, [data.companyId]);

  const customers = useMemo(() => {
    const map = new Map<string, CustomerRow>();
    for (const saved of savedCustomers) {
      map.set(saved.name, { name: saved.name, jobs: 0, open: 0, awarded: 0, active: 0, completed: 0, budgetValue: 0, last: saved.created_at });
    }
    for (const job of data.jobs) {
      const name = job.client_name?.trim() || 'Unassigned customer';
      const stage = classifyWorkspaceJobStage(job);
      const current = map.get(name) ?? { name, jobs: 0, open: 0, awarded: 0, active: 0, completed: 0, budgetValue: 0, last: null };
      current.jobs += 1;
      if (stage === 'open') current.open += 1;
      if (stage === 'awarded' || stage === 'allocated') current.awarded += 1;
      if (stage === 'in_progress') current.active += 1;
      if (stage === 'completed') current.completed += 1;
      current.budgetValue += Number(job.budget_amount ?? 0);
      const candidate = job.updated_at ?? job.created_at ?? null;
      if (candidate && (!current.last || candidate > current.last)) current.last = candidate;
      map.set(name, current);
    }
    return [...map.values()].sort((a, b) => String(b.last ?? '').localeCompare(String(a.last ?? '')));
  }, [data.jobs, savedCustomers]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (term && !customer.name.toLowerCase().includes(term)) return false;
      if (activity === 'active' && customer.active === 0) return false;
      if (activity === 'completed' && customer.completed === 0) return false;
      return true;
    });
  }, [activity, customers, search]);

  const saveCustomer = async () => {
    const name = customerForm.name.trim();
    if (!name) {
      setCustomerError('Customer name is required.');
      return;
    }
    if (!data.companyId || !isSupabaseConfigured) {
      setCustomerError('Company workspace is not available.');
      return;
    }
    setSavingCustomer(true);
    setCustomerError('');
    const { data: row, error } = await supabase
      .from('company_customers')
      .insert({
        company_id: data.companyId,
        name,
        email: customerForm.email.trim() || null,
        phone: customerForm.phone.trim() || null,
        address: customerForm.address.trim() || null,
        notes: customerForm.notes.trim() || null,
        created_by: user?.id ?? null,
      })
      .select('id,name,email,phone,address,notes,created_at')
      .single();
    setSavingCustomer(false);
    if (error) {
      setCustomerError(error.code === '23505' ? 'This customer already exists in the company customer book.' : error.message);
      return;
    }
    setSavedCustomers((current) => [...current, row as SavedCustomer].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerForm({ name: '', email: '', phone: '', address: '', notes: '' });
    setShowAddCustomer(false);
  };

  const savedByName = useMemo(() => new Map(savedCustomers.map((customer) => [customer.name, customer])), [savedCustomers]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker customers"
        title="Customers"
        description="Customer book plus relationships derived from broker-managed transport activity."
        actions={<ActionButton tone="primary" onClick={() => setShowAddCustomer(true)}>+ Add Customer</ActionButton>}
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      {customerError && <AlertBanner tone="danger">{customerError}</AlertBanner>}

      {showAddCustomer && (
        <section className="workspace-panel" style={{ marginBottom: 8 }}>
          <div className="workspace-panel__header"><strong>Add Customer</strong></div>
          <div className="workspace-panel__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            <label>Customer name<input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Email<input type="email" value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>Phone<input value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label>Address<input value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} /></label>
            <label style={{ gridColumn: '1 / -1' }}>Notes<textarea value={customerForm.notes} onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <ActionButton tone="secondary" onClick={() => setShowAddCustomer(false)}>Cancel</ActionButton>
              <ActionButton tone="primary" disabled={savingCustomer} onClick={() => void saveCustomer()}>{savingCustomer ? 'Saving...' : 'Add Customer'}</ActionButton>
            </div>
          </div>
        </section>
      )}

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
          <div className="workspace-record-meta"><span><strong>{rows.length}</strong> customer relationship{rows.length === 1 ? '' : 's'}</span><span>Source: customer book + broker-owned job history</span></div>
          {rows.length === 0 ? (
            <div className="workspace-panel"><EmptyState compact title="No matching customers" description="Add a customer or adjust the filters." /></div>
          ) : (
            <div className="workspace-record-list">
              {rows.map((customer) => {
                const open = expanded === customer.name;
                const saved = savedByName.get(customer.name);
                return (
                  <article key={customer.name} className="workspace-operational-row" data-state={customer.active ? 'active' : customer.completed ? 'completed' : 'relationship'}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Customer</span><strong>{customer.name}</strong><div>{customer.jobs} managed load{customer.jobs === 1 ? '' : 's'}</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Operational work</span><strong>{customer.active} active</strong><div>{customer.awarded} awarded / allocated · {customer.open} open</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Commercial history</span><strong>{money(customer.budgetValue)}</strong><div>Recorded customer budgets · {customer.completed} completed</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">Last activity</span><strong>{when(customer.last)}</strong><div style={{ marginTop: 4 }}><ActionButton tone="secondary" onClick={() => setExpanded(open ? null : customer.name)}>{open ? 'Close' : 'Details'}</ActionButton></div></div>
                    </div>
                    <div className="workspace-record-meta"><span>{customer.active ? <StatusBadge value="Active execution" tone="green" /> : customer.awarded ? <StatusBadge value="Awarded work" tone="blue" /> : <StatusBadge value={saved ? 'Saved customer' : 'Relationship'} tone="grey" />}</span><span>{customer.completed} completed booking{customer.completed === 1 ? '' : 's'}</span></div>
                    {open && (
                      <div className="workspace-record-details">
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Total loads</strong><div>{customer.jobs}</div></div>
                          <div className="workspace-detail-item"><strong>Open</strong><div>{customer.open}</div></div>
                          <div className="workspace-detail-item"><strong>Awarded / allocated</strong><div>{customer.awarded}</div></div>
                          <div className="workspace-detail-item"><strong>In execution</strong><div>{customer.active}</div></div>
                          <div className="workspace-detail-item"><strong>Completed</strong><div>{customer.completed}</div></div>
                          <div className="workspace-detail-item"><strong>Recorded customer budget</strong><div>{money(customer.budgetValue)}</div></div>
                          {saved && <div className="workspace-detail-item"><strong>Contact</strong><div>{saved.email || saved.phone || 'No contact details yet'}</div></div>}
                          {saved?.address && <div className="workspace-detail-item"><strong>Address</strong><div>{saved.address}</div></div>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                          <ActionButton tone="secondary" onClick={() => router.push(`/broker/loads?customer=${encodeURIComponent(customer.name)}`)}>View loads</ActionButton>
                          <ActionButton tone="primary" onClick={() => router.push(`/broker/post-load?customer=${encodeURIComponent(customer.name)}`)}>Post load for customer</ActionButton>
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
