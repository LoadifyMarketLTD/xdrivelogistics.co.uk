'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

export type WorkspaceJob = { id: string; company_id: string; status: string; current_status?: string | null; pickup_location: string | null; pickup_postcode?: string | null; delivery_location: string | null; delivery_postcode?: string | null; pickup_datetime: string | null; delivery_datetime: string | null; vehicle_type: string | null; assigned_driver_id?: string | null; awarded_carrier_company_id?: string | null; budget_amount?: number | null; delivery_photos?: string[] | null; created_at: string; updated_at: string; client_name?: string | null };
export type WorkspaceBid = { id: string; job_id: string; company_id: string | null; status: string; amount: number | null; bid_price_gbp: number | null; created_at: string; message?: string | null; companies?: { name?: string | null } | null };
export type WorkspaceInvoice = { id: string; company_id?: string | null; buyer_company_id?: string | null; job_id?: string | null; invoice_number?: string | null; status: string; payment_status?: string | null; amount: number | null; due_date?: string | null; created_at: string; client_name?: string | null };
export type WorkspaceDriver = { id: string; display_name: string | null; email?: string | null; phone?: string | null; status: string | null; availability_status: string | null; user_id?: string | null };
export type WorkspaceVehicle = { id: string; reg_plate: string | null; type: string | null; make?: string | null; model?: string | null; assigned_driver_id?: string | null };
export type WorkspaceDocument = { id: string; status: string | null; expiry_date: string | null; doc_type?: string | null; driver_id?: string | null; vehicle_id?: string | null };
export type WorkspaceLocation = { id: string; driver_id: string; job_id?: string | null; lat: number; lng: number; recorded_at?: string | null; updated_at?: string | null };
type QueryResult<T> = { data: T[] | null; error: { message?: string | null } | null };
const rows = <T,>(result: QueryResult<T>, errors: string[]) => { if (result.error?.message) errors.push(result.error.message); return result.data ?? []; };
const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map(item => [item.id, item])).values()];

export function useCompanyWorkspaceData() {
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

  useEffect(() => { let cancelled = false; if (user?.id) void resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null }).then(id => { if (!cancelled) setCompanyId(id ?? null); }); return () => { cancelled = true; }; }, [user?.id, user?.companyId]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) { setLoading(false); setError(companyId ? '' : 'This account is not linked to a company workspace.'); return; }
    setLoading(true); setError(''); const errors: string[] = [];
    const jobsRes = await supabase.from('jobs').select('id, company_id, status, current_status, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, vehicle_type, assigned_driver_id, awarded_carrier_company_id, budget_amount, delivery_photos, created_at, updated_at, client_name').or(`company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`).order('updated_at', { ascending: false }).limit(500);
    const jobRows = rows<WorkspaceJob>(jobsRes as QueryResult<WorkspaceJob>, errors);
    const jobIds = jobRows.map(job => job.id);
    const [ownBidsRes, receivedBidsRes, invoicesRes, driversRes, vehiclesRes, locationsRes] = await Promise.all([
      supabase.from('job_bids').select('id, job_id, company_id, status, amount, bid_price_gbp, created_at, message, companies:companies!job_bids_company_id_fkey(name)').eq('company_id', companyId).order('created_at', { ascending: false }).limit(500),
      jobIds.length ? supabase.from('job_bids').select('id, job_id, company_id, status, amount, bid_price_gbp, created_at, message, companies:companies!job_bids_company_id_fkey(name)').in('job_id', jobIds).order('created_at', { ascending: false }).limit(1000) : Promise.resolve({ data: [] as WorkspaceBid[], error: null }),
      supabase.from('invoices').select('id, company_id, buyer_company_id, job_id, invoice_number, status, payment_status, amount, due_date, created_at, client_name').or(`company_id.eq.${companyId},buyer_company_id.eq.${companyId}`).order('created_at', { ascending: false }).limit(500),
      supabase.from('drivers').select('id, display_name, email, phone, status, availability_status, user_id').eq('company_id', companyId).order('display_name', { ascending: true }).limit(500),
      supabase.from('vehicles').select('id, reg_plate, type, make, model, assigned_driver_id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(500),
      supabase.from('driver_locations').select('id, driver_id, job_id, lat, lng, recorded_at, updated_at').eq('company_id', companyId).order('recorded_at', { ascending: false }).limit(500),
    ]);
    const driverRows = rows<WorkspaceDriver>(driversRes as QueryResult<WorkspaceDriver>, errors);
    const vehicleRows = rows<WorkspaceVehicle>(vehiclesRes as QueryResult<WorkspaceVehicle>, errors);
    const [driverDocsRes, vehicleDocsRes] = await Promise.all([
      driverRows.length ? supabase.from('driver_documents').select('id, driver_id, doc_type, status, expiry_date').in('driver_id', driverRows.map(d => d.id)).order('expiry_date', { ascending: true }).limit(1000) : Promise.resolve({ data: [] as WorkspaceDocument[], error: null }),
      vehicleRows.length ? supabase.from('vehicle_documents').select('id, vehicle_id, doc_type, status, expiry_date').in('vehicle_id', vehicleRows.map(v => v.id)).order('expiry_date', { ascending: true }).limit(1000) : Promise.resolve({ data: [] as WorkspaceDocument[], error: null }),
    ]);
    setJobs(jobRows);
    setBids(unique([...rows<WorkspaceBid>(ownBidsRes as QueryResult<WorkspaceBid>, errors), ...rows<WorkspaceBid>(receivedBidsRes as QueryResult<WorkspaceBid>, errors)]).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)));
    setInvoices(rows<WorkspaceInvoice>(invoicesRes as QueryResult<WorkspaceInvoice>, errors)); setDrivers(driverRows); setVehicles(vehicleRows);
    setDriverDocuments(rows<WorkspaceDocument>(driverDocsRes as QueryResult<WorkspaceDocument>, errors)); setVehicleDocuments(rows<WorkspaceDocument>(vehicleDocsRes as QueryResult<WorkspaceDocument>, errors)); setLocations(rows<WorkspaceLocation>(locationsRes as QueryResult<WorkspaceLocation>, errors));
    setError(errors.length ? `Some workspace data could not be loaded: ${errors[0]}` : ''); setLoading(false);
  }, [companyId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { companyId, loading, error, jobs, bids, invoices, drivers, vehicles, driverDocuments, vehicleDocuments, locations, refresh };
}
