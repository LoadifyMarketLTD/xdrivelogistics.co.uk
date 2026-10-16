'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { confirmBookingPaymentObligation, bookingPaymentObligationRequestBody } from '../../../lib/legal/paymentObligationClient';
import { useCompanyWorkspaceData, type WorkspaceBid } from '../../components/workspace/useCompanyWorkspaceData';
import { workspaceVehicleImageSrc } from '../../components/workspace/vehiclePresentation';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { canonicalQuoteStage, quoteStageLabel } from '../../../lib/quotes/canonicalQuote';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
} from '../../components/workspace/WorkspaceUI';

type QuoteTab = 'received' | 'archived' | 'submitted' | 'unsuccessful';
type BidderIdentity = {
  bidId: string;
  companyId: string | null;
  driverId: string | null;
  companyName: string | null;
  companyType: string | null;
  personName: string | null;
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

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
const priceOf = (bid: WorkspaceBid) => Number(bid.bid_price_gbp ?? bid.amount ?? 0);

function matchesTab(bid: WorkspaceBid, tab: QuoteTab) {
  const stage = canonicalQuoteStage(bid, 'poster');
  if (tab === 'received') return ['submitted', 'viewed', 'shortlisted'].includes(stage);
  if (tab === 'archived') return ['accepted', 'archived'].includes(stage);
  if (tab === 'submitted') return false;
  return ['unsuccessful', 'withdrawn', 'expired'].includes(stage);
}

export default function BrokerQuotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = useCompanyWorkspaceData();
  const deepJob = searchParams.get('job');
  const [tab, setTab] = useState<QuoteTab>('received');
  const [customer, setCustomer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [carrier, setCarrier] = useState('');
  const [reference, setReference] = useState(deepJob || '');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [identities, setIdentities] = useState<Record<string, BidderIdentity>>({});
  const [identityWarning, setIdentityWarning] = useState('');

  useEffect(() => {
    if (deepJob) setReference(deepJob);
  }, [deepJob]);

  useEffect(() => {
    let active = true;
    const loadIdentities = async () => {
      if (!data.bids.length) {
        if (active) { setIdentities({}); setIdentityWarning(''); }
        return;
      }
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error('Session unavailable.');
        const response = await fetch('/api/admin/bids/identities', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as { identities?: BidderIdentity[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Bidder identities could not be resolved.');
        if (!active) return;
        setIdentities(Object.fromEntries((payload.identities ?? []).map((identity) => [identity.bidId, identity])));
        setIdentityWarning('');
      } catch {
        if (!active) return;
        setIdentities({});
        setIdentityWarning('Some bidder identities could not be enriched. Company-backed profiles remain available where the quote already supplies a company.');
      }
    };
    void loadIdentities();
    return () => { active = false; };
  }, [data.bids]);

  const rows = useMemo(() => {
    const jobs = new Map(data.jobs.map((job) => [job.id, job]));
    const customerTerm = customer.trim().toLowerCase();
    const fromTerm = from.trim().toLowerCase();
    const toTerm = to.trim().toLowerCase();
    const carrierTerm = carrier.trim().toLowerCase();
    const referenceTerm = reference.trim().toLowerCase();

    return data.bids
      .filter((bid) => matchesTab(bid, tab))
      .map((bid) => ({ bid, job: jobs.get(bid.job_id), identity: identities[bid.id] }))
      .filter(({ job }) => Boolean(job))
      .filter(({ job }) => !customerTerm || String(job?.client_name || '').toLowerCase().includes(customerTerm))
      .filter(({ job }) => !fromTerm || `${job?.pickup_postcode || ''} ${job?.pickup_location || ''}`.toLowerCase().includes(fromTerm))
      .filter(({ job }) => !toTerm || `${job?.delivery_postcode || ''} ${job?.delivery_location || ''}`.toLowerCase().includes(toTerm))
      .filter(({ bid, identity }) => !carrierTerm || `${identity?.displayName || ''} ${identity?.personName || ''} ${identity?.memberId || ''} ${identity?.businessPhone || ''} ${identity?.driverVehicleType || ''} ${(identity?.fleetVehicleTypes || []).join(' ')} ${(identity?.specialistServices || []).join(' ')} ${bid.companies?.name || ''}`.toLowerCase().includes(carrierTerm))
      .filter(({ bid, job }) => !referenceTerm || `${bid.id} ${job?.id || ''}`.toLowerCase().includes(referenceTerm))
      .sort((a, b) => priceOf(a.bid) - priceOf(b.bid));
  }, [carrier, customer, data.bids, data.jobs, from, identities, reference, tab, to]);


  const award = async (bidId: string) => {
    if (!confirmBookingPaymentObligation()) return;
    setWorking(bidId); setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${bidId}/award`, {
      method: 'POST',
      headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
      body: bookingPaymentObligationRequestBody,
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setMessage(payload.error || 'Unable to award this carrier quote.'); return; }
    setMessage('Booking offer sent - awaiting carrier acceptance.');
    await data.refresh();
  };

  const updateQuoteLifecycle = async (
    bidId: string,
    action: 'viewed' | 'shortlist' | 'unshortlist' | 'archive_poster' | 'unarchive_poster',
  ) => {
    setWorking(bidId);
    setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setWorking(null);
      setMessage('Your session has expired. Sign in again.');
      return;
    }
    const response = await fetch(`/api/workspace/bids/${encodeURIComponent(bidId)}/lifecycle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; auditWarning?: string | null };
    setWorking(null);
    if (!response.ok) {
      setMessage(payload.error || 'Quote lifecycle could not be updated.');
      return;
    }
    setMessage(payload.auditWarning || 'Quote lifecycle updated successfully.');
    await data.refresh();
  };

  const clearFilters = () => {
    setCustomer(''); setFrom(''); setTo(''); setCarrier(''); setReference('');
    if (deepJob) router.push('/broker/bids');
  };
  const tabs: Array<{ id: QuoteTab; label: string }> = [
    { id: 'received', label: 'Received' },
    { id: 'archived', label: 'Archived' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'unsuccessful', label: 'Unsuccessful' },
  ];
  const allVisibleExpanded = rows.length > 0 && rows.every(({ bid }) => expanded.has(bid.id));
  const toggleAllVisible = () => setExpanded((current) => {
    const next = new Set(current);
    for (const { bid } of rows) {
      if (allVisibleExpanded) next.delete(bid.id); else next.add(bid.id);
    }
    return next;
  });
  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      {identityWarning && <AlertBanner tone="warning">{identityWarning}</AlertBanner>}
      {message && <AlertBanner tone={message.includes('successfully') ? 'success' : 'danger'}>{message}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Quote filters">
          <div className="workspace-filter-rail__header">Search Quotes</div>
          <div className="workspace-filter-rail__body">
            <label>CUSTOMER<input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" /></label>
            <label>FROM<input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Pickup town / postcode" /></label>
            <label>TO<input value={to} onChange={(event) => setTo(event.target.value)} placeholder="Delivery town / postcode" /></label>
            <label>CARRIER / OWNER DRIVER<input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Member name" /></label>
            <label>LOAD / QUOTE REF<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference" /></label>
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Filters apply as you type.</span>{deepJob ? <ActionButton tone="secondary" onClick={() => router.push('/broker/bids')}>Show all quotes</ActionButton> : null}<ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton></div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip cx-quote-state-tabs" role="tablist" aria-label="Broker quote statuses">
            {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => { setTab(item.id); setExpanded(new Set()); }}>{item.label}</button>)}
            <span className="cx-quote-state-tabs__action"><button type="button" className="cx-expand-entries-control" onClick={toggleAllVisible} disabled={!rows.length}>{allVisibleExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button><button type="button" className="cx-expand-entries-control" onClick={() => void data.refresh()}>Refresh</button></span>
          </div>

          {rows.length === 0 ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}><EmptyState compact title="No matching quotes" description="Carrier responses will appear here when they match the selected status and filters." /></div>
          ) : (
            <div className="workspace-record-list">
              {rows.map(({ bid, job, identity }) => {
                if (!job) return null;
                const open = expanded.has(bid.id);
                const quote = priceOf(bid);
                const budget = Number(job.budget_amount ?? 0);
                const margin = budget > 0 && quote > 0 ? budget - quote : null;
                const carrierName = identity?.displayName || bid.companies?.name || (bid.bidder_driver_id ? 'Owner Driver' : 'Carrier');
                const carrierCompanyId = identity?.companyId ?? bid.company_id;
                const carrierDriverId = identity?.driverId ?? bid.bidder_driver_id ?? null;
                const carrierType = identity?.companyType?.replace(/_/g, ' ') || (carrierCompanyId ? 'Carrier / Fleet' : carrierDriverId ? 'Owner Driver' : 'Member');
                const quoteStage = canonicalQuoteStage(bid, 'poster');

                return (
                  <article className="xdrive-cx-quote-card" key={bid.id} data-state={bid.status} data-quote-stage={quoteStage}>
                    <div className="xdrive-cx-quote-card__main">
                      <section className="xdrive-cx-quote-card__route"><div><span>From:</span><strong>{job.pickup_postcode || job.pickup_location || 'Collection not set'}</strong></div><div><span>To:</span><strong>{job.delivery_postcode || job.delivery_location || 'Delivery not set'}</strong></div></section>
                      <section className="xdrive-cx-quote-card__times"><div><span>Pickup:</span><strong>{when(job.pickup_datetime)}</strong></div><div><span>Deliver:</span><strong>{when(job.delivery_datetime)}</strong></div></section>
                      <section className="xdrive-cx-quote-card__status">
                        <div className="xdrive-cx-quote-card__band">{quoteStageLabel(quoteStage)}</div>
                        <div className="xdrive-cx-quote-card__service"><strong><MemberIdentityLink companyId={carrierCompanyId} driverId={carrierDriverId}>{carrierName}</MemberIdentityLink></strong></div>
                        <div className="xdrive-cx-quote-card__posted">{quote > 0 ? money(quote) : 'Quote not priced'} · {carrierType}</div>
                        <div className="xdrive-cx-quote-card__status-meta"><span>Load ID: {job.id.slice(0, 8).toUpperCase()}</span><span className="xdrive-cx-quote-card__vehicle"><img className="xdrive-cx-quote-card__vehicle-image" src={workspaceVehicleImageSrc((job.vehicle_type || 'Vehicle not set').replaceAll('_', ' '))} alt="" aria-hidden="true" /><strong>{(job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ')}</strong></span></div>
                      </section>
                    </div>
                    {open && <div className="xdrive-cx-quote-card__freight"><div><span>Customer budget:</span><strong>{budget > 0 ? money(budget) : 'Not set'}</strong></div><div><span>Estimated spread:</span><strong>{margin !== null ? money(margin) : 'Unavailable'}</strong></div><div><span>Quote ID:</span><strong>{bid.id.slice(0, 8).toUpperCase()}</strong></div><div><span>Submitted:</span><strong>{when(bid.created_at)}</strong></div></div>}
                    {open && (
                      <div className="workspace-record-details xdrive-cx-quote-card__expanded-cx">
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Carrier / Owner Driver</strong><div><MemberIdentityLink companyId={carrierCompanyId} driverId={carrierDriverId}>{carrierName}</MemberIdentityLink></div><small>{carrierType}{identity?.personName && identity.personName !== carrierName ? ` · ${identity.personName}` : ''}</small></div>
                          <div className="workspace-detail-item"><strong>Quote</strong><div>{quote > 0 ? money(quote) : 'Not set'}</div></div>
                          <div className="workspace-detail-item"><strong>Customer budget</strong><div>{budget > 0 ? money(budget) : 'Not set'}</div></div>
                          <div className="workspace-detail-item"><strong>Estimated spread</strong><div>{margin !== null ? money(margin) : '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Submitted</strong><div>{when(bid.created_at)}</div></div>
                          <div className="workspace-detail-item"><strong>Vehicle</strong><div>{(job.vehicle_type || 'Not specified').replaceAll('_', ' ')}</div></div>
                          <div className="workspace-detail-item"><strong>Customer</strong><div>{job.client_name || 'Customer'}</div></div>
                          <div className="workspace-detail-item"><strong>Status</strong><div>{quoteStageLabel(quoteStage)}</div></div>
                          <div className="workspace-detail-item"><strong>Member ID</strong><div>{identity?.memberId || 'Not supplied'}</div></div>
                          <div className="workspace-detail-item"><strong>Business contact</strong><div>{identity?.businessPhone || 'Not supplied'}</div></div>
                          <div className="workspace-detail-item"><strong>Quote scope</strong><div>{identity?.quoteLevel === 'driver' ? 'Named driver / owner driver' : 'Company / fleet'}</div></div>
                          <div className="workspace-detail-item"><strong>Driver availability</strong><div>{identity?.driverAvailability?.replaceAll('_', ' ') || (identity?.quoteLevel === 'driver' ? 'Not supplied' : 'Company quote')}</div></div>
                          <div className="workspace-detail-item"><strong>Driver vehicle</strong><div>{identity?.driverVehicleType ? `${identity.driverVehicleType.replaceAll('_', ' ')}${identity.driverVehicleTailLift ? ' · Tail lift' : ''}${identity.driverVehiclePallets != null ? ` · ${identity.driverVehiclePallets} pallets` : ''}` : 'Not linked'}</div></div>
                          <div className="workspace-detail-item"><strong>Fleet capability</strong><div>{identity?.fleetVehicleTypes.length ? identity.fleetVehicleTypes.map((type) => type.replaceAll('_', ' ')).join(', ') : 'Not listed'}</div></div>
                          <div className="workspace-detail-item"><strong>Specialist services</strong><div>{identity?.specialistServices.length ? identity.specialistServices.join(', ') : 'Not listed'}</div></div>
                        </div>
                        <div style={{ marginTop: 5, padding: '5px 6px', border: '1px solid var(--ws-border-soft, #e2e7ed)', background: '#fff' }}><strong>Carrier message</strong><div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{bid.message || 'No message supplied'}</div></div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                          {quoteStage === 'shortlisted' ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => void updateQuoteLifecycle(bid.id, 'unshortlist')}>Remove shortlist</ActionButton> : null}
                          {['submitted', 'viewed'].includes(quoteStage) ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => void updateQuoteLifecycle(bid.id, 'shortlist')}>Shortlist</ActionButton> : null}
                          {quoteStage !== 'archived' && ['accepted', 'unsuccessful', 'withdrawn', 'expired'].includes(quoteStage) ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => void updateQuoteLifecycle(bid.id, 'archive_poster')}>Archive</ActionButton> : null}
                          {quoteStage === 'archived' ? <ActionButton tone="secondary" disabled={working === bid.id} onClick={() => void updateQuoteLifecycle(bid.id, 'unarchive_poster')}>Restore</ActionButton> : null}
                          <ActionButton tone="secondary" onClick={() => router.push(`/broker/bids?job=${job.id}`)}>Compare all quotes</ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push(`/broker/loads?job=${job.id}`)}>Open load</ActionButton>
                        </div>
                      </div>
                    )}
                    <div className="xdrive-cx-quote-card__footer">
                      <button type="button" className="xdrive-cx-quote-card__expander" onClick={() => { const opening = !open; setExpanded((current) => { const next = new Set(current); if (open) next.delete(bid.id); else next.add(bid.id); return next; }); if (opening && !bid.viewed_at) void updateQuoteLifecycle(bid.id, 'viewed'); }} aria-label={open ? 'Collapse quote' : 'Expand quote'}>{open ? '⌃' : '⌄'}</button>
                      {bid.status === 'submitted' && <button type="button" className="xdrive-cx-quote-card__cancel" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Awarding…' : 'Award carrier'}</button>}
                      <span className="xdrive-cx-quote-card__quote-state">{quote > 0 ? money(quote) : 'Quote not priced'}</span>
                      <span className="xdrive-cx-quote-card__member" style={{ marginLeft: 'auto' }}>{carrierName}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
