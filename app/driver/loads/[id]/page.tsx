'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import { useAuth } from '../../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { getLoadDetailSummary } from '../../../../lib/loadPostingDetails';

type LoadRow = {
  id: string;
  company_id: string;
  status: string;
  vehicle_type: string | null;
  cargo_type: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
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
  awarded_carrier_company_id: string | null;
  direct_invite_company_id: string | null;
  companies: { name: string } | Array<{ name: string }> | null;
};

type ExistingBid = {
  status: string;
  bid_price_gbp: number | null;
  amount: number | null;
  message: string | null;
};

const card: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '1.25rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  fontWeight: 700,
  fontSize: '0.82rem',
  border: 'none',
  cursor: 'pointer',
};

const money = (v: number | null, currency = 'GBP') =>
  v != null
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(v)
    : '—';

const formatDT = (v: string | null) =>
  v
    ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

const flag = (v: boolean | null, yes = '✓', no = '✗') =>
  v ? yes : no;

export default function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [load, setLoad] = useState<LoadRow | null>(null);
  const [existingBid, setExistingBid] = useState<ExistingBid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const userId = user?.id ?? null;
  const companyId = user?.companyId ?? null;
  const driverId = user?.driverId ?? null;

  const fetchLoad = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Service temporarily unavailable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data: loadData, error: loadErr } = await supabase
      .from('jobs')
      .select(
        'id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot, delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot, weight_kg, pallets, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, customer_reference, purchase_order_number, booking_reference, requested_vehicle_label, requested_cargo_label, cargo_value_gbp, pallet_type, pallet_stackable, collection_forklift_available, collection_tail_lift_required, collection_handball_required, delivery_forklift_available, delivery_tail_lift_required, delivery_handball_required, document_checklist, budget_amount, is_fixed_price, currency, load_details, exchange_posted_at, awarded_carrier_company_id, direct_invite_company_id, companies:companies!jobs_company_id_fkey(name)'
      )
      .eq('id', id)
      .in('status', ['posted', 'quoted'])
      .maybeSingle();

    if (loadErr) {
      setError(`Unable to load this marketplace listing: ${loadErr.message}`);
      setLoading(false);
      return;
    }

    if (!loadData) {
      setError('This load is no longer available on the marketplace.');
      setLoading(false);
      return;
    }

    setLoad(loadData as LoadRow);

    if (userId) {
      const { data: bidData } = await supabase
        .from('job_bids')
        .select('status, bid_price_gbp, amount, message')
        .eq('job_id', id)
        .eq('bidder_user_id', userId)
        .maybeSingle();

      setExistingBid(bidData as ExistingBid | null);
    }

    setLoading(false);
  }, [id, userId]);

  useEffect(() => {
    void fetchLoad();
  }, [fetchLoad]);

  const handleBidSubmit = async () => {
    if (!userId || !companyId || bidLoading) return;
    const amount = parseFloat(bidAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Enter a valid bid amount greater than £0.');
      return;
    }

    setBidLoading(true);
    setError('');

    const { error: bidErr } = await supabase.from('job_bids').insert({
      job_id: id,
      company_id: companyId,
      bidder_user_id: userId,
      bidder_driver_id: driverId ?? null,
      bid_price_gbp: amount,
      amount,
      currency: 'GBP',
      message: bidMessage.trim() || null,
      status: 'submitted',
    });

    setBidLoading(false);

    if (bidErr) {
      setError(`Failed to submit quote: ${bidErr.message}`);
      return;
    }

    setSuccess('Quote submitted successfully. The company will review your bid.');
    setBidAmount('');
    setBidMessage('');
    await fetchLoad();
  };

  const companyName =
    load?.companies
      ? Array.isArray(load.companies)
        ? (load.companies[0]?.name ?? 'Marketplace customer')
        : (load.companies.name ?? 'Marketplace customer')
      : 'Marketplace customer';

  const detailItems = load ? getLoadDetailSummary(load as Parameters<typeof getLoadDetailSummary>[0]) : [];

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell>
        <div style={{ maxWidth: '960px', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.back()}
              style={{ ...btn, background: '#f1f5f9', color: '#475569' }}
            >
              ← Back
            </button>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Marketplace load
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.1rem' }}>
                {load
                  ? `${load.pickup_location ?? load.pickup_postcode ?? 'Collection'} → ${load.delivery_location ?? load.delivery_postcode ?? 'Delivery'}`
                  : 'Loading…'}
              </div>
            </div>
          </div>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
              {success}
            </div>
          )}

          {loading ? (
            <div style={card}>
              <div style={{ color: '#64748b' }}>Loading load details…</div>
            </div>
          ) : load ? (
            <>
              {/* Route summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={card}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>Collection</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{load.pickup_location ?? load.pickup_postcode ?? '—'}</div>
                  {load.pickup_postcode && load.pickup_location && (
                    <div style={{ color: '#475569', fontSize: '0.82rem' }}>{load.pickup_postcode}</div>
                  )}
                  <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '0.3rem' }}>{formatDT(load.pickup_datetime)}</div>
                  {load.pickup_time_slot && (
                    <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Slot: {load.pickup_time_slot}</div>
                  )}
                  {load.collection_contact_name && (
                    <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                      Contact: {load.collection_contact_name}
                      {load.collection_contact_phone ? ` · ${load.collection_contact_phone}` : ''}
                    </div>
                  )}
                </div>
                <div style={card}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>Delivery</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{load.delivery_location ?? load.delivery_postcode ?? '—'}</div>
                  {load.delivery_postcode && load.delivery_location && (
                    <div style={{ color: '#475569', fontSize: '0.82rem' }}>{load.delivery_postcode}</div>
                  )}
                  <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '0.3rem' }}>{formatDT(load.delivery_datetime)}</div>
                  {load.delivery_time_slot && (
                    <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Slot: {load.delivery_time_slot}</div>
                  )}
                  {load.delivery_contact_name && (
                    <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                      Contact: {load.delivery_contact_name}
                      {load.delivery_contact_phone ? ` · ${load.delivery_contact_phone}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Load details */}
              <div style={card}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.8rem' }}>Load details</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
                  {[
                    { label: 'Customer', value: companyName },
                    { label: 'Reference', value: load.id.slice(0, 8).toUpperCase() },
                    { label: 'Vehicle', value: load.requested_vehicle_label ?? load.vehicle_type?.replace(/_/g, ' ') ?? '—' },
                    { label: 'Freight', value: load.requested_cargo_label ?? load.cargo_type?.replace(/_/g, ' ') ?? '—' },
                    { label: 'Weight', value: load.weight_kg ? `${load.weight_kg} kg` : '—' },
                    { label: 'Pallets', value: load.pallets != null ? `${load.pallets} ${load.pallet_type ?? ''}`.trim() : '—' },
                    { label: 'Stackable', value: flag(load.pallet_stackable, 'Yes', 'No') },
                    { label: 'Cargo value', value: money(load.cargo_value_gbp) },
                  ].map((item) => (
                    <div key={item.label} style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '0.15rem' }}>{item.label}</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {detailItems.length > 0 && (
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.4rem' }}>
                    {detailItems.map((item) => (
                      <div key={item.label} style={{ fontSize: '0.78rem', color: '#475569' }}>
                        <span style={{ color: '#64748b' }}>{item.label}: </span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Operational requirements */}
              <div style={card}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.8rem' }}>Operational requirements</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {[
                    { label: 'Collection forklift', value: flag(load.collection_forklift_available) },
                    { label: 'Collection tail lift', value: flag(load.collection_tail_lift_required) },
                    { label: 'Collection handball', value: flag(load.collection_handball_required) },
                    { label: 'Delivery forklift', value: flag(load.delivery_forklift_available) },
                    { label: 'Delivery tail lift', value: flag(load.delivery_tail_lift_required) },
                    { label: 'Delivery handball', value: flag(load.delivery_handball_required) },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.3rem' }}>
                      <span>{item.label}</span>
                      <strong style={{ color: item.value === '✓' ? '#15803d' : '#64748b' }}>{item.value}</strong>
                    </div>
                  ))}
                </div>
                {(load.document_checklist ?? []).length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '0.3rem' }}>Documents required</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {(load.document_checklist ?? []).map((doc) => (
                        <span key={doc} style={{ fontSize: '0.72rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                          {doc.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {load.load_details && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                    <strong>Additional notes: </strong>{load.load_details}
                  </div>
                )}
              </div>

              {/* Bid / pricing */}
              <div style={{ ...card, borderLeft: '4px solid #1d4ed8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pricing</div>
                    <div style={{ fontWeight: 800, fontSize: '1.35rem', color: '#0f172a' }}>
                      {load.is_fixed_price
                        ? money(load.budget_amount, load.currency || 'GBP')
                        : 'Quote required'}
                    </div>
                    {!load.is_fixed_price && load.budget_amount && load.budget_amount > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Budget target: {money(load.budget_amount, load.currency || 'GBP')}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    backgroundColor: load.is_fixed_price ? '#dcfce7' : '#fef3c7',
                    color: load.is_fixed_price ? '#15803d' : '#92400e',
                    padding: '0.25rem 0.65rem', borderRadius: '4px',
                  }}>
                    {load.is_fixed_price ? 'Fixed price' : 'Quote required'}
                  </span>
                </div>

                {existingBid ? (
                  <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.85rem' }}>
                    <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: '0.25rem', fontSize: '0.88rem' }}>
                      Quote already submitted
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#0369a1' }}>
                      Amount: {money(existingBid.bid_price_gbp ?? existingBid.amount)} · Status: {existingBid.status}
                    </div>
                    {existingBid.message && (
                      <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '0.25rem' }}>
                        Message: {existingBid.message}
                      </div>
                    )}
                  </div>
                ) : load.is_fixed_price ? (
                  <button
                    style={{ ...btn, background: '#1d4ed8', color: '#fff' }}
                    disabled={bidLoading}
                    onClick={() => void handleBidSubmit()}
                  >
                    {bidLoading ? 'Accepting…' : 'Accept fixed-price load'}
                  </button>
                ) : (
                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.6rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', fontWeight: 700, marginBottom: '0.3rem' }}>
                          Your quote (£) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          placeholder="e.g. 250.00"
                          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '0.85rem', boxSizing: 'border-box' as const }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', fontWeight: 700, marginBottom: '0.3rem' }}>
                          Message (optional)
                        </label>
                        <input
                          type="text"
                          value={bidMessage}
                          onChange={(e) => setBidMessage(e.target.value)}
                          placeholder="Any notes for the customer…"
                          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '0.85rem', boxSizing: 'border-box' as const }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        style={{ ...btn, background: '#1d4ed8', color: '#fff' }}
                        disabled={bidLoading || !bidAmount}
                        onClick={() => void handleBidSubmit()}
                      >
                        {bidLoading ? 'Submitting…' : 'Submit quote'}
                      </button>
                      <button
                        style={{ ...btn, background: '#f1f5f9', color: '#475569' }}
                        onClick={() => router.back()}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
