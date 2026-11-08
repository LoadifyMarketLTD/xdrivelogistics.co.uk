'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany3150Live } from '../../try-xdrive-demo/components/Company3150LiveData';
import DemoCompanyDashboard from '../../try-xdrive-demo/components/DemoCompanyDashboard';
import { masterNavigationHref } from '../../../lib/masterWorkspaceNavigation';
import { jobLifecyclePresentationGroup } from '../../../lib/jobs/jobLifecyclePresentation';
import { workspaceJobPresentationStatus } from '../../../lib/jobs/workspaceJobStage';

/**
 * Master Workspace 3150 Dashboard. The 3150 visual component is preserved;
 * all records are read exclusively from the authenticated company dataset.
 */
export default function OwnerDriver3150LiveDashboard() {
  const live = useCompany3150Live();
  const router = useRouter();
  const jobs = useMemo(() => (live?.data.jobs ?? []).map((job) => {
    const stage = jobLifecyclePresentationGroup(workspaceJobPresentationStatus(job));
    const pod = Boolean(job.pod_generated || job.pod_generated_at);
    return {
      id: job.id,
      from: job.pickup_location || job.pickup_postcode || 'Collection not recorded',
      to: job.delivery_location || job.delivery_postcode || 'Delivery not recorded',
      vehicle: job.vehicle_type?.replaceAll('_', ' ') || 'Vehicle not recorded',
      cargo: [job.pallets == null ? null : `${job.pallets} pallets`, job.weight_kg == null ? null : `${job.weight_kg} kg`].filter(Boolean).join(' | ') || 'Cargo not recorded',
      company: job.client_name || 'Customer not recorded',
      status: stage === 'completed' ? 'Completed' : stage === 'active' ? 'In Progress' : stage === 'upcoming' ? 'Allocated' : stage === 'cancelled' ? 'Cancelled' : 'Open',
      price: Number(job.budget_amount ?? 0),
      driver: live?.data.drivers.find((driver) => driver.id === job.assigned_driver_id)?.display_name || '',
      vehicleId: live?.data.vehicles.find((vehicle) => vehicle.id === job.vehicle_id)?.reg_plate || '',
      stage: stage === 'completed' ? 7 : stage === 'active' ? 3 : 0,
      pod,
    };
  }), [live]);
  const fleet = useMemo(() => (live?.data.vehicles ?? []).map((vehicle) => ({
    id: vehicle.id,
    reg: vehicle.reg_plate || 'Registration unavailable',
    type: vehicle.type || 'Not recorded',
    driver: live?.data.drivers.find((driver) => driver.id === vehicle.assigned_driver_id)?.display_name || 'Unassigned',
    area: 'Not recorded',
    status: 'Not verified',
  })), [live]);
  const drivers = useMemo(() => (live?.data.drivers ?? []).map((driver) => driver.display_name || 'Unnamed driver'), [live]);
  const go = (index: number) => {
    const target = masterNavigationHref('Owner Driver', index);
    if (target) router.push(target);
  };
  if (!live) return <p role="alert">The authenticated 3150 workspace dataset is unavailable.</p>;
  return <DemoCompanyDashboard
    workspaceLabel="Owner Driver"
    suppressPreview
    jobs={jobs}
    fleet={fleet}
    drivers={drivers}
    go={go}
    onOpenJob={(jobId) => router.push(`/driver/jobs/${encodeURIComponent(jobId)}`)}
  />;
}