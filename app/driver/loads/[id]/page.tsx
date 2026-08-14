'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import { useAuth } from '../../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { MemberIdentityLink } from '../../../components/workspace/MemberProfile';
import { ActionButton, EmptyState, StatusBadge } from '../../../components/workspace/WorkspaceUI';

type MarketplaceLoad = {
  id: string;
  company_id: string;
  status: string;
  pickup_area: string;
  pickup_postcode_area: string | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_area: string;
  delivery_postcode_area: string | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
  pickup_country_code: string | null;
  delivery_country_code: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  weight_kg: number | null;
  pallets: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  cargo_value_gbp: number | null;
  pallet_type: string | null;
  pallet_stackable: boolean | null;
  collection_forklift_available: boolean | null;
  collection_tail_lift_required: boolean | null;
  collection_handball_required: boolean | null;
  delivery_forklift_available: boolean | null;
  delivery_tail_lift_required: boolean | null;
  delivery_handball_required: boolean | null;
  handling_requirements: string[];
  service_mode: string | null;
  direct_delivery_required: boolean;
  distance_miles: number | null;
  is_fixed_price: boolean;
  budget_amount: number | null;
  currency: string;
  exchange_posted_at: string | null;
  hard_copy_pod: string | null;
  pod_required: boolean | null;
  payment_terms: string | null;
  public_quote_notes: string | null;
  member: {
    companyId: string;
    name: string;
    memberId: string | null;
    phone: string | null;
    memberType: string | null;
    memberSince: string | null;
    postedBy: string | null;
  };
  myBid: {
    status: string | null;
    amount: number | null;
    message: string | null;
  } | null;
};

const money = (value: number | null, currency = 'GBP') =>
  value == null
    ? 'Quote required'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const formatDT = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'TBC';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : 'Not supplied';

function dimensions(load: MarketplaceLoad) {
  const values = [load.length_cm, load.width_cm, load.height_cm];
  if (values.every((value) => value == null)) return 'Not supplied';
  return values.map((value) => value == null ? '—' : `${value}`).join(' × ') + ' cm';
}

export default function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [load, setLoad] = useState<MarketplaceLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);

  const userId = user?.id ?? null;
  const companyId = user?.companyId ?? null;
  const driverId = user?.driverId ?? null;
  const canCommercialBid = user?.canCommercialBid === true;
  const driverStatus = String(user?.driverStatus ?? '').trim().toLowerCase();
  const appAccess = user?.appAccess;
  const driverSuspended = ['suspended', 'inactive', 'blocked', 'rejected'].includes(driverStatus);
  const bidBlockedMessage = driverSuspended
    ? 'Your driver account is suspended. Contact support to restore bidding access.'
    : appAccess === false
      ? 'Your compliance documents are missing or expired. Update them before submitting commercial bids.'
      : !canCommercialBid
        ? 'Commercial bidding is not enabled for your account. Contact support to activate marketplace access.'
        : null;

  const fetchLoad = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Service temporarily unavailable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/driver/marketplace/loads?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as { load?: MarketplaceLoad; error?: string };
      if (!response.ok || !payload.load) throw new Error(payload.error || 'This load is no longer available on the marketplace.');
      setLoad(payload.load);
      if (payload.load.budget_amount != null && payload.load.budget_amount > 0) setBidAmount(String(payload.load.budget_amount));
      else setBidAmount('');
    } catch (reason) {
      setLoad(null);
      setError(reason instanceof Error ? reason.message : 'Unable to load this marketplace listing.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchLoad(); }, [fetchLoad]);

  const handleBidSubmit = async (overrideAmount?: number) => {
    if (!userId || bidLoading) return;
    if (bidBlockedMessage) { setError(bidBlockedMessage); return; }
    const amount = overrideAmount ?? Number.parseFloat(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid quote amount greater than £0.'); return; }

    setBidLoading(true); setError('');
    const { error: bidError } = await supabase.from('job_bids').insert({
      job_id: id, company_id: companyId ?? null, bidder_user_id: userId, bidder_driver_id: driverId ?? null,
      bid_price_gbp: amount, amount, currency: 'GBP', message: bidMessage.trim() || null, status: 'submitted',
    });
    setBidLoading(false);
    if (bidError) { setError(`Failed to submit quote: ${bidError.message}`); return; }
    setSuccess('Quote submitted successfully. The posting member will review it.');
    setBidMessage('');
    await fetchLoad();
  };

  const hasProposedPrice = Boolean(load?.budget_amount != null && load.budget_amount > 0);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="driver-board-summary" style={{ justifyContent: 'space-between' }}><span><button type="button" onClick={() => router.back()} style={{ border: 0, background: 'transparent', color: '#1d57d8', cursor: 'pointer', fontWeight: 700, padding: 0 }}>← Back to Loads</button></span><span>Pre-award marketplace view · exact execution details protected</span></div>
          {error && <div role="alert" style={{ minHeight: 32, display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #fecaca', borderRadius: 4, background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 700 }}>{error}</div>}
          {success && <div style={{ minHeight: 32, display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #bbf7d0', borderRadius: 4, background: '#ecfdf3', color: '#166534', fontSize: 12, fontWeight: 700 }}>{success}</div>}

          {loading ? <div className="driver-load-row"><EmptyState compact title="Loading marketplace load…" /></div> : load ? (
            <article className="driver-load-row" data-state={load.myBid?.status ? 'quoted' : 'open'}>
              <div className="driver-load-row__top">
                <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{load.pickup_area}</strong><span className="driver-cell-secondary">Area only · {formatDT(load.pickup_datetime)}{load.pickup_time_slot ? ` · ${load.pickup_time_slot}` : ''}</span></div>
                <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{load.delivery_area}</strong><span className="driver-cell-secondary">Area only · {formatDT(load.delivery_datetime)}{load.delivery_time_slot ? ` · ${load.delivery_time_slot}` : ''}</span></div>
                <div className="driver-load-cell"><span className="driver-cell-label">Load</span><strong className="driver-cell-primary">{load.requested_vehicle_label ?? load.requested_vehicle_type?.replace(/_/g, ' ') ?? load.vehicle_type?.replace(/_/g, ' ') ?? 'Vehicle TBC'}</strong><span className="driver-cell-secondary">{load.requested_cargo_label ?? load.cargo_type?.replace(/_/g, ' ') ?? 'Freight'}{load.weight_kg != null ? ` · ${load.weight_kg} kg` : ''}{load.pallets != null ? ` · ${load.pallets} pallet${load.pallets === 1 ? '' : 's'}` : ''}</span></div>
                <div className="driver-load-cell"><span className="driver-cell-label">Commercial</span><strong className="driver-cell-primary">{hasProposedPrice ? money(load.budget_amount, load.currency) : 'Quote required'}</strong><span className="driver-cell-secondary"><MemberIdentityLink companyId={load.member.companyId}>{load.member.name}</MemberIdentityLink>{load.member.memberId ? ` · ${load.member.memberId}` : ''}</span></div>
              </div>

              <div className="driver-load-row__meta"><span>Load #{load.id.slice(0, 8).toUpperCase()}</span><span>Posted {formatDT(load.exchange_posted_at)}</span>{load.member.postedBy && <span>Posted by {load.member.postedBy}</span>}{load.direct_delivery_required && <StatusBadge value="Direct" tone="blue" />}{load.myBid?.status && <StatusBadge value={`Quote ${load.myBid.status}`} tone="purple" />}{load.myBid?.amount != null && <strong style={{ color: '#7c3aed' }}>{money(load.myBid.amount)}</strong>}</div>

              <div className="driver-row-details" style={{ display: 'grid', gap: 8 }}>
                <div className="driver-detail-grid">
                  <div className="driver-detail-item"><span>Posting member</span><strong><MemberIdentityLink companyId={load.member.companyId}>{load.member.name}</MemberIdentityLink></strong><small>{[load.member.memberType, load.member.memberId].filter(Boolean).join(' · ') || 'Member identity supplied'}</small></div>
                  <div className="driver-detail-item"><span>Quote contact</span><strong>{load.member.phone ?? 'Business phone not supplied'}</strong><small>{load.member.postedBy ? `Posted by ${load.member.postedBy}` : 'Posted-by name not supplied'}</small></div>
                  <div className="driver-detail-item"><span>Member since</span><strong>{formatDate(load.member.memberSince)}</strong></div>
                  <div className="driver-detail-item"><span>Distance</span><strong>{load.distance_miles != null ? `${load.distance_miles.toFixed(1)} miles` : 'Not supplied'}</strong></div>
                  <div className="driver-detail-item"><span>Dimensions</span><strong>{dimensions(load)}</strong></div>
                  <div className="driver-detail-item"><span>Cargo value</span><strong>{load.cargo_value_gbp != null ? money(load.cargo_value_gbp) : 'Not supplied'}</strong></div>
                  <div className="driver-detail-item"><span>Stackable</span><strong>{load.pallet_stackable == null ? 'Not supplied' : load.pallet_stackable ? 'Yes' : 'No'}</strong></div>
                  <div className="driver-detail-item"><span>Payment terms</span><strong>{load.payment_terms ?? 'Not supplied on this job'}</strong></div>
                  <div className="driver-detail-item"><span>POD requirement</span><strong>{load.hard_copy_pod ?? (load.pod_required == null ? 'Not supplied' : load.pod_required ? 'POD required' : 'Not required')}</strong></div>
                </div>

                {load.handling_requirements.length > 0 && <div style={{ padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f8fafc', color: '#1a1f2b', fontSize: 11, lineHeight: '15px' }}><strong>Quote-safe requirements: </strong>{load.handling_requirements.join(' · ')}</div>}
                {load.public_quote_notes && <div style={{ padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f8fafc', color: '#1a1f2b', fontSize: 11, lineHeight: '15px' }}><strong>Public quote notes: </strong>{load.public_quote_notes}</div>}
                <div style={{ padding: '8px 9px', border: '1px solid #bfdbfe', borderRadius: 4, background: '#eff6ff', color: '#1e3a8a', fontSize: 11, lineHeight: '15px' }}><strong>Execution privacy boundary:</strong> exact street addresses, collection/delivery contacts, customer reference, PO number, booking reference, access instructions and private execution notes are intentionally not delivered to this pre-award page. After an authorised award/allocation, use Won Work / Jobs / Diary for the full job sheet.</div>

                {load.myBid ? <div style={{ padding: 8, border: '1px solid #bae6fd', borderRadius: 4, background: '#f0f9ff', color: '#0369a1', fontSize: 12 }}><strong>Quote already submitted</strong><div style={{ marginTop: 3 }}>Amount: {money(load.myBid.amount)} · Status: {load.myBid.status ?? 'submitted'}</div>{load.myBid.message && <div style={{ marginTop: 3 }}>Message: {load.myBid.message}</div>}</div> : bidBlockedMessage ? <div style={{ padding: 8, border: '1px solid #fcd34d', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 600 }}>{bidBlockedMessage}</div> : (
                  <div className="driver-inline-quote"><div className="driver-filter-field"><label htmlFor="marketplace-quote-amount">Your quote (£)</label><input id="marketplace-quote-amount" type="number" min="0" step="0.01" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="e.g. 250.00" /></div><div className="driver-filter-field"><label htmlFor="marketplace-quote-message">Message</label><textarea id="marketplace-quote-message" rows={2} value={bidMessage} onChange={(event) => setBidMessage(event.target.value)} placeholder="Optional message to posting member" /></div>{hasProposedPrice && <ActionButton tone="success" disabled={bidLoading} onClick={() => void handleBidSubmit(load.budget_amount ?? undefined)}>{bidLoading ? 'Accepting…' : `Accept proposed price (${money(load.budget_amount, load.currency)})`}</ActionButton>}<ActionButton tone="primary" disabled={bidLoading || !bidAmount} onClick={() => void handleBidSubmit()}>{bidLoading ? 'Submitting…' : hasProposedPrice ? 'Submit counter-offer' : 'Submit quote'}</ActionButton><ActionButton tone="secondary" onClick={() => router.back()}>Cancel</ActionButton></div>
                )}
              </div>
            </article>
          ) : null}
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
