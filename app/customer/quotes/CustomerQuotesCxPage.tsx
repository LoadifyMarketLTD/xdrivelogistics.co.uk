'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { bookingPaymentObligationRequestBody } from '../../../lib/legal/paymentObligationClient';
import { BOOKING_PAYMENT_OBLIGATION_ACKNOWLEDGEMENT_TEXT } from '../../../lib/legal/paymentObligation';
import { canonicalQuoteStage, quoteStageLabel } from '../../../lib/quotes/canonicalQuote';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData, type WorkspaceBid, type WorkspaceJob } from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type BidderIdentity = {
  bidId: string;
  companyId: string | null;
  driverId: string | null;
  companyName: string | null;
  personName: string | null;
  companyType: string | null;
  displayName: string;
  memberId: string | null;
  businessPhone: string | null;
  quoteLevel: 'driver' | 'company';
  driverAvailability: string | null;
  driverVehicleType: string | null;
  driverVehicleTailLift: boolean;
  driverVehiclePallets: number | null;
  fleetVehicleTypes: string[];
  specialistServices: string[];
};

type QuoteParticipant = {
  bid: WorkspaceBid;
  job: WorkspaceJob;
  identity: BidderIdentity | undefined;
  displayName: string;
  isOwnerDriverBid: boolean;
};

type BuyerBookingOffer = {
  id: string;
  job_id: string;
  bid_id: string;
  buyer_company_id: string;
  carrier_company_id: string | null;
  bidder_driver_id: string | null;
  quoted_amount: number | null;
  currency: string | null;
  status: string;
  offered_at: string | null;
  responded_at: string | null;
  decline_reason: string | null;
};

const money = (value: number, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const routeLabel = (job: WorkspaceJob) =>
  `${job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}`;

function AwardConfirmation({
  candidate,
  working,
  onCancel,
  onConfirm,
}: {
  candidate: QuoteParticipant;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onCancel(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.48)' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-award-confirmation-title"
        style={{ width: 'min(620px, calc(100vw - 32px))', overflow: 'hidden', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', boxShadow: 'none' }}
      >
        <header style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f4f6f8' }}>
          <strong id="customer-award-confirmation-title" style={{ display: 'block', fontSize: 14, lineHeight: '20px', color: '#0f172a' }}>Confirm booking offer</strong>
          <span style={{ display: 'block', marginTop: 2, fontSize: 11, lineHeight: '15px', color: '#64748b' }}>Review the selected carrier, price and load before sending the booking offer for carrier acceptance.</span>
        </header>

        <div style={{ padding: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
            {[
              ['Carrier', candidate.displayName],
              ['Member ID', candidate.identity?.memberId ?? 'Not supplied'],
              ['Business contact', candidate.identity?.businessPhone ?? 'Not supplied'],
              ['Quote scope', candidate.identity?.quoteLevel === 'driver' ? 'Named driver / owner driver' : 'Company / fleet'],
              ['Availability', candidate.identity?.driverAvailability?.replaceAll('_', ' ') ?? (candidate.identity?.quoteLevel === 'driver' ? 'Not supplied' : 'Company quote')],
              ['Driver vehicle', candidate.identity?.driverVehicleType ? `${candidate.identity.driverVehicleType.replaceAll('_', ' ')}${candidate.identity.driverVehicleTailLift ? ' · Tail lift' : ''}${candidate.identity.driverVehiclePallets != null ? ` · ${candidate.identity.driverVehiclePallets} pallets` : ''}` : 'Not linked'],
              ['Fleet capability', candidate.identity?.fleetVehicleTypes.length ? candidate.identity.fleetVehicleTypes.map((type) => type.replaceAll('_', ' ')).join(', ') : 'Not listed'],
              ['Specialist services', candidate.identity?.specialistServices.length ? candidate.identity.specialistServices.join(', ') : 'Not listed'],
              ['Agreed quote', money(Number(candidate.bid.bid_price_gbp ?? candidate.bid.amount ?? 0), candidate.bid.currency ?? 'GBP')],
              ['Route', routeLabel(candidate.job)],
              ['Pickup', when(candidate.job.pickup_datetime)],
              ['Vehicle', (candidate.job.vehicle_type ?? 'Not supplied').replaceAll('_', ' ')],
              ['Load ref', `XDL-${candidate.job.id.slice(0, 8).toUpperCase()}`],
            ].map(([label, value]) => (
              <div key={label} style={{ minHeight: 54, padding: '8px 9px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ display: 'block', color: '#64748b', fontSize: 11, lineHeight: '14px', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
                <strong style={{ display: 'block', marginTop: 3, color: '#0f172a', fontSize: 12, lineHeight: '16px' }}>{value}</strong>
              </div>
            ))}
          </div>
          {candidate.bid.message ? <div style={{ padding: 9, border: '1px solid #e2e8f0', borderRadius: 4, background: '#f8fafc', color: '#334155', fontSize: 11, lineHeight: '16px' }}><strong>Carrier message:</strong> {candidate.bid.message}</div> : null}
          <div style={{ padding: 9, border: '1px solid #fed7aa', borderRadius: 4, background: '#fff7ed', color: '#9a3412', fontSize: 11, lineHeight: '16px' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>Payment obligation acknowledgement</strong>
            <span>{BOOKING_PAYMENT_OBLIGATION_ACKNOWLEDGEMENT_TEXT}</span>
            <span style={{ display: 'block', marginTop: 5 }}>Selecting Send Booking Offer records this acknowledgement and creates a pending carrier acceptance request. No transport agreement is formed until the carrier accepts. On acceptance, the selected bid becomes accepted, competing submitted bids are rejected, and the booking advances under the authoritative backend lifecycle.</span>
          </div>
        </div>

        <footer style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid #e2e8f0', background: '#f4f6f8' }}>
          <ActionButton tone="secondary" disabled={working} onClick={onCancel}>Cancel</ActionButton>
          <ActionButton tone="success" disabled={working} onClick={onConfirm}>{working ? 'Sending…' : 'Send Booking Offer'}</ActionButton>
        </footer>
      </section>
    </div>
  );
}

function MessageParticipantDialog({
  candidate,
  body,
  working,
  error,
  onBodyChange,
  onCancel,
  onSend,
}: {
  candidate: QuoteParticipant;
  body: string;
  working: boolean;
  error: string;
  onBodyChange: (value: string) => void;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onCancel(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.48)' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-bid-message-title"
        style={{ width: 'min(620px, calc(100vw - 32px))', overflow: 'hidden', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', boxShadow: 'none' }}
      >
        <header style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f4f6f8' }}>
          <strong id="customer-bid-message-title" style={{ display: 'block', fontSize: 14, lineHeight: '20px', color: '#0f172a' }}>Message {candidate.displayName}</strong>
          <span style={{ display: 'block', marginTop: 2, fontSize: 11, lineHeight: '15px', color: '#64748b' }}>{routeLabel(candidate.job)} · XDL-{candidate.job.id.slice(0, 8).toUpperCase()}</span>
        </header>
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>
          <div style={{ padding: 9, border: '1px solid #dbeafe', borderRadius: 4, background: '#eff6ff', color: '#1e3a8a', fontSize: 11, lineHeight: '16px' }}>
            The recipient is resolved by XDrive from this real quote. You cannot replace the recipient with another user ID from this screen.
          </div>
          {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#475569' }}>
            MESSAGE
            <textarea
              autoFocus
              value={body}
              maxLength={4000}
              rows={5}
              onChange={(event) => onBodyChange(event.target.value)}
              placeholder="Write a transport-related message to this bidder"
              style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, font: 'inherit', resize: 'vertical' }}
            />
          </label>
          <span style={{ fontSize: 11, lineHeight: '14px', color: '#64748b' }}>{body.length}/4000 · messages are immutable once sent</span>
        </div>
        <footer style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', gap: 6, borderTop: '1px solid #e2e8f0', background: '#f4f6f8' }}>
          <ActionButton tone="secondary" disabled={working} onClick={onCancel}>Cancel</ActionButton>
          <ActionButton tone="primary" disabled={working || !body.trim()} onClick={onSend}>{working ? 'Sending…' : 'Send Message'}</ActionButton>
        </footer>
      </section>
    </div>
  );
}

export default function CustomerQuotesCxPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [identities, setIdentities] = useState<Map<string, BidderIdentity>>(new Map());
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'shortlisted' | 'pending_acceptance' | 'accepted' | 'unsuccessful' | 'archived'>('all');
  const [reference, setReference] = useState('');
  const [carrierSearch, setCarrierSearch] = useState('');
  const [candidate, setCandidate] = useState<QuoteParticipant | null>(null);
  const [messageCandidate, setMessageCandidate] = useState<QuoteParticipant | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [messageWorking, setMessageWorking] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [bookingOffers, setBookingOffers] = useState<BuyerBookingOffer[]>([]);
  const [bookingOfferError, setBookingOfferError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadIdentities = async () => {
      if (!data.bids.length) { setIdentities(new Map()); setIdentityError(''); return; }
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { setIdentityError('Member profiles are unavailable until the session is refreshed.'); return; }
      const response = await fetch('/api/workspace/bids/identities', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { identities?: BidderIdentity[]; error?: string };
      if (cancelled) return;
      if (!response.ok) { setIdentityError(payload.error ?? 'Bidder member profiles could not be resolved.'); return; }
      setIdentities(new Map((payload.identities ?? []).map((identity) => [identity.bidId, identity])));
      setIdentityError('');
    };
    void loadIdentities();
    return () => { cancelled = true; };
  }, [data.bids]);

  const loadBookingOffers = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setBookingOffers([]); setBookingOfferError('Carrier acceptance state is unavailable until the session is refreshed.'); return; }
    const response = await fetch('/api/customer/booking-offers', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as { offers?: BuyerBookingOffer[]; error?: string };
    if (!response.ok) { setBookingOffers([]); setBookingOfferError(payload.error ?? 'Carrier acceptance state could not be loaded.'); return; }
    setBookingOffers(payload.offers ?? []);
    setBookingOfferError('');
  }, []);

  useEffect(() => { void loadBookingOffers(); }, [loadBookingOffers, data.bids, data.jobs]);

  useEffect(() => {
    if (!candidate && !messageCandidate) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (candidate && !working) setCandidate(null);
      if (messageCandidate && !messageWorking) { setMessageCandidate(null); setMessageBody(''); setMessageError(''); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [candidate, messageCandidate, messageWorking, working]);

  const allQuotes = useMemo(() => data.bids.filter((bid) => ['submitted', 'accepted', 'rejected', 'declined', 'unsuccessful', 'withdrawn'].includes(String(bid.status).toLowerCase())), [data.bids]);
  const pendingOfferByJob = useMemo(() => new Map(bookingOffers.filter((offer) => offer.status === 'pending').map((offer) => [offer.job_id, offer])), [bookingOffers]);
  const pendingOfferByBid = useMemo(() => new Map(bookingOffers.filter((offer) => offer.status === 'pending').map((offer) => [offer.bid_id, offer])), [bookingOffers]);
  const grouped = useMemo(() => {
    const refNeedle = reference.trim().toLowerCase();
    const carrierNeedle = carrierSearch.trim().toLowerCase();
    return data.jobs.map((job) => ({
      job,
      quotes: allQuotes
        .filter((bid) => {
          if (bid.job_id !== job.id) return false;
          if (statusFilter === 'all') return true;
          const pendingOffer = pendingOfferByJob.get(job.id);
          if (statusFilter === 'pending_acceptance') return pendingOffer?.bid_id === bid.id;
          const stage = canonicalQuoteStage(bid, 'poster');
          if (statusFilter === 'submitted') return ['submitted', 'viewed'].includes(stage) && !pendingOffer;
          if (statusFilter === 'shortlisted') return stage === 'shortlisted' && !pendingOffer;
          if (statusFilter === 'unsuccessful') return ['unsuccessful', 'withdrawn', 'expired'].includes(stage);
          return stage === statusFilter;
        })
        .filter((bid) => {
          if (!carrierNeedle) return true;
          const identity = identities.get(bid.id);
          return `${identity?.displayName ?? ''} ${identity?.companyName ?? ''} ${identity?.personName ?? ''} ${identity?.memberId ?? ''} ${identity?.businessPhone ?? ''} ${identity?.driverVehicleType ?? ''} ${identity?.fleetVehicleTypes.join(' ') ?? ''} ${identity?.specialistServices.join(' ') ?? ''} ${identity?.companyId ?? ''} ${identity?.driverId ?? ''} ${bid.companies?.name ?? ''} ${bid.company_id ?? ''}`.toLowerCase().includes(carrierNeedle);
        })
        .sort((a, b) => Number(a.bid_price_gbp ?? a.amount ?? 0) - Number(b.bid_price_gbp ?? b.amount ?? 0)),
    })).filter((group) => group.quotes.length > 0)
      .filter(({ job }) => !refNeedle || `${job.id} XDL-${job.id.slice(0, 8)} ${job.booking_reference ?? ''} ${job.customer_reference ?? ''}`.toLowerCase().includes(refNeedle));
  }, [allQuotes, carrierSearch, data.jobs, identities, pendingOfferByJob, reference, statusFilter]);

  const award = async (id: string) => {
    setWorking(id); setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${id}/award`, { method: 'POST', headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }, body: bookingPaymentObligationRequestBody });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setMessage(payload.error ?? 'Unable to award quote.'); return; }
    setCandidate(null);
    setMessage('Booking offer sent - awaiting carrier acceptance.');
    await Promise.all([data.refresh(), loadBookingOffers()]);
  };

  const reject = async (id: string) => {
    setWorking(id); setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${id}/reject`, { method: 'POST', headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {} });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setMessage(payload.error ?? 'Unable to reject quote.'); return; }
    setMessage('Carrier quote rejected.');
    await data.refresh();
  };

  const updateQuoteLifecycle = async (
    id: string,
    action: 'viewed' | 'shortlist' | 'unshortlist' | 'archive_poster' | 'unarchive_poster',
  ) => {
    setWorking(id);
    setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setWorking(null);
      setMessage('Your session has expired. Sign in again.');
      return;
    }
    const response = await fetch(`/api/workspace/bids/${encodeURIComponent(id)}/lifecycle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; auditWarning?: string | null };
    setWorking(null);
    if (!response.ok) {
      setMessage(payload.error ?? 'Quote lifecycle could not be updated.');
      return;
    }
    setMessage(payload.auditWarning || 'Quote lifecycle updated successfully.');
    await data.refresh();
  };

  const sendBidMessage = async () => {
    if (!messageCandidate || !messageBody.trim() || messageWorking) return;
    setMessageWorking(true);
    setMessageError('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${messageCandidate.bid.id}/message`, {
      method: 'POST',
      headers: {
        ...(session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: messageBody.trim() }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; conversationId?: string };
    setMessageWorking(false);
    if (!response.ok) { setMessageError(payload.error ?? 'Message could not be sent.'); return; }
    setMessageCandidate(null);
    setMessageBody('');
    setMessage('Message sent to the verified quote participant.');
    const conversation = payload.conversationId ? `&conversation=${encodeURIComponent(payload.conversationId)}` : '';
    router.push(`/customer/messages?bidId=${encodeURIComponent(messageCandidate.bid.id)}&jobId=${encodeURIComponent(messageCandidate.job.id)}${conversation}`);
  };

  const counts = {
    all: allQuotes.length,
    submitted: allQuotes.filter((bid) => ['submitted', 'viewed'].includes(canonicalQuoteStage(bid, 'poster')) && !pendingOfferByJob.has(bid.job_id)).length,
    shortlisted: allQuotes.filter((bid) => canonicalQuoteStage(bid, 'poster') === 'shortlisted' && !pendingOfferByJob.has(bid.job_id)).length,
    pending_acceptance: allQuotes.filter((bid) => pendingOfferByBid.has(bid.id)).length,
    accepted: allQuotes.filter((bid) => canonicalQuoteStage(bid, 'poster') === 'accepted').length,
    unsuccessful: allQuotes.filter((bid) => ['unsuccessful', 'withdrawn', 'expired'].includes(canonicalQuoteStage(bid, 'poster'))).length,
    archived: allQuotes.filter((bid) => canonicalQuoteStage(bid, 'poster') === 'archived').length,
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer commercial"
        title="Quotes"
        description="Compare carrier responses by load, inspect member profiles, message the verified bidder and send one booking offer for carrier acceptance."
        actions={<><ActionButton tone="secondary" onClick={() => router.push('/customer/messages')}>Messages</ActionButton><ActionButton tone="secondary" onClick={() => void Promise.all([data.refresh(), loadBookingOffers()])}>Refresh</ActionButton></>}
      />
      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {message && <AlertBanner tone={message.includes('successfully') || message.includes('rejected') || message.includes('sent') ? 'success' : 'danger'}>{message}</AlertBanner>}
      {identityError && <AlertBanner tone="warning">{identityError}</AlertBanner>}
      {bookingOfferError && <AlertBanner tone="warning">{bookingOfferError}</AlertBanner>}
      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Customer quote filters"><div className="workspace-filter-rail__header">Search Quotes</div><div className="workspace-filter-rail__body"><label>LOAD ID / REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="XDrive or customer reference" /></label><label>CARRIER / MEMBER<input value={carrierSearch} onChange={(event) => setCarrierSearch(event.target.value)} placeholder="Company, owner driver or member ID" /></label><label>STATUS<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All quote activity</option><option value="submitted">Awaiting decision</option><option value="shortlisted">Shortlisted</option><option value="pending_acceptance">Awaiting carrier acceptance</option><option value="accepted">Accepted</option><option value="unsuccessful">Unsuccessful</option><option value="archived">Archived</option></select></label><ActionButton tone="secondary" onClick={() => { setReference(''); setCarrierSearch(''); setStatusFilter('all'); }}>Clear</ActionButton></div></aside>
        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>{(['all', 'submitted', 'shortlisted', 'pending_acceptance', 'accepted', 'unsuccessful', 'archived'] as const).map((status) => <button key={status} type="button" data-active={statusFilter === status ? 'true' : 'false'} onClick={() => setStatusFilter(status)}>{status === 'all' ? 'All' : status === 'submitted' ? 'Awaiting Decision' : status === 'pending_acceptance' ? 'Awaiting Carrier' : status === 'shortlisted' ? 'Shortlisted' : status === 'unsuccessful' ? 'Unsuccessful' : status[0].toUpperCase() + status.slice(1)} {counts[status]}</button>)}</div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span><strong>{grouped.length}</strong> load{grouped.length === 1 ? '' : 's'} with matching quotes</span><span>Lowest visible price shown first per load · one booking offer may await carrier acceptance at a time</span></div>
          {grouped.length === 0 ? <div className="workspace-panel"><EmptyState title={data.loading ? 'Loading quotes…' : 'No quotes in this view'} description="Carrier responses appear here after a load is published." /></div> : grouped.map(({ job, quotes }) => <section key={job.id} className="workspace-panel" style={{ marginBottom: 8 }}><div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span><strong>{routeLabel(job)}</strong> · Pickup {when(job.pickup_datetime)} · XDrive XDL-{job.id.slice(0, 8).toUpperCase()}</span><ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}`)}>Open load</ActionButton></div><DataTable columns={['Carrier', 'Price', 'Position', 'Message', 'Submitted', 'Status', 'Decision']} rows={quotes.map((bid, index) => {
            const identity = identities.get(bid.id);
            const isOwnerDriverBid = !bid.company_id && Boolean(identity?.driverId);
            const displayName = isOwnerDriverBid ? (identity?.personName || identity?.displayName || 'Owner Driver') : (identity?.companyName || bid.companies?.name || identity?.displayName || 'Carrier');
            const participant: QuoteParticipant = { bid, job, identity, displayName, isOwnerDriverBid };
            const quoteStage = canonicalQuoteStage(bid, 'poster');
            const pendingOffer = pendingOfferByJob.get(job.id);
            const isPendingSelectedBid = pendingOffer?.bid_id === bid.id;
            const awardLocked = Boolean(pendingOffer);
            const messagingAvailable = bid.status === 'submitted' || bid.status === 'accepted' || isPendingSelectedBid;
            return [
              <span key="carrier" style={{ display: 'grid', gap: 2 }}><strong><MemberIdentityLink companyId={isOwnerDriverBid ? null : (bid.company_id ?? identity?.companyId ?? null)} driverId={isOwnerDriverBid ? identity?.driverId ?? null : null}>{displayName}</MemberIdentityLink></strong><small style={{ color: '#64748b' }}>{identity?.memberId ? `ID ${identity.memberId} · ` : ''}{identity?.quoteLevel === 'driver' ? `Driver ${identity.driverAvailability?.replaceAll('_', ' ') || 'availability not supplied'}` : `${identity?.fleetVehicleTypes.length ?? 0} fleet type${identity?.fleetVehicleTypes.length === 1 ? '' : 's'}`}</small></span>,
              <strong key="price">{money(Number(bid.bid_price_gbp ?? bid.amount ?? 0), bid.currency ?? 'GBP')}</strong>,
              index === 0 ? <StatusBadge key="position" value="Best price" tone="green" /> : `#${index + 1}`,
              bid.message ?? 'No message',
              when(bid.created_at),
              isPendingSelectedBid ? <StatusBadge key="status" value="Awaiting Carrier Acceptance" tone="orange" /> : <StatusBadge key="status" value={quoteStageLabel(quoteStage)} />,
              <span key="actions" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {bid.status === 'submitted' && !awardLocked ? <ActionButton tone="success" disabled={working === bid.id} onClick={() => setCandidate(participant)}>Review & Send Offer</ActionButton> : null}
                {isPendingSelectedBid ? <StatusBadge value="Offer sent · awaiting carrier" tone="orange" /> : null}
                {messagingAvailable ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => { setMessageCandidate(participant); setMessageBody(''); setMessageError(''); }}>Message</ActionButton> : null}
                {quoteStage === 'shortlisted' && !awardLocked ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => void updateQuoteLifecycle(bid.id, 'unshortlist')}>Remove shortlist</ActionButton> : null}
                {['submitted', 'viewed'].includes(quoteStage) && !awardLocked ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => void updateQuoteLifecycle(bid.id, 'shortlist')}>Shortlist</ActionButton> : null}
                {bid.status === 'submitted' && !awardLocked ? <ActionButton tone="danger" disabled={working === bid.id} onClick={() => void reject(bid.id)}>Reject</ActionButton> : null}
                {quoteStage !== 'archived' && ['accepted', 'unsuccessful', 'withdrawn', 'expired'].includes(quoteStage) ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => void updateQuoteLifecycle(bid.id, 'archive_poster')}>Archive</ActionButton> : null}
                {quoteStage === 'archived' ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => void updateQuoteLifecycle(bid.id, 'unarchive_poster')}>Restore</ActionButton> : null}
              </span>,
            ];
          })} /></section>)}
        </main>
      </div>

      {candidate ? <AwardConfirmation candidate={candidate} working={working === candidate.bid.id} onCancel={() => setCandidate(null)} onConfirm={() => void award(candidate.bid.id)} /> : null}
      {messageCandidate ? <MessageParticipantDialog candidate={messageCandidate} body={messageBody} working={messageWorking} error={messageError} onBodyChange={setMessageBody} onCancel={() => { setMessageCandidate(null); setMessageBody(''); setMessageError(''); }} onSend={() => void sendBidMessage()} /> : null}
    </PageFrame>
  );
}
