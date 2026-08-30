'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { useFleetAvailabilityPresence } from '../../../components/workspace/useFleetAvailabilityPresence';
import {
  ActionButton,
  AlertBanner,
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
        description="Driver, vehicle assignment signals, active-job tracking or published idle position, live work and document readiness in one Fleet register."
        actions={(
          <>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/live-availability')}>Live Positions</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage drivers</ActionButton>
          </>
        )}
      />

      {presence.error && <AlertBanner tone="warning">{presence.error}</AlertBanner>}
      <Panel title="Driver operations register" description="Own-Fleet location combines active-job tracking with explicitly published idle availability. Create, edit, suspend and access-management actions remain in the existing Drivers administration page; canonical active vehicle eligibility is resolved server-side.">
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
              location ? <span key="location"><strong style={{ display: 'block' }}>Position received</strong><span>{when(location.recorded_at ?? location.updated_at)}</span></span> : 'Location unavailable',
              <span key="status" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><StatusBadge value={driver.availability_status ?? 'offline'} tone={operationallyAvailable ? 'green' : undefined} /><StatusBadge value={accountActive ? 'active account' : (driver.status ? `account ${driver.status}` : 'account status unavailable')} tone={accountActive ? 'blue' : 'red'} /></span>,
              job ? `${job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → ${job.delivery_postcode ?? job.delivery_location ?? 'Delivery'} · ${(job.current_status ?? job.status).replace(/_/g, ' ')}` : 'No job currently in execution',
              documents > 0 ? `${documents} document(s)` : 'No documents recorded',
              <span key="action" style={{ display: 'inline-flex', gap: 4 }}>
                {location && <ActionButton tone="secondary" onClick={() => router.push('/admin/live-availability')}>Locate</ActionButton>}
                <ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage</ActionButton>
              </span>,
            ];
          })}
          empty={<EmptyState title="No drivers in the Fleet roster" />}
        />
      </Panel>
    </PageFrame>
  );
}
