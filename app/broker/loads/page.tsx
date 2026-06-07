'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type ExchangeLoad = {
  id: string;
  company_id: string;
  status: string;
  vehicle_type: string | null;
  cargo_type: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  budget_amount: number | null;
  is_fixed_price: boolean;
  currency: string;
  load_details: string | null;
  exchange_posted_at: string | null;
  companies: { name: string } | null;
};

const NAV_ITEMS = [
  { label: 'Load Board', href: '/broker/loads' },
  { label: 'My Bids',    href: '/broker/bids' },
  { label: 'Awards',     href: '/broker/awards' },
];

export default function BrokerLoadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loads, setLoads] = useState<ExchangeLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidLoadId, setBidLoadId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidSuccess, setBidSuccess] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    const resolve = async () => {
      const id = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      setCompanyId(id ?? null);
    };
    void resolve();
  }, [user?.id, user?.companyId]);

  const loadBoard = useCallback(async () => {
    if (!companyId || !isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, budget_amount, is_fixed_price, currency, load_details, exchange_posted_at, companies:company_id(name)')
      .eq('status', 'posted')
      .neq('company_id', companyId)
      .order('exchange_posted_at', { ascending: false })
      .limit(100);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setLoads((data ?? []) as unknown as ExchangeLoad[]);
  }, [companyId]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  const handleBid = async () => {
    if (!bidLoadId || !companyId) return;
    const price = parseFloat(bidAmount);
    if (Number.isNaN(price) || price <= 0) { setBidSuccess(''); setError('Enter a valid bid amount'); return; }
    setBidSubmitting(true);
    const { error: err } = await supabase.from('bids').insert([{
      job_id: bidLoadId,
      company_id: companyId,
      bid_price_gbp: price,
      currency: 'GBP',
      message: bidMessage || null,
      status: 'pending',
    }]);
    setBidSubmitting(false);
    if (err) { setError(err.message); return; }
    setBidSuccess('Bid submitted successfully!');
    setBidLoadId(null);
    setBidAmount('');
    setBidMessage('');
    void loadBoard();
  };

  const filtered = filterVehicle
    ? loads.filter(l => (l.vehicle_type ?? '').includes(filterVehicle))
    : loads;

  const inputStyle = { width: '100%', padding: '0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' as const };

  return (
    <ProtectedRoute allowedRoles={['broker', 'owner']}>
      <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
        {/* Nav */}
        <nav style={{ background: '#0f172a', padding: '0.75rem 1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontWeight: 700, marginRight: '0.75rem', fontSize: '0.9rem' }}>🤝 Broker</span>
          {NAV_ITEMS.map(n => (
            <button key={n.href} onClick={() => router.push(n.href)} style={{ background: n.href === '/broker/loads' ? '#1d4ed8' : 'transparent', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              {n.label}
            </button>
          ))}
        </nav>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#0f172a' }}>Load Board</h1>
              <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>Browse loads posted by carriers on the exchange.</p>
            </div>
            <select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem' }}>
              <option value=''>All vehicle types</option>
              {['van_small','van_large','luton','truck_7_5t','truck_18t','artic'].map(v => <option key={v} value={v}>{v.replace(/_/g,'  ')}</option>)}
            </select>
          </div>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#dc2626' }}>{error}</div>}
          {bidSuccess && <div style={{ background: '#dcfce7', border: '1px solid #1F7A3D', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#14532d', fontWeight: 600 }}>{bidSuccess}</div>}

          {loading ? (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading loads…</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No posted loads found on the exchange right now.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {filtered.map(load => (
                <div key={load.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                        {load.pickup_location || '—'} → {load.delivery_location || '—'}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                        Posted by <strong>{(load.companies as { name: string } | null)?.name ?? 'Unknown'}</strong>
                        {load.exchange_posted_at ? ` · ${new Date(load.exchange_posted_at).toLocaleDateString('en-GB')}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {load.budget_amount ? (
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1d4ed8' }}>
                          £{Number(load.budget_amount).toFixed(2)}
                          {load.is_fixed_price ? ' (fixed)' : ' (budget)'}
                        </div>
                      ) : <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Open bid</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                    {load.vehicle_type && <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600 }}>{load.vehicle_type.replace(/_/g,' ')}</span>}
                    {load.cargo_type   && <span style={{ background: '#fef9c3', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600 }}>{load.cargo_type}</span>}
                    {load.pickup_datetime && <span style={{ color: '#64748b', fontSize: '0.76rem' }}>Pickup: {new Date(load.pickup_datetime).toLocaleDateString('en-GB')}</span>}
                  </div>

                  {load.load_details && <p style={{ margin: '0.5rem 0 0', fontSize: '0.83rem', color: '#475569' }}>{load.load_details}</p>}

                  <div style={{ marginTop: '0.85rem' }}>
                    <button
                      onClick={() => { setBidLoadId(load.id); setBidAmount(''); setBidMessage(''); setBidSuccess(''); setError(''); }}
                      style={{ padding: '0.5rem 1.1rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      Place Bid
                    </button>
                  </div>

                  {bidLoadId === load.id && (
                    <div style={{ marginTop: '0.85rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gap: '0.75rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Bid Amount (£) *</label>
                          <input style={inputStyle} type="number" min="0" step="0.01" value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder="e.g. 250.00" />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Message (optional)</label>
                          <input style={inputStyle} value={bidMessage} onChange={e => setBidMessage(e.target.value)} placeholder="Notes for the shipper" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => { void handleBid(); }} disabled={bidSubmitting} style={{ padding: '0.55rem 1.1rem', background: '#1F7A3D', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                          {bidSubmitting ? 'Submitting…' : 'Submit Bid'}
                        </button>
                        <button onClick={() => setBidLoadId(null)} style={{ padding: '0.55rem 1.1rem', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
