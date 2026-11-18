'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { confirmBookingPaymentObligation, bookingPaymentObligationRequestBody } from '../../../lib/legal/paymentObligationClient';
import { ActionButton, AlertBanner, EmptyState, OperationalTable, SemanticStatusBadge, StatusBadge } from '../../components/workspace/WorkspaceUI';

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
    if (!confirmBookingPaymentObligation()) return;
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
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: bookingPaymentObligationRequestBody,
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
      <div className="carrier-register-page carrier-register-page--bids">
        <div className="carrier-register-content">

          {/* Header */}
          <div className="carrier-register-toolbar">
            <div>
              <h1 className="carrier-register-title">Received Bids</h1>
              <p className="carrier-register-subtitle">Review and accept or reject bids on your exchange loads.</p>
            </div>
            <ActionButton tone="secondary" onClick={() => void loadBids()}>Refresh</ActionButton>
          </div>

          {/* Banners */}
          {!isSupabaseConfigured ? <AlertBanner tone="warning">Supabase is not configured. Database features are disabled.</AlertBanner> : null}
          {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
          {actionError ? <AlertBanner tone="danger">{actionError}</AlertBanner> : null}

          {/* Content */}
          {loading ? (
            <div className="carrier-register-empty"><EmptyState compact title="Loading bids..." /></div>
          ) : jobGroups.length === 0 ? (
            <div className="carrier-register-empty"><EmptyState title="No bids received yet" description="Publish loads to the exchange to start receiving bids." /></div>
          ) : (
            <div className="carrier-register-bid-list">
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
    <section className="carrier-register-bid-group" data-awarded={isAwarded ? 'true' : 'false'}>
      {/* Job header */}
      <div className="carrier-register-bid-group__header" data-awarded={isAwarded ? 'true' : 'false'}>
        <div>
          <div style={{ fontWeight: 600, color: '#172033', fontSize: 'var(--ws-font-panel-title, 13px)', lineHeight: '18px' }}>
            {group.jobPickup || '-'} to {group.jobDelivery || '-'}
          </div>
          <div style={{ fontSize: 'var(--ws-font-label, 11px)', lineHeight: '14px', color: '#64748b', marginTop: 2 }}>
            {group.jobVehicle ? VEHICLE_LABEL[group.jobVehicle] ?? group.jobVehicle : 'Vehicle TBC'}
            {group.jobPickupDate ? `  Pickup: ${fmtDate(group.jobPickupDate)}` : ''}
            {'  '}
            <span style={{ textTransform: 'capitalize' }}>{group.exchangeVisibility}</span>
            {'  '}
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--ws-font-meta, 11px)' }}>{group.jobId.slice(0, 8)}...</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isAwarded ? (
            <SemanticStatusBadge label={`Awarded${awardedBid?.companies?.name ? ` - ${awardedBid.companies.name}` : ''}`} tone="success" />
          ) : (
            <SemanticStatusBadge label={`${group.bids.filter((b) => b.bid_status === 'submitted').length} submitted bid${group.bids.filter((b) => b.bid_status === 'submitted').length !== 1 ? 's' : ''}`} tone="warning" />
          )}
        </div>
      </div>

      {/* Bids table */}
      <div className="carrier-register-table-wrap">
        <OperationalTable<BidWithJob>
          columns={[
            {
              id: 'carrier',
              header: 'Carrier',
              cell: (bid) => <>
                <strong>{bid.carrierIdentity?.displayName || 'Carrier profile incomplete'}</strong>
                {bid.carrierIdentity?.companyName && bid.carrierIdentity.personName ? <div className="workspace-record-meta">{bid.carrierIdentity.personName}</div> : null}
                {bid.carrierIdentity?.companyType ? <div className="workspace-record-meta" style={{ textTransform: 'capitalize' }}>{bid.carrierIdentity.companyType.replaceAll('_', ' ')}</div> : null}
              </>,
            },
            {
              id: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (bid) => {
                const amount = resolveBidAmountGbp(bid);
                return <strong>{amount == null ? '-' : `GBP ${amount.toFixed(2)}`} <span className="workspace-record-meta" style={{ display: 'inline' }}>{bid.currency}</span></strong>;
              },
            },
            { id: 'message', header: 'Message', cell: (bid) => bid.message || '—' },
            { id: 'status', header: 'Status', cell: (bid) => <StatusBadge value={bid.bid_status} />, semanticStatus: true },
            { id: 'submitted', header: 'Submitted', cell: (bid) => fmtDate(bid.created_at) },
            {
              id: 'actions',
              header: 'Actions',
              isAction: true,
              align: 'right',
              cell: (bid) => {
                const isActioning = actionLoading === bid.id;
                const canAccept = !isAwarded && bid.bid_status === 'submitted';
                const canReject = bid.bid_status === 'submitted';
                return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  {canAccept ? <ActionButton tone="success" disabled={isActioning} title="Accept this bid and award the job to this carrier" onClick={() => void onAccept(bid.id)}>{isActioning ? '...' : 'Accept'}</ActionButton> : null}
                  {canReject ? <ActionButton tone="danger" disabled={isActioning} title="Reject this bid" onClick={() => void onReject(bid.id)}>{isActioning ? '...' : 'Reject'}</ActionButton> : null}
                  {!canAccept && !canReject ? <span className="workspace-record-meta">—</span> : null}
                </div>;
              },
            },
          ]}
          rows={visibleBids}
          getRowKey={(bid) => bid.id}
          empty={<div className="carrier-register-empty">No bids in this page.</div>}
        />
      </div>
      {group.bids.length > BIDS_PER_PAGE && (
        <div style={{ minHeight: 'var(--ws-meta-h, 22px)', borderTop: '1px solid var(--ws-border-soft, #e2e7ed)', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--ws-font-meta, 11px)', color: '#64748b' }}>
          <span>
            Showing {safeGroupPage * BIDS_PER_PAGE + 1}-{Math.min((safeGroupPage + 1) * BIDS_PER_PAGE, group.bids.length)} of {group.bids.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <ActionButton tone="secondary" onClick={() => setGroupPage((prev) => Math.max(prev - 1, 0))} disabled={safeGroupPage === 0}>Previous</ActionButton>
            <ActionButton tone="secondary" onClick={() => setGroupPage((prev) => Math.min(prev + 1, totalGroupPages - 1))} disabled={safeGroupPage >= totalGroupPages - 1}>Next</ActionButton>
          </div>
        </div>
      )}
    </section>
  );
}
