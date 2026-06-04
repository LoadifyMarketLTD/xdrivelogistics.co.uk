'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { Quote, VehicleType, CargoType, Company } from '../../../lib/types/database';
import { useAuth } from '../../components/AuthContext';

const VEHICLE_TYPES: VehicleType[] = ['bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic'];
const CARGO_TYPES: CargoType[] = ['documents', 'packages', 'pallets', 'furniture', 'equipment', 'other'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  sent: { bg: '#e0f2fe', text: '#075985' },
  accepted: { bg: '#d1fae5', text: '#065f46' },
  declined: { bg: '#fee2e2', text: '#991b1b' },
};

const QUOTE_TABS: Array<{ id: string; label: string; statuses: string[] }> = [
  { id: 'received', label: 'Received', statuses: ['draft'] },
  { id: 'submitted', label: 'Submitted', statuses: ['sent'] },
  { id: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { id: 'rejected', label: 'Unsuccessful', statuses: ['declined'] },
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
    if (!error) loadQuotes();
  };

  const handleConvertToJob = async (quote: Quote) => {
    if (!companyId || !isSupabaseConfigured || !hasSupabaseSession) return;
    setConvertingId(quote.id);
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
      // Mark quote as accepted
      await supabase
        .from('quotes')
        .update({ status: 'accepted' })
        .eq('id', quote.id)
        .eq('company_id', companyId);
      loadQuotes();
      if (jobData?.id) {
        router.push(`/admin/jobs/${jobData.id}`);
      }
    } finally {
      setConvertingId(null);
    }
  };

  const inputStyle = { width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' as const, backgroundColor: 'white' };
  const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: '500' as const, color: '#374151', marginBottom: '0.5rem' };
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

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', height: 'calc(100vh - 89px)', overflow: 'hidden', background: '#f5f7fa' }}>

        {/* ── Left search panel ───────────────────────────────────────────── */}
        <aside style={{ width: '200px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '0.85rem', overflowY: 'auto', fontSize: '0.78rem' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.7rem', fontSize: '0.8rem' }}>🔍 Search Quotes</div>

          {!isSupabaseConfigured && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '5px', padding: '0.45rem', marginBottom: '0.6rem', color: '#92400e', fontSize: '0.7rem' }}>⚠️ Supabase not configured</div>
          )}

          <div style={{ marginBottom: '0.5rem' }}>
            <div style={qlabelStyle}>CUSTOMER / LOCATION</div>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search…"
              style={qInputStyle}
            />
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <div style={qlabelStyle}>VEHICLE SIZE</div>
            <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} style={qInputStyle}>
              <option value="all">Any</option>
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '0.9rem' }}>
            <div style={qlabelStyle}>DATE</div>
            <select style={qInputStyle}>
              <option>Anytime</option>
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', padding: '0.5rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
              Search
            </button>
            <button onClick={() => { setSearchTerm(''); setVehicleFilter('all'); }} style={{ padding: '0.5rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b' }}>
              Clear
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Tab bar + New Quote button */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {QUOTE_TABS.map((tab) => {
                const count = quotes.filter((q) => tab.statuses.includes((q.status || '').toLowerCase())).length;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      border: 'none',
                      borderBottom: active ? '2px solid #1d4ed8' : '2px solid transparent',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      color: active ? '#1d4ed8' : '#64748b',
                      marginBottom: '-1px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span style={{ marginLeft: '0.3rem', background: active ? '#dbeafe' : '#f1f5f9', color: active ? '#1d4ed8' : '#64748b', borderRadius: '8px', padding: '0.05rem 0.38rem', fontSize: '0.68rem' }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.38rem 0.85rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + New Quote
            </button>
          </div>

          {/* Table */}
          <div style={{ padding: '0.85rem', flex: 1, overflow: 'auto' }}>
            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
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
                          <th key={h} style={{ padding: '0.6rem 0.85rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((q, i) => {
                        const sc = STATUS_COLORS[q.status] ?? STATUS_COLORS.draft;
                        return (
                          <tr key={q.id} style={{ borderBottom: i < filteredQuotes.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>{q.customer_name || '—'}</td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#374151', fontSize: '0.82rem' }}>{q.pickup_location || '—'}</td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#374151', fontSize: '0.82rem' }}>{q.delivery_location || '—'}</td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.8rem' }}>{q.vehicle_type?.replace(/_/g, ' ') || '—'}</td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{q.amount ? `£${q.amount.toFixed(2)}` : '—'}</td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span style={{ background: sc.bg, color: sc.text, padding: '0.15rem 0.55rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>{q.status}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#94a3b8', fontSize: '0.78rem' }}>{new Date(q.created_at).toLocaleDateString('en-GB')}</td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
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
                                {q.status === 'accepted' && (
                                  <button onClick={() => handleConvertToJob(q)} disabled={convertingId === q.id} style={{ padding: '0.25rem 0.6rem', border: 'none', borderRadius: '5px', background: '#16a34a', color: '#fff', cursor: convertingId === q.id ? 'not-allowed' : 'pointer', fontSize: '0.73rem', fontWeight: 700 }}>
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
          </div>
        </main>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>New Quote</h2>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}>×</button>
              </div>
              <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gap: '0.85rem' }}>
                {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.65rem', color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}
                <div>
                  <label style={labelStyle}>Company *</label>
                  <select style={inputStyle} value={formData.company_id} onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}>
                    <option value="">Select a company…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Customer Name *</label><input style={inputStyle} value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} placeholder="John Smith" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} placeholder="customer@email.com" /></div>
                  <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formData.customer_phone} onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })} placeholder="07123456789" /></div>
                </div>
                <div><label style={labelStyle}>Pickup Location</label><input style={inputStyle} value={formData.pickup_location} onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })} placeholder="London, SW1A 1AA" /></div>
                <div><label style={labelStyle}>Delivery Location</label><input style={inputStyle} value={formData.delivery_location} onChange={(e) => setFormData({ ...formData, delivery_location: e.target.value })} placeholder="Manchester, M1 1AE" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={labelStyle}>Vehicle Type</label>
                    <select style={inputStyle} value={formData.vehicle_type} onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as VehicleType })}>
                      {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
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
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => { setShowModal(false); setError(''); }} style={{ padding: '0.6rem 1.25rem', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                <button onClick={handleCreate} style={{ padding: '0.6rem 1.25rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>Create Quote</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const qlabelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '0.2rem',
};

const qInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.35rem 0.45rem',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  fontSize: '0.76rem',
  color: '#374151',
  background: '#fff',
  marginBottom: '0',
  boxSizing: 'border-box',
};

function actionBtn(bg: string, color: string): React.CSSProperties {
  return { padding: '0.22rem 0.55rem', border: 'none', borderRadius: '5px', background: bg, color, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 };
}
