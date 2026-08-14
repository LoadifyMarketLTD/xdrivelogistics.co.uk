'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const ACTIVE_JOB_STATUSES = new Set([
  'awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);

export default function FleetAvailabilityPage() {
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

  const activeJobByDriver = useMemo(() => {
    const map = new Map<string, (typeof data.jobs)[number]>();
    for (const job of data.jobs) {
      if (!job.assigned_driver_id || job.awarded_carrier_company_id !== data.companyId) continue;
      if (!ACTIVE_JOB_STATUSES.has(normalise(job.current_status ?? job.status))) continue;
      if (!map.has(job.assigned_driver_id)) map.set(job.assigned_driver_id, job);
    }
    return map;
  }, [data.companyId, data.jobs]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet capacity"
        title="Availability"
        description="Current driver availability, assigned vehicle, latest position and live Fleet workload in one operational matrix."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/driver-availability')}>Manage availability</ActionButton>}
      />
      <Panel title="Fleet availability matrix" description="This view reports existing status and readiness data; it does not infer capacity that XDrive has not recorded.">
        <DataTable
          columns={['Driver', 'Availability', 'Vehicle', 'Location', 'Current Job', 'Documents', 'Action']}
          rows={data.drivers.map((driver) => {
            const vehicle = vehicleByDriver.get(driver.id);
            const location = latestLocationByDriver.get(driver.id);
            const job = activeJobByDriver.get(driver.id);
            const docs = data.driverDocuments.filter((document) => document.driver_id === driver.id);
            return [
              <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
              <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={normalise(driver.availability_status) === 'available' ? 'green' : undefined} />,
              vehicle ? `${vehicle.reg_plate ?? 'No registration'} · ${(vehicle.type ?? 'type unknown').replace(/_/g, ' ')}` : 'No assigned vehicle',
              location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Location unavailable',
              job ? `${job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}` : 'No active Fleet job',
              docs.length ? `${docs.length} document(s)` : 'No documents recorded',
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)}>Review</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No drivers available for Fleet planning" />}
        />
      </Panel>
    </PageFrame>
  );
}
