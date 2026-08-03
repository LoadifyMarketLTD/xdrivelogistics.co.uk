'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Quote, VehicleType, CargoType, Company } from '../../../lib/types/database';
import { VEHICLE_GROUPS, VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { useAuth } from '../../components/AuthContext';
import {
  ActionButton,
  AlertBanner,
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalFilters,
  OperationalPageLayout,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

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
    // bootstrap_company_membership() returns profiles.company_id and ensures
    // a company_memberships row exists for RLS is_company_member() checks.
    // Unlike get_or_create_company_for_user(), it does NOT auto-provision a new
    // company when profiles.company_id is already set — preventing the orphaned
    // company bug where each page load creates a fresh empty company.
    const { data: bootstrappedId } = await supabase.rpc('bootstrap_company_membership');
    if (typeof bootstrappedId === 'string' && bootstrappedId.length > 0) {
      setCompanyId(bootstrappedId);
      return;
    }
    // Fallback: bootstrap function not yet deployed — use legacy path.
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
    const { data, error } = await supabase
      .from('quotes')
      .select('id, company_id, customer_name, customer_email, customer_phone, pickup_location, delivery_location, vehicle_type, cargo_type, amount, currency, status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (!error && data) setQuotes(data as Quote[]);
    setLoading(false);
  };

  const loadCompanies = async () => {
    if (!isSupabaseConfigured || !companyId) return;
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .order('name');
    if (error) { console.error('Failed to load companies:', error.message); return; }
    if (data) setCompanies(data as Pick<Company, 'id' | 'name'>[]);
  };

  useEffect(() => {
    if (user?.companyId) {
      // Fast path: company already resolved in auth context — no RPC needed.
      setCompanyId(user.companyId);
    } else if (hasSupabaseSession && user?.id) {
      loadCompanyId(user.id);
    }
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  useEffect(() => {
    if (!companyId) return;
    setFormData((prev) => ({ ...prev, company_id: companyId }));
    loadQuotes();
    loadCompanies();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!companyId) { setError('Company profile is required'); return; }
    if (!formData.customer_name.trim()) { setError('Customer name is required'); return; }
    if (!isSupabaseConfigured) { setError('Supabase is not configured'); return; }
    const { error } = await supabase.from('quotes').insert([{
      ...formData,
      company_id: companyId,
      amount: formData.amount ? parseFloat(formData.amount) : null,
    }]);
    if (error) { setError(error.message); return; }
    setShowModal(false);
    setFormData({ company_id: '', customer_name: '', customer_email: '', customer_phone: '', pickup_location: '', delivery_location: '', vehicle_type: 'van_large', cargo_type: 'packages', amount: '', currency: 'GBP' });
    setError('');
    loadQuotes();
  };

  const handleUpdateStatus = async (quoteId: string, status: string) => {
    if (!isSupabaseConfigured || !companyId) return;
    const { error } = await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quoteId)
      .eq('company_id', companyId);
    if (!error) {
      setFlowMessage(`Quote moved to ${status}.`);
      loadQuotes();
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
      // Mark quote as converted
      await supabase
        .from('quotes')
        .update({ status: 'converted' })
        .eq('id', quote.id)
        .eq('company_id', companyId);
      loadQuotes();
      setFlowMessage('Quote converted to job successfully.');
      if (jobData?.id) {
        router.push(`/admin/jobs/${jobData.id}`);
      }
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
      return [
        quote.customer_name,
        quote.pickup_location,
        quote.delivery_location,
        quote.customer_email,
      ]
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

  const filterPanel = (
    <OperationalFilters
      title="Search Quotes"
      onClear={() => { setSearchTerm(''); setVehicleFilter('all'); }}
    >
      {!isSupabaseConfigured && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '6px 8px', marginBottom: '6px', color: '#92400e', fontSize: '12px' }}>⚠️ Supabase not configured</div>
      )}
      <OperationalFilterField label="CUSTOMER / LOCATION">
        <OperationalFilterInput
          value={searchTerm}
          onChange={(v) => setSearchTerm(v)}
          placeholder="Search…"
        />
      </OperationalFilterField>
      <OperationalFilterField label="VEHICLE SIZE">
        <OperationalFilterSelect
          value={vehicleFilter}
          onChange={(v) => setVehicleFilter(v)}
          options={[
            { value: 'all', label: 'Any' },
            ...VEHICLE_GROUPS.flatMap(([, options]) => options.map(([label, value]) => ({ value, label }))),
          ]}
        />
      </OperationalFilterField>
      <OperationalFilterField label="DATE">
        <OperationalFilterSelect
          value="anytime"
          onChange={() => {}}
          options={[
            { value: 'anytime', label: 'Anytime' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
          ]}
        />
      </OperationalFilterField>
    </OperationalFilters>
  );

  return (
    <ProtectedRoute>
      <OperationalPageLayout searchPanel={filterPanel}>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div>

          {/* Status tabs + New Quote button — contract 36px row */}
          <div className={cssStyles.jobsStatusTabs} role="tablist" aria-label="Filter quotes by status" style={{ marginBottom: '8px' }}>
            {QUOTE_TABS.map((tab) => {
              const count = quotes.filter((q) => tab.statuses.includes((q.status || '').toLowerCase())).length;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`${cssStyles.jobsStatusTab} ${active ? cssStyles.jobsStatusTabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {count > 0 && (
                    <span style={{ marginLeft: '4px', background: active ? '#dbeafe' : '#f1f5f9', color: active ? '#1d57d8' : '#5f6368', borderRadius: '999px', padding: '0 4px', fontSize: '10px', fontWeight: 700 }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <ActionButton tone="success" onClick={() => setShowModal(true)}>+ New Quote</ActionButton>
          </div>
          {flowMessage && <AlertBanner tone="success">{flowMessage}</AlertBanner>}

          {/* Table */}
          <div>
            <div className={cssStyles.operationalTableContainer}>
              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>Loading…</div>
              ) : filteredQuotes.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No quotes in this category.</div>
              ) : (
                <div className={cssStyles.operationalTableScroll}>
                  <table className={cssStyles.operationalTable} style={{ minWidth: '820px' }}>
                    <caption className={cssStyles.operationalTableCaption}>Quotes register</caption>
                    <thead>
                      <tr className={cssStyles.operationalTableHeaderRow}>
                        {['Customer', 'Pickup', 'Delivery', 'Vehicle', 'Amount', 'Status', 'Created', 'Actions'].map((h) => (
                          <th key={h} scope="col" className={cssStyles.operationalTableHeadCell}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedQuotes.map((q) => {
                        return (
                          <tr key={q.id} className={`${cssStyles.operationalTableRow} xdrive-table-row`}>
                            <td className={cssStyles.operationalTableCell} style={{ fontWeight: 600 }}>{q.customer_name || '—'}</td>
                            <td className={cssStyles.operationalTableCell}>{q.pickup_location || '—'}</td>
                            <td className={cssStyles.operationalTableCell}>{q.delivery_location || '—'}</td>
                            <td className={cssStyles.operationalTableCell}>{(q.vehicle_type && VEHICLE_TYPE_LABELS[q.vehicle_type]) || q.vehicle_type?.replace(/_/g, ' ') || '—'}</td>
                            <td className={cssStyles.operationalTableCell} style={{ fontWeight: 600 }}>{q.amount ? `£${q.amount.toFixed(2)}` : '—'}</td>
                            <td className={cssStyles.operationalTableCell}>
                              <StatusBadge value={q.status} />
                            </td>
                            <td className={cssStyles.operationalTableCell}>{new Date(q.created_at).toLocaleDateString('en-GB')}</td>
                            <td className={`${cssStyles.operationalTableCell} ${cssStyles.operationalTableActionCell}`}>
                              <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
                                {q.status === 'draft' && (
                                  <ActionButton tone="secondary" onClick={() => handleUpdateStatus(q.id, 'sent')}>Send</ActionButton>
                                )}
                                {(q.status === 'draft' || q.status === 'sent') && (
                                  <>
                                    <ActionButton tone="success" onClick={() => handleUpdateStatus(q.id, 'accepted')}>Accept</ActionButton>
                                    <ActionButton tone="danger" onClick={() => handleUpdateStatus(q.id, 'declined')}>Decline</ActionButton>
                                  </>
                                )}
                                {q.status === 'sent' && (
                                  <ActionButton tone="warning" onClick={() => void handleReviseQuote(q.id)}>Revise</ActionButton>
                                )}
                                {(q.status === 'draft' || q.status === 'sent' || q.status === 'accepted') && (
                                  <ActionButton tone="secondary" onClick={() => void handleWithdrawQuote(q.id)}>Withdraw</ActionButton>
                                )}
                                {q.status === 'accepted' && (
                                  <ActionButton tone="success" disabled={convertingId === q.id} onClick={() => handleConvertToJob(q)}>
                                    {convertingId === q.id ? 'Converting…' : '→ Job'}
                                  </ActionButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {!loading && filteredQuotes.length > QUOTES_PER_PAGE && (
              <div className={cssStyles.operationalTableMeta} style={{ marginTop: '8px' }}>
                <span>
                  Showing {safeQuotePage * QUOTES_PER_PAGE + 1}–{Math.min((safeQuotePage + 1) * QUOTES_PER_PAGE, filteredQuotes.length)} of {filteredQuotes.length}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <ActionButton tone="secondary" disabled={safeQuotePage === 0} onClick={() => setQuotePage((prev) => Math.max(prev - 1, 0))}>
                    Previous
                  </ActionButton>
                  <ActionButton tone="secondary" disabled={safeQuotePage >= totalQuotePages - 1} onClick={() => setQuotePage((prev) => Math.min(prev + 1, totalQuotePages - 1))}>
                    Next
                  </ActionButton>
                </div>
              </div>
            )}
          </div>
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '4px', border: '1px solid #d9e2ec', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124', lineHeight: '20px' }}>New Quote</h2>
                <button type="button" onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
                {error && <AlertBanner tone="danger">{error}</AlertBanner>}
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Company *</label>
                  <select className={cssStyles.settingsInput} value={formData.company_id} onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}>
                    <option value="">Select a company…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Customer Name *</label>
                  <input className={cssStyles.settingsInput} value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} placeholder="John Smith" />
                </div>
                <div className={cssStyles.settingsFieldGrid}>
                  <div>
                    <label className={cssStyles.settingsLabel}>Email</label>
                    <input type="email" className={cssStyles.settingsInput} value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} placeholder="customer@email.com" />
                  </div>
                  <div>
                    <label className={cssStyles.settingsLabel}>Phone</label>
                    <input className={cssStyles.settingsInput} value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} placeholder="07123456789" />
                  </div>
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Pickup Location</label>
                  <input className={cssStyles.settingsInput} value={formData.pickup_location} onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })} placeholder="London, SW1A 1AA" />
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Delivery Location</label>
                  <input className={cssStyles.settingsInput} value={formData.delivery_location} onChange={(e) => setFormData({ ...formData, delivery_location: e.target.value })} placeholder="Manchester, M1 1AE" />
                </div>
                <div className={cssStyles.settingsFieldGrid}>
                  <div>
                    <label className={cssStyles.settingsLabel}>Vehicle Type</label>
                    <select className={cssStyles.settingsInput} value={formData.vehicle_type} onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as VehicleType })}>
                      {VEHICLE_GROUPS.map(([group, options]) => (
                        <optgroup key={group} label={group}>
                          {options.map(([label, value]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={cssStyles.settingsLabel}>Cargo Type</label>
                    <select className={cssStyles.settingsInput} value={formData.cargo_type} onChange={(e) => setFormData({ ...formData, cargo_type: e.target.value as CargoType })}>
                      {CARGO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className={cssStyles.settingsFieldRow}>
                  <label className={cssStyles.settingsLabel}>Amount (£)</label>
                  <input type="number" step="0.01" className={cssStyles.settingsInput} value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="250.00" />
                </div>
              </div>
              <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <ActionButton tone="secondary" onClick={() => { setShowModal(false); setError(''); }}>Cancel</ActionButton>
                <ActionButton tone="success" onClick={handleCreate}>Create Quote</ActionButton>
              </div>
            </div>
          </div>
        )}
      </OperationalPageLayout>
    </ProtectedRoute>
  );
}
