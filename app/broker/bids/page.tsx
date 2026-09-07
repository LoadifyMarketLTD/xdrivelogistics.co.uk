'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData, type WorkspaceBid } from '../../components/workspace/useCompanyWorkspaceData';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type QuoteTab = 'received' | 'accepted' | 'archived' | 'unsuccessful';
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
  const status = String(bid.status || '').toLowerCase();
  if (tab === 'received') return status === 'submitted';
  if (tab === 'accepted') return status === 'accepted';
  if (tab === 'archived') return ['archived', 'cancelled'].includes(status);
  return ['rejected', 'unsuccessful', 'declined'].includes(status);
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
  const [expanded, setExpanded] = useState<string | null>(null);
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

  const counts = useMemo(() => ({
    received: data.bids.filter((bid) => matchesTab(bid, 'received')).length,
    accepted: data.bids.filter((bid) => matchesTab(bid, 'accepted')).length,
    archived: data.bids.filter((bid) => matchesTab(bid, 'archived')).length,
    unsuccessful: data.bids.filter((bid) => matchesTab(bid, 'unsuccessful')).length,
  }), [data.bids]);

  const award = async (bidId: string) => {
    setWorking(bidId); setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${bidId}/award`, {
      method: 'POST',
      headers: session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {},
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setMessage(payload.error || 'Unable to award this carrier quote.'); return; }
    setMessage('Carrier quote awarded successfully.');
    await data.refresh();
  };

  const clearFilters = () => {
    setCustomer(''); setFrom(''); setTo(''); setCarrier(''); setReference('');
    if (deepJob) router.push('/broker/bids');
  };
  const tabs: Array<{ id: QuoteTab; label: string; count: number }> = [
    { id: 'received', label: 'Received', count: counts.received },
    { id: 'accepted', label: 'Accepted', count: counts.accepted },
    { id: 'archived', label: 'Archived', count: counts.archived },
    { id: 'unsuccessful', label: 'Unsuccessful', count: counts.unsuccessful },
  ];
  const labelStyle = { fontSize: 'var(--ws-font-label, 11px)', color: '#64748b', fontWeight: 700 } as const;
  const metaStyle = { color: '#64748b', fontSize: 'var(--ws-font-meta, 11px)' } as const;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier sourcing"
        title="Quotes"
        description={deepJob ? `Compare and award quotes for load ${deepJob.slice(0, 8).toUpperCase()} from the canonical Broker Quotes board.` : 'Compare carrier and owner-driver responses, inspect the member profile and award without leaving the broker board.'}
        actions={deepJob ? <ActionButton tone="secondary" onClick={() => router.push('/broker/bids')}>Show all quotes</ActionButton> : undefined}
      />
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
            <div style={{ display: 'grid', gap: 4 }}><span style={metaStyle}>Filters apply as you type.</span><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton></div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {tabs.map((item) => <button key={item.id} type="button" data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} {item.count}</button>)}
          </div>

          {rows.length === 0 ? (
            <div className="workspace-panel" style={{ border: '1px solid var(--ws-border)', background: '#fff' }}><EmptyState compact title="No matching quotes" description="Carrier responses will appear here when they match the selected status and filters." /></div>
          ) : (
            <div className="workspace-record-list">
              {rows.map(({ bid, job, identity }) => {
                if (!job) return null;
                const open = expanded === bid.id;
                const quote = priceOf(bid);
                const budget = Number(job.budget_amount ?? 0);
                const margin = budget > 0 && quote > 0 ? budget - quote : null;
                const carrierName = identity?.displayName || bid.companies?.name || (bid.bidder_driver_id ? 'Owner Driver' : 'Carrier');
                const carrierCompanyId = identity?.companyId ?? bid.company_id;
                const carrierDriverId = identity?.driverId ?? bid.bidder_driver_id ?? null;
                const carrierType = identity?.companyType?.replace(/_/g, ' ') || (carrierCompanyId ? 'Carrier / Fleet' : carrierDriverId ? 'Owner Driver' : 'Member');

                return (
                  <article className="workspace-operational-row" key={bid.id} data-state={bid.status}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><div style={labelStyle}>FROM</div><strong>{job.pickup_postcode || job.pickup_location || 'Collection not set'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{job.client_name || 'Customer'}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>TO</div><strong>{job.delivery_postcode || job.delivery_location || 'Delivery not set'}</strong><div style={{ ...metaStyle, marginTop: 2 }}>{when(job.pickup_datetime)}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>CARRIER / MEMBER</div><strong><MemberIdentityLink companyId={carrierCompanyId} driverId={carrierDriverId}>{carrierName}</MemberIdentityLink></strong><div style={{ ...metaStyle, marginTop: 2 }}>{carrierType} · {(job.vehicle_type || 'Vehicle not set').replaceAll('_', ' ')}</div><div style={{ ...metaStyle, marginTop: 2 }}>{identity?.memberId ? `Member ID ${identity.memberId} · ` : ''}{identity?.quoteLevel === 'driver' ? `Driver ${identity.driverAvailability?.replaceAll('_', ' ') || 'availability not supplied'}` : `${identity?.fleetVehicleTypes.length ?? 0} fleet types`}</div></div>
                      <div className="workspace-operational-cell"><div style={labelStyle}>COMMERCIAL</div><strong>{quote > 0 ? money(quote) : 'Quote not priced'}</strong><div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}><StatusBadge value={bid.status} /><ActionButton tone="secondary" onClick={() => setExpanded(open ? null : bid.id)}>{open ? 'Close' : 'Open'}</ActionButton></div></div>
                    </div>
                    <div className="workspace-record-meta"><span>Load #{job.id.slice(0, 8).toUpperCase()}</span><span>Quote #{bid.id.slice(0, 8).toUpperCase()}</span><span>Customer budget: {budget > 0 ? money(budget) : 'Not set'}</span><span>{margin !== null ? `Est. spread: ${money(margin)}` : 'Spread unavailable'}</span></div>
                    {open && (
                      <div className="workspace-record-details">
                        <div className="workspace-detail-grid">
                          <div className="workspace-detail-item"><strong>Carrier / Owner Driver</strong><div><MemberIdentityLink companyId={carrierCompanyId} driverId={carrierDriverId}>{carrierName}</MemberIdentityLink></div><small>{carrierType}{identity?.personName && identity.personName !== carrierName ? ` · ${identity.personName}` : ''}</small></div>
                          <div className="workspace-detail-item"><strong>Quote</strong><div>{quote > 0 ? money(quote) : 'Not set'}</div></div>
                          <div className="workspace-detail-item"><strong>Customer budget</strong><div>{budget > 0 ? money(budget) : 'Not set'}</div></div>
                          <div className="workspace-detail-item"><strong>Estimated spread</strong><div>{margin !== null ? money(margin) : '—'}</div></div>
                          <div className="workspace-detail-item"><strong>Submitted</strong><div>{when(bid.created_at)}</div></div>
                          <div className="workspace-detail-item"><strong>Vehicle</strong><div>{(job.vehicle_type || 'Not specified').replaceAll('_', ' ')}</div></div>
                          <div className="workspace-detail-item"><strong>Customer</strong><div>{job.client_name || 'Customer'}</div></div>
                          <div className="workspace-detail-item"><strong>Status</strong><div>{bid.status.replaceAll('_', ' ')}</div></div>
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
                          {bid.status === 'submitted' && <ActionButton tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Awarding…' : 'Award carrier'}</ActionButton>}
                          <ActionButton tone="secondary" onClick={() => router.push(`/broker/bids?job=${job.id}`)}>Compare all quotes</ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push(`/broker/loads?job=${job.id}`)}>Open load</ActionButton>
                        </div>
                      </div>
                    )}
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
