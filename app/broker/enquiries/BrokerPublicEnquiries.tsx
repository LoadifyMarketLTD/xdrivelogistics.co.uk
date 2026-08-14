'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type PublicEnquiry = {
  id: string;
  company_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
};

type EnquiryTab = 'all' | 'new' | 'priced' | 'archived';

const when = (value: string) => new Date(value).toLocaleString('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const money = (amount: number | null, currency: string | null) =>
  typeof amount === 'number'
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
    : 'Not priced';

const statusOf = (value: string | null) => String(value || 'draft').toLowerCase();
const normaliseStatus = (value: string | null) => statusOf(value).replaceAll('_', ' ');

function matchesTab(row: PublicEnquiry, tab: EnquiryTab) {
  const status = statusOf(row.status);
  if (tab === 'all') return true;
  if (tab === 'new') return ['draft', 'new', 'pending', 'received'].includes(status);
  if (tab === 'priced') return typeof row.amount === 'number' && row.amount > 0 && !['archived', 'cancelled', 'closed'].includes(status);
  return ['archived', 'cancelled', 'closed', 'expired'].includes(status);
}

export default function BrokerPublicEnquiries() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PublicEnquiry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<EnquiryTab>('all');
  const [customer, setCustomer] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [reference, setReference] = useState('');

  const load = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured for this workspace.');
      setLoading(false);
      return;
    }
    if (!user?.companyId) {
      setError('No active broker company is available for this account.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('quotes')
      .select('id,company_id,customer_name,customer_email,customer_phone,pickup_location,delivery_location,vehicle_type,cargo_type,amount,currency,status,notes,created_at')
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: false })
      .limit(250);

    if (queryError) {
      setRows([]);
      setError(queryError.message || 'Unable to load public enquiries.');
    } else {
      setRows((data ?? []) as PublicEnquiry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId]);

  const filtered = useMemo(() => {
    const customerTerm = customer.trim().toLowerCase();
    const pickupTerm = pickup.trim().toLowerCase();
    const deliveryTerm = delivery.trim().toLowerCase();
    const vehicleTerm = vehicle.trim().toLowerCase();
    const referenceTerm = reference.trim().toLowerCase();

    return rows
      .filter((row) => matchesTab(row, tab))
      .filter((row) => !customerTerm || `${row.customer_name || ''} ${row.customer_email || ''}`.toLowerCase().includes(customerTerm))
      .filter((row) => !pickupTerm || String(row.pickup_location || '').toLowerCase().includes(pickupTerm))
      .filter((row) => !deliveryTerm || String(row.delivery_location || '').toLowerCase().includes(deliveryTerm))
      .filter((row) => !vehicleTerm || `${row.vehicle_type || ''} ${row.cargo_type || ''}`.toLowerCase().includes(vehicleTerm))
      .filter((row) => !referenceTerm || row.id.toLowerCase().includes(referenceTerm));
  }, [customer, delivery, pickup, reference, rows, tab, vehicle]);

  const counts = useMemo(() => ({
    all: rows.length,
    new: rows.filter((row) => matchesTab(row, 'new')).length,
    priced: rows.filter((row) => matchesTab(row, 'priced')).length,
    archived: rows.filter((row) => matchesTab(row, 'archived')).length,
  }), [rows]);

  const clearFilters = () => {
    setCustomer('');
    setPickup('');
    setDelivery('');
    setVehicle('');
    setReference('');
  };

  const tabs: Array<{ id: EnquiryTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'new', label: 'New', count: counts.new },
    { id: 'priced', label: 'Priced', count: counts.priced },
    { id: 'archived', label: 'Archived', count: counts.archived },
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer intake"
        title="Enquiries"
        description="Review customer transport requests, route details and commercial status without leaving the operational board."
        actions={<ActionButton tone="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>}
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Enquiry filters">
          <div className="workspace-filter-rail__header">Search Enquiries</div>
          <div className="workspace-filter-rail__body">
            <label>
              CUSTOMER
              <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Name / email" />
            </label>
            <label>
              FROM
              <input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Collection location" />
            </label>
            <label>
              TO
              <input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Delivery location" />
            </label>
            <label>
              VEHICLE / CARGO
              <input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Vehicle or freight" />
            </label>
            <label>
              ENQUIRY ID
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference" />
            </label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <ActionButton tone="primary" onClick={() => undefined}>Search</ActionButton>
              <ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton>
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
              >
                {item.label} {item.count}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}>
              <EmptyState compact title="Loading enquiries…" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}>
              <EmptyState compact title="No matching enquiries" description="Adjust the filters or select another status." />
            </div>
          ) : (
            <div className="workspace-record-list">
              {filtered.map((row) => {
                const open = expanded === row.id;
                return (
                  <article className="workspace-operational-row" key={row.id} data-state={statusOf(row.status)}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell">
                        <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>CUSTOMER / FROM</div>
                        <strong>{row.customer_name || 'Customer'}</strong>
                        <div style={{ marginTop: 2 }}>{row.pickup_location || 'Collection not supplied'}</div>
                      </div>
                      <div className="workspace-operational-cell">
                        <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>TO</div>
                        <strong>{row.delivery_location || 'Delivery not supplied'}</strong>
                        <div style={{ color: '#64748b', marginTop: 2 }}>{when(row.created_at)}</div>
                      </div>
                      <div className="workspace-operational-cell">
                        <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>LOAD</div>
                        <strong>{row.vehicle_type ? row.vehicle_type.replaceAll('_', ' ') : 'Vehicle not specified'}</strong>
                        <div style={{ color: '#64748b', marginTop: 2 }}>{row.cargo_type || 'Cargo not specified'}</div>
                      </div>
                      <div className="workspace-operational-cell">
                        <div style={{ fontSize: 8.5, color: '#64748b', fontWeight: 800 }}>COMMERCIAL</div>
                        <strong>{money(row.amount, row.currency)}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                          <StatusBadge value={normaliseStatus(row.status)} />
                          <ActionButton tone="secondary" onClick={() => setExpanded(open ? null : row.id)}>{open ? 'Close' : 'Open'}</ActionButton>
                        </div>
                      </div>
                    </div>

                    <div className="workspace-record-meta">
                      <span>Enquiry #{row.id.slice(0, 8).toUpperCase()}</span>
                      <span>{row.customer_email || 'No email'}</span>
                      <span>{row.customer_phone || 'No phone'}</span>
                    </div>

                    {open && (
                      <div className="workspace-record-details">
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Customer</strong><div>{row.customer_name || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Email</strong><div>{row.customer_email || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Phone</strong><div>{row.customer_phone || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Current price</strong><div>{money(row.amount, row.currency)}</div></div>
                          <div className="workspace-detail-item"><strong>Collection</strong><div>{row.pickup_location || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Delivery</strong><div>{row.delivery_location || '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Vehicle</strong><div>{row.vehicle_type || 'Not specified'}</div></div>
                          <div className="workspace-detail-item"><strong>Cargo</strong><div>{row.cargo_type || 'Not specified'}</div></div>
                        </div>

                        <div style={{ marginTop: 5, padding: '5px 6px', border: '1px solid #dfe5ec', background: '#fff' }}>
                          <strong>Request notes</strong>
                          <div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{row.notes || 'No notes supplied'}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                          {row.customer_phone && (
                            <ActionButton tone="primary" onClick={() => { window.location.href = `tel:${row.customer_phone}`; }}>Call customer</ActionButton>
                          )}
                          {row.customer_email && (
                            <ActionButton tone="secondary" onClick={() => { window.location.href = `mailto:${row.customer_email}`; }}>Email customer</ActionButton>
                          )}
                        </div>

                        <div style={{ marginTop: 5, padding: 6, border: '1px solid #f5d98b', background: '#fff8e6', color: '#6b4d00' }}>
                          Pricing progression and Convert to Job remain backend-dependent actions; this migration does not introduce unaudited client-side writes.
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
