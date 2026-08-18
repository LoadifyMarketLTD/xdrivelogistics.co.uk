'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workspaceJobPresentationStatus } from '../../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../../lib/supabaseClient';
import { CompanyJobSheetPanel } from '../../../components/workspace/CompanyJobSheetPanel';
import { MemberIdentityLink } from '../../../components/workspace/MemberProfile';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
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

export default function CustomerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const job = data.jobs.find((row) => row.id === id) ?? null;
  const quotes = useMemo(
    () => data.bids
      .filter((bid) => bid.job_id === id && bid.status === 'submitted')
      .sort((a, b) => Number(a.bid_price_gbp ?? a.amount ?? 0) - Number(b.bid_price_gbp ?? b.amount ?? 0)),
    [data.bids, id],
  );
  const invoice = data.invoices.find((row) => row.job_id === id) ?? null;

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
      await data.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'The quote could not be awarded.');
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
        description="The authoritative customer-side transport record: Order, exact route, carrier, contacts, POD, history, documents and authorised invoice information."
        actions={
          <>
            <ActionButton tone="secondary" onClick={() => router.push('/customer/bookings')}>Bookings</ActionButton>
            {quotes.length > 0 && <ActionButton tone="secondary" onClick={() => router.push('/customer/quotes')}>Quotes awaiting decision ({quotes.length})</ActionButton>}
            {invoice && <ActionButton tone="primary" onClick={() => router.push(`/customer/invoices/${invoice.id}`)}>Open invoice</ActionButton>}
          </>
        }
      />

      {data.error && <AlertBanner tone="danger">{data.error}</AlertBanner>}
      {message && <AlertBanner tone={message.includes('successfully') ? 'success' : 'danger'}>{message}</AlertBanner>}

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

          {!job.awarded_carrier_company_id && quotes.length > 0 && (
            <Panel title="Carrier quotes awaiting your decision" description="Open the member profile before award, then select the carrier quote for this booking.">
              <DataTable
                columns={['Carrier', 'Price', 'Message', 'Submitted', 'Status', 'Decision']}
                rows={quotes.map((bid, index) => [
                  <strong key="carrier"><MemberIdentityLink companyId={bid.company_id}>{bid.companies?.name ?? 'Carrier'}</MemberIdentityLink></strong>,
                  <strong key="price">{money(Number(bid.bid_price_gbp ?? bid.amount ?? 0), bid.currency ?? 'GBP')}</strong>,
                  bid.message ?? 'No message',
                  when(bid.created_at),
                  index === 0 ? <StatusBadge key="best" value="Best visible price" tone="green" /> : <StatusBadge key="status" value={bid.status} />,
                  <ActionButton key="award" tone="success" disabled={working === bid.id} onClick={() => void award(bid.id)}>{working === bid.id ? 'Awarding…' : 'Award'}</ActionButton>,
                ])}
              />
            </Panel>
          )}

          {!job.awarded_carrier_company_id && quotes.length === 0 && (
            <AlertBanner tone="warning">This load has not been awarded yet. The full customer-owned job record remains visible here, while carriers see only the quote-safe Marketplace projection.</AlertBanner>
          )}

          <Panel title={job.awarded_carrier_company_id ? 'Booking / Order' : 'Customer job record'} description={job.awarded_carrier_company_id ? 'Awarded booking details and execution evidence.' : 'Customer-owned job details before carrier award.'}>
            <CompanyJobSheetPanel jobId={job.id} mode="customer" />
          </Panel>
        </div>
      )}
    </PageFrame>
  );
}
