'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  WorkspaceShell,
  WorkspaceMain,
  WorkspaceHeader,
  WorkspaceContent,
  WorkspaceTable,
  WorkspaceTableTr,
  WorkspaceTableTd,
  WorkspaceStatusBadge,
  LoadingCard,
  EmptyCard,
  ErrorBanner,
  wsBtnAction,
  type WorkspaceTab,
} from '../../components/workspace';

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
  carrierIdentity: {
    displayName: string;
    companyName: string | null;
    companyType: string | null;
    personName: string | null;
  } | null;
};

type CarrierIdentity = {
  bidId: string;
  companyName: string | null;
  companyType: string | null;
  personName: string | null;
  displayName: string;
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
  accepted: { bg: '#d1fae5', text: '#065f46' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
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
    const token = await getAccessToken();
    let identityByBidId = new Map<string, CarrierIdentity>();
    if (token) {
      const identityResponse = await fetch('/api/admin/bids/identities', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (identityResponse.ok) {
        const identityJson = await identityResponse.json() as { identities?: CarrierIdentity[] };
        identityByBidId = new Map((identityJson.identities ?? []).map((identity) => [identity.bidId, identity]));
      }
    }

    const enrichedBids = bidRows.map((bid) => ({
      ...bid,
      companies: identityByBidId.get(bid.id)?.companyName
        ? { name: identityByBidId.get(bid.id)!.companyName! }
        : null,
      carrierIdentity: identityByBidId.get(bid.id) ?? null,
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

  const headerTabs: WorkspaceTab[] = [{
    id: 'received-bids',
    label: 'Received Bids',
    count: jobGroups.length,
  }];

  //  Render

  return (
    <ProtectedRoute>
      <WorkspaceShell>
        <WorkspaceMain>
          <WorkspaceHeader
            tabs={headerTabs}
            activeTab="received-bids"
            onTabChange={() => {}}
            action={(
              <button onClick={() => void loadBids()} style={wsBtnAction}>
                Refresh
              </button>
            )}
          />
          <WorkspaceContent>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <p style={{ color: '#64748b', margin: '0 0 1rem 0', fontSize: '0.8rem' }}>
                Review and accept or reject bids on your exchange loads.
              </p>

              {!isSupabaseConfigured && (
                <ErrorBanner msg="Supabase is not configured. Database features are disabled." />
              )}
              {error && <ErrorBanner msg={error} />}
              {actionError && <ErrorBanner msg={actionError} />}

              {loading ? (
                <LoadingCard text="Loading bids…" />
              ) : jobGroups.length === 0 ? (
                <EmptyCard icon="📦" text="No bids received yet. Publish loads to the exchange to start receiving bids." />
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
          </WorkspaceContent>
        </WorkspaceMain>
      </WorkspaceShell>
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
  const submittedCount = group.bids.filter((b) => b.bid_status === 'submitted').length;

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', border: isAwarded ? '1px solid #86efac' : '1px solid #e5e7eb' }}>
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
            <WorkspaceStatusBadge bg="#d1fae5" color="#065f46">
              Awarded{awardedBid?.companies?.name ? ` - ${awardedBid.companies.name}` : ''}
            </WorkspaceStatusBadge>
          ) : (
            <WorkspaceStatusBadge bg="#fef3c7" color="#92400e">
              {submittedCount} submitted bid{submittedCount !== 1 ? 's' : ''}
            </WorkspaceStatusBadge>
          )}
        </div>
      </div>

      <WorkspaceTable
        columns={['Carrier', 'Amount', 'Message', 'Status', 'Submitted', 'Actions']}
        pagination={{
          page: safeGroupPage,
          total: group.bids.length,
          perPage: BIDS_PER_PAGE,
          onPrev: () => setGroupPage((prev) => Math.max(prev - 1, 0)),
          onNext: () => setGroupPage((prev) => Math.min(prev + 1, totalGroupPages - 1)),
        }}
      >
        {visibleBids.map((bid, i) => {
          const sc = STATUS_COLORS[bid.bid_status] ?? STATUS_COLORS.submitted;
          const isActioning = actionLoading === bid.id;
          const canAccept = !isAwarded && bid.bid_status === 'submitted';
          const canReject = bid.bid_status === 'submitted';
          const bidAmount = resolveBidAmountGbp(bid);

          return (
            <WorkspaceTableTr key={bid.id} last={i === visibleBids.length - 1}>
              <WorkspaceTableTd>
                <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.88rem' }}>
                  {bid.carrierIdentity?.displayName || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Carrier profile incomplete</span>}
                </div>
                {bid.carrierIdentity?.companyName && bid.carrierIdentity.personName && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{bid.carrierIdentity.personName}</div>
                )}
                {bid.carrierIdentity?.companyType && (
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'capitalize' }}>
                    {bid.carrierIdentity.companyType.replaceAll('_', ' ')}
                  </div>
                )}
              </WorkspaceTableTd>
              <WorkspaceTableTd style={{ fontWeight: 700, color: '#111827' }}>
                {bidAmount == null ? '-' : `GBP ${bidAmount.toFixed(2)}`}
                <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.25rem' }}>{bid.currency}</span>
              </WorkspaceTableTd>
              <WorkspaceTableTd style={{ color: '#6b7280', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                {bid.message || <span style={{ fontStyle: 'italic' }}>-</span>}
              </WorkspaceTableTd>
              <WorkspaceTableTd>
                <WorkspaceStatusBadge bg={sc.bg} color={sc.text}>
                  {bid.bid_status.charAt(0).toUpperCase() + bid.bid_status.slice(1)}
                </WorkspaceStatusBadge>
              </WorkspaceTableTd>
              <WorkspaceTableTd style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                {fmtDate(bid.created_at)}
              </WorkspaceTableTd>
              <WorkspaceTableTd>
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
              </WorkspaceTableTd>
            </WorkspaceTableTr>
          );
        })}
      </WorkspaceTable>
    </div>
  );
}
