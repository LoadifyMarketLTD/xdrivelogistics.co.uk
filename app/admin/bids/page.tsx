'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import {resolveWorkspaceRole} from '../../../lib/workspaceRole';
import BookingConfirmationFullPage from '../../customer/quotes/BookingConfirmationFullPage';
import { bookingOfferReviewDetails } from '../../customer/quotes/bookingOfferReviewDetails';
import {receivedBidPrice,awardCurrencyVerified,pendingBuyerOffers,canAwardReceivedBid,type BuyerOffer} from '../../components/workspace/companyAdminReceivedBids';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { bookingPaymentObligationRequestBody } from '../../../lib/legal/paymentObligationClient';
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
    memberId: string | null;
    businessPhone: string | null;
    driverAvailability: string | null;
    driverVehicleType: string | null;
    driverVehicleTailLift: boolean;
    driverVehiclePallets: number | null;
  } | null;
};

type CarrierIdentity = {
  bidId: string;
  companyName: string | null;
  companyType: string | null;
  personName: string | null;
  displayName: string;
  memberId: string | null;
  businessPhone: string | null;
  driverAvailability: string | null;
  driverVehicleType: string | null;
  driverVehicleTailLift: boolean;
  driverVehiclePallets: number | null;
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

export default function BidsPage(){const {user}=useAuth();return <BidsPageContent key={(user?.id??'unknown')+':'+(user?.companyId??'unknown')}/>;}
function BidsPageContent() {
  const { user } = useAuth();
  const companyAdmin=(user?.workspaceRole??resolveWorkspaceRole(user))==='company_admin';
  const mutationLock=useRef(false);
  const [pendingOffers,setPendingOffers]=useState<Map<string,BuyerOffer>>(new Map());
  const [offersKnown,setOffersKnown]=useState(false);
  const [offersWarning,setOffersWarning]=useState('');
  const [review,setReview]=useState<BidWithJob|null>(null);
  const [notice,setNotice]=useState('');
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
    if(companyAdmin){setOffersKnown(false);setOffersWarning('');}
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!companyId) {
      setError('Company profile not loaded. Bid data is hidden until company access resolves.');
      setLoading(false);
      return;
    }

    // Fetch all bids on jobs owned by the current company.
    // The job_bids_owner_select RLS policy (migration 061) allows job owners to
    // SELECT bids on their own jobs, keyed via the jobs join.
    try {
    const { data, error: fetchError } = await supabase
      .from('job_bids_with_job_owner')
      .select('*')
      .eq('owner_company_id', companyId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      if(companyAdmin)setJobGroups([]);
      setError(`Failed to load bids: ${fetchError.message}`);
      setLoading(false);
      return;
    }

    const bidRows = ((data ?? []) as unknown as BidWithJob[]).filter(bid=>!companyAdmin||bid.owner_company_id===companyId);
    const token = await getAccessToken();
    if(companyAdmin){
      try{
        if(!token)throw Error('Session unavailable');
        const response=await fetch('/api/admin/bids/pending-offers?companyId='+encodeURIComponent(companyId),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
        const result=await response.json() as {offers?:BuyerOffer[]};
        if(!response.ok||!Array.isArray(result.offers))throw Error('Booking offers could not be verified');
        setPendingOffers(pendingBuyerOffers(result.offers,companyId));
        setOffersKnown(true);
      }catch{setOffersWarning('Booking offer status could not be verified. Award actions are disabled until refresh succeeds.');}
    }
    let identityByBidId = new Map<string, CarrierIdentity>();
    if (token) {
      try{const identityResponse = await fetch('/api/admin/bids/identities', {
        headers: { Authorization: 'Bearer ' + token },signal:AbortSignal.timeout(12000),
      });
      if (identityResponse.ok) {
        const identityJson = await identityResponse.json() as { identities?: CarrierIdentity[] };
        identityByBidId = new Map((identityJson.identities ?? []).map((identity) => [identity.bidId, identity]));
      }}catch{/* Identity enrichment unavailable; retain explicit incomplete label. */}
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
    }catch{setError('Received bids could not be loaded. Refresh to retry.');setJobGroups([]);}finally{setLoading(false);}
  }, [companyId,companyAdmin]);

  useEffect(() => { void loadBids(); }, [loadBids]);

  //  Access token helper

  const getAccessToken = async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  //  Accept bid

  const acceptBid = async (bidId: string) => {
    if(!review||review.id!==bidId)return;
    if(companyAdmin&&!canAwardReceivedBid(review,companyId,pendingOffers.has(review.job_id),offersKnown))return;
    if(mutationLock.current)return;mutationLock.current=true;
    setNotice('');
    try {
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
      body: bookingPaymentObligationRequestBody,signal:AbortSignal.timeout(15000),
    });
    const json = await res.json() as { error?: string;success?:boolean;bookingOfferId?:string;jobId?:string;status?:string };
    if (!res.ok) {
      setActionError(json.error ?? `Accept failed (${res.status}).`);
    } else if(companyAdmin){
      if(json.success!==true||json.status!=='pending_carrier_acceptance'||!json.bookingOfferId||!json.jobId||json.jobId!==review?.job_id){setActionError('Award response could not be verified. Refresh before retrying.');setOffersKnown(false);return;}
      const offer:BuyerOffer={id:json.bookingOfferId,job_id:json.jobId,bid_id:bidId,buyer_company_id:companyId!,status:'pending'};
      setPendingOffers(current=>new Map(current).set(offer.job_id,offer));setReview(null);setNotice('Booking offer sent. Awaiting carrier acceptance; this is not yet a confirmed booking.');await loadBids();
    } else {void loadBids();}
    }catch{setActionError('Award result could not be verified. Refresh before retrying.');if(companyAdmin)setOffersKnown(false);}finally{mutationLock.current=false;setActionLoading(null);}
  };

  //  Reject bid

  const rejectBid = async (bidId: string) => {
    if(mutationLock.current)return;mutationLock.current=true;
    try {
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
      headers: { Authorization: 'Bearer ' + token },signal:AbortSignal.timeout(15000),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      setActionError(json.error ?? `Reject failed (${res.status}).`);
    } else {
      await loadBids();
    }
    }catch{setActionError('Rejection result could not be verified. Refresh before retrying.');}finally{mutationLock.current=false;setActionLoading(null);}
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
            <ActionButton tone="secondary" disabled={Boolean(actionLoading)||loading} onClick={() => void loadBids()}>Refresh</ActionButton>
          </div>

          {/* Banners */}
          {!isSupabaseConfigured ? <AlertBanner tone="warning">Supabase is not configured. Database features are disabled.</AlertBanner> : null}
          {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
          {actionError ? <AlertBanner tone="danger">{actionError}</AlertBanner> : null}
          {companyAdmin&&offersWarning&&<AlertBanner tone="warning">{offersWarning}</AlertBanner>}
          {companyAdmin&&notice&&<AlertBanner tone="success">{notice}</AlertBanner>}
          {review && <BookingConfirmationFullPage
            key={review.id}
            details={bookingOfferReviewDetails({
              id:review.job_id,pickup_location:review.pickup_location,delivery_location:review.delivery_location,
              pickup_datetime:review.pickup_datetime,vehicle_type:review.vehicle_type,
            },{
              company_id:review.bidder_company_id,bidder_driver_id:review.bidder_driver_id,
              bid_price_gbp:review.bid_price_gbp,amount:review.amount,currency:review.currency,
              message:review.message,companies:review.companies,
            },review.carrierIdentity?{
              displayName:review.carrierIdentity.displayName,
              companyName:review.carrierIdentity.companyName,
              personName:review.carrierIdentity.personName,
              memberId:review.carrierIdentity.memberId,
              businessPhone:review.carrierIdentity.businessPhone,
              driverAvailability:review.carrierIdentity.driverAvailability,
              driverVehicleType:review.carrierIdentity.driverVehicleType,
              driverVehicleTailLift:review.carrierIdentity.driverVehicleTailLift,
              driverVehiclePallets:review.carrierIdentity.driverVehiclePallets,
            }:null)}
            working={Boolean(actionLoading)}
            error={actionError}
            onCancel={()=>{setReview(null);setActionError('')}}
            onConfirm={()=>void acceptBid(review.id)}
          />}


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
                  companyAdmin={companyAdmin} companyId={companyId} offersKnown={offersKnown} pendingOffer={pendingOffers.get(group.jobId)}
                  onAccept={(bidId)=>{const bid=group.bids.find(b=>b.id===bidId);if(!bid)return;if(companyAdmin&&!canAwardReceivedBid(bid,companyId,pendingOffers.has(group.jobId),offersKnown))return;setActionError('');setReview(bid)}}
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
  companyAdmin,companyId,offersKnown,pendingOffer,
  actionLoading,
  onAccept,
  onReject,
}: {
  group: JobGroup;
  companyAdmin:boolean;companyId:string|null;offersKnown:boolean;pendingOffer?:BuyerOffer;
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
          {companyAdmin&&pendingOffer&&!isAwarded?<SemanticStatusBadge label="Awaiting carrier acceptance" tone="warning"/>:isAwarded ? (
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
                if(companyAdmin)return <strong>{receivedBidPrice(bid)?.label??'Price not supplied'}</strong>;
                const amount = resolveBidAmountGbp(bid);
                return <strong>{amount == null ? '-' : `GBP ${amount.toFixed(2)}`} <span className="workspace-record-meta" style={{ display: 'inline' }}>{bid.currency}</span></strong>;
              },
            },
            { id: 'message', header: 'Message', cell: (bid) => bid.message || '—' },
            { id: 'status', header: 'Status', cell: (bid) => <StatusBadge value={companyAdmin&&pendingOffer?.bid_id===bid.id?'Awaiting carrier acceptance':bid.bid_status} />, semanticStatus: true },
            { id: 'submitted', header: 'Submitted', cell: (bid) => fmtDate(bid.created_at) },
            {
              id: 'actions',
              header: 'Actions',
              isAction: true,
              align: 'right',
              cell: (bid) => {
                const isActioning = actionLoading === bid.id;
                const canAccept = companyAdmin?canAwardReceivedBid(bid,companyId,Boolean(pendingOffer),offersKnown):!isAwarded && bid.bid_status === 'submitted';
                const canReject = bid.bid_status === 'submitted'&&(!companyAdmin||(!pendingOffer&&offersKnown&&!isAwarded));
                return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  {canAccept ? <ActionButton tone="success" disabled={companyAdmin?Boolean(actionLoading):isActioning} title="Accept this bid and award the job to this carrier" onClick={() => void onAccept(bid.id)}>{isActioning ? '...' : 'Review offer'}</ActionButton> : null}
                  {canReject ? <ActionButton tone="danger" disabled={companyAdmin?Boolean(actionLoading):isActioning} title="Reject this bid" onClick={() => void onReject(bid.id)}>{isActioning ? '...' : 'Reject'}</ActionButton> : null}
                  {companyAdmin&&bid.bid_status==='submitted'&&!isAwarded&&!pendingOffer&&offersKnown&&!awardCurrencyVerified(bid)?<span className="workspace-record-meta">Award unavailable: currency verification required.</span>:null}
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
