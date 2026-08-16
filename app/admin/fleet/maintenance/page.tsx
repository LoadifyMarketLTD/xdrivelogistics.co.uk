'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

export default function FleetMaintenancePage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);

  const rows = data.vehicles.map((vehicle) => {
    const documents = data.vehicleDocuments.filter((document) => document.vehicle_id === vehicle.id);
    const expired = documents.some((document) => (daysUntil(document.expiry_date) ?? 1) < 0);
    const expiring = documents.some((document) => {
      const days = daysUntil(document.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    });
    const signal = expired
      ? { value: 'document expired', tone: 'red' as const }
      : expiring
        ? { value: 'document review due', tone: 'orange' as const }
        : documents.length > 0
          ? { value: 'documents recorded', tone: 'blue' as const }
          : { value: 'documents missing', tone: 'grey' as const };
    return { vehicle, documents, signal };
  });

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet maintenance"
        title="Maintenance"
        description="Recorded vehicle and document signals only. The verified Fleet dataset does not expose a maintenance-health or operational-readiness state, so none is inferred here."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/vehicles')}>Manage vehicles</ActionButton>}
      />
      <KpiGrid>
        <KpiCard label="Fleet vehicles" value={data.vehicles.length} />
        <KpiCard
          label="Without assigned driver"
          value={data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id).length}
          tone="orange"
        />
        <KpiCard
          label="Expired document records"
          value={data.vehicleDocuments.filter((document) => (daysUntil(document.expiry_date) ?? 1) < 0).length}
          tone="red"
        />
      </KpiGrid>
      <Panel title="Vehicle document register" description="Document signals are not a substitute for the canonical server-side driver + vehicle eligibility check.">
        <DataTable
          columns={['Registration', 'Vehicle', 'Assigned driver', 'Evidence', 'Document signal', 'Action']}
          rows={rows.map(({ vehicle, documents, signal }) => {
            const driver = vehicle.assigned_driver_id ? driverById.get(vehicle.assigned_driver_id) : undefined;
            return [
              <strong key="registration">{vehicle.reg_plate ?? 'No registration'}</strong>,
              `${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || vehicle.type?.replace(/_/g, ' ') || 'Vehicle',
              driver?.display_name ?? driver?.email ?? (vehicle.assigned_driver_id ? 'Assigned driver not in current Fleet roster' : 'Not assigned'),
              `${documents.length} document(s)`,
              <StatusBadge key="status" value={signal.value} tone={signal.tone} />,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/vehicles?vehicle=${vehicle.id}`)}>Open vehicle</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No vehicles in the fleet" />}
        />
      </Panel>
    </PageFrame>
  );
}
