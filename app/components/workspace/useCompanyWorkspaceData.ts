'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

export type WorkspaceJob = {
  id: string;
  company_id: string;
  status: string;
  current_status?: string | null;
  pickup_location: string | null;
  pickup_postcode?: string | null;
  delivery_location: string | null;
  delivery_postcode?: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  assigned_driver_id?: string | null;
  awarded_carrier_company_id?: string | null;
  budget_amount?: number | null;
  delivery_photos?: string[] | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
};

export type WorkspaceBid = {
  id: string;
  job_id: string;
  company_id: string | null;
  status: string;
  amount: number | null;
  bid_price_gbp: number | null;
  created_at: string;
  message?: string | null;
  companies?: { name?: string | null } | null;
};

export type WorkspaceInvoice = {
  id: string;
  company_id?: string | null;
  buyer_company_id?: string | null;
  job_id?: string | null;
  invoice_number?: string | null;
  status: string;
  payment_status?: string | null;
  delivery_state?: string | null;
  amount: number | null;
  due_date?: string | null;
  created_at: string;
  client_name?: string | null;
};

export type WorkspaceDriver = {
  id: string;
  display_name: string | null;
  email?: string | null;
  phone?: string | null;
  status: string | null;
  availability_status: string | null;
  user_id?: string | null;
};

export type WorkspaceVehicle = {
  id: string;
  reg_plate: string | null;
  type: string | null;
  make?: string | null;
  model?: string | null;
  assigned_driver_id?: string | null;
};

export type WorkspaceDocument = {
  id: string;
  status: string | null;
  expiry_date: string | null;
  doc_type?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
};

export type WorkspaceLocation = {
  id: string;
  driver_id: string;
  job_id?: string | null;
  lat: number;
  lng: number;
  recorded_at?: string | null;
  updated_at?: string | null;
};

type WorkspaceDataState = {
  companyId: string | null;
  loading: boolean;
  error: string;
  jobs: WorkspaceJob[];
  bids: WorkspaceBid[];
  invoices: WorkspaceInvoice[];
  drivers: WorkspaceDriver[];
  vehicles: WorkspaceVehicle[];
  driverDocuments: WorkspaceDocument[];
  vehicleDocuments: WorkspaceDocument[];
  locations: WorkspaceLocation[];
  refresh: () => Promise<void>;
};

type QueryResult<T> = { data: T[] | null; error: { message?: string | null } | null };

const safeRows = <T,>(result: QueryResult<T>, errors: string[]): T[] => {
  if (result.error?.message) errors.push(result.error.message);
  return result.data ?? [];
};

const uniqueById = <T extends { id: string }>(rows: T[]): T[] => {
  const byId = new Map<string, T>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
};

const customerInvoiceVisible = (invoice: WorkspaceInvoice) => {
  const status = String(invoice.status ?? '').toLowerCase();
  const paymentStatus = String(invoice.payment_status ?? '').toLowerCase();
  const deliveryState = String(invoice.delivery_state ?? '').toLowerCase();
  return !['pending', 'draft', 'cancelled'].includes(status)
    && Number(invoice.amount ?? 0) > 0
    && Boolean(invoice.client_name?.trim())
    && (deliveryState === 'sent' || status === 'paid' || paymentStatus === 'paid');
};

export function useCompanyWorkspaceData(): WorkspaceDataState {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(user?.companyId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<WorkspaceJob[]>([]);
  const [bids, setBids] = useState<WorkspaceBid[]>([]);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [drivers, setDrivers] = useState<WorkspaceDriver[]>([]);
  const [vehicles, setVehicles] = useState<WorkspaceVehicle[]>([]);
  const [driverDocuments, setDriverDocuments] = useState<WorkspaceDocument[]>([]);
  const [vehicleDocuments, setVehicleDocuments] = useState<WorkspaceDocument[]>([]);
  const [locations, setLocations] = useState<WorkspaceLocation[]>([]);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!user?.id) return;
      const resolved = await resolveActiveCompanyId({
        userId: user.id,
        fallbackCompanyId: user.companyId ?? null,
      });
      if (!cancelled) setCompanyId(resolved ?? null);
    };
    void resolve();
    return () => { cancelled = true; };
  }, [user?.id, user?.companyId]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) {
      setLoading(false);
      setError(companyId ? '' : 'This account is not linked to a company workspace.');
      return;
    }

    setLoading(true);
    setError('');
    const errors: string[] = [];

    const jobsRes = await supabase
      .from('jobs')
      .select('id, company_id, status, current_status, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, vehicle_type, assigned_driver_id, awarded_carrier_company_id, budget_amount, delivery_photos, created_at, updated_at, client_name')
      .or(`company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`)
      .order('updated_at', { ascending: false })
      .limit(500);

    const allJobs = safeRows<WorkspaceJob>(jobsRes as QueryResult<WorkspaceJob>, errors);
    const jobIds = allJobs.map((job) => job.id);

    const [ownBidsRes, receivedBidsRes, invoicesRes, driversRes, vehiclesRes, locationsRes] = await Promise.all([
      supabase
        .from('job_bids')
        .select('id, job_id, company_id, status, amount, bid_price_gbp, created_at, message, companies:companies!job_bids_company_id_fkey(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500),
      jobIds.length > 0
        ? supabase
          .from('job_bids')
          .select('id, job_id, company_id, status, amount, bid_price_gbp, created_at, message, companies:companies!job_bids_company_id_fkey(name)')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false })
          .limit(1000)
        : Promise.resolve({ data: [] as WorkspaceBid[], error: null }),
      supabase
        .from('invoices')
        .select('id, company_id, buyer_company_id, job_id, invoice_number, status, payment_status, delivery_state, amount, due_date, created_at, client_name')
        .or(`company_id.eq.${companyId},buyer_company_id.eq.${companyId}`)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('drivers')
        .select('id, display_name, email, phone, status, availability_status, user_id')
        .eq('company_id', companyId)
        .order('display_name', { ascending: true })
        .limit(500),
      supabase
        .from('vehicles')
        .select('id, reg_plate, type, make, model, assigned_driver_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('driver_locations')
        .select('id, driver_id, lat, lng, recorded_at, updated_at')
        .eq('company_id', companyId)
        .order('recorded_at', { ascending: false })
        .limit(500),
    ]);

    const driverRows = safeRows<WorkspaceDriver>(driversRes as QueryResult<WorkspaceDriver>, errors);
    const vehicleRows = safeRows<WorkspaceVehicle>(vehiclesRes as QueryResult<WorkspaceVehicle>, errors);
    const driverIds = driverRows.map((driver) => driver.id);
    const vehicleIds = vehicleRows.map((vehicle) => vehicle.id);

    const [driverDocsRes, vehicleDocsRes] = await Promise.all([
      driverIds.length > 0
        ? supabase
          .from('driver_documents')
          .select('id, driver_id, doc_type, status, expiry_date')
          .in('driver_id', driverIds)
          .order('expiry_date', { ascending: true })
          .limit(1000)
        : Promise.resolve({ data: [] as WorkspaceDocument[], error: null }),
      vehicleIds.length > 0
        ? supabase
          .from('vehicle_documents')
          .select('id, vehicle_id, doc_type, status, expiry_date')
          .in('vehicle_id', vehicleIds)
          .order('expiry_date', { ascending: true })
          .limit(1000)
        : Promise.resolve({ data: [] as WorkspaceDocument[], error: null }),
    ]);

    const ownBids = safeRows<WorkspaceBid>(ownBidsRes as QueryResult<WorkspaceBid>, errors);
    const receivedBids = safeRows<WorkspaceBid>(receivedBidsRes as QueryResult<WorkspaceBid>, errors);
    const invoiceRows = safeRows<WorkspaceInvoice>(invoicesRes as QueryResult<WorkspaceInvoice>, errors);

    setJobs(allJobs);
    setBids(uniqueById([...ownBids, ...receivedBids]).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    setInvoices(invoiceRows.filter((invoice) =>
      invoice.company_id === companyId
      || (invoice.buyer_company_id === companyId && customerInvoiceVisible(invoice))
    ));
    setDrivers(driverRows);
    setVehicles(vehicleRows);
    setDriverDocuments(safeRows<WorkspaceDocument>(driverDocsRes as QueryResult<WorkspaceDocument>, errors));
    setVehicleDocuments(safeRows<WorkspaceDocument>(vehicleDocsRes as QueryResult<WorkspaceDocument>, errors));
    setLocations(safeRows<WorkspaceLocation>(locationsRes as QueryResult<WorkspaceLocation>, errors));
    setError(errors.length > 0 ? `Some workspace data could not be loaded: ${errors[0]}` : '');
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    companyId,
    loading,
    error,
    jobs,
    bids,
    invoices,
    drivers,
    vehicles,
    driverDocuments,
    vehicleDocuments,
    locations,
    refresh,
  };
}
