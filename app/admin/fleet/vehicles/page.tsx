'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const daysUntil = (value: string | null | undefined) => value
  ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)
  : null;
const VERIFIED_DOCUMENT_STATUSES = new Set(['approved', 'valid', 'verified', 'current']);

export default function FleetVehiclesPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);

  const documentsByVehicle = useMemo(() => {
    const map = new Map<string, (typeof data.vehicleDocuments)>();
    for (const document of data.vehicleDocuments) {
      if (!document.vehicle_id) continue;
      const rows = map.get(document.vehicle_id) ?? [];
      rows.push(document);
      map.set(document.vehicle_id, rows);
    }
    return map;
  }, [data.vehicleDocuments]);

  const documentOfType = (vehicleId: string, needle: string) =>
    (documentsByVehicle.get(vehicleId) ?? []).find((document) => normalise(document.doc_type).includes(needle));

  const readiness = (documents: (typeof data.vehicleDocuments)) => {
    if (!documents.length) return { label: 'documents missing', tone: 'red' as const };
    if (documents.some((document) => {
      const days = daysUntil(document.expiry_date);
      return ['rejected', 'expired'].includes(normalise(document.status)) || (days !== null && days < 0);
    })) return { label: 'blocked / expired', tone: 'red' as const };
    if (documents.some((document) => {
      const status = normalise(document.status);
      const days = daysUntil(document.expiry_date);
      return ['pending', 'under_review'].includes(status) || (days !== null && days <= 30);
    })) return { label: 'attention required', tone: 'orange' as const };
    if (documents.every((document) => VERIFIED_DOCUMENT_STATUSES.has(normalise(document.status)))) {
      return { label: 'evidence current', tone: 'green' as const };
    }
    return { label: 'verification unclear', tone: 'orange' as const };
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Vehicles"
        description="Vehicle identity, driver assignment and document readiness in one dense Fleet register. Operational vehicle availability is shown only when a verified source exists."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/vehicles')}>Manage vehicles</ActionButton>}
      />
      <Panel title="Vehicle operations register" description="Unassigned does not mean available. The current verified Fleet dataset does not expose an operational vehicle-availability state, so no availability is inferred from driver assignment.">
        <DataTable
          columns={['Vehicle', 'Type', 'Registration', 'Driver', 'Document readiness', 'MOT', 'Insurance', 'Operational availability']}
          rows={data.vehicles.map((vehicle) => {
            const documents = documentsByVehicle.get(vehicle.id) ?? [];
            const driver = vehicle.assigned_driver_id ? driverById.get(vehicle.assigned_driver_id) : undefined;
            const mot = documentOfType(vehicle.id, 'mot');
            const insurance = documentOfType(vehicle.id, 'insurance');
            const documentReadiness = readiness(documents);
            const docValue = (document: (typeof data.vehicleDocuments)[number] | undefined) => {
              if (!document) return 'Not recorded';
              const days = daysUntil(document.expiry_date);
              return `${document.status ?? 'status unavailable'}${document.expiry_date ? ` · ${document.expiry_date}${days !== null ? ` (${days}d)` : ''}` : ''}`;
            };
            return [
              <strong key="vehicle">{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || (vehicle.type ?? 'Vehicle').replace(/_/g, ' ')}</strong>,
              (vehicle.type ?? 'Not specified').replace(/_/g, ' '),
              vehicle.reg_plate ?? 'Not recorded',
              driver?.display_name ?? driver?.email ?? 'Unassigned',
              <StatusBadge key="status" value={documentReadiness.label} tone={documentReadiness.tone} />,
              docValue(mot),
              docValue(insurance),
              <StatusBadge key="availability" value="Not exposed" tone="grey" />,
            ];
          })}
          empty={<EmptyState title="No vehicles in the Fleet" />}
        />
      </Panel>
    </PageFrame>
  );
}
