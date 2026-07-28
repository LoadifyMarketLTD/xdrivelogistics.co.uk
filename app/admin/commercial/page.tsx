'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  formatDate,
  formatVehicleLabel,
  formatCurrency,
} from '../../../lib/companyJobFormatters';
import { getStatusLabel, getStatusTone } from '../../../lib/companyJobStatus';
import {
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  ActionButton,
  EmptyState,
  AlertBanner,
} from '../../components/workspace/WorkspaceUI';

// ── Types ──────────────────────────────────────────────────────────────────────

type CommercialBid = {
  id: string;
  job_id: string;
  company_id: string | null;
  amount: number | null;
  bid_price_gbp: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  jobs?: {
    id: string;
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    vehicle_type: string | null;
    company_id: string;
    companies: { name: string } | null;
  } | null;
};

type WonJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  vehicle_type: string | null;
  status: string;
  currency: string;
  budget_amount: number | null;
  company_id: string;
  companies: { name: string } | null;
  awarded_carrier_company_id: string | null;
  created_at: string;
};

type CommercialTab = 'submitted' | 'won' | 'rejected';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeCompany(
  value: { name: string } | Array<{ name: string }> | null | undefined,
): { name: string } | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeBidJob(
  job: CommercialBid['jobs'] | null | undefined | unknown,
): CommercialBid['jobs'] {
  if (!job) return null;
  const j = Array.isArray(job) ? (job[0] ?? null) : job;
  if (!j || typeof j !== 'object') return null;
  const raw = j as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    pickup_location: typeof raw.pickup_location === 'string' ? raw.pickup_location : null,
    delivery_location: typeof raw.delivery_location === 'string' ? raw.delivery_location : null,
    pickup_datetime: typeof raw.pickup_datetime === 'string' ? raw.pickup_datetime : null,
    vehicle_type: typeof raw.vehicle_type === 'string' ? raw.vehicle_type : null,
    company_id: String(raw.company_id ?? ''),
    companies: normalizeCompany(raw.companies as { name: string } | null),
  };
}

function resolveBidAmount(bid: Pick<CommercialBid, 'bid_price_gbp' | 'amount'>): number | null {
  if (typeof bid.bid_price_gbp === 'number') return bid.bid_price_gbp;
  if (typeof bid.amount === 'number') return bid.amount;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommercialPage() {
  const { user, hasSupabaseSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);

  const initialTab = (searchParams.get('tab') as CommercialTab | null) ?? 'submitted';
  const [tab, setTab] = useState<CommercialTab>(initialTab);

  // Bids state
  const [bids, setBids] = useState<CommercialBid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bidsError, setBidsError] = useState('');

  // Won jobs state
  const [wonJobs, setWonJobs] = useState<WonJob[]>([]);
  const [wonLoading, setWonLoading] = useState(false);
  const [wonError, setWonError] = useState('');

  // Company resolution
  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) return;
    if (user.companyId) { setCompanyId(user.companyId); return; }
    resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: null }).then(setCompanyId);
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  // Sync tab from URL
  useEffect(() => {
    const urlTab = searchParams.get('tab') as CommercialTab | null;
    if (urlTab && urlTab !== tab) setTab(urlTab);
  }, [searchParams, tab]);

  // Load bids
  const loadBids = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    setBidsLoading(true);
    setBidsError('');
    const { data, error } = await supabase
      .from('job_bids')
      .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at, jobs(id, pickup_location, delivery_location, pickup_datetime, vehicle_type, company_id, companies!jobs_company_id_fkey(name))')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setBidsError(`Failed to load bids: ${error.message}`);
    } else {
      setBids((data ?? []).map((bid) => ({ ...bid, jobs: normalizeBidJob(bid.jobs) })));
    }
    setBidsLoading(false);
  }, [companyId]);

  // Load won jobs
  const loadWonJobs = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    setWonLoading(true);
    setWonError('');
    const { data, error } = await supabase
      .from('jobs')
      .select('id, pickup_location, delivery_location, pickup_datetime, vehicle_type, status, currency, budget_amount, company_id, awarded_carrier_company_id, created_at, companies!jobs_company_id_fkey(name)')
      .eq('awarded_carrier_company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setWonError(`Failed to load won jobs: ${error.message}`);
    } else {
      setWonJobs((data ?? []).map((job) => ({ ...job, companies: normalizeCompany(job.companies) })));
    }
    setWonLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    if (tab === 'submitted' || tab === 'rejected') void loadBids();
    if (tab === 'won') void loadWonJobs();
  }, [companyId, tab, loadBids, loadWonJobs]);

  // Bid withdrawal
  const withdrawBid = useCallback(async (bidId: string) => {
    if (!companyId) return;
    const { error } = await supabase
      .from('job_bids')
      .update({ status: 'withdrawn' })
      .eq('id', bidId)
      .eq('company_id', companyId);
    if (!error) void loadBids();
  }, [companyId, loadBids]);

  // Filtered bids per tab
  const submittedBids = useMemo(
    () => bids.filter((b) => ['submitted', 'pending'].includes(b.status)),
    [bids],
  );
  const rejectedBids = useMemo(
    () => bids.filter((b) => ['rejected', 'declined', 'withdrawn'].includes(b.status)),
    [bids],
  );

  const tabs: Array<{ id: CommercialTab; label: string; count: number }> = [
    { id: 'submitted', label: 'Submitted / Awaiting', count: submittedBids.length },
    { id: 'won', label: 'Won Work', count: wonJobs.length },
    { id: 'rejected', label: 'Rejected / Withdrawn', count: rejectedBids.length },
  ];

  const handleTabChange = (newTab: CommercialTab) => {
    setTab(newTab);
    router.replace(`/admin/commercial?tab=${newTab}`, { scroll: false });
  };

  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff', 'broker']}>
      <PageFrame>
        <PageHeader
          eyebrow="Commercial"
          title="Quotes & Awards"
          description="Track bids submitted on the load exchange, won work and unsuccessful quotes."
          actions={
            <ActionButton tone="primary" onClick={() => router.push('/admin/marketplace')}>
              Find Loads
            </ActionButton>
          }
        />

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Commercial workspace tabs"
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '1rem',
            background: '#fff',
            borderRadius: '8px 8px 0 0',
            padding: '0 0.5rem',
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => handleTabChange(t.id)}
              style={{
                padding: '0.65rem 0.9rem',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid #1d4ed8' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: tab === t.id ? '#1d4ed8' : '#64748b',
                marginBottom: '-1px',
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  style={{
                    marginLeft: '0.35rem',
                    background: tab === t.id ? '#dbeafe' : '#f1f5f9',
                    color: tab === t.id ? '#1d4ed8' : '#64748b',
                    borderRadius: '8px',
                    padding: '0.05rem 0.4rem',
                    fontSize: '0.72rem',
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Submitted / Awaiting ─────────────────────────────────────────────── */}
        {tab === 'submitted' && (
          <Panel
            title="Submitted quotes awaiting decision"
            description="Bids you have placed on the load exchange that have not yet been accepted or rejected."
            actions={
              <ActionButton tone="secondary" onClick={() => void loadBids()}>
                Refresh
              </ActionButton>
            }
          >
            {bidsError && <AlertBanner tone="danger">{bidsError}</AlertBanner>}
            {bidsLoading ? (
              <EmptyState title="Loading…" description="Fetching your submitted quotes." />
            ) : submittedBids.length === 0 ? (
              <EmptyState
                title="No submitted quotes"
                description="Quotes you submit on the marketplace will appear here while awaiting a decision."
                action={
                  <ActionButton tone="primary" onClick={() => router.push('/admin/marketplace')}>
                    Browse Loads
                  </ActionButton>
                }
              />
            ) : (
              <BidTable bids={submittedBids} onWithdraw={withdrawBid} />
            )}
          </Panel>
        )}

        {/* ── Won Work ─────────────────────────────────────────────────────────── */}
        {tab === 'won' && (
          <Panel
            title="Won work"
            description="Jobs awarded to your company as the carrier."
            actions={
              <ActionButton tone="secondary" onClick={() => void loadWonJobs()}>
                Refresh
              </ActionButton>
            }
          >
            {wonError && <AlertBanner tone="danger">{wonError}</AlertBanner>}
            {wonLoading ? (
              <EmptyState title="Loading…" description="Fetching won jobs." />
            ) : wonJobs.length === 0 ? (
              <EmptyState
                title="No won work yet"
                description="Jobs you have been awarded will appear here."
                action={
                  <ActionButton tone="primary" onClick={() => router.push('/admin/marketplace')}>
                    Find Loads
                  </ActionButton>
                }
              />
            ) : (
              <WonJobTable jobs={wonJobs} onOpen={(id) => router.push(`/admin/jobs/${id}`)} />
            )}
          </Panel>
        )}

        {/* ── Rejected / Withdrawn ─────────────────────────────────────────────── */}
        {tab === 'rejected' && (
          <Panel
            title="Rejected and withdrawn quotes"
            description="Quotes that were unsuccessful or withdrawn before a decision."
          >
            {bidsError && <AlertBanner tone="danger">{bidsError}</AlertBanner>}
            {bidsLoading ? (
              <EmptyState title="Loading…" description="Fetching quotes." />
            ) : rejectedBids.length === 0 ? (
              <EmptyState title="No rejected quotes" description="Unsuccessful or withdrawn quotes will appear here." />
            ) : (
              <BidTable bids={rejectedBids} />
            )}
          </Panel>
        )}
      </PageFrame>
    </ProtectedRoute>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BidTable({
  bids,
  onWithdraw,
}: {
  bids: CommercialBid[];
  onWithdraw?: (id: string) => void;
}) {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
        <thead>
          <tr>
            {['Route', 'Posted by', 'Your quote', 'Submitted', 'Status', 'Actions'].map((h) => (
              <th
                key={h}
                scope="col"
                style={{
                  textAlign: 'left',
                  padding: '0.58rem 0.65rem',
                  fontSize: '0.62rem',
                  fontWeight: 850,
                  color: '#475569',
                  letterSpacing: '0.045em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bids.map((bid) => {
            const job = bid.jobs;
            const amount = resolveBidAmount(bid);
            return (
              <tr key={bid.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                <td style={{ padding: '0.65rem', fontSize: '0.78rem' }}>
                  <strong style={{ color: '#0f172a' }}>
                    {job?.pickup_location || '—'} → {job?.delivery_location || '—'}
                  </strong>
                  <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '0.1rem' }}>
                    {formatVehicleLabel(job?.vehicle_type)}
                    {job?.pickup_datetime ? ` · ${formatDate(job.pickup_datetime)}` : ''}
                  </div>
                </td>
                <td style={{ padding: '0.65rem', fontSize: '0.74rem', color: '#374151' }}>
                  {job?.companies?.name || '—'}
                </td>
                <td style={{ padding: '0.65rem', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                  {amount == null ? '—' : formatCurrency(amount)}
                </td>
                <td style={{ padding: '0.65rem', fontSize: '0.72rem', color: '#64748b' }}>
                  {formatDate(bid.created_at)}
                </td>
                <td style={{ padding: '0.65rem' }}>
                  <StatusBadge value={getStatusLabel(bid.status)} tone={getStatusTone(bid.status)} />
                </td>
                <td style={{ padding: '0.65rem' }}>
                  {bid.status === 'submitted' && onWithdraw && (
                    <ActionButton tone="danger" onClick={() => onWithdraw(bid.id)}>
                      Withdraw
                    </ActionButton>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WonJobTable({
  jobs,
  onOpen,
}: {
  jobs: WonJob[];
  onOpen: (id: string) => void;
}) {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
        <thead>
          <tr>
            {['Route', 'Posted by', 'Budget', 'Pickup', 'Status', 'Actions'].map((h) => (
              <th
                key={h}
                scope="col"
                style={{
                  textAlign: 'left',
                  padding: '0.58rem 0.65rem',
                  fontSize: '0.62rem',
                  fontWeight: 850,
                  color: '#475569',
                  letterSpacing: '0.045em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={{ borderBottom: '1px solid #edf2f7' }}>
              <td style={{ padding: '0.65rem', fontSize: '0.78rem' }}>
                <strong style={{ color: '#0f172a' }}>
                  {job.pickup_location || '—'} → {job.delivery_location || '—'}
                </strong>
                <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '0.1rem' }}>
                  {formatVehicleLabel(job.vehicle_type)}
                </div>
              </td>
              <td style={{ padding: '0.65rem', fontSize: '0.74rem', color: '#374151' }}>
                {job.companies?.name || '—'}
              </td>
              <td style={{ padding: '0.65rem', fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>
                {job.budget_amount != null ? formatCurrency(job.budget_amount) : '—'}
              </td>
              <td style={{ padding: '0.65rem', fontSize: '0.72rem', color: '#64748b' }}>
                {formatDate(job.pickup_datetime)}
              </td>
              <td style={{ padding: '0.65rem' }}>
                <StatusBadge value={getStatusLabel(job.status)} tone={getStatusTone(job.status)} />
              </td>
              <td style={{ padding: '0.65rem' }}>
                <ActionButton tone="secondary" onClick={() => onOpen(job.id)}>
                  View Job
                </ActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
