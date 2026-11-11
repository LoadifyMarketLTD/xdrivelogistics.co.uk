'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany3150Live } from '../../try-xdrive-demo/components/Company3150LiveData';
import DemoCompanyDashboard from '../../try-xdrive-demo/components/DemoCompanyDashboard';
import { masterNavigationHref } from '../../../lib/masterWorkspaceNavigation';
import { jobLifecyclePresentationGroup } from '../../../lib/jobs/jobLifecyclePresentation';
import { workspaceJobPresentationStatus } from '../../../lib/jobs/workspaceJobStage';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { supabase } from '../../../lib/supabaseClient';
import {hasCompletePodEvidence} from '../../../lib/jobs/podCompletion';

/**
 * Master Workspace 3150 Dashboard. The 3150 visual component is preserved;
 * all records are read exclusively from the authenticated company dataset.
 */
export default function OwnerDriver3150LiveDashboard() {
  const live = useCompany3150Live();
  const router = useRouter();
  const [verifiedFleet, setVerifiedFleet] = useState<{
    vehicles: { id: string; is_available?: boolean | null }[];
    drivers: { id: string; display_name?: string | null; availability_status: string | null }[];
    limited: boolean;
  } | null>(null);
  const [verifiedOutstanding, setVerifiedOutstanding] = useState<number | null | undefined>(undefined);
  const companyId = live?.data.companyId ?? null;

  useEffect(() => {
    let active = true;
    setVerifiedFleet(null);
    setVerifiedOutstanding(undefined);
    if (!companyId) return () => { active = false; };
    const load = async () => {
      const token = readRouteAuthAccessToken() ?? (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        if (active) setVerifiedOutstanding(null);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const [fleetResult, financeResult] = await Promise.allSettled([
        fetch(`/api/workspace/fleet-overview?companyId=${encodeURIComponent(companyId)}&includeDocuments=false`, { headers, cache: 'no-store' }),
        fetch('/api/driver/finance/invoices?view=receivables&limit=500', { headers, cache: 'no-store' }),
      ]);
      if (!active) return;
      if (fleetResult.status === 'fulfilled' && fleetResult.value.ok) {
        const body = await fleetResult.value.json().catch(() => null) as {
          companyId?: string; vehicles?: { id: string }[];
          drivers?: { id: string; display_name?: string | null; availability_status: string | null }[];
          limited?: boolean;
        } | null;
        if (active && body?.companyId === companyId && Array.isArray(body.vehicles) && Array.isArray(body.drivers)) {
          setVerifiedFleet({ vehicles: body.vehicles, drivers: body.drivers, limited: body.limited === true });
        }
      }
      if (financeResult.status === 'fulfilled' && financeResult.value.ok) {
        const body = await financeResult.value.json().catch(() => null) as {
          valueSummary?: { outstanding?: number }; invoiceSummary?: { total?: number };
        } | null;
        const amount = body?.valueSummary?.outstanding;
        if (active) setVerifiedOutstanding(typeof amount === 'number' && Number.isFinite(amount) && (body?.invoiceSummary?.total ?? 501) <= 500 ? amount : null);
      } else if (active) {
        setVerifiedOutstanding(null);
      }
    };
    void load().catch(() => { if (active) setVerifiedOutstanding(null); });
    return () => { active = false; };
  }, [companyId]);
  const jobs = useMemo(() => (live?.data.jobs ?? []).map((job) => {
    const stage = jobLifecyclePresentationGroup(workspaceJobPresentationStatus(job));
    const pod = hasCompletePodEvidence(job);
    return {
      id: job.id,
      from: job.pickup_location || job.pickup_postcode || 'Collection not recorded',
      to: job.delivery_location || job.delivery_postcode || 'Delivery not recorded',
      vehicle: job.vehicle_type?.replaceAll('_', ' ') || 'Vehicle not recorded',
      cargo: [job.pallets == null ? null : `${job.pallets} pallets`, job.weight_kg == null ? null : `${job.weight_kg} kg`].filter(Boolean).join(' | ') || 'Cargo not recorded',
      company: job.client_name || 'Customer not recorded',
      status: stage === 'completed' ? 'Completed' : stage === 'active' ? 'In Progress' : stage === 'upcoming' ? 'Allocated' : stage === 'cancelled' ? 'Cancelled' : 'Open',
      price: Number(job.budget_amount ?? 0),
      driver: job.assigned_driver_id ? (live?.data.drivers.find((driver) => driver.id === job.assigned_driver_id)?.display_name || verifiedFleet?.drivers.find((driver) => driver.id === job.assigned_driver_id)?.display_name || 'Assigned driver') : '',
      vehicleId: live?.data.vehicles.find((vehicle) => vehicle.id === job.vehicle_id)?.reg_plate || '',
      stage: stage === 'completed' ? 7 : stage === 'active' ? 3 : 0,
      pod,
    };
  }), [live, verifiedFleet]);
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
    verifiedFleet={verifiedFleet}
    verifiedOutstanding={verifiedOutstanding}
  />;
}