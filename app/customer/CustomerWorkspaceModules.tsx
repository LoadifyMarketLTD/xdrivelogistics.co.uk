'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import LoadPostingForm from '../components/workspace/LoadPostingForm';
import PodDocumentsPage from '../components/workspace/PodDocumentsPage';
import {
  useCompanyWorkspaceData,
  type WorkspaceBid,
  type WorkspaceJob,
} from '../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  ProgressSteps,
  QuickActions,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from '../components/workspace/WorkspaceUI';

const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const lifecycleStages = [
  'posted',
  'quoted',
  'awarded',
  'allocated',
  'accepted',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'on_my_way_to_delivery',
  'on_site_delivery',
  'delivered',
];

const lifecycleLabels: Record<string, string> = {
  draft: 'Draft',
  posted: 'Posted',
  quoted: 'Quotes received',
  awarded: 'Carrier awarded',
  allocated: 'Driver allocated',
  accepted: 'Driver accepted',
  on_my_way: 'On the way to pickup',
  on_my_way_to_pickup: 'On the way to pickup',
  on_site_pickup: 'At pickup',
  loaded: 'Loaded',
  collected: 'Loaded',
  in_transit: 'In transit',
  on_my_way_to_delivery: 'On the way to delivery',
  on_site_delivery: 'At delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  incident: 'Incident reported',
  waiting: 'Waiting on site',
  waiting_time: 'Waiting time recorded',
  failed_delivery: 'Delivery failed',
  dispute: 'Dispute open',
};

const currentStatus = (job: WorkspaceJob) =>
  String(job.current_status ?? job.status ?? 'draft').toLowerCase();

const lifecycleLabel = (value: string | null | undefined) => {
  const normalised = String(value ?? 'unknown').toLowerCase();
  return (
    lifecycleLabels[normalised] ??
    normalised.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  );
};

const stageIndex = (job: WorkspaceJob) => {
  const status = currentStatus(job);
  if (status === 'collected' || status === 'in_transit') return lifecycleStages.indexOf('loaded');
  if (status === 'on_my_way') return lifecycleStages.indexOf('on_my_way_to_pickup');
  if (status === 'completed') return lifecycleStages.length - 1;
  return Math.max(lifecycleStages.indexOf(status), 0);
};

const isOperationallyActive = (job: WorkspaceJob) => {
  const index = stageIndex(job);
  return index >= lifecycleStages.indexOf('accepted') && index < lifecycleStages.indexOf('delivered');
};

const isAwardedPending = (job: WorkspaceJob) => {
  const status = currentStatus(job);
  return Boolean(job.awarded_carrier_company_id) && ['awarded', 'allocated'].includes(status);
};

const isIssueStatus = (status: string) =>
  ['incident', 'cancel', 'waiting', 'failed', 'dispute'].some((token) => status.includes(token));

const submittedQuotes = (bids: WorkspaceBid[], jobId: string) =>
  bids.filter((bid) => bid.job_id === jobId && bid.status === 'submitted');

const hoursUntil = (value: string | null | undefined) =>
  value ? (new Date(value).getTime() - Date.now()) / 3_600_000 : null;

type AttentionItem = {
  job: WorkspaceJob;
  reason: string;
  tone: 'red' | 'orange' | 'blue' | 'purple';
  priority: number;
};

const buildAttentionItem = (job: WorkspaceJob, bids: WorkspaceBid[]): AttentionItem | null => {
  const status = currentStatus(job);
  const quotes = submittedQuotes(bids, job.id);
  const pickupHours = hoursUntil(job.pickup_datetime);
  const deliveryHours = hoursUntil(job.delivery_datetime);
  const hasAward = Boolean(job.awarded_carrier_company_id);

  if (status.includes('failed_delivery')) {
    return { job, reason: 'Failed delivery requires review', tone: 'red', priority: 100 };
  }
  if (status.includes('incident')) {
    return { job, reason: 'Incident requires review', tone: 'red', priority: 95 };
  }
  if (status.includes('dispute')) {
    return { job, reason: 'Dispute requires action', tone: 'red', priority: 90 };
  }
  if (status.includes('cancel')) {
    return { job, reason: 'Cancellation requires review', tone: 'red', priority: 85 };
  }
  if (status.includes('waiting')) {
    return { job, reason: 'Waiting time requires review', tone: 'orange', priority: 80 };
  }
  if (isOperationallyActive(job) && deliveryHours !== null && deliveryHours < 0) {
    return { job, reason: 'Delivery ETA has passed', tone: 'red', priority: 75 };
  }
  if (['posted', 'quoted'].includes(status) && !hasAward && quotes.length > 0) {
    const oldestQuoteAge = Math.max(
      ...quotes.map((quote) => (Date.now() - new Date(quote.created_at).getTime()) / 3_600_000)
    );
    if ((pickupHours !== null && pickupHours <= 24) || oldestQuoteAge >= 24) {
      return { job, reason: 'Quote decision due', tone: 'purple', priority: 70 };
    }
  }
  if (['posted', 'quoted'].includes(status) && !hasAward && quotes.length === 0 && pickupHours !== null && pickupHours <= 24) {
    return {
      job,
      reason: pickupHours < 0 ? 'Pickup passed with no quotes' : 'Pickup approaching with no quotes',
      tone: pickupHours < 0 ? 'red' : 'orange',
      priority: pickupHours < 0 ? 68 : 65,
    };
  }
  if (['delivered', 'completed'].includes(status) && (job.delivery_photos?.length ?? 0) === 0) {
    return { job, reason: 'Awaiting proof of delivery', tone: 'orange', priority: 55 };
  }
  return null;
};

const routeLabel = (job: WorkspaceJob) =>
  `${job.pickup_postcode ?? job.pickup_location ?? 'Pickup'} → ${
    job.delivery_postcode ?? job.delivery_location ?? 'Delivery'
  }`;

const locationForJob = (
  job: WorkspaceJob,
  locations: ReturnType<typeof useCompanyWorkspaceData>['locations']
) =>
  job.assigned_driver_id
    ? locations.find((location) => location.driver_id === job.assigned_driver_id)
    : undefined;

const trackingSummary = (
  job: WorkspaceJob,
  locations: ReturnType<typeof useCompanyWorkspaceData>['locations']
) => {
  const location = locationForJob(job, locations);
  if (!location) return 'No live location available';
  const timestamp = location.recorded_at ?? location.updated_at;
  return timestamp ? `Last signal ${when(timestamp)}` : 'Live location available';
};

export function CustomerDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const metrics = useMemo(() => {
    const awarded = data.jobs.filter(isAwardedPending).length;
    const active = data.jobs.filter(isOperationallyActive).length;
    const delayed = data.jobs.filter(
      (job) =>
        isOperationallyActive(job) &&
        job.delivery_datetime &&
        new Date(job.delivery_datetime).getTime() < Date.now()
    ).length;
    const unpaid = data.invoices.filter(
      (invoice) =>
        invoice.buyer_company_id === data.companyId &&
        String(invoice.payment_status ?? invoice.status).toLowerCase() !== 'paid'
    ).length;

    return {
      draft: data.jobs.filter((job) => currentStatus(job) === 'draft').length,
      open: data.jobs.filter((job) => ['posted', 'quoted'].includes(currentStatus(job))).length,
      quotes: data.bids.filter((bid) => bid.status === 'submitted').length,
      awarded,
      active,
      delayed,
      pod: data.jobs.filter((job) => (job.delivery_photos?.length ?? 0) > 0).length,
      unpaid,
    };
  }, [data]);

  const attention = useMemo(
    () =>
      data.jobs
        .map((job) => buildAttentionItem(job, data.bids))
        .filter((item): item is AttentionItem => Boolean(item))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 12),
    [data.jobs, data.bids]
  );

  const noQuoteWarnings = attention.filter((item) => item.reason.toLowerCase().includes('no quotes'));
  const issueCount = attention.filter((item) => item.priority >= 80).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer transport"
        title="Customer Dashboard"
        description="Post transport requirements, compare carrier quotes, track live delivery milestones and retrieve POD and invoices."
        actions={
          <>
            <ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>
              Post Load
            </ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/customer/deliveries')}>
              Track Deliveries
            </ActionButton>
          </>
        }
      />

      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      {noQuoteWarnings.length > 0 && (
        <AlertBanner tone="warning">
          {noQuoteWarnings.length} load{noQuoteWarnings.length === 1 ? '' : 's'} approaching pickup
          without a submitted quote. Open the attention queue to review or repost.
        </AlertBanner>
      )}
      {issueCount > 0 && (
        <AlertBanner tone="danger">
          {issueCount} operational issue{issueCount === 1 ? '' : 's'} require review, including
          incidents, cancellations, waiting time, failed delivery or disputes.
        </AlertBanner>
      )}

      <KpiGrid>
        <KpiCard label="Draft loads" value={metrics.draft} />
        <KpiCard label="Open loads" value={metrics.open} tone="blue" onClick={() => router.push('/customer/loads')} />
        <KpiCard label="Quotes received" value={metrics.quotes} tone="purple" onClick={() => router.push('/customer/quotes')} />
        <KpiCard label="Awarded, awaiting start" value={metrics.awarded} tone="orange" onClick={() => router.push('/customer/awards')} />
        <KpiCard label="Active deliveries" value={metrics.active} tone="green" onClick={() => router.push('/customer/deliveries')} />
        <KpiCard label="Delayed" value={metrics.delayed} tone="red" onClick={() => router.push('/customer/deliveries')} />
        <KpiCard label="POD ready" value={metrics.pod} tone="navy" onClick={() => router.push('/customer/documents')} />
        <KpiCard label="Unpaid invoices" value={metrics.unpaid} tone="orange" onClick={() => router.push('/customer/invoices?payment=unpaid')} />
      </KpiGrid>

      <TwoColumn>
        <Panel
          title="Action required"
          description="Only records with a customer decision, timing risk or operational issue appear here."
          actions={
            <ActionButton tone="secondary" onClick={() => router.push('/customer/loads')}>
              All loads
            </ActionButton>
          }
        >
          <DataTable
            columns={['Priority', 'Route', 'Pickup / ETA', 'Lifecycle', 'Tracking', 'Action']}
            rows={attention.map(({ job, reason, tone }) => [
              <StatusBadge key="reason" value={reason} tone={tone} />,
              <strong key="route">{routeLabel(job)}</strong>,
              <span key="timing">
                <strong style={{ display: 'block' }}>{when(job.pickup_datetime)}</strong>
                <small style={{ color: workspaceTheme.muted }}>
                  ETA {when(job.delivery_datetime)}
                </small>
              </span>,
              <StatusBadge key="status" value={lifecycleLabel(currentStatus(job))} />,
              <small key="tracking" style={{ color: workspaceTheme.muted }}>
                {trackingSummary(job, data.locations)}
              </small>,
              <ActionButton
                key="action"
                tone="secondary"
                onClick={() => router.push(`/customer/jobs/${job.id}`)}
              >
                Review
              </ActionButton>,
            ])}
            empty={
              <EmptyState
                title="No customer action required"
                description="Active jobs without a risk or decision are available in Deliveries."
                action={
                  <ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>
                    Post a load
                  </ActionButton>
                }
              />
            }
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <Panel title="Quick actions">
            <QuickActions
              actions={[
                { label: 'Post a new load', description: 'Create a transport requirement', onClick: () => router.push('/customer/post-load') },
                { label: 'Review carrier quotes', description: `${metrics.quotes} submitted`, onClick: () => router.push('/customer/quotes') },
                { label: 'Track active deliveries', description: `${metrics.active} in progress`, onClick: () => router.push('/customer/deliveries') },
                { label: 'Open POD register', description: `${metrics.pod} ready`, onClick: () => router.push('/customer/documents') },
                { label: 'Review unpaid invoices', description: `${metrics.unpaid} unpaid`, onClick: () => router.push('/customer/invoices?payment=unpaid') },
              ]}
            />
          </Panel>

          <Panel title="Recent updates" description="Latest real job update timestamps.">
            <div style={{ display: 'grid', gap: '0.38rem' }}>
              {data.jobs.slice(0, 6).map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => router.push(`/customer/jobs/${job.id}`)}
                  style={quickButton}
                >
                  <span>
                    <strong style={{ display: 'block' }}>{routeLabel(job)}</strong>
                    <small style={{ color: workspaceTheme.muted }}>{when(job.updated_at)}</small>
                  </span>
                  <StatusBadge value={lifecycleLabel(currentStatus(job))} />
                </button>
              ))}
              {data.jobs.length === 0 && <EmptyState title="No recent transport activity" />}
            </div>
          </Panel>
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

const quickButton = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.6rem',
  border: `1px solid ${workspaceTheme.border}`,
  borderRadius: '8px',
  padding: '0.58rem 0.64rem',
  background: workspaceTheme.surfaceSoft,
  color: workspaceTheme.text,
  fontSize: '0.74rem',
  cursor: 'pointer',
  textAlign: 'left',
} as const;

export function CustomerPostLoadPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="New transport"
        title="Post Load"
        description="The form is grouped by collection, delivery, cargo, vehicle, references and commercial requirements."
      />
      <LoadPostingForm mode="customer" />
    </PageFrame>
  );
}

export function CustomerLoadsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer loads"
        title="My Loads"
        description="Every load is shown with its current human-readable lifecycle state and actionable route."
        actions={
          <ActionButton tone="warning" onClick={() => router.push('/customer/post-load')}>
            Post Load
          </ActionButton>
        }
      />
      <Panel title="Load register">
        <DataTable
          columns={['Reference', 'Route', 'Pickup', 'Vehicle', 'Quotes', 'Lifecycle', 'Action']}
          rows={data.jobs.map((job) => [
            job.id.slice(0, 8).toUpperCase(),
            <strong key="route">{routeLabel(job)}</strong>,
            when(job.pickup_datetime),
            lifecycleLabel(job.vehicle_type ?? 'Not specified'),
            submittedQuotes(data.bids, job.id).length,
            <StatusBadge key="status" value={lifecycleLabel(currentStatus(job))} />,
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/customer/jobs/${job.id}`)}
            >
              Open
            </ActionButton>,
          ])}
          empty={<EmptyState title="No loads posted" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function CustomerQuotesPage() {
  const data = useCompanyWorkspaceData();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const grouped = useMemo(
    () =>
      data.jobs
        .map((job) => ({
          job,
          quotes: data.bids.filter(
            (bid) => bid.job_id === job.id && ['submitted', 'accepted', 'rejected'].includes(bid.status)
          ),
        }))
        .filter((group) => group.quotes.length),
    [data.jobs, data.bids]
  );

  const award = async (id: string) => {
    setWorking(id);
    setMessage('');
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/customer/bids/${id}/award`, {
      method: 'POST',
      headers: session.session?.access_token
        ? { Authorization: `Bearer ${session.session.access_token}` }
        : {},
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setWorking(null);
    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to award quote.');
      return;
    }
    setMessage('Carrier quote awarded successfully.');
    await data.refresh();
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier quotes"
        title="Quotes"
        description="Compare price, carrier identity, quote age and pickup timing before making an award."
      />
      {message && (
        <AlertBanner tone={message.includes('successfully') ? 'success' : 'danger'}>
          {message}
        </AlertBanner>
      )}
      {grouped.map(({ job, quotes }) => {
        const pickupHours = hoursUntil(job.pickup_datetime);
        const oldestHours = Math.max(
          ...quotes.map((quote) => (Date.now() - new Date(quote.created_at).getTime()) / 3_600_000)
        );
        const decisionWarning =
          !job.awarded_carrier_company_id &&
          ((pickupHours !== null && pickupHours <= 24) || oldestHours >= 24);

        return (
          <Panel
            key={job.id}
            title={routeLabel(job)}
            description={`Pickup ${when(job.pickup_datetime)}`}
            style={{ marginBottom: '0.8rem' }}
          >
            {decisionWarning && (
              <AlertBanner tone="warning">
                Quote review window is closing: pickup is approaching or the oldest submitted quote
                has been waiting more than 24 hours.
              </AlertBanner>
            )}
            <DataTable
              columns={['Carrier', 'Price', 'Message', 'Submitted', 'Status', 'Decision']}
              rows={quotes
                .slice()
                .sort(
                  (a, b) =>
                    Number(a.bid_price_gbp ?? a.amount ?? 0) -
                    Number(b.bid_price_gbp ?? b.amount ?? 0)
                )
                .map((bid) => [
                  bid.companies?.name ?? 'Carrier',
                  money(Number(bid.bid_price_gbp ?? bid.amount ?? 0)),
                  bid.message ?? 'No message',
                  when(bid.created_at),
                  <StatusBadge key="status" value={lifecycleLabel(bid.status)} />,
                  bid.status === 'submitted' ? (
                    <ActionButton
                      key="award"
                      tone="success"
                      disabled={working === bid.id}
                      onClick={() => void award(bid.id)}
                    >
                      {working === bid.id ? 'Awarding…' : 'Accept'}
                    </ActionButton>
                  ) : (
                    '—'
                  ),
                ])}
            />
          </Panel>
        );
      })}
      {grouped.length === 0 && (
        <Panel>
          <EmptyState
            title="No quotes received"
            description="Carrier quotes will appear after a load is published."
          />
        </Panel>
      )}
    </PageFrame>
  );
}

export function CustomerAwardsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const rows = data.jobs.filter(isAwardedPending);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier selection"
        title="Awards"
        description="Only awarded loads that have not yet entered active delivery are shown here."
      />
      <Panel>
        <DataTable
          columns={['Load', 'Route', 'Pickup', 'Lifecycle', 'Action']}
          rows={rows.map((job) => [
            job.id.slice(0, 8).toUpperCase(),
            routeLabel(job),
            when(job.pickup_datetime),
            <StatusBadge key="status" value={lifecycleLabel(currentStatus(job))} />,
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/customer/jobs/${job.id}`)}
            >
              View
            </ActionButton>,
          ])}
          empty={<EmptyState title="No loads awaiting operational start" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function CustomerDeliveriesPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const rows = data.jobs.filter(
    (job) => isOperationallyActive(job) || ['delivered', 'completed'].includes(currentStatus(job))
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Live transport"
        title="Deliveries"
        description="Active and completed deliveries with scheduled ETA, latest tracking signal and lifecycle progress."
      />
      <Panel>
        <DataTable
          columns={['Route', 'Pickup', 'ETA', 'Lifecycle', 'Tracking', 'POD', 'Action']}
          rows={rows.map((job) => [
            <strong key="route">{routeLabel(job)}</strong>,
            when(job.pickup_datetime),
            when(job.delivery_datetime),
            <StatusBadge key="status" value={lifecycleLabel(currentStatus(job))} />,
            <small key="tracking" style={{ color: workspaceTheme.muted }}>
              {trackingSummary(job, data.locations)}
            </small>,
            (job.delivery_photos?.length ?? 0) > 0 ? (
              <StatusBadge key="pod" value="POD available" tone="green" />
            ) : (
              <StatusBadge key="pod" value="Awaiting POD" tone="orange" />
            ),
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/customer/jobs/${job.id}`)}
            >
              Track
            </ActionButton>,
          ])}
          empty={<EmptyState title="No active or completed deliveries" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function CustomerDocumentsPage() {
  return <PodDocumentsPage mode="customer" />;
}

export function CustomerInvoicesPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const rows = data.invoices.filter(
    (invoice) =>
      invoice.buyer_company_id === data.companyId ||
      data.jobs.some((job) => job.id === invoice.job_id)
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer finance"
        title="Invoices"
        description="Invoices addressed to this customer company, linked to the transport job and payment status."
      />
      <Panel>
        <DataTable
          columns={['Invoice', 'Job', 'Amount', 'Due', 'Payment status', 'Action']}
          rows={rows.map((invoice) => [
            invoice.invoice_number ?? invoice.id.slice(0, 8),
            invoice.job_id?.slice(0, 8).toUpperCase() ?? '—',
            money(Number(invoice.amount ?? 0)),
            invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set',
            <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />,
            <ActionButton
              key="action"
              tone="secondary"
              onClick={() => router.push(`/customer/invoices/${invoice.id}`)}
            >
              Open invoice
            </ActionButton>,
          ])}
          empty={<EmptyState title="No customer invoices" />}
        />
      </Panel>
    </PageFrame>
  );
}

export function CustomerUpdatesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<
    Array<{
      id: string;
      event_type: string;
      entity_type: string;
      status: string;
      created_at: string;
      payload: Record<string, unknown> | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.companyId) {
      setLoading(false);
      return;
    }
    supabase
      .from('notification_events')
      .select('id,event_type,entity_type,status,created_at,payload')
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRows((data ?? []) as typeof rows);
        setLoading(false);
      });
  }, [user?.companyId]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Notifications"
        title="Updates"
        description="A chronological feed of quotes, awards, status changes, POD and invoice events."
      />
      <Panel>
        {loading ? (
          <EmptyState title="Loading updates…" />
        ) : (
          <DataTable
            columns={['Event', 'Entity', 'Time', 'Status', 'Detail']}
            rows={rows.map((row) => [
              lifecycleLabel(row.event_type),
              lifecycleLabel(row.entity_type),
              when(row.created_at),
              <StatusBadge key="status" value={lifecycleLabel(row.status)} />,
              typeof row.payload?.message === 'string' ? row.payload.message : '—',
            ])}
            empty={<EmptyState title="No updates yet" />}
          />
        )}
      </Panel>
    </PageFrame>
  );
}

export function CustomerTeamPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<
    Array<{
      id: string;
      role_in_company: string;
      status: string;
      user_id: string | null;
      created_at: string;
    }>
  >([]);

  useEffect(() => {
    if (!user?.companyId) return;
    supabase
      .from('company_memberships')
      .select('id,role_in_company,status,user_id,created_at')
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setRows((data ?? []) as typeof rows));
  }, [user?.companyId]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer administration"
        title="Team"
        description="Company members who can post loads, review quotes or view delivery and invoice information."
      />
      <Panel>
        <DataTable
          columns={['Member', 'Role', 'Status', 'Joined']}
          rows={rows.map((row) => [
            row.user_id?.slice(0, 8) ?? 'Invited member',
            lifecycleLabel(row.role_in_company),
            <StatusBadge key="status" value={lifecycleLabel(row.status)} />,
            when(row.created_at),
          ])}
          empty={<EmptyState title="No team members" />}
        />
      </Panel>
    </PageFrame>
  );
}

type TrackingEvent = {
  id: string;
  event_type: string;
  message?: string | null;
  created_at: string;
};

export function CustomerJobPage({ jobId }: { jobId: string }) {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const job = data.jobs.find((candidate) => candidate.id === jobId);

  useEffect(() => {
    if (!jobId) return;
    supabase
      .from('job_tracking_events')
      .select('id,event_type,message,created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
      .then(({ data: eventRows }) => setEvents((eventRows ?? []) as TrackingEvent[]));
  }, [jobId]);

  if (data.loading) {
    return (
      <PageFrame>
        <EmptyState title="Loading job…" />
      </PageFrame>
    );
  }

  if (!job) {
    return (
      <PageFrame>
        <AlertBanner tone="danger">This job was not found in the current customer company.</AlertBanner>
      </PageFrame>
    );
  }

  const status = currentStatus(job);
  const quotes = submittedQuotes(data.bids, job.id);
  const location = locationForJob(job, data.locations);
  const relatedInvoices = data.invoices.filter((invoice) => invoice.job_id === job.id);
  const issueEvents = events.filter((event) => isIssueStatus(event.event_type.toLowerCase()));
  const hasPod = (job.delivery_photos?.length ?? 0) > 0;
  const attentionItem = buildAttentionItem(job, data.bids);

  return (
    <PageFrame>
      <PageHeader
        eyebrow={`Job ${job.id.slice(0, 8).toUpperCase()}`}
        title={routeLabel(job)}
        description={`Pickup ${when(job.pickup_datetime)} · ETA ${when(job.delivery_datetime)}`}
        meta={
          <>
            <StatusBadge value={lifecycleLabel(status)} />
            {location && <StatusBadge value="Tracking available" tone="green" />}
            {hasPod && <StatusBadge value="POD available" tone="green" />}
          </>
        }
        actions={
          <>
            {hasPod && (
              <ActionButton tone="secondary" onClick={() => router.push('/customer/documents')}>
                Open POD
              </ActionButton>
            )}
            {relatedInvoices.length > 0 && (
              <ActionButton
                tone="secondary"
                onClick={() => router.push(`/customer/invoices/${relatedInvoices[0].id}`)}
              >
                Open invoice
              </ActionButton>
            )}
          </>
        }
      />

      {attentionItem && (
        <AlertBanner tone={attentionItem.tone === 'red' ? 'danger' : 'warning'}>
          {attentionItem.reason}
        </AlertBanner>
      )}

      <Panel
        title="Transport progress"
        description="The current lifecycle is displayed without changing the underlying job state."
        style={{ marginBottom: '0.8rem' }}
      >
        <ProgressSteps
          steps={lifecycleStages.map((stage) => lifecycleLabel(stage))}
          currentIndex={stageIndex(job)}
        />
      </Panel>

      <TwoColumn>
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <Panel title="Operational details">
            <DataTable
              columns={['Pickup', 'Delivery ETA', 'Vehicle', 'Quotes', 'Lifecycle']}
              rows={[
                [
                  when(job.pickup_datetime),
                  when(job.delivery_datetime),
                  lifecycleLabel(job.vehicle_type ?? 'Not specified'),
                  quotes.length,
                  <StatusBadge key="status" value={lifecycleLabel(status)} />,
                ],
              ]}
            />
          </Panel>

          <Panel
            title="Tracking timeline"
            description="Real tracking events and timestamps recorded for this job."
          >
            <DataTable
              columns={['Event', 'Time', 'Detail']}
              rows={events.map((event) => [
                <StatusBadge
                  key="event"
                  value={lifecycleLabel(event.event_type)}
                  tone={isIssueStatus(event.event_type.toLowerCase()) ? 'red' : undefined}
                />,
                when(event.created_at),
                event.message ?? '—',
              ])}
              empty={<EmptyState title="No tracking events recorded" />}
            />
          </Panel>

          <Panel
            title="Incidents and exceptions"
            description="Incidents, cancellations, waiting time, failed delivery and disputes recorded in the tracking history."
          >
            <DataTable
              columns={['Type', 'Time', 'Detail']}
              rows={issueEvents.map((event) => [
                <StatusBadge key="type" value={lifecycleLabel(event.event_type)} tone="red" />,
                when(event.created_at),
                event.message ?? 'No additional detail',
              ])}
              empty={<EmptyState title="No operational exceptions recorded" />}
            />
          </Panel>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <Panel title="ETA & live tracking">
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              <div style={detailRow}>
                <span>Scheduled ETA</span>
                <strong>{when(job.delivery_datetime)}</strong>
              </div>
              <div style={detailRow}>
                <span>Latest signal</span>
                <strong>
                  {location ? when(location.recorded_at ?? location.updated_at) : 'Not available'}
                </strong>
              </div>
              {location && (
                <div style={detailRow}>
                  <span>Coordinates</span>
                  <strong>
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </strong>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Commercial records">
            <QuickActions
              actions={[
                {
                  label: 'Carrier quotes',
                  description: `${quotes.length} submitted`,
                  onClick: () => router.push('/customer/quotes'),
                },
                {
                  label: 'POD documents',
                  description: hasPod ? `${job.delivery_photos?.length ?? 0} file(s)` : 'Awaiting POD',
                  onClick: () => router.push('/customer/documents'),
                },
                {
                  label: 'Invoices',
                  description: `${relatedInvoices.length} linked`,
                  onClick: () =>
                    relatedInvoices[0]
                      ? router.push(`/customer/invoices/${relatedInvoices[0].id}`)
                      : router.push('/customer/invoices'),
                },
              ]}
            />
          </Panel>
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

const detailRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '0.8rem',
  paddingBottom: '0.5rem',
  borderBottom: `1px solid ${workspaceTheme.border}`,
  color: workspaceTheme.muted,
  fontSize: '0.72rem',
} as const;
