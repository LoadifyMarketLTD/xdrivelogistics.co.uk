'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getLoadDetailSummary } from '../../../lib/loadPostingDetails';

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
  delivery_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_time_slot: string | null;
  weight_kg: number | null;
  pallets: number | null;
  collection_contact_name: string | null;
  collection_contact_phone: string | null;
  delivery_contact_name: string | null;
  delivery_contact_phone: string | null;
  customer_reference: string | null;
  purchase_order_number: string | null;
  booking_reference: string | null;
  requested_vehicle_label: string | null;
  requested_cargo_label: string | null;
  cargo_value_gbp: number | null;
  pallet_type: string | null;
  pallet_stackable: boolean | null;
  collection_forklift_available: boolean | null;
  collection_tail_lift_required: boolean | null;
  collection_handball_required: boolean | null;
  delivery_forklift_available: boolean | null;
  delivery_tail_lift_required: boolean | null;
  delivery_handball_required: boolean | null;
  document_checklist: string[] | null;
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
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot, delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot, weight_kg, pallets, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, customer_reference, purchase_order_number, booking_reference, requested_vehicle_label, requested_cargo_label, cargo_value_gbp, pallet_type, pallet_stackable, collection_forklift_available, collection_tail_lift_required, collection_handball_required, delivery_forklift_available, delivery_tail_lift_required, delivery_handball_required, document_checklist, budget_amount, is_fixed_price, currency, load_details, special_requirements, access_restrictions, exchange_posted_at, companies:company_id(name)')
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
    if (!bidLoadId || !companyId || !user?.id) return;
    const price = parseFloat(bidAmount);
    if (Number.isNaN(price) || price <= 0) { setBidSuccess(''); setError('Enter a valid bid amount'); return; }
    setBidSubmitting(true);
    const { error: err } = await supabase.from('job_bids').insert([{
      job_id: bidLoadId,
      company_id: companyId,
      bidder_user_id: user.id,
      bid_price_gbp: price,
      amount: price,
      currency: 'GBP',
      message: bidMessage || null,
      status: 'submitted',
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
              {[
                ['van_small', 'Small Van'],
                ['swb_van', 'SWB Van'],
                ['mwb_van', 'MWB Van'],
                ['lwb_van', 'LWB Van'],
                ['xlwb_van', 'XLWB Van'],
                ['luton', 'Luton'],
                ['luton_tail_lift', 'Luton Tail Lift'],
                ['curtainside_van', 'Curtainside Van'],
                ['truck_3_5t', '3.5T'],
                ['truck_5t', '5T'],
                ['truck_7_5t', '7.5T'],
                ['truck_12t', '12T'],
                ['truck_18t', '18T'],
                ['truck_26t', '26T'],
                ['artic_44t_curtainsider', 'Artic 44T Curtainsider'],
                ['artic_44t_box_trailer', 'Artic 44T Box Trailer'],
                ['artic_44t_flatbed', 'Artic 44T Flatbed'],
                ['artic_44t_refrigerated', 'Artic 44T Refrigerated'],
                ['artic_44t_double_deck', 'Artic 44T Double Deck'],
                ['hiab', 'Hiab'],
                ['moffett', 'Moffett'],
                ['adr_vehicle', 'ADR Vehicle'],
                ['refrigerated_vehicle', 'Refrigerated Vehicle'],
                ['temperature_controlled_vehicle', 'Temperature Controlled Vehicle'],
              ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
                    {(load.requested_vehicle_label || load.vehicle_type) && <span style={{ background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600 }}>{load.requested_vehicle_label ?? load.vehicle_type?.replace(/_/g,' ')}</span>}
                    {(load.requested_cargo_label || load.cargo_type) && <span style={{ background: '#fef9c3', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 600 }}>{load.requested_cargo_label ?? load.cargo_type}</span>}
                    {load.pickup_datetime && <span style={{ color: '#64748b', fontSize: '0.76rem' }}>Pickup: {new Date(load.pickup_datetime).toLocaleDateString('en-GB')}</span>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.45rem', marginTop: '0.7rem' }}>
                    {getLoadDetailSummary(load, 8).map((item) => (
                      <div key={`${load.id}-${item.label}`} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '0.45rem 0.55rem' }}>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                        <div style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 600 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

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
