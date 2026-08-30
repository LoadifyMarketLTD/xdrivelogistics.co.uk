'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { useFleetAvailabilityPresence } from '../../../components/workspace/useFleetAvailabilityPresence';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
// Presentation-only account-state signal. Full operational eligibility is
// revalidated by the canonical server contract before quoting/allocation.
const isDriverAccountActive = (status: string | null | undefined) => normalise(status) === 'active';

type FleetDriverWorkStage = 'awarded' | 'allocated' | 'in_progress';
const WORK_STAGE_RANK: Record<FleetDriverWorkStage, number> = {
  awarded: 0,
  allocated: 1,
  in_progress: 2,
};

export default function FleetAvailabilityPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const presence = useFleetAvailabilityPresence(data.companyId);

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
    for (const point of presence.points) {
      const current = map.get(point.driverId);
      const currentAt = current?.recorded_at ?? current?.updated_at ?? '';
      const nextAt = point.recordedAt ?? '';
      if (!current || nextAt > currentAt) {
        map.set(point.driverId, {
          id: `availability:${point.driverId}`,
          driver_id: point.driverId,
          job_id: null,
          lat: point.lat,
          lng: point.lng,
          recorded_at: point.recordedAt,
          updated_at: null,
        });
      }
    }
    return map;
  }, [data.locations, presence.points]);

  const workByDriver = useMemo(() => {
    const map = new Map<string, { job: (typeof data.jobs)[number]; stage: FleetDriverWorkStage }>();
    for (const job of data.jobs) {
      if (!job.assigned_driver_id || job.awarded_carrier_company_id !== data.companyId) continue;
      const stage = classifyWorkspaceJobStage(job);
      if (stage !== 'awarded' && stage !== 'allocated' && stage !== 'in_progress') continue;
      const current = map.get(job.assigned_driver_id);
      if (!current || WORK_STAGE_RANK[stage] > WORK_STAGE_RANK[current.stage]) {
        map.set(job.assigned_driver_id, { job, stage });
      }
    }
    return map;
  }, [data.companyId, data.jobs]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet capacity"
        title="Availability"
        description="Current driver availability, vehicle assignment signals, latest position and Fleet workload in one operational matrix."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/driver-availability')}>Manage availability</ActionButton>}
      />
      {presence.error && <AlertBanner tone="warning">{presence.error}</AlertBanner>}
      <Panel title="Fleet availability matrix" description="Active-job tracking and explicitly published idle availability are combined for your own Fleet only; full driver + canonical active vehicle eligibility is revalidated server-side before allocation.">
        <DataTable
          columns={['Driver', 'Availability', 'Vehicle', 'Location', 'Current / assigned job', 'Documents', 'Action']}
          rows={data.drivers.map((driver) => {
            const vehicles = vehiclesByDriver.get(driver.id) ?? [];
            const vehicle = vehicles.length === 1 ? vehicles[0] : undefined;
            const vehicleSignal = vehicles.length === 0
              ? 'No assigned vehicle'
              : vehicles.length > 1
                ? `${vehicles.length} assigned vehicles · canonical active vehicle resolved server-side`
                : `${vehicle?.reg_plate ?? 'No registration'} · ${(vehicle?.type ?? 'type unknown').replace(/_/g, ' ')}`;
            const location = latestLocationByDriver.get(driver.id);
            const work = workByDriver.get(driver.id);
            const docs = data.driverDocuments.filter((document) => document.driver_id === driver.id);
            const accountActive = isDriverAccountActive(driver.status);
            const operationallyAvailable = accountActive && normalise(driver.availability_status) === 'available';
            return [
              <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
              <span key="availability" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><StatusBadge value={driver.availability_status ?? 'offline'} tone={operationallyAvailable ? 'green' : undefined} /><StatusBadge value={accountActive ? 'active account' : driver.status ? `account ${driver.status}` : 'account status unavailable'} tone={accountActive ? 'blue' : 'red'} /></span>,
              vehicleSignal,
              location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Location unavailable',
              work ? <span key="work"><strong style={{ display: 'block' }}>{work.job.pickup_postcode ?? work.job.pickup_location ?? 'Collection'} → {work.job.delivery_postcode ?? work.job.delivery_location ?? 'Delivery'}</strong><span>{work.stage === 'in_progress' ? 'Execution in progress' : work.stage === 'allocated' ? 'Allocated / awaiting execution' : 'Allocation incomplete — driver + canonical vehicle required'}</span></span> : 'No current or allocated Fleet job',
              docs.length ? `${docs.length} document(s)` : 'No documents recorded',
              <ActionButton key="action" tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No drivers available for Fleet planning" />}
        />
      </Panel>
    </PageFrame>
  );
}
