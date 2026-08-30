'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workspaceJobPresentationStatus } from '../../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../../lib/supabaseClient';
import JobLiveTrackingPanel from '../../../components/tracking/JobLiveTrackingPanel';
import { CompanyJobSheetPanel } from '../../../components/workspace/CompanyJobSheetPanel';
import DriverInstructionPanel from '../../../components/workspace/DriverInstructionPanel';
import { MemberIdentityLink } from '../../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import type { OwnerEditCapabilities } from '../../../components/workspace/JobOwnerEditForm';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../../components/workspace/WorkspaceUI';

const money = (value: number | null | undefined, currency = 'GBP') =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value)
    : 'Not supplied';

const when = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

const quoteAmount = (bid: { bid_price_gbp?: number | string | null; amount?: number | string | null }) => {
  const value = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export default function CustomerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [ownerCapabilities, setOwnerCapabilities] = useState<OwnerEditCapabilities | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

  const job = data.jobs.find((row) => row.id === id) ?? null;
  const quotes = useMemo(
    () => data.bids
      .filter((bid) => bid.job_id === id && bid.status === 'submitted')
      .sort((a, b) => Number(a.bid_price_gbp ?? a.amount ?? 0) - Number(b.bid_price_gbp ?? b.amount ?? 0)),
    [data.bids, id],
  );
  const lowestQuote = useMemo(() => quotes.map(quoteAmount).filter((value): value is number => value != null)[0] ?? null, [quotes]);
  const invoice = data.invoices.find((row) => row.job_id === id) ?? null;

  useEffect(() => {
    let cancelled = false;
    const loadCapabilities = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;
        const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(id)}/owner`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({})) as { job?: { capabilities?: OwnerEditCapabilities } };
        if (!cancelled) setOwnerCapabilities(payload.job?.capabilities ?? null);
      } catch {
        if (!cancelled) setOwnerCapabilities(null);
      }
    };
    void loadCapabilities();
    return () => { cancelled = true; };
  }, [id]);

  const award = async (bidId: string) => {
    setWorking(bidId);
    setMessage('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/customer/bids/${bidId}/award`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The quote could not be awarded.');
      setMessage('Carrier quote awarded successfully.');
      setDeleteArmed(false);
      await data.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The quote could not be awarded.');
    } finally {
      setWorking(null);
    }
  };

  const deleteLoad = async () => {
    setWorking('delete');
    setMessage('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(id)}/owner`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The load could not be deleted.');
      router.push('/customer/loads');
      router.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The load could not be deleted.');
      setDeleteArmed(false);
    } finally {
      setWorking(null);
    }
  };

  const presentationStatus = job ? workspaceJobPresentationStatus(job) : null;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer booking"
        title={job ? `XDrive XDL-${job.id.slice(0, 8).toUpperCase()}` : 'Booking detail'}
        description="The authoritative customer-side transport record: compare carrier quotes, award work, then follow Order, exact route, carrier, contacts, POD, history, documents, live tracking and authorised invoice information."
        actions={
          <>
            <ActionButton tone="secondary" onClick={() => router.push('/customer/bookings')}>Bookings</ActionButton>
            {ownerCapabilities?.canEdit && job && <ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${job.id}/edit`)}>Edit Load</ActionButton>}
            {ownerCapabilities?.canDelete && job && <ActionButton tone="danger" disabled={working === 'delete'} onClick={() => setDeleteArmed(true)}>Delete Load</ActionButton>}
            {quotes.length > 0 && <ActionButton tone="secondary" onClick={() => router.push('/customer/quotes')}>Quotes awaiting decision ({quotes.length})</ActionButton>}
            {invoice && <ActionButton tone="primary" onClick={() => router.push(`/customer/invoices/${invoice.id}`)}>Open invoice</ActionButton>}
          </>
        }
      />

      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {message && <AlertBanner tone={message.includes('successfully') ? 'success' : 'danger'}>{message}</AlertBanner>}

      {deleteArmed && job && (
        <div style={{ border: '1px solid #fecaca', background: '#fff7f7', borderRadius: 5, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: '#991b1b', fontSize: 12 }}>
          <div><strong>Delete XDL-{job.id.slice(0, 8).toUpperCase()} permanently?</strong><div style={{ marginTop: 2 }}>This is allowed only while the load is unawarded, unallocated and has no protected quote, POD, invoice or execution history.</div></div>
          <div style={{ display: 'flex', gap: 7 }}>
            <ActionButton tone="secondary" disabled={working === 'delete'} onClick={() => setDeleteArmed(false)}>Keep Load</ActionButton>
            <ActionButton tone="danger" disabled={working === 'delete'} onClick={() => void deleteLoad()}>{working === 'delete' ? 'Deleting…' : 'Confirm Delete'}</ActionButton>
          </div>
        </div>
      )}

      {data.loading && !job ? (
        <Panel><EmptyState compact title="Loading booking…" /></Panel>
      ) : !job ? (
        <Panel><EmptyState title="Booking not found" description="This transport record is not available in the current customer workspace." /></Panel>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
            <span><strong>{job.pickup_postcode ?? job.pickup_location ?? 'Collection'}</strong> → <strong>{job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong></span>
            <span>Pickup {when(job.pickup_datetime)} · <StatusBadge value={presentationStatus ?? 'unknown'} /></span>
          </div>

          {job.awarded_carrier_company_id && <JobLiveTrackingPanel jobId={job.id} />}

          {!job.awarded_carrier_company_id && quotes.length > 0 && (
            <Panel title="Compare carrier quotes" description="Compare the verified quote values available to this customer account, open each member profile, then award the carrier. Reputation/ETA fields are not fabricated when the current quote contract does not supply them.">
              <DataTable
                columns={['Carrier / member', 'Quote', 'Price comparison', 'Message / terms', 'Submitted', 'Decision']}
                rows={quotes.map((bid, index) => {
                  const amount = quoteAmount(bid);
                  const delta = amount != null && lowestQuote != null ? amount - lowestQuote : null;
                  return [
                    <span key="carrier"><strong style={{ display: 'block' }}><MemberIdentityLink companyId={bid.company_id}>{bid.companies?.name ?? 'Carrier'}</MemberIdentityLink></strong><small style={{ color: '#64748b' }}>Open member profile before award</small></span>,
                    <strong key="price">{money(amount, bid.currency ?? 'GBP')}</strong>,
                    index === 0 && amount != null
                      ? <StatusBadge key="best" value="Lowest visible price" tone="green" />
                      : delta != null
                        ? <span key="delta"><strong>+{money(delta, bid.currency ?? 'GBP')}</strong><small style={{ display: 'block', color: '#64748b' }}>vs lowest visible quote</small></span>
                        : <span key="delta-none" style={{ color: '#64748b' }}>Comparison unavailable</span>,
                    bid.message ?? 'No message supplied',
                    when(bid.created_at),
                    <ActionButton key="award" tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Awarding…' : 'Award / Book'}</ActionButton>,
                  ];
                })}
              />
              <div style={{ marginTop: 8, padding: '7px 8px', border: '1px solid #bfdbfe', borderRadius: 4, background: '#eff6ff', color: '#1e3a8a', fontSize: 11, lineHeight: '15px' }}>
                Carrier reputation, live ETA/distance and richer booking-comparison attributes remain separate parity-ledger fields until the authorised customer quote projection exposes them. Price, member identity, quote message and submission time above are real current-contract fields.
              </div>
            </Panel>
          )}

          {!job.awarded_carrier_company_id && quotes.length === 0 && (
            <AlertBanner tone="warning">This load has not been awarded yet. The full customer-owned job record remains visible here, while carriers see only the quote-safe Marketplace projection.</AlertBanner>
          )}

          <DriverInstructionPanel jobId={job.id} />

          <Panel title={job.awarded_carrier_company_id ? 'Booking / Order' : 'Customer job record'} description={job.awarded_carrier_company_id ? 'Awarded booking details and execution evidence.' : 'Customer-owned job details before carrier award.'}>
            <CompanyJobSheetPanel jobId={job.id} mode="customer" />
          </Panel>
        </div>
      )}
    </PageFrame>
  );
}
