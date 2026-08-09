'use client';

import { useRouter } from 'next/navigation';
import { getWorkspaceDatasetMetricValue, useCompanyWorkspaceData } from './useCompanyWorkspaceData';
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

export default function ComplianceControlDashboardHome() {
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
  const pending = documents.filter((document) =>
    ['pending', 'under_review'].includes(String(document.status ?? '').toLowerCase()),
  );
  const pendingIds = new Set(pending.map((document) => document.id));
  const current = documents.filter((document) => {
    if (pendingIds.has(document.id)) return false;
    const days = daysUntil(document.expiry_date);
    return days === null || days > 30;
  });
  const expiringCurrent = due7.concat(due30).filter((document) => !pendingIds.has(document.id));
  const expiredCurrent = expired.filter((document) => !pendingIds.has(document.id));
  const incidents = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));

  const priorityDocuments = documents
    .filter((document) => document.expiry_date || ['pending', 'under_review'].includes(String(document.status ?? '').toLowerCase()))
    .sort((a, b) => {
      const aTime = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

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
        <KpiCard label="Expired documents" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expired.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Immediate renewal')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], expired.length ? 'red' : 'green')} onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Expires in 7 days" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => due7.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Urgent window')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], due7.length ? 'orange' : 'green')} onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Expires in 30 days" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => due30.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Upcoming expiry')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], 'blue')} onClick={() => router.push('/admin/documents/expiry')} />
        <KpiCard label="Pending verification" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => pending.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Review required')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], pending.length ? 'purple' : 'navy')} onClick={() => router.push('/admin/documents')} />
        <KpiCard label="Drivers not ready" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.status !== 'active').length)} detail={metricDetail(data, ['drivers'], 'Inactive or blocked')} tone={metricTone(data, ['drivers'], 'red')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Operational incidents" value={metricValue(data, ['jobs'], () => incidents.length)} detail={metricDetail(data, ['jobs'], 'Compliance follow-up')} tone={metricTone(data, ['jobs'], incidents.length ? 'red' : 'green')} onClick={() => router.push('/admin/incidents')} />
      </KpiGrid>

      <Panel
        title="Priority verification & expiry queue"
        description="Expired and near-expiry records are shown before routine documents."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/documents')}>All documents</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Document', 'Entity', 'Expiry', 'Status', 'Review']}
          rows={priorityDocuments.slice(0, 12).map((document) => [
            document.doc_type?.replace(/_/g, ' ') ?? 'Document',
            document.driver_id ? 'Driver' : document.vehicle_id ? 'Vehicle' : 'Company',
            document.expiry_date ? new Date(document.expiry_date).toLocaleDateString('en-GB') : 'No expiry date',
            <StatusBadge
              key="status"
              value={document.status ?? 'pending'}
              tone={(daysUntil(document.expiry_date) ?? 9999) < 0 ? 'red' : (daysUntil(document.expiry_date) ?? 9999) <= 7 ? 'orange' : undefined}
            />,
            <ActionButton key="review" tone="secondary" onClick={() => router.push('/admin/documents')}>Review</ActionButton>,
          ])}
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
              { label: 'Expired', count: expiredCurrent.length, color: workspaceTheme.red, background: '#FEF2F2', border: '#FECACA' },
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
