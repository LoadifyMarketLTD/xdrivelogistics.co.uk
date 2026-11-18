'use client';

import { WORKSPACE_READINESS_CHANGED } from '../../../../lib/workspaceReadiness';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { EmptyState } from '../../../components/workspace/WorkspaceUI';
import MarketplaceQuoteModal, { type MarketplaceQuoteSubmitPayload } from '../../_components/MarketplaceQuoteModal';

type MarketplaceLoad = {
  route_stops?: {sequence:number;stop_type:string;area:string;window_start:string|null;window_end:string|null}[];
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
  distance_minutes: number | null;
  distance_to_pickup_miles: number | null;
  pickup_eta_minutes: number | null;
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


function dimensions(load: MarketplaceLoad) {
  const values = [load.length_cm, load.width_cm, load.height_cm];
  if (values.every((value) => value == null)) return 'Not supplied';
  return values.map((value) => value == null ? '—' : `${value}`).join(' × ') + ' cm';
}

export default function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [load, setLoad] = useState<MarketplaceLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);

  const getAccessToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }, []);

  const fetchLoad = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Service temporarily unavailable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = await getAccessToken();
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
  }, [getAccessToken, id]);

  useEffect(() => { void fetchLoad(); }, [fetchLoad]);

  const handleBidSubmit = async (quote: MarketplaceQuoteSubmitPayload) => {
    if (bidLoading) return;
    const amount = quote.totalAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid quote amount greater than £0.');
      return;
    }

    setBidLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/driver/bids', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: id,
          amount,
          baseAmount: quote.baseAmount,
          additionalExtrasGbp: quote.additionalExtrasGbp,
          message: quote.message,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; denialReasons?: string[] };
      if (!response.ok) { window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED)); throw new Error(payload.error || 'Your quote could not be submitted.'); }
      setSuccess('Quote submitted successfully. The posting member will review it.');
      setBidMessage('');
      router.push('/driver/loads');
      await fetchLoad();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your quote could not be submitted.');
    } finally {
      setBidLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell>
        <div>
          {loading && <EmptyState compact title="Loading marketplace load..." />}
          {!load && !loading && <div role="alert">{error || 'Load unavailable'} <button onClick={() => router.push('/driver/loads')}>Back to Loads</button></div>}
          {success && <p role="status">{success}</p>}
          {load?.myBid && <div><p>Quote already submitted: {money(load.myBid.amount)} / {load.myBid.status ?? 'submitted'}</p><button onClick={() => router.push('/driver/loads')}>Back to Loads</button></div>}
          <MarketplaceQuoteModal
            target={load ? {
              id: load.id,
              reference: "XDL-" + load.id.slice(0,8).toUpperCase(),
              distanceMiles: load.distance_miles, durationMinutes: load.distance_minutes,
              stops: (load.route_stops ?? []).map((s,i,all)=>({label:s.stop_type==="collection"?"Collection":"Delivery",area:i===0?[load.pickup_area,load.pickup_postcode_area].filter(Boolean).join(", "):i===all.length-1?[load.delivery_area,load.delivery_postcode_area].filter(Boolean).join(", "):s.area,when:s.window_start?formatDT(s.window_start)+(s.window_end?" - "+formatDT(s.window_end):""):"Time not specified"})),
              pallets: load.pallets, weight: load.weight_kg != null ? load.weight_kg+" kg" : null, dimensions: dimensions(load), cargo: load.requested_cargo_label ?? load.cargo_type,
              service: ((load.route_stops?.length ?? 0)>2 ? ((load.route_stops ?? []).filter(s=>s.stop_type==="collection").length>1?"Multi-stop / ":"Multi-drop / "):"")+(load.service_mode?.replace(/_/g," ")??"On Demand"),
              notes:load.public_quote_notes,paymentTerms:load.payment_terms,hardPod:load.hard_copy_pod,
              memberName: load.member.postedBy ?? load.member.name,
              companyId: load.company_id, memberCode: load.member.memberId,
              pickup: `${load.pickup_area}${load.pickup_postcode_area ? `, ${load.pickup_postcode_area}` : ''}`,
              delivery: `${load.delivery_area}${load.delivery_postcode_area ? `, ${load.delivery_postcode_area}` : ''}`,
              pickupAt: load.pickup_datetime,
              deliveryAt: load.delivery_datetime,
              vehicle: load.requested_vehicle_label
                ?? load.requested_vehicle_type?.replace(/_/g, ' ')
                ?? load.vehicle_type?.replace(/_/g, ' ')
                ?? 'Vehicle not specified',
            } : null}
            amount={bidAmount}
            message={bidMessage}
            working={bidLoading}
            error={error}
            onAmountChange={setBidAmount}
            onMessageChange={setBidMessage}
            onSubmit={(payload) => void handleBidSubmit(payload)}
            onClose={() => {
              if (!bidLoading) {
                router.push('/driver/loads');
                setBidMessage('');
              }
            }}
          />
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
