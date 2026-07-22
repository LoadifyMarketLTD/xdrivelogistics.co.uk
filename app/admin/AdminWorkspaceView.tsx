'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
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
  QuickActions,
  StatusBadge,
  TwoColumn,
} from '../components/workspace/WorkspaceUI';
import { hasWorkspaceCapability, resolveWorkspaceRole, type WorkspaceCapability } from '../../lib/workspaceRole';
import {
  getEffectiveJobStatus,
  getInvoiceState,
  getRecordedComplianceState,
  isActiveExecutionStatus,
  isExceptionJobStatus,
  isTerminalJobStatus,
} from '../../lib/workspaceClassifiers';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

const TRACKING_STALE_MS = 20 * 60_000;
const PICKUP_IMMINENT_MS = 2 * 60 * 60_000;

const formatDateTime = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const roleLabel = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

type AttentionItem = {
  id: string;
  issue: string;
  entity: string;
  time: string | null;
  severity: 'critical' | 'high' | 'medium';
  status: string;
  route: string;
  capability: WorkspaceCapability;
};

type PersonalNotification = {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
};

export default function AdminWorkspaceView() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const workspaceRole = resolveWorkspaceRole(user);
  const [companyName, setCompanyName] = useState('Company workspace');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<PersonalNotification[]>([]);
  const [supplementalError, setSupplementalError] = useState('');

  const can = (capability: WorkspaceCapability) => hasWorkspaceCapability(workspaceRole, capability);

  useEffect(() => {
    if (!data.loading && !data.error) setLastRefreshedAt(new Date().toISOString());
  }, [data.loading, data.error, data.jobs, data.invoices, data.drivers, data.vehicles]);

  useEffect(() => {
    let cancelled = false;
    const loadSupplemental = async () => {
      if (!isSupabaseConfigured || !data.companyId || !user?.id) return;
      setSupplementalError('');
      const [companyResult, notificationResult] = await Promise.all([
        supabase.from('companies').select('name').eq('id', data.companyId).maybeSingle(),
        supabase
          .from('notification_events')
          .select('id, event_type, status, created_at')
          .eq('recipient_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      if (companyResult.data?.name) setCompanyName(String(companyResult.data.name));
      if (notificationResult.error) {
        setSupplementalError(`Notifications could not be loaded: ${notificationResult.error.message}`);
      } else {
        setNotifications((notificationResult.data ?? []) as PersonalNotification[]);
      }
    };
    void loadSupplemental();
    return () => { cancelled = true; };
  }, [data.companyId, user?.id]);

  const derived = useMemo(() => {
    const now = Date.now();
    const activeJobs = data.jobs.filter((job) => isActiveExecutionStatus(getEffectiveJobStatus(job)));
    const activeDriverIds = new Set(activeJobs.map((job) => job.assigned_driver_id).filter(Boolean) as string[]);
    const latestLocationByDriver = new Map<string, (typeof data.locations)[number]>();
    for (const location of data.locations) {
      if (!latestLocationByDriver.has(location.driver_id)) latestLocationByDriver.set(location.driver_id, location);
    }

    const blockingDriverIds = new Set(
      data.driverDocuments
        .filter((document) => getRecordedComplianceState(document, now).blocking)
        .map((document) => document.driver_id)
        .filter(Boolean) as string[]
    );
    const blockingVehicleIds = new Set(
      data.vehicleDocuments
        .filter((document) => getRecordedComplianceState(document, now).blocking)
        .map((document) => document.vehicle_id)
        .filter(Boolean) as string[]
    );

    const awardedUnallocated = data.jobs.filter((job) =>
      getEffectiveJobStatus(job) === 'awarded' &&
      job.awarded_carrier_company_id === data.companyId &&
      !job.assigned_driver_id
    );
    const allocatedAwaitingAcceptance = data.jobs.filter((job) =>
      getEffectiveJobStatus(job) === 'allocated' && Boolean(job.assigned_driver_id)
    );
    const delayedOrException = data.jobs.filter((job) => {
      const status = getEffectiveJobStatus(job);
      const overdue = isActiveExecutionStatus(status) && Boolean(job.delivery_datetime) && new Date(job.delivery_datetime as string).getTime() < now;
      return overdue || isExceptionJobStatus(status);
    });
    const noDeliveryPhotos = data.jobs.filter((job) =>
      ['delivered', 'completed'].includes(getEffectiveJobStatus(job)) && (job.delivery_photos?.length ?? 0) === 0
    );

    const driversReady = data.drivers.filter((driver) =>
      ['active', 'approved', 'verified'].includes(String(driver.status ?? '').toLowerCase()) &&
      driver.availability_status === 'available' &&
      !activeDriverIds.has(driver.id) &&
      !blockingDriverIds.has(driver.id)
    );
    const driversUnavailable = data.drivers.filter((driver) => !driversReady.some((ready) => ready.id === driver.id));

    const vehiclesReady = data.vehicles.filter((vehicle) => {
      if (blockingVehicleIds.has(vehicle.id)) return false;
      if (!vehicle.assigned_driver_id) return true;
      return !activeDriverIds.has(vehicle.assigned_driver_id);
    });

    const recordedComplianceIssues = [
      ...data.driverDocuments.map((document) => ({ ...document, entity: 'Driver document' })),
      ...data.vehicleDocuments.map((document) => ({ ...document, entity: 'Vehicle document' })),
    ].filter((document) => getRecordedComplianceState(document, now).blocking);

    const unpaidInvoices = data.invoices.filter((invoice) => getInvoiceState(invoice, now).unpaid);
    const overdueInvoices = data.invoices.filter((invoice) => getInvoiceState(invoice, now).overdue);

    const attention: AttentionItem[] = [];
    const add = (item: AttentionItem) => attention.push(item);

    for (const job of activeJobs) {
      const status = getEffectiveJobStatus(job);
      if (job.delivery_datetime && new Date(job.delivery_datetime).getTime() < now) {
        add({ id: `overdue-${job.id}`, issue: 'Overdue active delivery', entity: `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`, time: job.delivery_datetime, severity: 'critical', status, route: `/admin/fleet/active-jobs?job=${job.id}`, capability: 'jobs.track' });
      }
      if (job.assigned_driver_id) {
        const location = latestLocationByDriver.get(job.assigned_driver_id);
        const timestamp = location?.recorded_at ?? location?.updated_at ?? null;
        if (!timestamp || now - new Date(timestamp).getTime() > TRACKING_STALE_MS) {
          add({ id: `tracking-${job.id}`, issue: timestamp ? 'Stale tracking signal' : 'No tracking signal', entity: `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`, time: timestamp, severity: 'high', status, route: '/admin/fleet/positions', capability: 'fleet.positions.view' });
        }
      }
    }
    for (const job of delayedOrException.filter((job) => isExceptionJobStatus(getEffectiveJobStatus(job)))) {
      add({ id: `exception-${job.id}`, issue: 'Failed or exception delivery', entity: `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`, time: job.updated_at, severity: 'critical', status: getEffectiveJobStatus(job), route: `/admin/jobs?job=${job.id}`, capability: 'jobs.view' });
    }
    for (const job of awardedUnallocated) {
      const pickupAt = job.pickup_datetime ? new Date(job.pickup_datetime).getTime() : Number.NaN;
      const imminent = Number.isFinite(pickupAt) && pickupAt > now && pickupAt - now <= PICKUP_IMMINENT_MS;
      add({ id: `award-${job.id}`, issue: imminent ? 'Pickup imminent without allocation' : 'Awarded but unallocated', entity: `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`, time: job.pickup_datetime, severity: 'high', status: getEffectiveJobStatus(job), route: `/admin/fleet/assignments?job=${job.id}`, capability: 'jobs.allocate' });
    }
    for (const job of allocatedAwaitingAcceptance) {
      add({ id: `allocated-${job.id}`, issue: 'Allocated awaiting acceptance', entity: `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`, time: job.updated_at, severity: 'high', status: getEffectiveJobStatus(job), route: `/admin/fleet/assignments?job=${job.id}`, capability: 'jobs.allocate' });
    }
    for (const job of noDeliveryPhotos) {
      add({ id: `pod-${job.id}`, issue: 'No delivery photos recorded', entity: `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`, time: job.updated_at, severity: 'high', status: getEffectiveJobStatus(job), route: `/admin/jobs?job=${job.id}`, capability: 'jobs.review_pod' });
    }
    for (const document of recordedComplianceIssues) {
      add({ id: `document-${document.id}`, issue: document.entity === 'Driver document' ? 'Expired or invalid driver document' : 'Expired or invalid vehicle document', entity: document.doc_type?.replace(/_/g, ' ') ?? document.entity, time: document.expiry_date, severity: 'critical', status: document.status ?? 'expired', route: '/admin/documents', capability: 'documents.company.manage' });
    }
    for (const invoice of overdueInvoices) {
      add({ id: `invoice-${invoice.id}`, issue: 'Overdue invoice', entity: invoice.invoice_number ?? invoice.client_name ?? 'Invoice', time: invoice.due_date ?? null, severity: 'high', status: invoice.payment_status ?? invoice.status, route: '/admin/invoices', capability: 'invoices.carrier.manage' });
    }

    const priority = { critical: 0, high: 1, medium: 2 };
    attention.sort((a, b) => priority[a.severity] - priority[b.severity] || String(a.time ?? '').localeCompare(String(b.time ?? '')));

    const activity = [
      ...data.jobs.map((job) => ({ id: `job-${job.id}`, type: 'Job updated', subject: `${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`, status: getEffectiveJobStatus(job), at: job.updated_at, route: `/admin/jobs?job=${job.id}` })),
      ...data.bids.map((bid) => ({ id: `bid-${bid.id}`, type: 'Quote activity', subject: bid.companies?.name ?? 'Carrier quote', status: bid.status, at: bid.created_at, route: '/admin/quotes' })),
      ...data.invoices.map((invoice) => ({ id: `invoice-${invoice.id}`, type: 'Invoice activity', subject: invoice.invoice_number ?? invoice.client_name ?? 'Invoice', status: invoice.payment_status ?? invoice.status, at: invoice.created_at, route: '/admin/invoices' })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10);

    return { activeJobs, awardedUnallocated, allocatedAwaitingAcceptance, delayedOrException, noDeliveryPhotos, driversReady, driversUnavailable, vehiclesReady, recordedComplianceIssues, unpaidInvoices, overdueInvoices, attention, activity };
  }, [data]);

  const visibleAttention = derived.attention.filter((item) => can(item.capability)).slice(0, 15);
  const quickActions = [
    can('jobs.allocate') ? { label: 'Allocate work', description: 'Resolve awarded and unallocated jobs', onClick: () => router.push('/admin/fleet/assignments') } : null,
    can('jobs.track') ? { label: 'Active deliveries', description: 'Review live jobs and exceptions', onClick: () => router.push('/admin/fleet/active-jobs') } : null,
    can('drivers.manage') ? { label: 'Driver readiness', description: 'Open the company driver register', onClick: () => router.push('/admin/drivers') } : null,
    can('vehicles.manage') ? { label: 'Vehicle readiness', description: 'Open the company vehicle register', onClick: () => router.push('/admin/vehicles') } : null,
    can('documents.company.manage') ? { label: 'Compliance documents', description: 'Review recorded document issues', onClick: () => router.push('/admin/documents') } : null,
    can('settings.manage') ? { label: 'Company settings', description: 'Manage authorised company settings', onClick: () => router.push('/admin/settings') } : null,
  ].filter(Boolean) as Array<{ label: string; description: string; onClick: () => void }>;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Company administration"
        title="Admin Workspace"
        description="Operational exceptions, resource blockers and administrative actions for the active company only."
        meta={<><StatusBadge value={companyName} tone="blue" /><StatusBadge value={roleLabel(workspaceRole)} tone="grey" /><span style={{ color: '#64748b', fontSize: '0.7rem' }}>Last refreshed {formatDateTime(lastRefreshedAt)}</span></>}
        actions={<ActionButton tone="secondary" disabled={data.loading} onClick={() => void data.refresh()}>{data.loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      />
      {data.error && <AlertBanner tone="warning">{data.error}</AlertBanner>}
      {supplementalError && <AlertBanner tone="warning">{supplementalError}</AlertBanner>}

      <KpiGrid>
        {can('jobs.allocate') && <KpiCard label="Awarded and unallocated" value={derived.awardedUnallocated.length} tone="orange" detail="Awarded to this company; driver not assigned" onClick={() => router.push('/admin/fleet/assignments')} />}
        {can('jobs.allocate') && <KpiCard label="Awaiting acceptance" value={derived.allocatedAwaitingAcceptance.length} tone="orange" detail="Allocated with a persisted driver assignment" />}
        {can('jobs.track') && <KpiCard label="Active deliveries" value={derived.activeJobs.length} tone="green" detail="Accepted through on-site delivery" onClick={() => router.push('/admin/fleet/active-jobs')} />}
        {can('jobs.view') && <KpiCard label="Delayed or exception" value={derived.delayedOrException.length} tone="red" detail="Overdue execution or persisted exception status" />}
        {can('drivers.manage') && <KpiCard label="Drivers allocation-ready" value={derived.driversReady.length} tone="green" detail="Active, available, unassigned and no recorded blocking document" onClick={() => router.push('/admin/drivers')} />}
        {can('drivers.manage') && <KpiCard label="Drivers unavailable" value={derived.driversUnavailable.length} tone="navy" detail="Not currently allocation-ready" />}
        {can('vehicles.manage') && <KpiCard label="Vehicles allocation-ready" value={derived.vehiclesReady.length} tone="blue" detail="No active driver commitment or recorded blocking document" onClick={() => router.push('/admin/vehicles')} />}
        {can('documents.company.manage') && <KpiCard label="Recorded compliance issues" value={derived.recordedComplianceIssues.length} tone="red" detail="Expired, rejected or invalid recorded documents" onClick={() => router.push('/admin/documents')} />}
        {can('jobs.review_pod') && <KpiCard label="No delivery photos recorded" value={derived.noDeliveryPhotos.length} tone="red" detail="Delivered or completed jobs" />}
        {can('invoices.carrier.manage') && <KpiCard label="Unpaid invoices" value={derived.unpaidInvoices.length} tone="orange" detail="Payable invoices not marked paid" onClick={() => router.push('/admin/invoices')} />}
        {can('invoices.carrier.manage') && <KpiCard label="Overdue invoices" value={derived.overdueInvoices.length} tone="red" detail="Unpaid with due date passed" onClick={() => router.push('/admin/invoices')} />}
      </KpiGrid>

      <TwoColumn rightWidth="minmax(300px, 0.68fr)">
        <Panel title="Admin attention queue" description="Only persisted, actionable company exceptions are shown, ordered by operational priority.">
          <DataTable
            columns={['Issue', 'Affected entity', 'Deadline / event', 'Severity', 'Status', 'Action']}
            rows={visibleAttention.map((item) => [
              <strong key="issue">{item.issue}</strong>,
              item.entity,
              formatDateTime(item.time),
              <StatusBadge key="severity" value={item.severity} tone={item.severity === 'critical' ? 'red' : item.severity === 'high' ? 'orange' : 'blue'} />,
              <StatusBadge key="status" value={item.status} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(item.route)}>Open</ActionButton>,
            ])}
            empty={<EmptyState title={data.loading ? 'Loading attention queue' : 'No actionable exceptions'} description={data.loading ? 'Company-scoped records are being loaded.' : 'No supported exception currently requires intervention.'} />}
          />
        </Panel>
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <Panel title="Quick actions" description="Actions are filtered by the central capability model.">
            <QuickActions actions={quickActions} />
          </Panel>
          <Panel title="Personal notifications" description="Persisted notification events addressed to the signed-in administrator.">
            {notifications.length > 0 ? notifications.map((notification) => (
              <div key={notification.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.52rem 0', borderBottom: '1px solid #eef2f6' }}>
                <span><strong style={{ display: 'block', fontSize: '0.75rem' }}>{roleLabel(notification.event_type)}</strong><small style={{ color: '#64748b' }}>{formatDateTime(notification.created_at)}</small></span>
                <StatusBadge value={notification.status} />
              </div>
            )) : <EmptyState title="No personal notification events" description="This is a true empty state; query failures are shown separately above." />}
          </Panel>
        </div>
      </TwoColumn>

      <div style={{ marginTop: '0.8rem' }}>
        <Panel title="Recent company activity" description="Persisted job, quote and invoice timestamps; render time is not used as activity time.">
          <DataTable
            columns={['Activity', 'Subject', 'Status', 'Persisted time', 'Action']}
            rows={derived.activity.map((item) => [item.type, <strong key="subject">{item.subject}</strong>, <StatusBadge key="status" value={item.status} />, formatDateTime(item.at), <ActionButton key="action" tone="secondary" onClick={() => router.push(item.route)}>Open</ActionButton>])}
            empty={<EmptyState title="No persisted company activity" />}
          />
        </Panel>
      </div>
    </PageFrame>
  );
}
