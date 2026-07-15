'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { CargoType, Quote, VehicleType } from '../../lib/types/database';
import { labelToVehicleType, labelToCargoType } from '../../lib/vehicleTypes';
import { downloadInvoicePdf } from '../../lib/invoicePdf';
import { loadCompanySettings } from '../../lib/companySettings';
import type { InvoiceData } from '../components/InvoiceTemplate';
import {
  toCanonicalInvoiceDisplayStatus,
  toCanonicalPaymentStatus,
  type CanonicalInvoiceStatus,
} from '../../lib/invoiceStatus';

type CustomerTab = 'dashboard' | 'post' | 'quotes' | 'deliveries' | 'invoices' | 'updates';

type CustomerJob = {
  id: string;
  status: string;
  awarded_carrier_company_id: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: VehicleType | null;
  cargo_type: CargoType | null;
  pallets: number | null;
  weight_kg: number | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  delivery_photos: string[] | null;
  created_at: string;
  updated_at: string;
};

type CustomerBid = {
  id: string;
  job_id: string;
  company_id: string | null;
  amount: number | null;
  bid_price_gbp: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  jobs: {
    id: string;
    status: string;
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    vehicle_type: VehicleType | null;
    awarded_carrier_company_id: string | null;
  } | null;
  companies: { name: string | null } | null;
};

type CustomerJobDocument = {
  id: string;
  job_id: string;
  doc_type: string | null;
  file_path: string | null;
  file_url?: string | null;
  file_type?: string | null;
  created_at: string | null;
};

type CustomerInvoice = {
  id: string;
  invoice_number: string;
  job_ref: string;
  job_id?: string | null;
  commercial_agreement_id?: string | null;
  invoice_date: string;
  due_date: string;
  status: CanonicalInvoiceStatus;
  amount: number;
  net_amount: number;
  vat_amount: number;
  vat_rate: 0 | 5 | 20;
  payment_terms: string;
  payment_status: string | null;
  late_fee: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  pickup_location: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_datetime: string | null;
  delivery_recipient: string | null;
  service_description: string | null;
  pod_photos: string[] | null;
  signature: string | null;
  recipient_name: string | null;
  created_at: string;
};

type InvoiceStatusHistory = {
  id: string;
  invoice_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_at: string;
};

type InvoicePaymentHistory = {
  id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  settlement_method: string | null;
  external_reference: string | null;
  note: string | null;
};

type CustomerUpdate = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

type LoadForm = {
  pickupDate: string;
  pickupTime: string;
  deliveryDate: string;
  deliveryTime: string;
  pickupPostcode: string;
  pickupAddress: string;
  deliveryPostcode: string;
  deliveryAddress: string;
  collectionContactName: string;
  collectionContactPhone: string;
  deliveryContactName: string;
  deliveryContactPhone: string;
  customerReference: string;
  purchaseOrderNumber: string;
  bookingReference: string;
  vehicleLabel: string;
  cargoLabel: string;
  totalWeightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  cargoValueGbp: string;
  palletCount: string;
  palletType: string;
  stackable: 'yes' | 'no';
  collectionForklift: boolean;
  collectionTailLift: boolean;
  collectionHandball: boolean;
  deliveryForklift: boolean;
  deliveryTailLift: boolean;
  deliveryHandball: boolean;
  accessRestrictions: string[];
  specialRequirements: string[];
  documents: string[];
  notes: string;
};

const timeSlots = Array.from({ length: 57 }, (_, index) => {
  const minutes = 8 * 60 + index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

const vehicleGroups = [
  ['Vans', ['Small Van', 'SWB Van', 'MWB Van', 'LWB Van', 'XLWB Van', 'Luton', 'Luton Tail Lift', 'Curtainside Van']],
  ['Rigid Trucks', ['3.5T', '5T', '7.5T', '12T', '18T', '26T']],
  ['HGV / Artics', ['Artic 44T Curtainsider', 'Artic 44T Box Trailer', 'Artic 44T Flatbed', 'Artic 44T Refrigerated', 'Artic 44T Double Deck']],
  ['Specialist Vehicles', ['Hiab', 'Moffett', 'ADR Vehicle', 'Refrigerated Vehicle', 'Temperature Controlled Vehicle']],
] as const;

const cargoOptions = ['Documents', 'Parcels', 'Pallets', 'Machinery', 'Furniture', 'Retail Goods', 'Mixed Freight', 'ADR Goods', 'Temperature Controlled Freight', 'Other'];
const accessOptions = ['Residential Address', 'Commercial Premises', 'Limited Access', 'City Centre Delivery', 'Timed Booking Required'];
const specialOptions = ['ADR Required', 'Temperature Controlled', 'Two Man Crew Required', 'Fragile Goods', 'High Value Goods'];
const documentOptions = ['Commercial Invoice', 'Packing List', 'Delivery Notes', 'Customs Documents', 'Other Attachments'];
const palletTypes = ['Standard Pallet', 'Euro Pallet', 'Oversized Pallet'];

const newLoadForm = (): LoadForm => ({
  pickupDate: '',
  pickupTime: '08:00',
  deliveryDate: '',
  deliveryTime: 'ASAP',
  pickupPostcode: '',
  pickupAddress: '',
  deliveryPostcode: '',
  deliveryAddress: '',
  collectionContactName: '',
  collectionContactPhone: '',
  deliveryContactName: '',
  deliveryContactPhone: '',
  customerReference: '',
  purchaseOrderNumber: '',
  bookingReference: '',
  vehicleLabel: 'LWB Van',
  cargoLabel: 'Pallets',
  totalWeightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  cargoValueGbp: '',
  palletCount: '',
  palletType: 'Standard Pallet',
  stackable: 'yes',
  collectionForklift: false,
  collectionTailLift: false,
  collectionHandball: false,
  deliveryForklift: false,
  deliveryTailLift: false,
  deliveryHandball: false,
  accessRestrictions: [],
  specialRequirements: [],
  documents: [],
  notes: '',
});

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  posted: 'Published',
  quoted: 'Quotes Received',
  awarded: 'Carrier Awarded',
  allocated: 'Active Delivery',
  collected: 'Collected',
  in_transit: 'Active Delivery',
  delivered: 'POD Uploaded',
  invoiced: 'Invoice Issued',
  paid: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

const toDateTime = (date: string, time: string) => (!date || !time || time === 'ASAP' ? null : `${date}T${time}:00`);
const gbp = (value: number | null | undefined) => `GBP ${Number(value ?? 0).toFixed(2)}`;
const dateDisplay = (value: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const legacyCargo = (label: string): CargoType => labelToCargoType(label);

const legacyVehicle = (label: string): VehicleType => labelToVehicleType(label);

const toInvoiceData = (invoice: CustomerInvoice): InvoiceData => ({
  id: invoice.id,
  invoiceNumber: invoice.invoice_number,
  jobRef: invoice.job_ref,
  date: invoice.invoice_date,
  dueDate: invoice.due_date,
  status: toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status),
  clientName: invoice.client_name,
  clientAddress: invoice.client_address ?? '',
  clientEmail: invoice.client_email ?? '',
  pickupLocation: invoice.pickup_location ?? '',
  pickupDateTime: invoice.pickup_datetime ?? '',
  deliveryLocation: invoice.delivery_location ?? '',
  deliveryDateTime: invoice.delivery_datetime ?? '',
  deliveryRecipient: invoice.delivery_recipient ?? '',
  serviceDescription: invoice.service_description ?? '',
  amount: Number(invoice.amount ?? 0),
  netAmount: Number(invoice.net_amount ?? invoice.amount ?? 0),
  vatAmount: Number(invoice.vat_amount ?? 0),
  vatRate: invoice.vat_rate,
  paymentTerms: invoice.payment_terms === 'Pay now' || invoice.payment_terms === '30 days' ? invoice.payment_terms : '14 days',
  lateFee: invoice.late_fee ?? '',
  podPhotos: invoice.pod_photos ?? undefined,
  signature: invoice.signature ?? undefined,
  recipientName: invoice.recipient_name ?? undefined,
});

export default function CustomerPage() {
  const { user, logout } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tab, setTab] = useState<CustomerTab>('dashboard');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bids, setBids] = useState<CustomerBid[]>([]);
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const [jobDocuments, setJobDocuments] = useState<CustomerJobDocument[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [invoiceStatusHistory, setInvoiceStatusHistory] = useState<InvoiceStatusHistory[]>([]);
  const [invoicePaymentHistory, setInvoicePaymentHistory] = useState<InvoicePaymentHistory[]>([]);
  const [updates, setUpdates] = useState<CustomerUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [awardingBidId, setAwardingBidId] = useState<string | null>(null);
  const [podJobId, setPodJobId] = useState<string | null>(null);
  const [form, setForm] = useState<LoadForm>(() => newLoadForm());

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured || !user?.id) {
        if (!cancelled) setCompanyId(user?.companyId ?? null);
        return;
      }
      if (user.companyId) {
        if (!cancelled) setCompanyId(user.companyId);
        return;
      }
      const { data } = await supabase.from('company_memberships').select('company_id').eq('user_id', user.id).neq('status', 'suspended').limit(1).maybeSingle();
      if (!cancelled) setCompanyId((data?.company_id as string) ?? null);
    };
    void run();
    return () => { cancelled = true; };
  }, [user?.id, user?.companyId]);

  const loadData = async () => {
    setLoading(true);
    setMessage('');
    if (!isSupabaseConfigured || !user?.id) {
      setLoading(false);
      return;
    }
    if (!companyId) {
      setQuotes([]);
      setBids([]);
      setJobs([]);
      setJobDocuments([]);
      setInvoices([]);
      setInvoiceStatusHistory([]);
      setInvoicePaymentHistory([]);
      setUpdates([]);
      setMessage('Your customer account is not linked to a company yet.');
      setLoading(false);
      return;
    }

    const [quoteRes, jobRes, bidRes, updateRes] = await Promise.all([
      supabase.from('quotes').select('id, company_id, created_by, customer_name, customer_email, customer_phone, pickup_location, delivery_location, vehicle_type, cargo_type, amount, currency, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('jobs').select('id, status, awarded_carrier_company_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, vehicle_type, cargo_type, pallets, weight_kg, load_details, special_requirements, access_restrictions, delivery_photos, created_at, updated_at').eq('company_id', companyId).order('updated_at', { ascending: false }),
      supabase.from('job_bids').select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at, jobs!inner(id, status, company_id, created_by, pickup_location, delivery_location, pickup_datetime, vehicle_type, awarded_carrier_company_id), companies:companies!job_bids_company_id_fkey(name)').eq('jobs.company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('notification_events').select('id, event_type, entity_type, entity_id, payload, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(40),
    ]);

    if (quoteRes.error || jobRes.error || bidRes.error || updateRes.error) {
      setMessage(quoteRes.error?.message ?? jobRes.error?.message ?? bidRes.error?.message ?? updateRes.error?.message ?? 'Unable to load customer data.');
      setLoading(false);
      return;
    }

    setQuotes((quoteRes.data ?? []) as Quote[]);
    setBids((bidRes.data ?? []) as unknown as CustomerBid[]);
    const jobRows = (jobRes.data ?? []) as CustomerJob[];
    setJobs(jobRows);
    if (jobRows.length > 0) {
      const { data: documentRows } = await supabase
        .from('job_documents')
        .select('id, job_id, doc_type, file_path, file_url, file_type, created_at')
        .in('job_id', jobRows.map((job) => job.id))
        .order('created_at', { ascending: false });
      setJobDocuments((documentRows ?? []) as CustomerJobDocument[]);
    } else {
      setJobDocuments([]);
    }
    const jobIds = jobRows.map((job) => job.id);
    const [invoiceBuyerRes, invoiceByJobRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, job_ref, job_id, commercial_agreement_id, invoice_date, due_date, status, payment_status, amount, net_amount, vat_amount, vat_rate, payment_terms, late_fee, client_name, client_email, client_address, pickup_location, pickup_datetime, delivery_location, delivery_datetime, delivery_recipient, service_description, pod_photos, signature, recipient_name, created_at')
        .eq('buyer_company_id', companyId)
        .order('created_at', { ascending: false }),
      jobIds.length > 0
        ? supabase
            .from('invoices')
            .select('id, invoice_number, job_ref, job_id, commercial_agreement_id, invoice_date, due_date, status, payment_status, amount, net_amount, vat_amount, vat_rate, payment_terms, late_fee, client_name, client_email, client_address, pickup_location, pickup_datetime, delivery_location, delivery_datetime, delivery_recipient, service_description, pod_photos, signature, recipient_name, created_at')
            .in('job_id', jobIds)
            .is('buyer_company_id', null)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (invoiceBuyerRes.error || invoiceByJobRes.error) {
      setMessage(invoiceBuyerRes.error?.message ?? invoiceByJobRes.error?.message ?? 'Unable to load customer invoices.');
      setLoading(false);
      return;
    }

    const invoiceById = new Map<string, CustomerInvoice>();
    for (const invoice of ([...(invoiceBuyerRes.data ?? []), ...(invoiceByJobRes.data ?? [])] as CustomerInvoice[])) {
      invoiceById.set(invoice.id, invoice);
    }

    const invoiceRows = Array.from(invoiceById.values()).map((invoice) => ({
      ...invoice,
      status: toCanonicalInvoiceDisplayStatus(invoice.status, invoice.due_date, invoice.payment_status),
      payment_status: toCanonicalPaymentStatus(invoice.payment_status),
    }));
    setUpdates((updateRes.data ?? []) as CustomerUpdate[]);
    setInvoices(invoiceRows);
    if (invoiceRows.length > 0) {
      const invoiceIds = invoiceRows.map((invoice) => invoice.id);
      const [statusHistoryRes, paymentHistoryRes] = await Promise.all([
        supabase.from('invoice_status_history').select('id, invoice_id, from_status, to_status, note, changed_at').in('invoice_id', invoiceIds).order('changed_at', { ascending: false }),
        supabase.from('invoice_payment_history').select('id, invoice_id, amount, paid_at, settlement_method, external_reference, note').in('invoice_id', invoiceIds).order('paid_at', { ascending: false }),
      ]);
      setInvoiceStatusHistory((statusHistoryRes.data ?? []) as InvoiceStatusHistory[]);
      setInvoicePaymentHistory((paymentHistoryRes.data ?? []) as InvoicePaymentHistory[]);
    } else {
      setInvoiceStatusHistory([]);
      setInvoicePaymentHistory([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user?.id]);

  const metrics = useMemo(() => ({
    openLoads: jobs.filter((job) => !['delivered', 'invoiced', 'paid', 'cancelled'].includes(job.status)).length,
    quotesWaiting: jobs.filter((job) => ['posted', 'quoted'].includes(job.status)).length + quotes.filter((quote) => ['draft', 'sent', 'submitted'].includes(quote.status)).length,
    quotesReceived: bids.filter((bid) => bid.status === 'submitted').length + quotes.length,
    awardedJobs: jobs.filter((job) => Boolean(job.awarded_carrier_company_id) || ['awarded', 'allocated', 'collected', 'in_transit', 'delivered', 'invoiced', 'paid'].includes(job.status)).length,
    activeDeliveries: jobs.filter((job) => ['awarded', 'allocated', 'collected', 'in_transit'].includes(job.status)).length,
    podReady: jobs.filter((job) => (job.delivery_photos?.length ?? 0) > 0).length,
    unpaidInvoices: invoices.filter((invoice) => {
      const paymentStatus = toCanonicalPaymentStatus(invoice.payment_status);
      return paymentStatus !== 'paid' && paymentStatus !== 'refunded';
    }).length,
  }), [jobs, quotes, bids, invoices]);

  const bidGroups = useMemo(() => {
    const groups = new Map<string, CustomerBid[]>();
    for (const bid of bids) {
      const key = bid.job_id;
      groups.set(key, [...(groups.get(key) ?? []), bid]);
    }
    return Array.from(groups.entries()).map(([jobId, groupBids]) => ({
      jobId,
      job: groupBids[0]?.jobs ?? jobs.find((job) => job.id === jobId) ?? null,
      bids: groupBids,
    }));
  }, [bids, jobs]);

  const podDocumentsByJob = useMemo(() => {
    const map = new Map<string, CustomerJobDocument[]>();
    for (const doc of jobDocuments) {
      const type = `${doc.doc_type ?? ''} ${doc.file_type ?? ''}`.toLowerCase();
      if (!type.includes('pod') && !type.includes('delivery') && !doc.file_path && !doc.file_url) continue;
      map.set(doc.job_id, [...(map.get(doc.job_id) ?? []), doc]);
    }
    return map;
  }, [jobDocuments]);

  const invoiceStatusById = useMemo(() => {
    const map = new Map<string, InvoiceStatusHistory[]>();
    for (const item of invoiceStatusHistory) map.set(item.invoice_id, [...(map.get(item.invoice_id) ?? []), item]);
    return map;
  }, [invoiceStatusHistory]);

  const invoicePaymentsById = useMemo(() => {
    const map = new Map<string, InvoicePaymentHistory[]>();
    for (const item of invoicePaymentHistory) map.set(item.invoice_id, [...(map.get(item.invoice_id) ?? []), item]);
    return map;
  }, [invoicePaymentHistory]);

  const setField = <K extends keyof LoadForm>(key: K, value: LoadForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (key: 'accessRestrictions' | 'specialRequirements' | 'documents', value: string) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));
  };

  const detailsJson = () => JSON.stringify({
    workflow: 'customer_load_posting_v1',
    references: {
      customerReference: form.customerReference || null,
      purchaseOrderNumber: form.purchaseOrderNumber || null,
      bookingReference: form.bookingReference || null,
    },
    requestedVehicle: form.vehicleLabel,
    requestedCargo: form.cargoLabel,
    collection: {
      date: form.pickupDate,
      timeSlot: form.pickupTime,
      postcode: form.pickupPostcode,
      address: form.pickupAddress,
      contactName: form.collectionContactName,
      contactPhone: form.collectionContactPhone,
      forkliftAvailable: form.collectionForklift,
      tailLiftRequired: form.collectionTailLift,
      handballRequired: form.collectionHandball,
    },
    delivery: {
      date: form.deliveryDate || null,
      timeSlot: form.deliveryTime,
      postcode: form.deliveryPostcode,
      address: form.deliveryAddress,
      contactName: form.deliveryContactName,
      contactPhone: form.deliveryContactPhone,
      forkliftAvailable: form.deliveryForklift,
      tailLiftRequired: form.deliveryTailLift,
      handballRequired: form.deliveryHandball,
    },
    dimensionsCm: { length: form.lengthCm || null, width: form.widthCm || null, height: form.heightCm || null },
    cargoValueGbp: form.cargoValueGbp || null,
    palletDetails: form.cargoLabel === 'Pallets' ? { count: form.palletCount || null, type: form.palletType, stackable: form.stackable === 'yes' } : null,
    documentChecklist: form.documents,
    notes: form.notes || null,
  }, null, 2);

  const saveLoad = async (publish: boolean) => {
    setFormError('');
    setSaved(false);
    if (!form.pickupDate || !form.pickupPostcode.trim() || !form.pickupAddress.trim()) {
      setFormError('Collection date, postcode and address are required.');
      return;
    }
    if (!form.deliveryPostcode.trim() || !form.deliveryAddress.trim()) {
      setFormError('Delivery postcode and address are required.');
      return;
    }
    if (!form.collectionContactName.trim() || !form.collectionContactPhone.trim() || !form.deliveryContactName.trim() || !form.deliveryContactPhone.trim()) {
      setFormError('Collection and delivery contacts are required.');
      return;
    }
    if (!isSupabaseConfigured || !user?.id || !companyId) {
      setFormError('Your customer account is not linked to a company yet.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('jobs').insert([{
      company_id: companyId,
      created_by: user.id,
      status: publish ? 'posted' : 'draft',
      pickup_location: `${form.pickupAddress}, ${form.pickupPostcode}`,
      pickup_postcode: form.pickupPostcode.trim().toUpperCase(),
      pickup_datetime: toDateTime(form.pickupDate, form.pickupTime),
      delivery_location: `${form.deliveryAddress}, ${form.deliveryPostcode}`,
      delivery_postcode: form.deliveryPostcode.trim().toUpperCase(),
      delivery_datetime: toDateTime(form.deliveryDate, form.deliveryTime),
      vehicle_type: legacyVehicle(form.vehicleLabel),
      cargo_type: legacyCargo(form.cargoLabel),
      pallets: form.cargoLabel === 'Pallets' && form.palletCount ? Number(form.palletCount) : null,
      weight_kg: form.totalWeightKg ? Number(form.totalWeightKg) : null,
      length_cm: form.lengthCm ? Number(form.lengthCm) : null,
      width_cm: form.widthCm ? Number(form.widthCm) : null,
      height_cm: form.heightCm ? Number(form.heightCm) : null,
      load_details: detailsJson(),
      special_requirements: form.specialRequirements.join(', ') || null,
      access_restrictions: form.accessRestrictions.join(', ') || null,
    }]);
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setSaved(true);
    setForm(newLoadForm());
    setTab('dashboard');
    await loadData();
  };

  const downloadInvoice = async (invoice: CustomerInvoice) => {
    if (!companyId) return;
    setDownloadingInvoiceId(invoice.id);
    try {
      await downloadInvoicePdf({ invoice: toInvoiceData(invoice), companySettings: await loadCompanySettings(supabase, companyId) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download invoice PDF.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const awardBid = async (bidId: string) => {
    setMessage('');
    setAwardingBidId(bidId);
    const token = await getAccessToken();
    if (!token) {
      setMessage('Session expired. Please sign in again.');
      setAwardingBidId(null);
      return;
    }

    const response = await fetch(`/api/customer/bids/${bidId}/award`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setAwardingBidId(null);
    if (!response.ok) {
      setMessage(payload.error ?? `Award failed (${response.status}).`);
      return;
    }
    setMessage('Quote awarded successfully.');
    await loadData();
  };

  const podFilesForJob = (job: CustomerJob) => {
    const photoFiles = (job.delivery_photos ?? []).map((path, index) => ({
      id: `${job.id}-photo-${index}`,
      label: `Delivery POD ${index + 1}`,
      path,
    }));
    const documentFiles = (podDocumentsByJob.get(job.id) ?? [])
      .map((doc, index) => ({
        id: doc.id,
        label: doc.doc_type || doc.file_type || `POD document ${index + 1}`,
        path: doc.file_path || doc.file_url || '',
      }))
      .filter((file) => file.path.length > 0);
    return [...photoFiles, ...documentFiles];
  };

  const resolvePodUrl = async (path: string) => {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const { data, error } = await supabase.storage.from('pod-docs').createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'POD file is not available.');
    return data.signedUrl;
  };

  const openPod = async (path: string) => {
    try {
      window.open(await resolvePodUrl(path), '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open POD.');
    }
  };

  const downloadPod = async (path: string) => {
    try {
      const url = await resolvePodUrl(path);
      const link = document.createElement('a');
      link.href = url;
      link.download = path.split('/').pop() || 'pod-document';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download POD.');
    }
  };

  const chip = (status: string) => <span className="chip">{statusLabels[status] ?? status}</span>;
  const field = (label: string, node: React.ReactNode) => <label className="field"><span>{label}</span>{node}</label>;
  const checks = (items: string[], selected: string[], key: 'accessRestrictions' | 'specialRequirements' | 'documents') => (
    <div className="checks">{items.map((item) => <label key={item}><input type="checkbox" checked={selected.includes(item)} onChange={() => toggle(key, item)} />{item}</label>)}</div>
  );

  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <div className="page">
        <header className="topbar">
          <div>
            <p>XDrive Customer</p>
            <h1>Load Posting Workspace</h1>
          </div>
          <div className="userbar">
            <span>{user?.email}</span>
            <button onClick={() => logout()}>Logout</button>
          </div>
        </header>

        <main>
          {message && <div className="notice warn">{message}</div>}
          {saved && <div className="notice ok">Load saved successfully.</div>}

          <nav className="tabs">
            {([
              ['dashboard', 'Dashboard'],
              ['post', 'Post Load'],
              ['quotes', `Quotes (${quotes.length})`],
              ['deliveries', `Deliveries (${jobs.length})`],
              ['invoices', `Invoices (${invoices.length})`],
              ['updates', `Updates (${updates.length})`],
            ] as Array<[CustomerTab, string]>).map(([nextTab, label]) => (
              <button key={nextTab} className={tab === nextTab ? 'active' : ''} onClick={() => setTab(nextTab)}>{label}</button>
            ))}
          </nav>

          {tab === 'dashboard' && (
            <section className="stack">
              <div className="metrics">
                {[
                  ['Open Loads', metrics.openLoads],
                  ['Quotes Waiting', metrics.quotesWaiting],
                  ['Quotes Received', metrics.quotesReceived],
                  ['Awarded Jobs', metrics.awardedJobs],
                  ['Active Deliveries', metrics.activeDeliveries],
                  ['POD Ready', metrics.podReady],
                  ['Unpaid Invoices', metrics.unpaidInvoices],
                ].map(([label, value]) => <article key={label} className="metric"><span>{label}</span><strong>{value}</strong></article>)}
              </div>
              <div className="actions">
                <button className="primary" onClick={() => setTab('post')}>Post Load</button>
                <button onClick={() => setTab('post')}>Request Quote</button>
                <button onClick={() => setTab('deliveries')}>View Active Deliveries</button>
                <button onClick={() => setTab('invoices')}>View Invoices</button>
                <button onClick={() => setTab('updates')}>View Updates</button>
                <button onClick={() => window.location.href = '/customer/settings'}>Settings</button>
              </div>
              <div className="columns">
                <ListCard title="Recent Loads">{jobs.slice(0, 4).map((job) => <Row key={job.id} title={`${job.pickup_postcode ?? job.pickup_location ?? '-'} to ${job.delivery_postcode ?? job.delivery_location ?? '-'}`} meta={statusLabels[job.status] ?? job.status} />)}</ListCard>
                <ListCard title="Recent Quotes">{bids.slice(0, 4).map((bid) => <Row key={bid.id} title={`${bid.jobs?.pickup_location ?? '-'} to ${bid.jobs?.delivery_location ?? '-'}`} meta={`${bid.companies?.name ?? 'Carrier'} - ${gbp(bid.bid_price_gbp ?? bid.amount)} - ${bid.status}`} />)}</ListCard>
                <ListCard title="Recent Deliveries">{jobs.slice(0, 4).map((job) => <Row key={job.id} title={dateDisplay(job.pickup_datetime)} meta={job.delivery_location ?? '-'} />)}</ListCard>
              </div>
            </section>
          )}

          {tab === 'post' && (
            <section className="stack">
              {formError && <div className="notice error">{formError}</div>}
              <Card title="Pickup & Delivery Scheduling">
                <div className="grid4">
                  {field('Pickup Date *', <input type="date" value={form.pickupDate} onChange={(e) => setField('pickupDate', e.target.value)} />)}
                  {field('Pickup Time Slot *', <select value={form.pickupTime} onChange={(e) => setField('pickupTime', e.target.value)}>{timeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select>)}
                  {field('Delivery Date', <input type="date" value={form.deliveryDate} onChange={(e) => setField('deliveryDate', e.target.value)} />)}
                  {field('Delivery Time Slot', <select value={form.deliveryTime} onChange={(e) => setField('deliveryTime', e.target.value)}><option>ASAP</option>{timeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select>)}
                </div>
              </Card>

              <div className="columns">
                <Card title="Collection">
                  {field('Pickup Postcode *', <input value={form.pickupPostcode} onChange={(e) => setField('pickupPostcode', e.target.value)} placeholder="SW1A 1AA" />)}
                  {field('Pickup Address *', <textarea value={form.pickupAddress} onChange={(e) => setField('pickupAddress', e.target.value)} />)}
                  {field('Contact Name *', <input value={form.collectionContactName} onChange={(e) => setField('collectionContactName', e.target.value)} />)}
                  {field('Phone Number *', <input value={form.collectionContactPhone} onChange={(e) => setField('collectionContactPhone', e.target.value)} />)}
                </Card>
                <Card title="Delivery">
                  {field('Delivery Postcode *', <input value={form.deliveryPostcode} onChange={(e) => setField('deliveryPostcode', e.target.value)} placeholder="M1 1AE" />)}
                  {field('Delivery Address *', <textarea value={form.deliveryAddress} onChange={(e) => setField('deliveryAddress', e.target.value)} />)}
                  {field('Contact Name *', <input value={form.deliveryContactName} onChange={(e) => setField('deliveryContactName', e.target.value)} />)}
                  {field('Phone Number *', <input value={form.deliveryContactPhone} onChange={(e) => setField('deliveryContactPhone', e.target.value)} />)}
                </Card>
              </div>

              <Card title="References">
                <div className="grid3">
                  {field('Customer Reference', <input value={form.customerReference} onChange={(e) => setField('customerReference', e.target.value)} />)}
                  {field('Purchase Order Number', <input value={form.purchaseOrderNumber} onChange={(e) => setField('purchaseOrderNumber', e.target.value)} />)}
                  {field('Booking Reference', <input value={form.bookingReference} onChange={(e) => setField('bookingReference', e.target.value)} />)}
                </div>
              </Card>

              <Card title="Vehicle & Cargo">
                <div className="grid4">
                  {field('Vehicle Type', <select value={form.vehicleLabel} onChange={(e) => setField('vehicleLabel', e.target.value)}>{vehicleGroups.map(([group, options]) => <optgroup key={group} label={group}>{options.map((option) => <option key={option}>{option}</option>)}</optgroup>)}</select>)}
                  {field('Cargo Type', <select value={form.cargoLabel} onChange={(e) => setField('cargoLabel', e.target.value)}>{cargoOptions.map((option) => <option key={option}>{option}</option>)}</select>)}
                  {field('Total Weight (kg)', <input type="number" min="0" value={form.totalWeightKg} onChange={(e) => setField('totalWeightKg', e.target.value)} />)}
                  {field('Cargo Value (GBP)', <input type="number" min="0" value={form.cargoValueGbp} onChange={(e) => setField('cargoValueGbp', e.target.value)} />)}
                </div>
                <div className="grid3">
                  {field('Length (cm)', <input type="number" min="0" value={form.lengthCm} onChange={(e) => setField('lengthCm', e.target.value)} />)}
                  {field('Width (cm)', <input type="number" min="0" value={form.widthCm} onChange={(e) => setField('widthCm', e.target.value)} />)}
                  {field('Height (cm)', <input type="number" min="0" value={form.heightCm} onChange={(e) => setField('heightCm', e.target.value)} />)}
                </div>
              </Card>

              {form.cargoLabel === 'Pallets' && (
                <Card title="Pallet Workflow">
                  <div className="grid3">
                    {field('Number of Pallets', <input type="number" min="0" value={form.palletCount} onChange={(e) => setField('palletCount', e.target.value)} />)}
                    {field('Pallet Type', <select value={form.palletType} onChange={(e) => setField('palletType', e.target.value)}>{palletTypes.map((option) => <option key={option}>{option}</option>)}</select>)}
                    {field('Stackable', <select value={form.stackable} onChange={(e) => setField('stackable', e.target.value as 'yes' | 'no')}><option value="yes">Yes</option><option value="no">No</option></select>)}
                  </div>
                </Card>
              )}

              <div className="columns">
                <Card title="Collection Loading">{['Forklift Available', 'Tail Lift Required', 'Handball Required'].map((label, index) => <Toggle key={label} label={label} checked={[form.collectionForklift, form.collectionTailLift, form.collectionHandball][index]} onChange={(value) => setField(['collectionForklift', 'collectionTailLift', 'collectionHandball'][index] as keyof LoadForm, value as never)} />)}</Card>
                <Card title="Delivery Unloading">{['Forklift Available', 'Tail Lift Required', 'Handball Required'].map((label, index) => <Toggle key={label} label={label} checked={[form.deliveryForklift, form.deliveryTailLift, form.deliveryHandball][index]} onChange={(value) => setField(['deliveryForklift', 'deliveryTailLift', 'deliveryHandball'][index] as keyof LoadForm, value as never)} />)}</Card>
              </div>

              <Card title="Load Options">
                <p className="opts-group-label">Access Restrictions</p>
                {checks(accessOptions, form.accessRestrictions, 'accessRestrictions')}
                <p className="opts-group-label">Special Requirements</p>
                {checks(specialOptions, form.specialRequirements, 'specialRequirements')}
                <p className="opts-group-label">Documents Required</p>
                {checks(documentOptions, form.documents, 'documents')}
                <div style={{ marginTop: 10 }}>{field('Other Attachments', <input type="file" multiple onChange={(event) => setField('documents', Array.from(event.target.files ?? []).map((file) => file.name))} />)}</div>
              </Card>
              <Card title="Notes">{field('Operational Notes', <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Site instructions, booking windows, driver notes." />)}</Card>

              <div className="savebar">
                <button disabled={saving} onClick={() => void saveLoad(false)}>Save Draft</button>
                <button className="primary" disabled={saving} onClick={() => void saveLoad(true)}>{saving ? 'Saving...' : 'Publish Load'}</button>
              </div>
            </section>
          )}

          {tab === 'quotes' && (
            <section className="stack">
              {bidGroups.length === 0 ? <Card title="Carrier Bids">No carrier bids received yet.</Card> : bidGroups.map((group) => (
                <article key={group.jobId} className="card">
                  <div className="split">
                    <div>
                      <h2>{group.job?.pickup_location ?? '-'} to {group.job?.delivery_location ?? '-'}</h2>
                      <p className="muted">Pickup: {dateDisplay(group.job?.pickup_datetime ?? null)} · Vehicle: {group.job?.vehicle_type?.replace(/_/g, ' ') ?? '-'}</p>
                    </div>
                    {chip(group.job?.status ?? 'posted')}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr>{['Carrier', 'Amount', 'Message', 'Status', 'Action'].map((head) => <th key={head}>{head}</th>)}</tr></thead>
                      <tbody>
                        {group.bids.map((bid) => {
                          const isAwarded = bid.status === 'accepted';
                          const canAward = bid.status === 'submitted' && !group.job?.awarded_carrier_company_id;
                          return (
                            <tr key={bid.id}>
                              <td>{bid.companies?.name ?? 'Carrier'}</td>
                              <td>{gbp(bid.bid_price_gbp ?? bid.amount)}</td>
                              <td>{bid.message || '-'}</td>
                              <td>{bid.status}</td>
                              <td>
                                {isAwarded ? 'Awarded' : (
                                  <button disabled={!canAward || awardingBidId === bid.id} onClick={() => void awardBid(bid.id)}>
                                    {awardingBidId === bid.id ? 'Awarding...' : 'Award Quote'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
              {quotes.length > 0 && (
                <DataTable empty="No quote records." rows={quotes.map((quote) => [quote.pickup_location ?? '-', quote.delivery_location ?? '-', quote.vehicle_type?.replace(/_/g, ' ') ?? '-', quote.cargo_type ?? '-', quote.amount ? gbp(quote.amount) : '-', quote.status])} headers={['Pickup', 'Delivery', 'Vehicle', 'Cargo', 'Amount', 'Status']} />
              )}
            </section>
          )}

          {tab === 'deliveries' && (
            <section className="stack">
              {loading ? <Card title="Deliveries">Loading...</Card> : jobs.length === 0 ? <Card title="Deliveries">No deliveries found.</Card> : jobs.map((job) => (
                <article key={job.id} className="card">
                  <div className="split"><strong>{job.pickup_postcode ?? job.pickup_location ?? '-'} to {job.delivery_postcode ?? job.delivery_location ?? '-'}</strong>{chip(job.status)}</div>
                  <div className="grid4 small">
                    <span>Pickup: {dateDisplay(job.pickup_datetime)}</span>
                    <span>Delivery: {dateDisplay(job.delivery_datetime)}</span>
                    <span>Vehicle: {job.vehicle_type?.replace(/_/g, ' ') ?? '-'}</span>
                    <span>POD: {podFilesForJob(job).length ? 'Ready' : 'Pending'}</span>
                  </div>
                  <div className="actions compact">
                    <button onClick={() => window.location.href = `/customer/jobs/${job.id}`}>View Job</button>
                    {podFilesForJob(job).length > 0 && (
                      <>
                        <button onClick={() => setPodJobId(podJobId === job.id ? null : job.id)}>View POD</button>
                        <button onClick={() => void downloadPod(podFilesForJob(job)[0].path)}>Download POD</button>
                      </>
                    )}
                  </div>
                  {podJobId === job.id && (
                    <div className="pod-list">
                      {podFilesForJob(job).map((file) => (
                        <div key={file.id} className="pod-row">
                          <span>{file.label}</span>
                          <div className="actions compact">
                            <button onClick={() => void openPod(file.path)}>Open</button>
                            <button onClick={() => void downloadPod(file.path)}>Download</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}

          {tab === 'invoices' && (
            <section className="stack">
              <Card title="Invoices">
                {invoices.length === 0 ? <p>No invoices available.</p> : <div className="table-wrap"><table><thead><tr>{['Invoice #', 'Job Ref', 'Issue Date', 'Due Date', 'Amount', 'Status', 'Actions'].map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number}</td><td>{invoice.job_ref || '-'}</td><td>{new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</td><td>{new Date(invoice.due_date).toLocaleDateString('en-GB')}</td><td>{gbp(invoice.amount)}</td><td>{invoice.status}</td><td><button disabled={downloadingInvoiceId === invoice.id} onClick={() => void downloadInvoice(invoice)}>{downloadingInvoiceId === invoice.id ? 'Preparing...' : 'Download PDF'}</button></td></tr>)}</tbody></table></div>}
              </Card>
              {invoices.map((invoice) => {
                const statusRows = invoiceStatusById.get(invoice.id) ?? [];
                const paymentRows = invoicePaymentsById.get(invoice.id) ?? [];
                return (
                  <article key={`${invoice.id}-history`} className="card">
                    <div className="split">
                      <h2>{invoice.invoice_number}</h2>
                      <strong>{invoice.status}</strong>
                    </div>
                    <div className="grid4 small">
                      <span>Amount: {gbp(invoice.amount)}</span>
                      <span>Issued: {new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</span>
                      <span>Due: {new Date(invoice.due_date).toLocaleDateString('en-GB')}</span>
                      <span>Payment status: {invoice.status}</span>
                    </div>
                    <div className="columns">
                      <div>
                        <h3>Status History</h3>
                        {statusRows.length === 0 ? <p className="muted">No status history recorded.</p> : statusRows.map((row) => <p key={row.id}>{row.from_status ?? 'Created'} to {row.to_status} · {dateDisplay(row.changed_at)}{row.note ? ` · ${row.note}` : ''}</p>)}
                      </div>
                      <div>
                        <h3>Payment History</h3>
                        {paymentRows.length === 0 ? <p className="muted">No payments recorded.</p> : paymentRows.map((row) => <p key={row.id}>{gbp(row.amount)} · {dateDisplay(row.paid_at)} · {row.settlement_method ?? 'Method not recorded'}{row.external_reference ? ` · Ref ${row.external_reference}` : ''}</p>)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {tab === 'updates' && (
            <section className="stack">
              <Card title="Carrier Updates & Notifications">
                {updates.length === 0 ? <p>No updates found.</p> : updates.map((update) => {
                  const payload = update.payload ?? {};
                  const route = [payload.pickup_location, payload.delivery_location].filter(Boolean).join(' to ');
                  return (
                    <div key={update.id} className="row">
                      <strong>{update.event_type.replace(/_/g, ' ')}</strong>
                      <span>{route || update.entity_type} · {dateDisplay(update.created_at)} · {update.status}</span>
                    </div>
                  );
                })}
              </Card>
            </section>
          )}
        </main>

        <style jsx>{`
          .page { min-height: 100vh; background: #f3f4f6; color: #0f172a; }
          .topbar { background: #0a2239; color: white; padding: 16px; display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
          .topbar p { margin: 0; color: #f5c84c; font-size: 12px; font-weight: 800; }
          .topbar h1 { margin: 0; font-size: 22px; }
          .userbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; color: #cbd5e1; font-size: 14px; }
          main { max-width: 1180px; margin: 0 auto; padding: 16px; }
          button { border: 1px solid #cbd5e1; background: white; border-radius: 8px; padding: 10px 14px; font-weight: 800; cursor: pointer; color: #0f172a; }
          button:disabled { opacity: .6; cursor: not-allowed; }
          .primary { background: #f5c84c; border-color: #f5c84c; color: #111827; }
          .tabs { background: white; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px; display: flex; flex-wrap: wrap; }
          .tabs button { border: 0; border-bottom: 3px solid transparent; border-radius: 0; color: #64748b; }
          .tabs .active { border-bottom-color: #f5c84c; color: #0f172a; background: #fffbeb; }
          .stack { display: grid; gap: 16px; }
          .card, .metric { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .card h2 { margin: 0 0 12px; font-size: 17px; }
          .metrics, .columns, .grid3, .grid4 { display: grid; gap: 12px; }
          .metrics { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
          .columns { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
          .grid3 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
          .grid4 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
          .metric { border-top: 4px solid #f5c84c; }
          .metric span, .field span { display: block; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; }
          .metric strong { display: block; font-size: 34px; }
          .actions, .savebar { display: flex; gap: 10px; flex-wrap: wrap; }
          .actions.compact { margin-top: 12px; gap: 8px; }
          .actions.compact button { padding: 8px 10px; font-size: 13px; }
          .savebar { justify-content: flex-end; }
          .field { display: grid; gap: 4px; margin-bottom: 12px; }
          input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px; padding: 11px; font: inherit; background: white; color: #0f172a; }
          input[type="checkbox"], input[type="radio"] { width: auto; padding: 0; border: revert; border-radius: revert; background: revert; box-shadow: none; }
          textarea { min-height: 82px; resize: vertical; }
          .checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
          .checks label { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
          .checks label:hover { border-color: #f5c84c; background: #fffbeb; }
          .checks label input[type="checkbox"] { flex-shrink: 0; }
          .toggle { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 6px; }
          .opts-group-label { margin: 12px 0 6px; font-size: 12px; font-weight: 900; text-transform: uppercase; color: #64748b; letter-spacing: .04em; }
          .notice { border-radius: 8px; padding: 12px; margin-bottom: 12px; font-weight: 800; }
          .warn { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }
          .ok { background: #dcfce7; color: #14532d; border: 1px solid #22c55e; }
          .error { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
          .row { border-top: 1px solid #e2e8f0; padding: 10px 0; }
          .row strong { display: block; }
          .row span, .small { color: #64748b; font-size: 14px; }
          .split { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
          .chip { background: #fffbeb; color: #92400e; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 900; }
          .muted { margin: 4px 0 0; color: #64748b; font-size: 14px; }
          .pod-list { margin-top: 12px; border-top: 1px solid #e2e8f0; }
          .pod-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
          .table-wrap { overflow-x: auto; }
          table { width: 100%; min-width: 760px; border-collapse: collapse; }
          th, td { padding: 12px; border-top: 1px solid #e2e8f0; text-align: left; }
          th { background: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase; }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card"><h2>{title}</h2>{children}</section>;
}

function ListCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card title={title}>{children || <p>No records yet.</p>}</Card>;
}

function Row({ title, meta }: { title: string; meta: string }) {
  return <div className="row"><strong>{title}</strong><span>{meta}</span></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle">{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <section className="card"><p>{empty}</p></section>;
  return (
    <section className="card table-wrap">
      <table>
        <thead><tr>{headers.map((head) => <th key={head}>{head}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </section>
  );
}
