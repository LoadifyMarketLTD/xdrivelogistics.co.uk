'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

//  Types

type BidWithJob = {
  id: string;
  job_id: string;
  bidder_id: string | null;
  bid_price_gbp: number | string | null;
  message: string | null;
  created_at: string;
  bid_status: string;
  bidder_company_id: string | null;
  quote_amount: number | string | null;
  load_id: string;
  bidder_user_id: string | null;
  bidder_driver_id: string | null;
  currency: string;
  amount: number | string | null;
  amount_gbp: number | string | null;
  updated_at: string;
  owner_company_id: string | null;
  exchange_visibility: string;
  job_status: string;
  load_status: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  vehicle_type: string | null;
  awarded_carrier_company_id: string | null;
  companies: { name: string } | null;
};

type JobGroup = {
  jobId: string;
  jobPickup: string | null;
  jobDelivery: string | null;
  jobPickupDate: string | null;
  jobVehicle: string | null;
  awardedCarrierCompanyId: string | null;
  exchangeVisibility: string;
  bids: BidWithJob[];
};

//  Constants

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted: { bg: '#e0f2fe', text: '#075985' },
  accepted:  { bg: '#d1fae5', text: '#065f46' },
  rejected:  { bg: '#fee2e2', text: '#991b1b' },
  withdrawn: { bg: '#f3f4f6', text: '#6b7280' },
};

const VEHICLE_LABEL: Record<string, string> = {
  bicycle: 'Bicycle', motorbike: 'Motorbike', car: 'Car',
  van_small: 'Small Van', van_large: 'Large Van', luton: 'Luton Van',
  truck_7_5t: '7.5t Truck', truck_18t: '18t Truck', artic: 'Artic',
};

function fmtDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolveBidAmountGbp(
  bid: Pick<BidWithJob, 'bid_price_gbp' | 'amount'>
): number | null {
  const v = bid.bid_price_gbp ?? bid.amount;

  if (v == null) return null;

  const n =
    typeof v === 'number'
      ? v
      : Number(v);

  return Number.isFinite(n) ? n : null;
}

//  Component

export default function BidsPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  const [jobGroups, setJobGroups] = useState<JobGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null); // bidId being actioned

  //  Data loading

  const loadBids = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!companyId) {
      setError('Company profile not loaded. Bid data is hidden until company access resolves.');
      setLoading(false);
      return;
    }

    // Fetch all bids on jobs owned by the current company.
    // The job_bids_owner_select RLS policy (migration 061) allows job owners to
    // SELECT bids on their own jobs, keyed via the jobs join.
    const { data, error: fetchError } = await supabase
      .from('job_bids_with_job_owner')
      .select('*')
      .eq('owner_company_id', companyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(`Failed to load bids: ${fetchError.message}`);
      setLoading(false);
      return;
    }

    const bidRows = (data ?? []) as unknown as BidWithJob[];
    const bidderCompanyIds = Array.from(
      new Set(
        bidRows
          .map((bid) => bid.bidder_company_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let companyNameById = new Map<string, string>();
    if (bidderCompanyIds.length > 0) {
      const { data: companyRows } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', bidderCompanyIds);

      companyNameById = new Map(
        (companyRows ?? [])
          .map((row) => [row.id, row.name] as const)
          .filter((entry): entry is readonly [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
      );
    }

    const enrichedBids = bidRows.map((bid) => ({
      ...bid,
      companies:
        bid.bidder_company_id && companyNameById.has(bid.bidder_company_id)
          ? { name: companyNameById.get(bid.bidder_company_id)! }
          : null,
    }));

    // Group bids by job
    const groupMap = new Map<string, JobGroup>();
    for (const raw of enrichedBids) {
      if (!groupMap.has(raw.job_id)) {
        groupMap.set(raw.job_id, {
          jobId: raw.job_id,
          jobPickup: raw.pickup_location,
          jobDelivery: raw.delivery_location,
          jobPickupDate: raw.pickup_datetime,
          jobVehicle: raw.vehicle_type,
          awardedCarrierCompanyId: raw.awarded_carrier_company_id,
          exchangeVisibility: raw.exchange_visibility,
          bids: [],
        });
      }
      groupMap.get(raw.job_id)!.bids.push(raw);
    }
    setJobGroups(Array.from(groupMap.values()));
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void loadBids(); }, [loadBids]);

  //  Access token helper

  const getAccessToken = async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  //  Accept bid

  const acceptBid = async (bidId: string) => {
    setActionError('');
    setActionLoading(bidId);
    const token = await getAccessToken();
    if (!token) {
      setActionError('Session expired. Please sign in again.');
      setActionLoading(null);
      return;
    }
    const res = await fetch(`/api/admin/bids/${bidId}/accept`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      setActionError(json.error ?? `Accept failed (${res.status}).`);
    } else {
      void loadBids();
    }
    setActionLoading(null);
  };

  //  Reject bid

  const rejectBid = async (bidId: string) => {
    setActionError('');
    setActionLoading(bidId);
    const token = await getAccessToken();
    if (!token) {
      setActionError('Session expired. Please sign in again.');
      setActionLoading(null);
      return;
    }
    const res = await fetch(`/api/admin/bids/${bidId}/reject`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      setActionError(json.error ?? `Reject failed (${res.status}).`);
    } else {
      void loadBids();
    }
    setActionLoading(null);
  };

  //  Render

  return (
    <ProtectedRoute>
      <div style={{ background: '#f5f7fa', padding: '0.85rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Received Bids</h2>
              <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>Review and accept or reject bids on your exchange loads.</p>
            </div>
            <button
              onClick={() => void loadBids()}
              style={{ padding: '0.35rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b' }}
            >
              Refresh
            </button>
          </div>

          {/* Banners */}
          {!isSupabaseConfigured && (
            <Banner color="amber">Supabase is not configured. Database features are disabled.</Banner>
          )}
          {error && <Banner color="red">{error}</Banner>}
          {actionError && <Banner color="red">{actionError}</Banner>}

          {/* Content */}
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
          ) : jobGroups.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#6b7280', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ margin: 0 }}>No bids received yet. Publish loads to the exchange to start receiving bids.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {jobGroups.map((group) => (
                <JobBidGroup
                  key={group.jobId}
                  group={group}
                  actionLoading={actionLoading}
                  onAccept={acceptBid}
                  onReject={rejectBid}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

//  JobBidGroup

function JobBidGroup({
  group,
  actionLoading,
  onAccept,
  onReject,
}: {
  group: JobGroup;
  actionLoading: string | null;
  onAccept: (bidId: string) => void | Promise<void>;
  onReject: (bidId: string) => void | Promise<void>;
}) {
  const BIDS_PER_PAGE = 8;
  const [groupPage, setGroupPage] = useState(0);
  const isAwarded = !!group.awardedCarrierCompanyId;
  const awardedBid = isAwarded
    ? group.bids.find(
        (b) =>
          b.bidder_company_id === group.awardedCarrierCompanyId &&
          b.bid_status === 'accepted',
      )
    : null;
  useEffect(() => {
    setGroupPage(0);
  }, [group.jobId, group.bids.length]);
  const totalGroupPages = Math.max(1, Math.ceil(group.bids.length / BIDS_PER_PAGE));
  const safeGroupPage = Math.min(groupPage, totalGroupPages - 1);
  const visibleBids = group.bids.slice(safeGroupPage * BIDS_PER_PAGE, (safeGroupPage + 1) * BIDS_PER_PAGE);

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', border: isAwarded ? '1px solid #86efac' : '1px solid #e5e7eb' }}>
      {/* Job header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', backgroundColor: isAwarded ? '#f0fdf4' : '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
            {group.jobPickup || '-'} to {group.jobDelivery || '-'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
            {group.jobVehicle ? VEHICLE_LABEL[group.jobVehicle] ?? group.jobVehicle : 'Vehicle TBC'}
            {group.jobPickupDate ? `  Pickup: ${fmtDate(group.jobPickupDate)}` : ''}
            {'  '}
            <span style={{ textTransform: 'capitalize' }}>{group.exchangeVisibility}</span>
            {'  '}
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{group.jobId.slice(0, 8)}...</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAwarded ? (
            <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '0.3rem 0.85rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700 }}>
              Awarded{awardedBid?.companies?.name ? ` - ${awardedBid.companies.name}` : ''}
            </span>
          ) : (
            <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.3rem 0.85rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600 }}>
              {group.bids.filter((b) => b.bid_status === 'submitted').length} submitted bid{group.bids.filter((b) => b.bid_status === 'submitted').length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Bids table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {['Carrier', 'Amount', 'Message', 'Status', 'Submitted', 'Actions'].map((h) => (
              <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleBids.map((bid, i) => {
            const sc = STATUS_COLORS[bid.bid_status] ?? STATUS_COLORS.submitted;
            const isActioning = actionLoading === bid.id;
            const canAccept = !isAwarded && bid.bid_status === 'submitted';
            const canReject = bid.bid_status === 'submitted';
            const bidAmount = resolveBidAmountGbp(bid);

            return (
              <tr key={bid.id} style={{ borderBottom: i < visibleBids.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.88rem' }}>
                    {bid.companies?.name || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unknown carrier</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                    {bid.id.slice(0, 8)}...
                  </div>
                </td>
                <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#111827' }}>
                  {bidAmount == null ? '-' : `GBP ${bidAmount.toFixed(2)}`}
                  <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.25rem' }}>{bid.currency}</span>
                </td>
                <td style={{ padding: '0.85rem 1rem', color: '#6b7280', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                  {bid.message || <span style={{ fontStyle: 'italic' }}>-</span>}
                </td>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <span style={{ backgroundColor: sc.bg, color: sc.text, padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>
                    {bid.bid_status.charAt(0).toUpperCase() + bid.bid_status.slice(1)}
                  </span>
                </td>
                <td style={{ padding: '0.85rem 1rem', color: '#6b7280', fontSize: '0.85rem' }}>
                  {fmtDate(bid.created_at)}
                </td>
                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canAccept && (
                      <button
                        onClick={() => onAccept(bid.id)}
                        disabled={isActioning}
                        title="Accept this bid and award the job to this carrier"
                        style={{ padding: '0.35rem 0.8rem', backgroundColor: isActioning ? '#e5e7eb' : '#d1fae5', color: isActioning ? '#9ca3af' : '#065f46', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: isActioning ? 'not-allowed' : 'pointer' }}
                      >
                        {isActioning ? '...' : 'Accept'}
                      </button>
                    )}
                    {canReject && (
                      <button
                        onClick={() => onReject(bid.id)}
                        disabled={isActioning}
                        title="Reject this bid"
                        style={{ padding: '0.35rem 0.8rem', backgroundColor: isActioning ? '#e5e7eb' : '#fee2e2', color: isActioning ? '#9ca3af' : '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: isActioning ? 'not-allowed' : 'pointer' }}
                      >
                        {isActioning ? '...' : 'Reject'}
                      </button>
                    )}
                    {!canAccept && !canReject && (
                      <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>-</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {group.bids.length > BIDS_PER_PAGE && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0.65rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#6b7280' }}>
          <span>
            Showing {safeGroupPage * BIDS_PER_PAGE + 1}-{Math.min((safeGroupPage + 1) * BIDS_PER_PAGE, group.bids.length)} of {group.bids.length}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => setGroupPage((prev) => Math.max(prev - 1, 0))}
              disabled={safeGroupPage === 0}
              style={{ padding: '0.28rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '6px', background: safeGroupPage === 0 ? '#f9fafb' : '#fff', cursor: safeGroupPage === 0 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            <button
              onClick={() => setGroupPage((prev) => Math.min(prev + 1, totalGroupPages - 1))}
              disabled={safeGroupPage >= totalGroupPages - 1}
              style={{ padding: '0.28rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '6px', background: safeGroupPage >= totalGroupPages - 1 ? '#f9fafb' : '#fff', cursor: safeGroupPage >= totalGroupPages - 1 ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

//  Banner

function Banner({ children, color }: { children: React.ReactNode; color: 'red' | 'amber' }) {
  const styles = {
    red:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    amber: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  }[color];
  return (
    <div style={{ backgroundColor: styles.bg, border: `1px solid ${styles.border}`, borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem', color: styles.text, fontSize: '0.88rem' }}>
      {children}
    </div>
  );
}
