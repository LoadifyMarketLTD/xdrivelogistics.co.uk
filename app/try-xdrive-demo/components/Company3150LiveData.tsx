'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  useCompanyWorkspaceData,
  type WorkspaceDataState,
  type WorkspaceJob,
} from '../../components/workspace/useCompanyWorkspaceData';
import type { DemoLoad } from './demoExchange';
import { public3150StoredLocation } from '../../../lib/jobs/public3150StoredLocation';

export type LiveQuote = {
  id: string;
  loadId: string;
  role: string;
  direction: "Received" | "Sent";
  amount: number;
  createdAt: string;
  status: 'Open' | 'Withdrawn' | 'Accepted' | 'Rejected';
  notes?: string;
  vehicle?: string;
  etaMinutes?: number;
  route?: { from: string; to: string; vehicle: string } | null;
};

export type Company3150LiveContextValue = {
  data: WorkspaceDataState;
  loads: DemoLoad[];
  bookings: DemoLoad[];
  quotes: LiveQuote[];
};

const Company3150Context = createContext<Company3150LiveContextValue | null>(null);
export const useCompany3150Live = () => useContext(Company3150Context);

function resolveJobStatus(job: WorkspaceJob): DemoLoad['status'] {
  const status = (job.current_status || job.status || '').toLowerCase();
  if (['cancelled', 'canceled'].includes(status)) return 'Cancelled';
  if (job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id ||
      ['awarded', 'allocated', 'assigned', 'in_progress', 'in transit', 'in_transit', 'collected', 'delivered', 'completed'].includes(status)) return 'Awarded';
  return 'Open';
}

function mapJob(job: WorkspaceJob, driverNames: Map<string, string>, publicLocations = false): DemoLoad {
  const hasPOD = Boolean(job.pod_generated || job.pod_generated_at ||
    job.has_delivery_evidence || job.delivery_signature_data ||
    job.pod_photos?.length || job.delivery_photos?.length);
  return {
    id: job.id,
    from: publicLocations ? public3150StoredLocation(job.pickup_location, job.pickup_postcode) : (job.pickup_location || job.pickup_postcode || 'Collection not specified'),
    to: publicLocations ? public3150StoredLocation(job.delivery_location, job.delivery_postcode) : (job.delivery_location || job.delivery_postcode || 'Delivery not specified'),
    vehicle: publicLocations && job.vehicle_type ? job.vehicle_type.replaceAll('_',' ').replace(/^./,x=>x.toUpperCase()) : (job.vehicle_type || 'Not specified'),
    pallets: job.pallets == null ? '' : String(job.pallets),
    weight: publicLocations ? (job.weight_kg != null ? String(job.weight_kg) : job.weight || '') : '',
    customer: job.client_name || 'Customer not recorded',
    sell: job.budget_amount == null ? '' : String(job.budget_amount),
    pickupDate: job.pickup_datetime?.slice(0, 10),
    deliveryDate: job.delivery_datetime?.slice(0, 10),
    pickupStart: job.pickup_datetime?.slice(11, 16),
    deliveryTime: job.delivery_datetime?.slice(11, 16),
    postedAt: job.created_at,
    paymentTerms: publicLocations ? (job.payment_terms || 'Not recorded') : undefined,
    service: publicLocations ? (job.load_type === 'on_demand' || job.load_type === 'on demand' ? 'On Demand' : job.load_type === 'same_day' ? 'Same Day' : job.load_type === 'next_day' ? 'Next Day' : (job.load_type || job.service_mode || 'Not recorded')) : undefined,
    packaging: publicLocations ? (job.packaging || job.cargo_type || undefined) : undefined,
    dimensions: publicLocations ? (job.dimensions || undefined) : undefined,
    displayId: publicLocations ? (job.load_reference || job.booking_reference || job.customer_reference || job.id.slice(0,8).toUpperCase()) : undefined,
    memberId: publicLocations ? 'Not recorded' : undefined,
    status: resolveJobStatus(job),
    quote: job.budget_amount ?? undefined,
    assignedDriver: job.assigned_driver_id ? driverNames.get(job.assigned_driver_id) || 'Assigned driver' : undefined,
    assignedVehicleId: job.vehicle_id || undefined,
    deliveryStage: hasPOD ? 7 : (job.current_status || '').toLowerCase().includes('deliver') ? 6 : undefined,
    podReceived: hasPOD,
    podPhotoCount: (job.pod_photos?.length || 0) + (job.delivery_photos?.length || 0),
    podRecipient: job.client_signature_name || undefined,
    podConfirmedAt: job.pod_generated_at || undefined,
    operationalStatus: job.current_status || job.status,
    readOnly: true,
  };
}

function mapBidStatus(status: string): LiveQuote['status'] {
  switch (status?.toLowerCase()) {
    case 'accepted':
    case 'awarded':
      return 'Accepted';
    case 'rejected':
    case 'declined':
      return 'Rejected';
    case 'cancelled':
    case 'canceled':
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return 'Open';
  }
}

export function Company3150LiveProvider({ children, publicLocations = false }: { children: ReactNode; publicLocations?: boolean }) {
  const data = useCompanyWorkspaceData();
  const value = useMemo<Company3150LiveContextValue>(() => {
    const driverNames = new Map(data.drivers.map(d => [d.id, d.display_name || 'Unnamed driver']));
    const loads = data.jobs.map(j => mapJob(j, driverNames, publicLocations));
    const bookings = loads.filter(l => l.status === 'Awarded' || l.podReceived ||
      ['completed', 'delivered'].includes((l.operationalStatus || '').toLowerCase()));
    const quotes = data.bids.map(b => ({
      id: b.id,
      loadId: b.job_id,
      role: 'Carrier',
      direction: data.jobs.find(j=>j.id===b.job_id)?.company_id===data.companyId?("Received" as const):("Sent" as const),
      amount: b.bid_price_gbp ?? b.amount ?? 0,
      createdAt: b.created_at,
      status: mapBidStatus(b.status),
      notes: b.message || undefined,
    }));
    return { data, loads, bookings, quotes };
  }, [data, publicLocations]);
  return <Company3150Context.Provider value={value}>{children}</Company3150Context.Provider>;
}
