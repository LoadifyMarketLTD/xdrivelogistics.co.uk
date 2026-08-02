'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Quote, VehicleType, CargoType, Company } from '../../../lib/types/database';
import { VEHICLE_GROUPS, VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { useAuth } from '../../components/AuthContext';
import {
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalFilters,
  OperationalPageLayout,
} from '../../components/workspace/WorkspaceUI';

const CARGO_TYPES: CargoType[] = ['documents', 'packages', 'pallets', 'furniture', 'machinery', 'retail_goods', 'mixed_freight', 'adr_goods', 'temperature_controlled_freight', 'equipment', 'other'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  sent: { bg: '#e0f2fe', text: '#075985' },
  accepted: { bg: '#d1fae5', text: '#065f46' },
  declined: { bg: '#fee2e2', text: '#991b1b' },
  converted: { bg: '#ede9fe', text: '#5b21b6' },
  withdrawn: { bg: '#e2e8f0', text: '#475569' },
};

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

  const inputStyle = { width: '100%', height: '32px', padding: '0 8px', border: '1px solid #d9e2ec', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' as const, backgroundColor: 'white' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600' as const, color: '#5f6368', marginBottom: '4px' };
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

          {/* Tab bar + New Quote button */}
          <div style={{ background: '#fff', border: '1px solid #d9e2ec', borderRadius: '4px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '40px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {QUOTE_TABS.map((tab) => {
                const count = quotes.filter((q) => tab.statuses.includes((q.status || '').toLowerCase())).length;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      height: '40px',
                      padding: '0 12px',
                      border: 'none',
                      borderBottom: active ? '2px solid #1d57d8' : '2px solid transparent',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: active ? '#1d57d8' : '#5f6368',
                      marginBottom: '-1px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span style={{ marginLeft: '6px', background: active ? '#dbeafe' : '#f1f5f9', color: active ? '#1d57d8' : '#5f6368', borderRadius: '999px', padding: '1px 6px', fontSize: '11px', fontWeight: 600 }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{ height: '28px', padding: '0 12px', background: '#35a853', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + New Quote
            </button>
          </div>
          {flowMessage && (
            <div style={{ marginBottom: '8px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', padding: '8px 12px', color: '#166534', fontSize: '13px', fontWeight: 600 }}>
              {flowMessage}
            </div>
          )}

          {/* Table */}
          <div>
            <div style={{ background: '#fff', borderRadius: '4px', border: '1px solid #d9e2ec', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>Loading…</div>
              ) : filteredQuotes.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                  <div style={{ fontSize: '0.88rem' }}>No quotes in this category.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['Customer', 'Pickup', 'Delivery', 'Vehicle', 'Amount', 'Status', 'Created', 'Actions'].map((h) => (
                          <th key={h} style={{ height: '36px', padding: '0 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedQuotes.map((q, i) => {
                        const sc = STATUS_COLORS[q.status] ?? STATUS_COLORS.draft;
                        return (
                          <tr key={q.id} style={{ height: '40px', borderBottom: i < paginatedQuotes.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '0 12px', fontWeight: 600, color: '#202124', fontSize: '13px' }}>{q.customer_name || '—'}</td>
                            <td style={{ padding: '0 12px', color: '#202124', fontSize: '13px' }}>{q.pickup_location || '—'}</td>
                            <td style={{ padding: '0 12px', color: '#202124', fontSize: '13px' }}>{q.delivery_location || '—'}</td>
                            <td style={{ padding: '0 12px', color: '#5f6368', fontSize: '13px' }}>{(q.vehicle_type && VEHICLE_TYPE_LABELS[q.vehicle_type]) || q.vehicle_type?.replace(/_/g, ' ') || '—'}</td>
                            <td style={{ padding: '0 12px', fontWeight: 600, color: '#202124', fontSize: '13px' }}>{q.amount ? `£${q.amount.toFixed(2)}` : '—'}</td>
                            <td style={{ padding: '0 12px' }}>
                              <span style={{ background: sc.bg, color: sc.text, padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>{q.status}</span>
                            </td>
                            <td style={{ padding: '0 12px', color: '#5f6368', fontSize: '12px' }}>{new Date(q.created_at).toLocaleDateString('en-GB')}</td>
                            <td style={{ padding: '0 12px' }}>
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                {q.status === 'draft' && (
                                  <button onClick={() => handleUpdateStatus(q.id, 'sent')} style={actionBtn('#e0f2fe', '#075985')}>Send</button>
                                )}
                                {(q.status === 'draft' || q.status === 'sent') && (
                                  <>
                                    <button onClick={() => handleUpdateStatus(q.id, 'accepted')} style={actionBtn('#dcfce7', '#15803d')}>Accept</button>
                                    <button onClick={() => handleUpdateStatus(q.id, 'declined')} style={actionBtn('#fee2e2', '#991b1b')}>Decline</button>
                                  </>
                                )}
                                {q.status === 'sent' && (
                                  <button onClick={() => void handleReviseQuote(q.id)} style={actionBtn('#fef3c7', '#92400e')}>Revise</button>
                                )}
                                {(q.status === 'draft' || q.status === 'sent' || q.status === 'accepted') && (
                                  <button onClick={() => void handleWithdrawQuote(q.id)} style={actionBtn('#e2e8f0', '#475569')}>Withdraw</button>
                                )}
                                {q.status === 'accepted' && (
                                  <button onClick={() => handleConvertToJob(q)} disabled={convertingId === q.id} style={{ height: '26px', padding: '0 10px', border: 'none', borderRadius: '4px', background: '#35a853', color: '#fff', cursor: convertingId === q.id ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}>
                                    {convertingId === q.id ? 'Converting…' : '→ Job'}
                                  </button>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: '#5f6368' }}>
                <span>
                  Showing {safeQuotePage * QUOTES_PER_PAGE + 1}–{Math.min((safeQuotePage + 1) * QUOTES_PER_PAGE, filteredQuotes.length)} of {filteredQuotes.length}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setQuotePage((prev) => Math.max(prev - 1, 0))}
                    disabled={safeQuotePage === 0}
                    style={{ height: '28px', padding: '0 10px', border: '1px solid #d9e2ec', borderRadius: '4px', background: safeQuotePage === 0 ? '#f5f7fa' : '#fff', color: '#202124', cursor: safeQuotePage === 0 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setQuotePage((prev) => Math.min(prev + 1, totalQuotePages - 1))}
                    disabled={safeQuotePage >= totalQuotePages - 1}
                    style={{ height: '28px', padding: '0 10px', border: '1px solid #d9e2ec', borderRadius: '4px', background: safeQuotePage >= totalQuotePages - 1 ? '#f5f7fa' : '#fff', color: '#202124', cursor: safeQuotePage >= totalQuotePages - 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '4px', border: '1px solid #d9e2ec', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#202124', lineHeight: '22px' }}>New Quote</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#5f6368', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: '16px', display: 'grid', gap: '8px' }}>
                {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '8px 12px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}
                <div>
                  <label style={labelStyle}>Company *</label>
                  <select style={inputStyle} value={formData.company_id} onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}>
                    <option value="">Select a company…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Customer Name *</label><input style={inputStyle} value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} placeholder="John Smith" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} placeholder="customer@email.com" /></div>
                  <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} placeholder="07123456789" /></div>
                </div>
                <div><label style={labelStyle}>Pickup Location</label><input style={inputStyle} value={formData.pickup_location} onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })} placeholder="London, SW1A 1AA" /></div>
                <div><label style={labelStyle}>Delivery Location</label><input style={inputStyle} value={formData.delivery_location} onChange={(e) => setFormData({ ...formData, delivery_location: e.target.value })} placeholder="Manchester, M1 1AE" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>Vehicle Type</label>
                    <select style={inputStyle} value={formData.vehicle_type} onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as VehicleType })}>
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
                    <label style={labelStyle}>Cargo Type</label>
                    <select style={inputStyle} value={formData.cargo_type} onChange={(e) => setFormData({ ...formData, cargo_type: e.target.value as CargoType })}>
                      {CARGO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div><label style={labelStyle}>Amount (£)</label><input style={inputStyle} type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="250.00" /></div>
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ height: '32px', padding: '0 16px', background: '#fff', color: '#202124', border: '1px solid #d9e2ec', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                <button onClick={handleCreate} style={{ height: '32px', padding: '0 16px', background: '#35a853', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Create Quote</button>
              </div>
            </div>
          </div>
        )}
      </OperationalPageLayout>
    </ProtectedRoute>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

function actionBtn(bg: string, color: string): React.CSSProperties {
  return { height: '26px', padding: '0 8px', border: 'none', borderRadius: '4px', background: bg, color, cursor: 'pointer', fontSize: '12px', fontWeight: 600 };
}
