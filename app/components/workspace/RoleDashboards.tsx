'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import {
  getWorkspaceDefinition,
  hasWorkspaceCapability,
  resolveWorkspaceRole,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';
import {
  getWorkspaceDatasetMetricValue,
  useCompanyWorkspaceData,
  type WorkspaceDataState,
} from './useCompanyWorkspaceData';
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
  PermissionDeniedState,
  StatusBadge,
  TwoColumn,
} from './WorkspaceUI';
import {
  activeStatuses,
  datasetUnavailable,
  daysUntil,
  exceptionStatuses,
  formatDate,
  metricDetail,
  metricTone,
  metricValue,
  money,
} from './dashboardRuntime';
import { CarrierDashboard, FleetDashboard } from './CarrierFleetDashboards';

export { CarrierDashboard, FleetDashboard } from './CarrierFleetDashboards';

type AdminDashboardTarget =
  | 'carrier'
  | 'fleet'
  | 'dispatcher'
  | 'finance'
  | 'compliance'
  | 'viewer'
  | 'blocked';

export type AdminDashboardResolution = {
  target: AdminDashboardTarget;
  blocker: string | null;
  homeHref: string | null;
};

export function resolveAdminDashboard(role: WorkspaceRole | null | undefined): AdminDashboardResolution {
  if (!role) {
    return {
      target: 'blocked',
      blocker: 'Workspace role context is unavailable, so the /admin dashboard cannot be resolved safely.',
      homeHref: null,
    };
  }

  const definition = getWorkspaceDefinition(role);
  switch (role) {
    case 'company_owner':
    case 'company_admin':
    case 'carrier_admin':
      return hasWorkspaceCapability(role, 'jobs.view') && definition.homeHref === '/admin'
        ? { target: 'carrier', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: `${role} is missing the approved /admin carrier dashboard contract.`, homeHref: definition.homeHref };
    case 'fleet_manager':
      return hasWorkspaceCapability(role, 'fleet.positions.view')
        ? { target: 'fleet', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: 'fleet_manager is missing the approved fleet dashboard capability contract.', homeHref: definition.homeHref };
    case 'dispatcher':
      return hasWorkspaceCapability(role, 'jobs.dispatch')
        ? { target: 'dispatcher', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: 'dispatcher is missing the approved operations dashboard capability contract.', homeHref: definition.homeHref };
    case 'finance':
      return hasWorkspaceCapability(role, 'invoices.customer.manage') || hasWorkspaceCapability(role, 'invoices.carrier.manage')
        ? { target: 'finance', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: 'finance is missing the approved finance dashboard capability contract.', homeHref: definition.homeHref };
    case 'compliance':
      return hasWorkspaceCapability(role, 'documents.company.manage') || hasWorkspaceCapability(role, 'documents.verify')
        ? { target: 'compliance', blocker: null, homeHref: definition.homeHref }
        : { target: 'blocked', blocker: 'compliance is missing the approved compliance dashboard capability contract.', homeHref: definition.homeHref };
    case 'viewer':
      return { target: 'viewer', blocker: null, homeHref: definition.homeHref };
    case 'platform_owner':
      return { target: 'blocked', blocker: `platform_owner resolves to ${definition.homeHref}, so it cannot silently receive the carrier /admin dashboard.`, homeHref: definition.homeHref };
    case 'broker':
    case 'customer':
    case 'driver':
    case 'owner_driver':
      return { target: 'blocked', blocker: `${role} resolves to ${definition.homeHref}; entering /admin does not convert it into carrier/company operations.`, homeHref: definition.homeHref };
  }
}

export function FinanceDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const totals = useMemo(() => {
    const unpaid = data.invoices.filter(
      (invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status),
    );
    const overdue = unpaid.filter(
      (invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < Date.now(),
    );
    return {
      draft: data.invoices.filter((invoice) => ['draft', 'Draft'].includes(invoice.status)).length,
      unpaid: unpaid.length,
      overdue: overdue.length,
      outstanding: unpaid.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
      overdueAmount: overdue.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    };
  }, [data.invoices]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance control"
        title="Finance Dashboard"
        description="Invoice issuance, payment status, balances and exceptions without operational edit permissions."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/invoices')}>Open Invoices</ActionButton>}
      />
      <KpiGrid>
        <KpiCard label="Draft invoices" value={getWorkspaceDatasetMetricValue(data.datasets.invoices, (rows) => rows.filter((invoice) => ['draft', 'Draft'].includes(invoice.status)).length)} detail={metricDetail(data, ['invoices'], 'Invoices requiring issue')} />
        <KpiCard label="Outstanding invoices" value={getWorkspaceDatasetMetricValue(data.datasets.invoices, (rows) => rows.filter((invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status)).length)} detail={metricDetail(data, ['invoices'], 'Awaiting payment')} tone={metricTone(data, ['invoices'], 'orange')} />
        <KpiCard label="Overdue invoices" value={getWorkspaceDatasetMetricValue(data.datasets.invoices, (rows) => rows.filter((invoice) => invoice.payment_status !== 'paid' && !['paid', 'Paid', 'void'].includes(invoice.status) && invoice.due_date && new Date(invoice.due_date).getTime() < Date.now()).length)} detail={metricDetail(data, ['invoices'], 'Past due date')} tone={metricTone(data, ['invoices'], 'red')} />
        <KpiCard label="Outstanding value" value={metricValue(data, ['invoices'], () => money(totals.outstanding))} detail={metricDetail(data, ['invoices'], 'Unpaid balance')} tone={metricTone(data, ['invoices'], 'navy')} />
        <KpiCard label="Overdue value" value={metricValue(data, ['invoices'], () => money(totals.overdueAmount))} detail={metricDetail(data, ['invoices'], 'Past due balance')} tone={metricTone(data, ['invoices'], 'red')} />
      </KpiGrid>
      <Panel title="Invoice control" description="Most recent invoices and payment state.">
        <DataTable
          columns={['Invoice', 'Client', 'Amount', 'Due', 'Status']}
          rows={data.invoices.slice(0, 15).map((invoice) => [
            invoice.invoice_number ?? 'Invoice',
            invoice.client_name ?? 'Client',
            money(Number(invoice.amount ?? 0)),
            invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Not set',
            <StatusBadge key="status" value={invoice.payment_status ?? invoice.status} />,
          ])}
        />
      </Panel>
    </PageFrame>
  );
}

export function ComplianceDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const documents = data.driverDocuments.concat(data.vehicleDocuments);
  const expired = documents.filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days < 0;
  });
  const due7 = documents.filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days >= 0 && days <= 7;
  });
  const due30 = documents.filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days > 7 && days <= 30;
  });

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Compliance control"
        title="Compliance Dashboard"
        description="Verification, expiry and operational readiness for drivers, vehicles and company documents."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents')}>Verification Queue</ActionButton>}
      />
      <KpiGrid>
        <KpiCard label="Expired" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expired.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Immediate renewal required')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'red')} />
        <KpiCard label="Expires in 7 days" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => due7.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Urgent review window')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'orange')} />
        <KpiCard label="Expires in 30 days" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => due30.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Upcoming expiry')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'blue')} />
        <KpiCard label="Pending verification" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => documents.filter((document) => ['pending', 'under_review'].includes(document.status ?? '')).length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Requires review')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'purple')} />
        <KpiCard label="Drivers not ready" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.status !== 'active').length)} detail={metricDetail(data, ['drivers'], 'Inactive or blocked')} tone={metricTone(data, ['drivers'], 'red')} />
      </KpiGrid>
      <Panel title="Priority expiry queue" description="Expired documents first, followed by the nearest expiry date.">
        <DataTable
          columns={['Document', 'Entity', 'Expiry', 'Status', 'Action']}
          rows={documents
            .filter((document) => document.expiry_date)
            .sort((a, b) => new Date(a.expiry_date ?? 0).getTime() - new Date(b.expiry_date ?? 0).getTime())
            .slice(0, 20)
            .map((document) => [
              document.doc_type?.replace(/_/g, ' ') ?? 'Document',
              document.driver_id ? 'Driver' : 'Vehicle',
              document.expiry_date ? new Date(document.expiry_date).toLocaleDateString('en-GB') : 'Not set',
              <StatusBadge key="status" value={document.status ?? 'pending'} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/admin/documents')}>Review</ActionButton>,
            ])}
        />
      </Panel>
    </PageFrame>
  );
}

export function DispatcherDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceDataState['locations'][number]>();
    for (const location of data.locations) {
      const current = map.get(location.driver_id);
      const currentAt = current?.recorded_at ?? current?.updated_at ?? '';
      const candidateAt = location.recorded_at ?? location.updated_at ?? '';
      if (!current || candidateAt > currentAt) map.set(location.driver_id, location);
    }
    return map;
  }, [data.locations]);

  const stalePositions = data.drivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = location?.recorded_at ?? location?.updated_at;
    return !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
  }).length;
  const activeJobs = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status));
  const unallocatedJobs = data.jobs.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id);
  const exceptionJobs = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operations control"
        title="Operations Dashboard"
        description="Daily allocation, live execution and exception control without carrier marketplace or finance content."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/operations-centre')}>Open Operations Centre</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Assignments</ActionButton>
          </>
        }
      />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Unallocated jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id).length)} detail={metricDetail(data, ['jobs'], 'Needs dispatch')} tone={metricTone(data, ['jobs'], 'orange')} onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Live execution')} tone={metricTone(data, ['jobs'], 'green')} onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="Exceptions" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => exceptionStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Immediate intervention')} tone={metricTone(data, ['jobs'], exceptionJobs.length ? 'red' : 'green')} onClick={() => router.push('/admin/incidents')} />
        <KpiCard label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)} detail={metricDetail(data, ['drivers'], 'Ready now')} tone={metricTone(data, ['drivers'], 'blue')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Stale positions" value={metricValue(data, ['drivers', 'locations'], () => stalePositions)} detail={metricDetail(data, ['drivers', 'locations'], 'No fresh GPS update')} tone={metricTone(data, ['drivers', 'locations'], stalePositions ? 'red' : 'navy')} onClick={() => router.push('/admin/fleet/positions')} />
      </KpiGrid>
      <TwoColumn>
        <Panel title="Priority jobs" description="Dispatch priority sorted by current operating risk.">
          <DataTable
            columns={['Route', 'Pickup', 'Status', 'Action']}
            rows={[...unallocatedJobs, ...activeJobs.filter((job) => !unallocatedJobs.includes(job))].slice(0, 8).map((job) => [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              formatDate(job.pickup_datetime),
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
            ])}
            empty={<EmptyState compact title={datasetUnavailable(data, ['jobs']) ? 'Job data unavailable' : 'No dispatch priorities'} description={datasetUnavailable(data, ['jobs']) ? 'The operational jobs feed is unavailable for this workspace.' : 'Unallocated and live jobs will appear here.'} />}
          />
        </Panel>
        <Panel title="Resource signals" description="Dispatchers can monitor status without carrier commercial actions.">
          <KpiGrid>
            <KpiCard label="Drivers online" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status !== 'offline').length)} detail={metricDetail(data, ['drivers'], 'Online or busy')} tone={metricTone(data, ['drivers'], 'green')} onClick={() => router.push('/admin/drivers')} />
            <KpiCard label="Vehicles visible" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.length)} detail={metricDetail(data, ['vehicles'], 'Fleet units')} tone="navy" onClick={() => router.push('/admin/vehicles')} />
            <KpiCard label="Exceptions open" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => exceptionStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Operational incidents')} tone={metricTone(data, ['jobs'], 'red')} onClick={() => router.push('/admin/incidents')} />
          </KpiGrid>
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}

export function ViewerDashboard() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const completedJobs = data.jobs.filter((job) => ['delivered', 'completed', 'paid'].includes(job.current_status ?? job.status));
  const exceptionJobs = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));

  return (
    <PageFrame>
      <PageHeader eyebrow="Read-only operations" title="Viewer Dashboard" description="Approved operational visibility without state-changing carrier actions." />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      <KpiGrid>
        <KpiCard label="Jobs visible" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.length)} detail={metricDetail(data, ['jobs'], 'Read-only record set')} tone="navy" onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'In progress')} tone={metricTone(data, ['jobs'], 'green')} onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Completed" value={metricValue(data, ['jobs'], () => completedJobs.length)} detail={metricDetail(data, ['jobs'], 'Delivered or paid')} tone={metricTone(data, ['jobs'], 'blue')} onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Exceptions" value={metricValue(data, ['jobs'], () => exceptionJobs.length)} detail={metricDetail(data, ['jobs'], 'Requires follow-up')} tone={metricTone(data, ['jobs'], exceptionJobs.length ? 'red' : 'green')} onClick={() => router.push('/admin/jobs')} />
      </KpiGrid>
      <Panel title="Recent jobs" description="Latest visible operational work items.">
        <DataTable
          columns={['Route', 'Pickup', 'Status', 'Open']}
          rows={data.jobs.slice(0, 10).map((job) => [
            <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
            formatDate(job.pickup_datetime),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            <ActionButton key="open" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState compact title={datasetUnavailable(data, ['jobs']) ? 'Job data unavailable' : 'No jobs visible'} description={datasetUnavailable(data, ['jobs']) ? 'The read-only jobs dataset is currently unavailable.' : 'Operational jobs will appear here when records are available.'} />}
        />
      </Panel>
    </PageFrame>
  );
}

function BlockedAdminDashboard({ blocker, homeHref }: { blocker: string; homeHref: string | null }) {
  const router = useRouter();
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Workspace boundary"
        title="Admin dashboard unavailable"
        description="The canonical workspace contract does not permit this role to inherit carrier/company operations content here."
      />
      <PermissionDeniedState
        reason={blocker}
        action={homeHref ? <ActionButton tone="secondary" onClick={() => router.push(homeHref)}>Open approved home route</ActionButton> : undefined}
      />
    </PageFrame>
  );
}

export default function RoleDashboard() {
  const { user } = useAuth();
  const resolution = resolveAdminDashboard(user?.workspaceRole ?? resolveWorkspaceRole(user));
  switch (resolution.target) {
    case 'carrier':
      return <CarrierDashboard />;
    case 'fleet':
      return <FleetDashboard />;
    case 'dispatcher':
      return <DispatcherDashboard />;
    case 'finance':
      return <FinanceDashboard />;
    case 'compliance':
      return <ComplianceDashboard />;
    case 'viewer':
      return <ViewerDashboard />;
    case 'blocked':
      return <BlockedAdminDashboard blocker={resolution.blocker ?? 'Admin dashboard unavailable.'} homeHref={resolution.homeHref} />;
  }
}
