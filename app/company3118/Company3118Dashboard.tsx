'use client';

import { useMemo } from 'react';
import { useCompanyWorkspaceData } from '../components/workspace/useCompanyWorkspaceData';
import DemoCompanyDashboard from './components/DemoCompanyDashboard';

export default function Company3118Dashboard() {
  const data = useCompanyWorkspaceData();
  const driverNames = useMemo(() => new Map(data.drivers.map(driver => [driver.id, driver.display_name || 'Assigned driver'])), [data.drivers]);
  const vehicles = useMemo(() => new Map(data.vehicles.map(vehicle => [vehicle.id, vehicle])), [data.vehicles]);
  const jobs = useMemo(() => data.jobs.map(job => {
    const rawStatus = (job.current_status || job.status || '').toLowerCase();
    const completed = ['completed', 'delivered'].includes(rawStatus);
    const inProgress = ['in_progress', 'in_transit', 'loaded', 'on_my_way', 'collected', 'on_site_pickup', 'on_site_delivery'].includes(rawStatus);
    const pod = Boolean(job.pod_generated || job.pod_generated_at || job.has_delivery_evidence || job.delivery_signature_data);
    const vehicle = job.vehicle_id ? vehicles.get(job.vehicle_id) : null;
    return {
      id: job.id,
      from: job.pickup_location || job.pickup_postcode || 'Collection not recorded',
      to: job.delivery_location || job.delivery_postcode || 'Delivery not recorded',
      vehicle: job.vehicle_type?.replaceAll('_', ' ') || vehicle?.type || 'Not recorded',
      cargo: [job.pallets == null ? '' : job.pallets + ' pallets', job.weight_kg == null ? '' : job.weight_kg + ' kg'].filter(Boolean).join(' · ') || 'Cargo details not recorded',
      company: job.client_name || 'Customer not recorded',
      status: completed ? 'Completed' : inProgress ? 'In Progress' : job.assigned_driver_id ? 'Allocated' : 'Open',
      price: job.budget_amount ?? 0,
      driver: job.assigned_driver_id ? driverNames.get(job.assigned_driver_id) || 'Assigned driver' : '',
      vehicleId: vehicle?.reg_plate || '',
      stage: completed ? 8 : inProgress ? 4 : 0,
      pod,
    };
  }), [data.jobs, driverNames, vehicles]);
  const fleet = data.vehicles.map(vehicle => ({
    id: vehicle.id,
    reg: vehicle.reg_plate || 'Not recorded',
    type: vehicle.type?.replaceAll('_', ' ') || 'Not recorded',
    driver: vehicle.assigned_driver_id ? driverNames.get(vehicle.assigned_driver_id) || 'Assigned driver' : '',
    area: 'Position not recorded',
    status: 'Not verified',
  }));
  const drivers = data.drivers.map(driver => driver.display_name || 'Unnamed driver');
  const outstanding = data.datasets.invoices.availability === 'available'
    ? data.invoices.filter(invoice => !['paid', 'cancelled', 'void'].includes((invoice.payment_status || invoice.status || '').toLowerCase()))
      .reduce((total, invoice) => total + Number(invoice.amount || 0), 0)
    : null;
  if (data.loading && !data.jobs.length) return <p role="status">Loading company operations…</p>;
  if (data.error && !data.jobs.length) return <p role="alert">Company operations are unavailable: {data.error}</p>;
  return <DemoCompanyDashboard jobs={jobs} fleet={fleet} drivers={drivers}
    outstanding={outstanding} liveMode go={(index) => {
      const targets = ['/admin','/admin/post-load','/admin/marketplace','/admin/exchange','/admin/won-work','/admin/fleet','/admin/drivers','/admin/diary','/admin/invoices'];
      if (typeof window !== 'undefined' && targets[index]) window.location.assign(targets[index]);
    }} />;
}
