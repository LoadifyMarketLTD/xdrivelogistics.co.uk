'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../../components/workspace/WorkspaceUI';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not supplied';

// Presentation-only account-state signal. Full operational eligibility remains
// authoritative on the server and also requires current onboarding/compliance
// plus exactly one compliant canonical vehicle.
const isDriverAccountActive = (status: string | null | undefined) => normalise(status) === 'active';

export default function FleetDriversPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const vehiclesByDriver = useMemo(() => {
    const map = new Map<string, (typeof data.vehicles)>();
    for (const vehicle of data.vehicles) {
      if (!vehicle.assigned_driver_id) continue;
      const rows = map.get(vehicle.assigned_driver_id) ?? [];
      rows.push(vehicle);
      map.set(vehicle.assigned_driver_id, rows);
    }
    return map;
  }, [data.vehicles]);

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, (typeof data.locations)[number]>();
    for (const location of data.locations) {
      const current = map.get(location.driver_id);
      const currentAt = current?.recorded_at ?? current?.updated_at ?? '';
      const nextAt = location.recorded_at ?? location.updated_at ?? '';
      if (!current || nextAt > currentAt) map.set(location.driver_id, location);
    }
    return map;
  }, [data.locations]);

  const jobByDriver = useMemo(() => {
    const map = new Map<string, (typeof data.jobs)[number]>();
    for (const job of data.jobs) {
      if (!job.assigned_driver_id || job.awarded_carrier_company_id !== data.companyId) continue;
      if (classifyWorkspaceJobStage(job) !== 'in_progress') continue;
      if (!map.has(job.assigned_driver_id)) map.set(job.assigned_driver_id, job);
    }
    return map;
  }, [data.companyId, data.jobs]);

  const documentCountByDriver = useMemo(() => {
    const map = new Map<string, number>();
    for (const document of data.driverDocuments) {
      if (document.driver_id) map.set(document.driver_id, (map.get(document.driver_id) ?? 0) + 1);
    }
    return map;
  }, [data.driverDocuments]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Drivers"
        description="Driver, vehicle assignment signals, position, live work and document readiness in one dense Fleet register."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage drivers</ActionButton>}
      />

      <Panel title="Driver operations register" description="Operational status only; create, edit, suspend and access-management actions remain in the existing Drivers administration page. Canonical active vehicle eligibility is resolved server-side.">
        <DataTable
          columns={['Driver', 'Vehicle', 'Location', 'Status', 'Current job', 'Documents', 'Action']}
          rows={data.drivers.map((driver) => {
            const vehicles = vehiclesByDriver.get(driver.id) ?? [];
            const vehicle = vehicles.length === 1 ? vehicles[0] : undefined;
            const vehicleSignal = vehicles.length === 0
              ? 'No assigned vehicle'
              : vehicles.length > 1
                ? `${vehicles.length} assigned vehicles · canonical active vehicle resolved server-side`
                : `${vehicle?.reg_plate ?? 'No registration'} · ${(vehicle?.type ?? 'type unknown').replace(/_/g, ' ')}`;
            const location = latestLocationByDriver.get(driver.id);
            const job = jobByDriver.get(driver.id);
            const documents = documentCountByDriver.get(driver.id) ?? 0;
            const accountActive = isDriverAccountActive(driver.status);
            const operationallyAvailable = accountActive && normalise(driver.availability_status) === 'available';
            return [
              <span key="driver"><strong style={{ display: 'block' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span>{driver.phone ?? driver.email ?? 'No contact supplied'}</span></span>,
              vehicleSignal,
              location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} · ${when(location.recorded_at ?? location.updated_at)}` : 'Location unavailable',
              <span key="status" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><StatusBadge value={driver.availability_status ?? 'offline'} tone={operationallyAvailable ? 'green' : undefined} /><StatusBadge value={accountActive ? 'active account' : (driver.status ? `account ${driver.status}` : 'account status unavailable')} tone={accountActive ? 'blue' : 'red'} /></span>,
              job ? `${job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'} · ${(job.current_status ?? job.status).replace(/_/g, ' ')}` : 'No job currently in execution',
              documents > 0 ? `${documents} document(s)` : 'No documents recorded',
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No drivers in the Fleet roster" />}
        />
      </Panel>
    </PageFrame>
  );
}
