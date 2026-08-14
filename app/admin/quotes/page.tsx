'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Quote, VehicleType, CargoType, Company } from '../../../lib/types/database';
import { VEHICLE_GROUPS, VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { useAuth } from '../../components/AuthContext';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

const CARGO_TYPES: CargoType[] = ['documents', 'packages', 'pallets', 'furniture', 'machinery', 'retail_goods', 'mixed_freight', 'adr_goods', 'temperature_controlled_freight', 'equipment', 'other'];

const QUOTE_TABS: Array<{ id: string; label: string; statuses: string[] }> = [
  { id: 'received', label: 'Received', statuses: ['draft'] },
  { id: 'submitted', label: 'Submitted', statuses: ['sent'] },
  { id: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { id: 'converted', label: 'Converted', statuses: ['converted'] },
  { id: 'rejected', label: 'Unsuccessful', statuses: ['declined'] },
  { id: 'withdrawn', label: 'Withdrawn', statuses: ['withdrawn'] },
] as const;

export default function QuotesPage() {
  const { user, hasSupabaseSession } = useAuth();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<Pick<Company, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_id: '', customer_name: '', customer_email: '', customer_phone: '',
    pickup_location: '', delivery_location: '',
    vehicle_type: 'van_large' as VehicleType, cargo_type: 'packages' as CargoType,
    amount: '', currency: 'GBP',
  });
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('received');
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const QUOTES_PER_PAGE = 12;
  const [quotePage, setQuotePage] = useState(0);
  const [flowMessage, setFlowMessage] = useState('');

  const loadCompanyId = async (userId: string) => {
    const { data: bootstrappedId } = await supabase.rpc('bootstrap_company_membership');
    if (typeof bootstrappedId === 'string' && bootstrappedId.length > 0) {
      setCompanyId(bootstrappedId);
      return;
    }
    const { data: rpcId } = await supabase.rpc('get_or_create_company_for_user');
    if (rpcId) {
      setCompanyId(rpcId as string);
      return;
    }
    const { data: membership } = await supabase
      .from('company_memberships')
      .select('company_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    setCompanyId((membership?.company_id as string) ?? null);
  };

  const loadQuotes = async () => {
    setLoading(true);
    if (!isSupabaseConfigured || !companyId) { setLoading(false); return; }
    const { data, error: queryError } = await supabase
      .from('quotes')
      .select('id, company_id, customer_name, customer_email, customer_phone, pickup_location, delivery_location, vehicle_type, cargo_type, amount, currency, status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (!queryError && data) setQuotes(data as Quote[]);
    setLoading(false);
  };

  const loadCompanies = async () => {
    if (!isSupabaseConfigured || !companyId) return;
    const { data, error: queryError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .order('name');
    if (queryError) { console.error('Failed to load companies:', queryError.message); return; }
    if (data) setCompanies(data as Pick<Company, 'id' | 'name'>[]);
  };

  useEffect(() => {
    if (user?.companyId) {
      setCompanyId(user.companyId);
    } else if (hasSupabaseSession && user?.id) {
      void loadCompanyId(user.id);
    }
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  useEffect(() => {
    if (!companyId) return;
    setFormData((previous) => ({ ...previous, company_id: companyId }));
    void loadQuotes();
    void loadCompanies();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!companyId) { setError('Company profile is required'); return; }
    if (!formData.customer_name.trim()) { setError('Customer name is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    const { error: createError } = await supabase.from('quotes').insert([{
      ...formData,
      company_id: companyId,
      amount: formData.amount ? parseFloat(formData.amount) : null,
    }]);
    if (createError) { setError(createError.message); return; }
    setShowModal(false);
    setFormData({ company_id: '', customer_name: '', customer_email: '', customer_phone: '', pickup_location: '', delivery_location: '', vehicle_type: 'van_large', cargo_type: 'packages', amount: '', currency: 'GBP' });
    setError('');
    void loadQuotes();
  };

  const handleUpdateStatus = async (quoteId: string, status: string) => {
    if (!isSupabaseConfigured || !companyId) return;
    const { error: updateError } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quoteId)
      .eq('company_id', companyId);
    if (!updateError) {
      setFlowMessage(`Quote moved to ${status}.`);
      void loadQuotes();
    }
  };

  const handleWithdrawQuote = async (quoteId: string) => {
    await handleUpdateStatus(quoteId, 'withdrawn');
  };

  const handleReviseQuote = async (quoteId: string) => {
    await handleUpdateStatus(quoteId, 'draft');
  };

  const handleConvertToJob = async (quote: Quote) => {
    if (!companyId || !isSupabaseConfigured || !hasSupabaseSession) return;
    setConvertingId(quote.id);
    setFlowMessage('');
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert([{
          company_id: companyId,
          created_by: user?.id ?? null,
          status: 'posted',
          client_name: quote.customer_name,
          client_email: quote.customer_email ?? null,
          client_phone: quote.customer_phone ?? null,
          load_details: quote.customer_name,
          pickup_location: quote.pickup_location ?? null,
          delivery_location: quote.delivery_location ?? null,
          vehicle_type: quote.vehicle_type ?? null,
          cargo_type: quote.cargo_type ?? null,
        }])
        .select('id')
        .single();
      if (jobError) {
        console.error('Failed to create job from quote:', jobError.message);
        return;
      }
      await supabase
        .from('quotes')
        .update({ status: 'converted' })
        .eq('id', quote.id)
        .eq('company_id', companyId);
      void loadQuotes();
      setFlowMessage('Quote converted to job successfully.');
      if (jobData?.id) router.push(`/admin/jobs/${jobData.id}`);
    } finally {
      setConvertingId(null);
    }
  };

  const filteredQuotes = useMemo(() => {
    const activeStatuses = QUOTE_TABS.find((tab) => tab.id === activeTab)?.statuses ?? [];
    return quotes.filter((quote) => {
      if (!activeStatuses.includes((quote.status || '').toLowerCase())) return false;
      if (vehicleFilter !== 'all' && quote.vehicle_type !== vehicleFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.trim().toLowerCase();
      return [quote.customer_name, quote.pickup_location, quote.delivery_location, quote.customer_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [quotes, activeTab, vehicleFilter, searchTerm]);

  useEffect(() => {
    setQuotePage(0);
  }, [activeTab, vehicleFilter, searchTerm, quotes.length]);

  const totalQuotePages = Math.max(1, Math.ceil(filteredQuotes.length / QUOTES_PER_PAGE));
  const safeQuotePage = Math.min(quotePage, totalQuotePages - 1);
  const paginatedQuotes = filteredQuotes.slice(safeQuotePage * QUOTES_PER_PAGE, (safeQuotePage + 1) * QUOTES_PER_PAGE);

  const clearFilters = () => {
    setSearchTerm('');
    setVehicleFilter('all');
  };

  return (
    <ProtectedRoute>
      <PageFrame>
        <PageHeader
          eyebrow="Carrier commercial"
          title="Quotes"
          description="Manage customer quotes through the existing quote lifecycle from one dense operational register."
          actions={<ActionButton tone="success" onClick={() => setShowModal(true)}>New Quote</ActionButton>}
        />

        {!isSupabaseConfigured && <AlertBanner tone="warning">Supabase is not configured for this workspace.</AlertBanner>}
        {flowMessage && <AlertBanner tone="success">{flowMessage}</AlertBanner>}

        <div className="workspace-board-layout">
          <aside className="workspace-filter-rail" aria-label="Quote filters">
            <div className="workspace-filter-rail__header">Filter Quotes</div>
            <div className="workspace-filter-rail__body">
              <label>
                CUSTOMER / LOCATION
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Customer, route or email" />
              </label>
              <label>
                VEHICLE
                <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}>
                  <option value="all">Any vehicle</option>
                  {VEHICLE_GROUPS.map(([group, options]) => (
                    <optgroup key={group} label={group}>
                      {options.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: '15px' }}>Filters apply live to the current status tab.</div>
              <ActionButton tone="secondary" onClick={clearFilters}>Clear filters</ActionButton>
            </div>
          </aside>

          <main style={{ minWidth: 0 }}>
            <div className="workspace-tab-strip" role="tablist" aria-label="Quote statuses" style={{ display: 'flex', overflowX: 'auto', marginBottom: 8 }}>
              {QUOTE_TABS.map((tab) => {
                const count = quotes.filter((quote) => tab.statuses.includes((quote.status || '').toLowerCase())).length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    data-active={activeTab === tab.id ? 'true' : 'false'}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label} <span>{count}</span>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="workspace-panel"><EmptyState compact title="Loading quotes…" /></div>
            ) : paginatedQuotes.length === 0 ? (
              <div className="workspace-panel"><EmptyState compact title="No quotes in this view" description="Adjust the filters or choose another status." /></div>
            ) : (
              <div className="workspace-panel" style={{ padding: 0, overflow: 'hidden' }}>
                <DataTable
                  columns={['Customer', 'Pickup', 'Delivery', 'Vehicle', 'Amount', 'Status', 'Created', 'Actions']}
                  rows={paginatedQuotes.map((quote) => [
                    <strong key="customer">{quote.customer_name || '—'}</strong>,
                    quote.pickup_location || '—',
                    quote.delivery_location || '—',
                    (quote.vehicle_type && VEHICLE_TYPE_LABELS[quote.vehicle_type]) || quote.vehicle_type?.replace(/_/g, ' ') || '—',
                    quote.amount != null ? `£${quote.amount.toFixed(2)}` : '—',
                    <StatusBadge key="status" value={quote.status} />,
                    new Date(quote.created_at).toLocaleDateString('en-GB'),
                    <div key="actions" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {quote.status === 'draft' && <ActionButton tone="primary" onClick={() => void handleUpdateStatus(quote.id, 'sent')}>Send</ActionButton>}
                      {(quote.status === 'draft' || quote.status === 'sent') && <ActionButton tone="success" onClick={() => void handleUpdateStatus(quote.id, 'accepted')}>Accept</ActionButton>}
                      {(quote.status === 'draft' || quote.status === 'sent') && <ActionButton tone="danger" onClick={() => void handleUpdateStatus(quote.id, 'declined')}>Decline</ActionButton>}
                      {quote.status === 'sent' && <ActionButton tone="warning" onClick={() => void handleReviseQuote(quote.id)}>Revise</ActionButton>}
                      {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted') && <ActionButton tone="secondary" onClick={() => void handleWithdrawQuote(quote.id)}>Withdraw</ActionButton>}
                      {quote.status === 'accepted' && <ActionButton tone="success" disabled={convertingId === quote.id} onClick={() => void handleConvertToJob(quote)}>{convertingId === quote.id ? 'Converting…' : 'Convert to Job'}</ActionButton>}
                    </div>,
                  ])}
                />
              </div>
            )}

            {!loading && filteredQuotes.length > QUOTES_PER_PAGE && (
              <div style={{ minHeight: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: '#64748b' }}>
                <span>Showing {safeQuotePage * QUOTES_PER_PAGE + 1}–{Math.min((safeQuotePage + 1) * QUOTES_PER_PAGE, filteredQuotes.length)} of {filteredQuotes.length}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <ActionButton tone="secondary" onClick={() => setQuotePage((previous) => Math.max(previous - 1, 0))} disabled={safeQuotePage === 0}>Previous</ActionButton>
                  <ActionButton tone="secondary" onClick={() => setQuotePage((previous) => Math.min(previous + 1, totalQuotePages - 1))} disabled={safeQuotePage >= totalQuotePages - 1}>Next</ActionButton>
                </div>
              </div>
            )}
          </main>
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #cfd7e3', borderRadius: 4, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ minHeight: 36, padding: '0 12px', borderBottom: '1px solid #e2e7ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14 }}>New Quote</strong>
                <ActionButton tone="secondary" onClick={() => { setShowModal(false); setError(''); }}>Close</ActionButton>
              </div>
              <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                {error && <AlertBanner tone="danger">{error}</AlertBanner>}
                <QuoteField label="Company *"><select style={modalControl} value={formData.company_id} onChange={(event) => setFormData({ ...formData, company_id: event.target.value })}><option value="">Select a company…</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></QuoteField>
                <QuoteField label="Customer Name *"><input style={modalControl} value={formData.customer_name} onChange={(event) => setFormData({ ...formData, customer_name: event.target.value })} /></QuoteField>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                  <QuoteField label="Email"><input style={modalControl} type="email" value={formData.customer_email} onChange={(event) => setFormData({ ...formData, customer_email: event.target.value })} /></QuoteField>
                  <QuoteField label="Phone"><input style={modalControl} value={formData.customer_phone} onChange={(event) => setFormData({ ...formData, customer_phone: event.target.value })} /></QuoteField>
                </div>
                <QuoteField label="Pickup Location"><input style={modalControl} value={formData.pickup_location} onChange={(event) => setFormData({ ...formData, pickup_location: event.target.value })} /></QuoteField>
                <QuoteField label="Delivery Location"><input style={modalControl} value={formData.delivery_location} onChange={(event) => setFormData({ ...formData, delivery_location: event.target.value })} /></QuoteField>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                  <QuoteField label="Vehicle Type"><select style={modalControl} value={formData.vehicle_type} onChange={(event) => setFormData({ ...formData, vehicle_type: event.target.value as VehicleType })}>{VEHICLE_GROUPS.map(([group, options]) => <optgroup key={group} label={group}>{options.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}</select></QuoteField>
                  <QuoteField label="Cargo Type"><select style={modalControl} value={formData.cargo_type} onChange={(event) => setFormData({ ...formData, cargo_type: event.target.value as CargoType })}>{CARGO_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></QuoteField>
                </div>
                <QuoteField label="Amount (£)"><input style={modalControl} type="number" step="0.01" value={formData.amount} onChange={(event) => setFormData({ ...formData, amount: event.target.value })} /></QuoteField>
              </div>
              <div style={{ minHeight: 44, padding: '6px 12px', borderTop: '1px solid #e2e7ed', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                <ActionButton tone="secondary" onClick={() => { setShowModal(false); setError(''); }}>Cancel</ActionButton>
                <ActionButton tone="success" onClick={() => void handleCreate()}>Create Quote</ActionButton>
              </div>
            </div>
          </div>
        )}
      </PageFrame>
    </ProtectedRoute>
  );
}

function QuoteField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#334155' }}><span>{label}</span>{children}</label>;
}

const modalControl: React.CSSProperties = {
  width: '100%',
  minHeight: 32,
  boxSizing: 'border-box',
  border: '1px solid #cfd7e3',
  borderRadius: 4,
  padding: '5px 8px',
  background: '#fff',
  color: '#172033',
  fontSize: 13,
};
