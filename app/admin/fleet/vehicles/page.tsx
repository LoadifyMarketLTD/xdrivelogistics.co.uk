'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { useFleetAvailabilityPresence } from '../../../components/workspace/useFleetAvailabilityPresence';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const daysUntil = (value: string | null | undefined) => value
  ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)
  : null;

export default function FleetVehiclesPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const presence = useFleetAvailabilityPresence(data.companyId);
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

  const documentSignal = (documents: (typeof data.vehicleDocuments)) => {
    if (!documents.length) return { label: 'documents missing', tone: 'red' as const };
    if (documents.some((document) => {
      const days = daysUntil(document.expiry_date);
      return ['rejected', 'expired'].includes(normalise(document.status)) || (days !== null && days < 0);
    })) return { label: 'document attention', tone: 'red' as const };
    if (documents.some((document) => {
      const status = normalise(document.status);
      const days = daysUntil(document.expiry_date);
      return ['pending', 'under_review'].includes(status) || (days !== null && days <= 30);
    })) return { label: 'review required', tone: 'orange' as const };
    return { label: 'documents recorded', tone: 'blue' as const };
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Vehicles"
        description="Vehicle identity, driver assignment, document signals and live published Fleet availability. Canonical operational eligibility is enforced server-side."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/vehicles')}>Manage vehicles</ActionButton>}
      />
      {presence.error && <AlertBanner tone="warning">{presence.error}</AlertBanner>}
      <Panel title="Vehicle operations register" description="A vehicle is shown as available now only when its assigned active driver has a current published Fleet presence. Unassigned does not mean available, and allocation still revalidates canonical driver + vehicle compliance server-side.">
        <DataTable
          columns={['Vehicle', 'Type', 'Registration', 'Driver', 'Document signal', 'MOT', 'Insurance', 'Operational availability']}
          rows={data.vehicles.map((vehicle) => {
            const documents = documentsByVehicle.get(vehicle.id) ?? [];
            const driver = vehicle.assigned_driver_id ? driverById.get(vehicle.assigned_driver_id) : undefined;
            const publishedPresence = vehicle.assigned_driver_id ? presence.byDriverId.get(vehicle.assigned_driver_id) : undefined;
            const driverAvailable = normalise(driver?.status) === 'active' && normalise(driver?.availability_status) === 'available';
            const availableNow = Boolean(driverAvailable && publishedPresence);
            const mot = documentOfType(vehicle.id, 'mot');
            const insurance = documentOfType(vehicle.id, 'insurance');
            const signal = documentSignal(documents);
            const docValue = (document: (typeof data.vehicleDocuments)[number] | undefined) => {
              if (!document) return 'Not recorded';
              const days = daysUntil(document.expiry_date);
              return `${document.status ?? 'status unavailable'}${document.expiry_date ? ` · ${document.expiry_date}${days !== null ? ` (${days}d)` : ''}` : ''}`;
            };
            const availabilityLabel = availableNow
              ? 'available now'
              : !driver
                ? 'unassigned'
                : driverAvailable
                  ? 'available · location not published'
                  : `driver ${driver.availability_status ?? 'offline'}`;
            return [
              <strong key="vehicle">{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || (vehicle.type ?? 'Vehicle').replace(/_/g, ' ')}</strong>,
              (vehicle.type ?? 'Not specified').replace(/_/g, ' '),
              vehicle.reg_plate ?? 'Not recorded',
              driver?.display_name ?? driver?.email ?? 'Unassigned',
              <StatusBadge key="status" value={signal.label} tone={signal.tone} />,
              docValue(mot),
              docValue(insurance),
              <StatusBadge key="availability" value={availabilityLabel} tone={availableNow ? 'green' : driverAvailable ? 'orange' : 'grey'} />,
            ];
          })}
          empty={<EmptyState title="No vehicles in the Fleet" />}
        />
      </Panel>
    </PageFrame>
  );
}
