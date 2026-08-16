'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
// Presentation-only account-state signal. Full operational eligibility is
// revalidated by the canonical server contract before quoting/allocation.
const isDriverAccountActive = (status: string | null | undefined) => normalise(status) === 'active';

type FleetDriverWorkStage = 'allocation_incomplete' | 'allocated' | 'active';
const WORK_STAGE_RANK: Record<FleetDriverWorkStage, number> = {
  allocation_incomplete: 0,
  allocated: 1,
  active: 2,
};

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

  const workByDriver = useMemo(() => {
    const map = new Map<string, { job: (typeof data.jobs)[number]; stage: FleetDriverWorkStage }>();
    for (const job of data.jobs) {
      if (!job.assigned_driver_id || job.awarded_carrier_company_id !== data.companyId) continue;
      const stage = classifyWorkspaceJobStage(job);
      if (!['awarded', 'allocated', 'in_progress'].includes(stage)) continue;
      const value: FleetDriverWorkStage = stage === 'in_progress'
        ? 'active'
        : stage === 'allocated'
          ? 'allocated'
          : 'allocation_incomplete';
      const current = map.get(job.assigned_driver_id);
      if (!current || WORK_STAGE_RANK[value] > WORK_STAGE_RANK[current.stage]) {
        map.set(job.assigned_driver_id, { job, stage: value });
      }
    }
    return map;
  }, [data.companyId, data.jobs]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet capacity"
        title="Availability"
        description="Current driver availability, assigned vehicle, latest position and Fleet workload in one operational matrix."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/driver-availability')}>Manage availability</ActionButton>}
      />
      <Panel title="Fleet availability matrix" description="This view reports existing status and readiness data; it does not infer capacity that XDrive has not recorded.">
        <DataTable
          columns={['Driver', 'Availability', 'Vehicle', 'Location', 'Current / assigned job', 'Documents', 'Action']}
          rows={data.drivers.map((driver) => {
            const vehicle = vehicleByDriver.get(driver.id);
            const location = latestLocationByDriver.get(driver.id);
            const work = workByDriver.get(driver.id);
            const docs = data.driverDocuments.filter((document) => document.driver_id === driver.id);
            const accountActive = isDriverAccountActive(driver.status);
            const operationallyAvailable = accountActive && normalise(driver.availability_status) === 'available';
            return [
              <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
              <span key="availability" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><StatusBadge value={driver.availability_status ?? 'offline'} tone={operationallyAvailable ? 'green' : undefined} /><StatusBadge value={accountActive ? 'active account' : driver.status ? `account ${driver.status}` : 'account status unavailable'} tone={accountActive ? 'blue' : 'red'} /></span>,
              vehicle ? `${vehicle.reg_plate ?? 'No registration'} · ${(vehicle.type ?? 'type unknown').replace(/_/g, ' ')}` : 'No assigned vehicle',
              location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Location unavailable',
              work ? <span key="work"><strong style={{ display: 'block' }}>{work.job.pickup_postcode ?? work.job.pickup_location ?? 'Collection'} → {work.job.delivery_postcode ?? work.job.delivery_location ?? 'Delivery'}</strong><span>{work.stage === 'active' ? 'Execution in progress' : work.stage === 'allocated' ? 'Allocated / awaiting execution' : 'Allocation incomplete — driver + canonical vehicle required'}</span></span> : 'No current or allocated Fleet job',
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
