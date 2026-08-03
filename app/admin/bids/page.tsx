'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

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
      {/* Page background — contract Section 1: #f4f6f8, 12px padding */}
      <div style={{ background: '#f4f6f8', padding: '12px' }}>
        <PageHeader
          eyebrow="Exchange"
          title="Received Bids"
          description="Review and accept or reject bids on your exchange loads."
          actions={<ActionButton tone="secondary" onClick={() => void loadBids()}>Refresh</ActionButton>}
        />

        {!isSupabaseConfigured && <AlertBanner tone="warning">Supabase is not configured. Database features are disabled.</AlertBanner>}
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {actionError && <AlertBanner tone="danger">{actionError}</AlertBanner>}

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>Loading…</div>
        ) : jobGroups.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '32px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>No bids received yet. Publish loads to the exchange to start receiving bids.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
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
    <div className={`${cssStyles.bidsJobGroup} ${isAwarded ? cssStyles.bidsJobGroupAwarded : ''}`}>
      {/* Job header — 36px min-height, dense */}
      <div className={`${cssStyles.bidsJobGroupHeader} ${isAwarded ? cssStyles.bidsJobGroupHeaderAwarded : ''}`}>
        <div>
          <p className={cssStyles.bidsJobGroupTitle}>
            {group.jobPickup || '-'} → {group.jobDelivery || '-'}
          </p>
          <p className={cssStyles.bidsJobGroupMeta}>
            {group.jobVehicle ? VEHICLE_LABEL[group.jobVehicle] ?? group.jobVehicle : 'Vehicle TBC'}
            {group.jobPickupDate ? `  ·  Pickup: ${fmtDate(group.jobPickupDate)}` : ''}
            {'  ·  '}
            <span style={{ textTransform: 'capitalize' }}>{group.exchangeVisibility}</span>
            {'  ·  '}
            <span style={{ fontFamily: 'monospace' }}>{group.jobId.slice(0, 8)}…</span>
          </p>
        </div>
        <div>
          {isAwarded ? (
            <span className={`${cssStyles.bidsJobGroupBadge} ${cssStyles.bidsJobGroupBadgeAwarded}`}>
              Awarded{awardedBid?.companies?.name ? ` — ${awardedBid.companies.name}` : ''}
            </span>
          ) : (
            <span className={`${cssStyles.bidsJobGroupBadge} ${cssStyles.bidsJobGroupBadgePending}`}>
              {group.bids.filter((b) => b.bid_status === 'submitted').length} submitted bid{group.bids.filter((b) => b.bid_status === 'submitted').length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Bids table — Section 9+10: header 36px; rows 42px */}
      <div className={cssStyles.operationalTableScroll}>
        <table className={cssStyles.operationalTable}>
          <caption className={cssStyles.operationalTableCaption}>Bids for this job</caption>
          <thead>
            <tr className={cssStyles.operationalTableHeaderRow}>
              {['Carrier', 'Amount', 'Message', 'Status', 'Submitted', 'Actions'].map((h) => (
                <th key={h} scope="col" className={cssStyles.operationalTableHeadCell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleBids.map((bid) => {
              const isActioning = actionLoading === bid.id;
              const canAccept = !isAwarded && bid.bid_status === 'submitted';
              const canReject = bid.bid_status === 'submitted';
              const bidAmount = resolveBidAmountGbp(bid);

              return (
                <tr key={bid.id} className={`${cssStyles.operationalTableRow} xdrive-table-row`}>
                  <td className={cssStyles.operationalTableCell}>
                    <strong style={{ fontSize: '12px', color: '#111827' }}>
                      {bid.carrierIdentity?.displayName ?? <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Carrier profile incomplete</span>}
                    </strong>
                    {bid.carrierIdentity?.companyName && bid.carrierIdentity.personName && (
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{bid.carrierIdentity.personName}</div>
                    )}
                    {bid.carrierIdentity?.companyType && (
                      <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'capitalize' }}>
                        {bid.carrierIdentity.companyType.replaceAll('_', ' ')}
                      </div>
                    )}
                  </td>
                  <td className={cssStyles.operationalTableCell} style={{ fontWeight: 700 }}>
                    {bidAmount == null ? '-' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(bidAmount)}
                  </td>
                  <td className={cssStyles.operationalTableCell} style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bid.message ?? <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>—</span>}
                  </td>
                  <td className={cssStyles.operationalTableCell}>
                    <StatusBadge value={bid.bid_status.charAt(0).toUpperCase() + bid.bid_status.slice(1)} />
                  </td>
                  <td className={cssStyles.operationalTableCell}>{fmtDate(bid.created_at)}</td>
                  <td className={`${cssStyles.operationalTableCell} ${cssStyles.operationalTableActionCell}`}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      {canAccept && (
                        <ActionButton
                          tone="success"
                          disabled={isActioning}
                          title="Accept this bid and award the job to this carrier"
                          onClick={() => onAccept(bid.id)}
                        >
                          {isActioning ? '…' : 'Accept'}
                        </ActionButton>
                      )}
                      {canReject && (
                        <ActionButton
                          tone="danger"
                          disabled={isActioning}
                          title="Reject this bid"
                          onClick={() => onReject(bid.id)}
                        >
                          {isActioning ? '…' : 'Reject'}
                        </ActionButton>
                      )}
                      {!canAccept && !canReject && (
                        <span style={{ color: '#9ca3af', fontSize: '11px', fontStyle: 'italic' }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {group.bids.length > BIDS_PER_PAGE && (
        <div className={cssStyles.operationalTableMeta}>
          <span>
            Showing {safeGroupPage * BIDS_PER_PAGE + 1}–{Math.min((safeGroupPage + 1) * BIDS_PER_PAGE, group.bids.length)} of {group.bids.length}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <ActionButton tone="secondary" disabled={safeGroupPage === 0} onClick={() => setGroupPage((prev) => Math.max(prev - 1, 0))}>
              Previous
            </ActionButton>
            <ActionButton tone="secondary" disabled={safeGroupPage >= totalGroupPages - 1} onClick={() => setGroupPage((prev) => Math.min(prev + 1, totalGroupPages - 1))}>
              Next
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
