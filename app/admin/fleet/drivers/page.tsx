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

const isDriverAccountEligible = (status: string | null | undefined) => {
  const value = normalise(status);
  return Boolean(value) && !['suspended', 'inactive', 'rejected'].includes(value);
};

export default function FleetDriversPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const vehicleByDriver = useMemo(() => {
    const map = new Map<string, (typeof data.vehicles)[number]>();
    for (const vehicle of data.vehicles) {
      if (vehicle.assigned_driver_id && !map.has(vehicle.assigned_driver_id)) map.set(vehicle.assigned_driver_id, vehicle);
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
        description="Driver, vehicle, position, live work and document readiness in one dense Fleet register."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage drivers</ActionButton>}
      />

      <Panel title="Driver operations register" description="Operational status only; create, edit, suspend and access-management actions remain in the existing Drivers administration page.">
        <DataTable
          columns={['Driver', 'Vehicle', 'Location', 'Status', 'Current job', 'Documents', 'Action']}
          rows={data.drivers.map((driver) => {
            const vehicle = vehicleByDriver.get(driver.id);
            const location = latestLocationByDriver.get(driver.id);
            const job = jobByDriver.get(driver.id);
            const documents = documentCountByDriver.get(driver.id) ?? 0;
            const accountEligible = isDriverAccountEligible(driver.status);
            const operationallyAvailable = accountEligible && normalise(driver.availability_status) === 'available';
            return [
              <span key="driver"><strong style={{ display: 'block' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span>{driver.phone ?? driver.email ?? 'No contact supplied'}</span></span>,
              vehicle ? `${vehicle.reg_plate ?? 'No registration'} · ${(vehicle.type ?? 'type unknown').replace(/_/g, ' ')}` : 'No assigned vehicle',
              location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} · ${when(location.recorded_at ?? location.updated_at)}` : 'Location unavailable',
              <span key="status" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><StatusBadge value={driver.availability_status ?? 'offline'} tone={operationallyAvailable ? 'green' : undefined} /><StatusBadge value={accountEligible ? 'eligible account' : (driver.status ? `account ${driver.status}` : 'account status unavailable')} tone={accountEligible ? 'green' : 'red'} /></span>,
              job ? `${job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'} · ${(job.current_status ?? job.status).replace(/_/g, ' ')}` : 'No job currently in execution',
              documents > 0 ? `${documents} document(s)` : 'No documents recorded',
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)}>Manage</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No drivers in the Fleet roster" />}
        />
      </Panel>
    </PageFrame>
  );
}
