'use client';

import { useRouter } from 'next/navigation';
import { getWorkspaceDatasetMetricValue, useCompanyWorkspaceData, type WorkspaceDocument } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  ComplianceSummaryPanel,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  Panel,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from './WorkspaceUI';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import {
  daysUntil,
  exceptionStatuses,
  metricDetail,
  metricTone,
  metricValue,
  unavailable,
} from './AdminDashboardShared';

type ComplianceDocumentState = 'rejected' | 'expired' | 'pending' | 'due7' | 'due30' | 'current';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

function complianceDocumentState(document: WorkspaceDocument): ComplianceDocumentState {
  const status = normalise(document.status);
  const days = daysUntil(document.expiry_date);
  if (status === 'rejected') return 'rejected';
  if (status === 'expired' || (days !== null && days < 0)) return 'expired';
  if (['pending', 'under_review'].includes(status)) return 'pending';
  if (days !== null && days <= 7) return 'due7';
  if (days !== null && days <= 30) return 'due30';
  return 'current';
}

export default function ComplianceControlDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const documents = data.driverDocuments.concat(data.vehicleDocuments);
  const documentState = new Map(documents.map((document) => [document.id, complianceDocumentState(document)]));
  const rejected = documents.filter((document) => documentState.get(document.id) === 'rejected');
  const expired = documents.filter((document) => documentState.get(document.id) === 'expired');
  const due7 = documents.filter((document) => documentState.get(document.id) === 'due7');
  const due30 = documents.filter((document) => documentState.get(document.id) === 'due30');
  const pending = documents.filter((document) => documentState.get(document.id) === 'pending');
  const current = documents.filter((document) => documentState.get(document.id) === 'current');
  const expiringCurrent = due7.concat(due30);
  const incidents = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));

  const driverById = new Map(data.drivers.map((driver) => [driver.id, driver]));
  const vehicleById = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const entityName = (document: WorkspaceDocument) => {
    if (document.driver_id) {
      const driver = driverById.get(document.driver_id);
      return driver?.display_name ?? driver?.email ?? `Driver ${document.driver_id.slice(0, 8).toUpperCase()}`;
    }
    if (document.vehicle_id) {
      const vehicle = vehicleById.get(document.vehicle_id);
      const makeModel = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
      return vehicle?.reg_plate ?? makeModel ?? vehicle?.type?.replace(/_/g, ' ') ?? `Vehicle ${document.vehicle_id.slice(0, 8).toUpperCase()}`;
    }
    return 'Company';
  };

  const priorityDocuments = documents
    .filter((document) => documentState.get(document.id) !== 'current')
    .sort((a, b) => {
      const rank: Record<ComplianceDocumentState, number> = { rejected: 0, expired: 1, due7: 2, pending: 3, due30: 4, current: 5 };
      const stateDelta = rank[documentState.get(a.id) ?? 'current'] - rank[documentState.get(b.id) ?? 'current'];
      if (stateDelta !== 0) return stateDelta;
      const aTime = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

  const queueStatus = (document: WorkspaceDocument) => {
    const state = documentState.get(document.id) ?? 'current';
    if (state === 'rejected') return { label: 'Rejected', tone: 'red' as const };
    if (state === 'expired') return { label: 'Expired', tone: 'red' as const };
    if (state === 'due7') return { label: 'Due within 7 days', tone: 'orange' as const };
    if (state === 'due30') return { label: 'Due within 30 days', tone: 'orange' as const };
    if (state === 'pending') return { label: 'Pending review', tone: 'purple' as const };
    return { label: document.status ?? 'Current', tone: 'green' as const };
  };

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Compliance control"
        title="Compliance Dashboard"
        badge="Readiness & verification"
        description="Document verification, expiry, driver and vehicle readiness, and operational incidents. No commercial pricing or payment controls."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents')}>Verification Queue</ActionButton>}
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <KpiGrid>
        <KpiCard label="Expired documents" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expired.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], rejected.length ? `${rejected.length} rejected record(s) also require review` : 'Immediate renewal')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], expired.length || rejected.length ? 'red' : 'green')} onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Expires in 7 days" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => due7.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Urgent window')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], due7.length ? 'orange' : 'green')} onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Expires in 30 days" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => due30.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Upcoming expiry')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'blue')} onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Pending verification" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => pending.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Review required')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], pending.length ? 'purple' : 'navy')} onClick={() => router.push('/admin/documents')} />
        <KpiCard label="Drivers not ready" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => normalise(driver.status) !== 'active').length)} detail={metricDetail(data, ['drivers'], 'Inactive or blocked')} tone={metricTone(data, ['drivers'], 'red')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Operational incidents" value={metricValue(data, ['jobs'], () => incidents.length)} detail={metricDetail(data, ['jobs'], 'Compliance follow-up')} tone={metricTone(data, ['jobs'], incidents.length ? 'red' : 'green')} onClick={() => router.push('/admin/incidents')} />
      </KpiGrid>

      <Panel
        title="Priority verification & expiry queue"
        description="Rejected, expired, near-expiry and pending records are shown before routine documents."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents')}>All documents</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Document', 'Driver / Vehicle', 'Expiry', 'Status', 'Review']}
          rows={priorityDocuments.slice(0, 12).map((document) => {
            const state = queueStatus(document);
            return [
              document.doc_type?.replace(/_/g, ' ') ?? 'Document',
              <strong key="entity">{entityName(document)}</strong>,
              document.expiry_date ? new Date(document.expiry_date).toLocaleDateString('en-GB') : 'No expiry date',
              <StatusBadge key="status" value={state.label} tone={state.tone} />,
              <ActionButton key="review" tone={state.tone === 'red' ? 'danger' : 'secondary'} onClick={() => router.push('/admin/documents')}>Review</ActionButton>,
            ];
          })}
          empty={<EmptyState compact title={unavailable(data, ['driverDocuments', 'vehicleDocuments']) ? 'Document data unavailable' : 'No priority documents'} />}
        />
      </Panel>

      <TwoColumn>
        <Panel title="Compliance coverage" description="Document readiness across the current record set." style={{ marginTop: '12px' }}>
          <ComplianceSummaryPanel
            total={documents.length}
            rows={[
              { label: 'Current', count: current.length, color: workspaceTheme.green, background: '#F0FDF4', border: '#BBF7D0' },
              { label: 'Due within 30 days', count: expiringCurrent.length, color: workspaceTheme.orange, background: '#FFF8E8', border: '#FDE68A' },
              { label: 'Expired / rejected', count: expired.length + rejected.length, color: workspaceTheme.red, background: '#FEF2F2', border: '#FECACA' },
              { label: 'Pending review', count: pending.length, color: workspaceTheme.purple, background: '#FAF5FF', border: '#E9D5FF' },
            ]}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <Panel title="Compliance actions" description="Verification and readiness workflows only.">
            <QuickActionGrid
              actions={[
                { key: 'documents', label: 'Document verification', onClick: () => router.push('/admin/documents') },
                { key: 'expiry', label: 'Expiry register', onClick: () => router.push('/admin/documents/expiry') },
                { key: 'drivers', label: 'Driver readiness', onClick: () => router.push('/admin/drivers') },
                { key: 'vehicles', label: 'Vehicle readiness', onClick: () => router.push('/admin/vehicles') },
                { key: 'incidents', label: 'Incidents', onClick: () => router.push('/admin/incidents') },
              ]}
            />
          </Panel>

          <Panel title="Incidents requiring follow-up" description="Operational incidents visible to compliance.">
            <DataTable
              columns={['Route', 'Status', 'Open']}
              rows={incidents.slice(0, 5).map((job) => [
                <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                <StatusBadge key="status" value={job.current_status ?? job.status} tone="red" />,
                <ActionButton key="open" tone="secondary" onClick={() => router.push('/admin/incidents')}>Review</ActionButton>,
              ])}
              empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Incident feed unavailable' : 'No compliance incidents'} />}
            />
          </Panel>
        </div>
      </TwoColumn>
    </div>
  );
}
