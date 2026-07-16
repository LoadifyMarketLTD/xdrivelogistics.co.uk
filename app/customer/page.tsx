'use client';

import { useEffect, useMemo, useState } from 'react';
import { LogOut } from 'lucide-react';
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [form, setForm] = useState<LoadForm>(() => newLoadForm());

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

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

  // ── Tab definitions ───────────────────────────────────────────────────────────

  const customerTabs: Array<{ id: CustomerTab; label: string; count?: number }> = [
    { id: 'dashboard',   label: 'Dashboard' },
    { id: 'post',        label: 'Post Load' },
    { id: 'quotes',      label: 'Quotes',            count: (bidGroups.length + quotes.length) || undefined },
    { id: 'deliveries',  label: 'Active Deliveries', count: jobs.length || undefined },
    { id: 'invoices',    label: 'Customer Invoices', count: invoices.length || undefined },
    { id: 'updates',     label: 'Updates',           count: updates.length || undefined },
  ];

  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <div style={{ display: 'flex', height: 'calc(100vh - 89px)', overflow: 'hidden', background: '#f5f7fa' }}>

        {/* ── Left summary panel ──────────────────────────────────────────────── */}
        <aside style={{ width: '210px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '0.9rem', overflowY: 'auto', fontSize: '0.78rem' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem', fontSize: '0.8rem' }}>📋 My Workspace</div>

          {!isSupabaseConfigured && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '0.5rem', marginBottom: '0.75rem', color: '#92400e', fontSize: '0.72rem' }}>
              Supabase not configured
            </div>
          )}

          {([
            ['Open Loads',       metrics.openLoads],
            ['Quotes Waiting',   metrics.quotesWaiting],
            ['Quotes Received',  metrics.quotesReceived],
            ['Awarded Jobs',     metrics.awardedJobs],
            ['Active Deliveries',metrics.activeDeliveries],
            ['POD Ready',        metrics.podReady],
            ['Unpaid Invoices',  metrics.unpaidInvoices],
          ] as [string, number][]).map(([label, value]) => (
            <div key={label} style={{ marginBottom: '0.55rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.05rem' }}>{label}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{value}</div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
            <button
              onClick={() => setTab('post')}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', padding: '0.5rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', textAlign: 'center' as const }}
            >
              + Post Load
            </button>
            <button
              onClick={() => { window.location.href = '/customer/settings'; }}
              style={{ padding: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b', textAlign: 'center' as const }}
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.45rem', border: '1px solid #fecaca', borderRadius: '5px', background: '#fef2f2', cursor: loggingOut ? 'wait' : 'pointer', fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c', opacity: loggingOut ? 0.65 : 1, textAlign: 'center' as const }}
            >
              <LogOut size={14} aria-hidden="true" />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>

          {message && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '0.5rem', marginTop: '0.75rem', color: '#92400e', fontSize: '0.72rem' }}>
              {message}
            </div>
          )}
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Top bar: tabs + refresh */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {customerTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '0.65rem 0.9rem',
                    border: 'none',
                    borderBottom: tab === t.id ? '2px solid #1d4ed8' : '2px solid transparent',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: tab === t.id ? '#1d4ed8' : '#64748b',
                    marginBottom: '-1px',
                  }}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span style={{ marginLeft: '0.35rem', background: tab === t.id ? '#dbeafe' : '#f1f5f9', color: tab === t.id ? '#1d4ed8' : '#64748b', borderRadius: '8px', padding: '0.05rem 0.4rem', fontSize: '0.72rem' }}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => void loadData()}
              style={{ padding: '0.3rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b' }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* Content area */}
          <div style={{ padding: '0.85rem', flex: 1, overflowY: 'auto' }}>
            {saved && <WSBanner type="ok" msg="Load saved successfully." />}

            {/* ── Dashboard ──────────────────────────────────────────────────── */}
            {tab === 'dashboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                  {([
                    ['Open Loads',        metrics.openLoads,        '#3b82f6'],
                    ['Quotes Waiting',    metrics.quotesWaiting,    '#f59e0b'],
                    ['Quotes Received',   metrics.quotesReceived,   '#6366f1'],
                    ['Awarded Jobs',      metrics.awardedJobs,      '#16a34a'],
                    ['Active Deliveries', metrics.activeDeliveries, '#0ea5e9'],
                    ['POD Ready',         metrics.podReady,         '#8b5cf6'],
                    ['Unpaid Invoices',   metrics.unpaidInvoices,   '#ef4444'],
                  ] as [string, number, string][]).map(([label, value, color]) => (
                    <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: `3px solid ${color}`, borderRadius: '8px', padding: '0.75rem 1rem' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{label}</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                  <WSCard title="Recent My Loads">
                    {jobs.slice(0, 4).length === 0
                      ? <WSEmpty text="No loads yet." />
                      : jobs.slice(0, 4).map((job) => (
                        <WSRow key={job.id} title={`${job.pickup_postcode ?? job.pickup_location ?? '–'} → ${job.delivery_postcode ?? job.delivery_location ?? '–'}`} meta={statusLabels[job.status] ?? job.status} />
                      ))}
                  </WSCard>
                  <WSCard title="Recent Quotes">
                    {bids.slice(0, 4).length === 0
                      ? <WSEmpty text="No quotes yet." />
                      : bids.slice(0, 4).map((bid) => (
                        <WSRow key={bid.id} title={`${bid.jobs?.pickup_location ?? '–'} → ${bid.jobs?.delivery_location ?? '–'}`} meta={`${bid.companies?.name ?? 'Carrier'} · ${gbp(bid.bid_price_gbp ?? bid.amount)} · ${bid.status}`} />
                      ))}
                  </WSCard>
                  <WSCard title="Recent Active Deliveries">
                    {jobs.slice(0, 4).length === 0
                      ? <WSEmpty text="No deliveries yet." />
                      : jobs.slice(0, 4).map((job) => (
                        <WSRow key={job.id} title={dateDisplay(job.pickup_datetime)} meta={job.delivery_location ?? '–'} />
                      ))}
                  </WSCard>
                </div>
              </div>
            )}

            {/* ── Post Load ──────────────────────────────────────────────────── */}
            {tab === 'post' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {formError && <WSBanner type="error" msg={formError} />}

                <WSCard title="Pickup & Delivery Scheduling">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <WSField label="Pickup Date *"><input type="date" value={form.pickupDate} onChange={(e) => setField('pickupDate', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Pickup Time Slot *"><select value={form.pickupTime} onChange={(e) => setField('pickupTime', e.target.value)} style={wsInputStyle}>{timeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></WSField>
                    <WSField label="Delivery Date"><input type="date" value={form.deliveryDate} onChange={(e) => setField('deliveryDate', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Delivery Time Slot"><select value={form.deliveryTime} onChange={(e) => setField('deliveryTime', e.target.value)} style={wsInputStyle}><option>ASAP</option>{timeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></WSField>
                  </div>
                </WSCard>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                  <WSCard title="Collection">
                    <WSField label="Pickup Postcode *"><input value={form.pickupPostcode} onChange={(e) => setField('pickupPostcode', e.target.value)} placeholder="SW1A 1AA" style={wsInputStyle} /></WSField>
                    <WSField label="Pickup Address *"><textarea value={form.pickupAddress} onChange={(e) => setField('pickupAddress', e.target.value)} style={{ ...wsInputStyle, minHeight: '70px', resize: 'vertical' as const }} /></WSField>
                    <WSField label="Contact Name *"><input value={form.collectionContactName} onChange={(e) => setField('collectionContactName', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Phone Number *"><input value={form.collectionContactPhone} onChange={(e) => setField('collectionContactPhone', e.target.value)} style={wsInputStyle} /></WSField>
                  </WSCard>
                  <WSCard title="Delivery">
                    <WSField label="Delivery Postcode *"><input value={form.deliveryPostcode} onChange={(e) => setField('deliveryPostcode', e.target.value)} placeholder="M1 1AE" style={wsInputStyle} /></WSField>
                    <WSField label="Delivery Address *"><textarea value={form.deliveryAddress} onChange={(e) => setField('deliveryAddress', e.target.value)} style={{ ...wsInputStyle, minHeight: '70px', resize: 'vertical' as const }} /></WSField>
                    <WSField label="Contact Name *"><input value={form.deliveryContactName} onChange={(e) => setField('deliveryContactName', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Phone Number *"><input value={form.deliveryContactPhone} onChange={(e) => setField('deliveryContactPhone', e.target.value)} style={wsInputStyle} /></WSField>
                  </WSCard>
                </div>

                <WSCard title="References">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    <WSField label="Customer Reference"><input value={form.customerReference} onChange={(e) => setField('customerReference', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Purchase Order Number"><input value={form.purchaseOrderNumber} onChange={(e) => setField('purchaseOrderNumber', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Booking Reference"><input value={form.bookingReference} onChange={(e) => setField('bookingReference', e.target.value)} style={wsInputStyle} /></WSField>
                  </div>
                </WSCard>

                <WSCard title="Vehicle & Cargo">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <WSField label="Vehicle Type"><select value={form.vehicleLabel} onChange={(e) => setField('vehicleLabel', e.target.value)} style={wsInputStyle}>{vehicleGroups.map(([group, options]) => <optgroup key={group} label={group}>{options.map((option) => <option key={option}>{option}</option>)}</optgroup>)}</select></WSField>
                    <WSField label="Cargo Type"><select value={form.cargoLabel} onChange={(e) => setField('cargoLabel', e.target.value)} style={wsInputStyle}>{cargoOptions.map((option) => <option key={option}>{option}</option>)}</select></WSField>
                    <WSField label="Total Weight (kg)"><input type="number" min="0" value={form.totalWeightKg} onChange={(e) => setField('totalWeightKg', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Cargo Value (GBP)"><input type="number" min="0" value={form.cargoValueGbp} onChange={(e) => setField('cargoValueGbp', e.target.value)} style={wsInputStyle} /></WSField>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <WSField label="Length (cm)"><input type="number" min="0" value={form.lengthCm} onChange={(e) => setField('lengthCm', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Width (cm)"><input type="number" min="0" value={form.widthCm} onChange={(e) => setField('widthCm', e.target.value)} style={wsInputStyle} /></WSField>
                    <WSField label="Height (cm)"><input type="number" min="0" value={form.heightCm} onChange={(e) => setField('heightCm', e.target.value)} style={wsInputStyle} /></WSField>
                  </div>
                </WSCard>

                {form.cargoLabel === 'Pallets' && (
                  <WSCard title="Pallet Workflow">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      <WSField label="Number of Pallets"><input type="number" min="0" value={form.palletCount} onChange={(e) => setField('palletCount', e.target.value)} style={wsInputStyle} /></WSField>
                      <WSField label="Pallet Type"><select value={form.palletType} onChange={(e) => setField('palletType', e.target.value)} style={wsInputStyle}>{palletTypes.map((option) => <option key={option}>{option}</option>)}</select></WSField>
                      <WSField label="Stackable"><select value={form.stackable} onChange={(e) => setField('stackable', e.target.value as 'yes' | 'no')} style={wsInputStyle}><option value="yes">Yes</option><option value="no">No</option></select></WSField>
                    </div>
                  </WSCard>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                  <WSCard title="Collection Loading">
                    {(['Forklift Available', 'Tail Lift Required', 'Handball Required'] as const).map((label, index) => (
                      <WSToggle key={label} label={label} checked={[form.collectionForklift, form.collectionTailLift, form.collectionHandball][index]} onChange={(value) => setField(['collectionForklift', 'collectionTailLift', 'collectionHandball'][index] as keyof LoadForm, value as never)} />
                    ))}
                  </WSCard>
                  <WSCard title="Delivery Unloading">
                    {(['Forklift Available', 'Tail Lift Required', 'Handball Required'] as const).map((label, index) => (
                      <WSToggle key={label} label={label} checked={[form.deliveryForklift, form.deliveryTailLift, form.deliveryHandball][index]} onChange={(value) => setField(['deliveryForklift', 'deliveryTailLift', 'deliveryHandball'][index] as keyof LoadForm, value as never)} />
                    ))}
                  </WSCard>
                </div>

                <WSCard title="Load Options">
                  <WSOptLabel>Access Restrictions</WSOptLabel>
                  <WSChecks items={accessOptions} selected={form.accessRestrictions} onChange={(value) => toggle('accessRestrictions', value)} />
                  <WSOptLabel>Special Requirements</WSOptLabel>
                  <WSChecks items={specialOptions} selected={form.specialRequirements} onChange={(value) => toggle('specialRequirements', value)} />
                  <WSOptLabel>Documents Required</WSOptLabel>
                  <WSChecks items={documentOptions} selected={form.documents} onChange={(value) => toggle('documents', value)} />
                  <div style={{ marginTop: '0.75rem' }}>
                    <WSField label="Other Attachments">
                      <input type="file" multiple onChange={(event) => setField('documents', Array.from(event.target.files ?? []).map((file) => file.name))} style={wsInputStyle} />
                    </WSField>
                  </div>
                </WSCard>

                <WSCard title="Notes">
                  <WSField label="Operational Notes">
                    <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Site instructions, booking windows, driver notes." style={{ ...wsInputStyle, minHeight: '82px', resize: 'vertical' as const }} />
                  </WSField>
                </WSCard>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', padding: '0.5rem 0' }}>
                  <button
                    disabled={saving}
                    onClick={() => void saveLoad(false)}
                    style={{ padding: '0.55rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, color: '#374151', fontSize: '0.85rem', opacity: saving ? 0.6 : 1 }}
                  >
                    Save Draft
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => void saveLoad(true)}
                    style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', background: saving ? '#9ca3af' : '#16a34a', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                  >
                    {saving ? 'Saving...' : 'Publish Load'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Quotes ──────────────────────────────────────────────────────── */}
            {tab === 'quotes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {loading ? (
                  <LoadingCard text="Loading quotes…" />
                ) : bidGroups.length === 0 && quotes.length === 0 ? (
                  <EmptyCard icon="💼" text="No carrier bids received yet. Post a load to start receiving quotes." />
                ) : (
                  <>
                    {bidGroups.map((group) => (
                      <div key={group.jobId} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #1d4ed8', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{group.job?.pickup_location ?? '–'} → {group.job?.delivery_location ?? '–'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                              Pickup: {dateDisplay(group.job?.pickup_datetime ?? null)} · Vehicle: {group.job?.vehicle_type?.replace(/_/g, ' ') ?? '–'}
                            </div>
                          </div>
                          <WSStatusBadge status={group.job?.status ?? 'posted'} />
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                {['Carrier', 'Amount', 'Message', 'Status', 'Action'].map((h) => (
                                  <th key={h} style={{ padding: '0.6rem 0.85rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {group.bids.map((bid, i) => {
                                const isAwarded = bid.status === 'accepted';
                                const canAward = bid.status === 'submitted' && !group.job?.awarded_carrier_company_id;
                                return (
                                  <tr key={bid.id} style={{ borderBottom: i < group.bids.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                    <td style={{ padding: '0.7rem 0.85rem', color: '#374151', fontSize: '0.85rem' }}>{bid.companies?.name ?? 'Carrier'}</td>
                                    <td style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{gbp(bid.bid_price_gbp ?? bid.amount)}</td>
                                    <td style={{ padding: '0.7rem 0.85rem', color: '#64748b', fontSize: '0.82rem' }}>{bid.message || '—'}</td>
                                    <td style={{ padding: '0.7rem 0.85rem' }}><WSStatusBadge status={bid.status} /></td>
                                    <td style={{ padding: '0.7rem 0.85rem' }}>
                                      {isAwarded ? (
                                        <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>✓ Awarded</span>
                                      ) : (
                                        <button
                                          disabled={!canAward || awardingBidId === bid.id}
                                          onClick={() => void awardBid(bid.id)}
                                          style={{ padding: '0.25rem 0.6rem', border: 'none', borderRadius: '5px', background: (!canAward || awardingBidId === bid.id) ? '#9ca3af' : '#16a34a', color: '#fff', cursor: (!canAward || awardingBidId === bid.id) ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                        >
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
                      </div>
                    ))}

                    {quotes.length > 0 && (
                      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>Direct Quotes</div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                {['Pickup', 'Delivery', 'Vehicle', 'Cargo', 'Amount', 'Status'].map((h) => (
                                  <th key={h} style={{ padding: '0.6rem 0.85rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {quotes.map((quote, i) => (
                                <tr key={quote.id} style={{ borderBottom: i < quotes.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                  <td style={{ padding: '0.7rem 0.85rem', color: '#374151', fontSize: '0.85rem' }}>{quote.pickup_location ?? '—'}</td>
                                  <td style={{ padding: '0.7rem 0.85rem', color: '#374151', fontSize: '0.85rem' }}>{quote.delivery_location ?? '—'}</td>
                                  <td style={{ padding: '0.7rem 0.85rem', color: '#64748b', fontSize: '0.82rem' }}>{quote.vehicle_type?.replace(/_/g, ' ') ?? '—'}</td>
                                  <td style={{ padding: '0.7rem 0.85rem', color: '#64748b', fontSize: '0.82rem' }}>{quote.cargo_type ?? '—'}</td>
                                  <td style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{quote.amount ? gbp(quote.amount) : '—'}</td>
                                  <td style={{ padding: '0.7rem 0.85rem' }}><WSStatusBadge status={quote.status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Active Deliveries ────────────────────────────────────────────── */}
            {tab === 'deliveries' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {loading ? (
                  <LoadingCard text="Loading deliveries…" />
                ) : jobs.length === 0 ? (
                  <EmptyCard icon="🚛" text="No deliveries found. Post a load to get started." />
                ) : (
                  jobs.map((job) => (
                    <div key={job.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `3px solid ${JOB_STATUS_COLOR[job.status] ?? '#e2e8f0'}`, borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', padding: '0.75rem 1rem', alignItems: 'start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, minWidth: '38px' }}>From:</span>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{job.pickup_postcode ?? job.pickup_location ?? '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, minWidth: '38px' }}>To:</span>
                            <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.85rem' }}>{job.delivery_postcode ?? job.delivery_location ?? '—'}</span>
                          </div>
                          <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                            POD: {podFilesForJob(job).length > 0 ? '✓ Ready' : 'Pending'}
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, minWidth: '44px' }}>Pickup:</span>
                            <span style={{ fontSize: '0.82rem', color: '#374151' }}>{dateDisplay(job.pickup_datetime)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, minWidth: '44px' }}>Delivery:</span>
                            <span style={{ fontSize: '0.82rem', color: '#374151' }}>{dateDisplay(job.delivery_datetime)}</span>
                          </div>
                          <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                            {job.vehicle_type?.replace(/_/g, ' ') ?? 'Vehicle TBC'}
                          </div>
                        </div>
                        <div style={{ minWidth: '150px', textAlign: 'right' }}>
                          <WSStatusBadge status={job.status} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem', alignItems: 'flex-end' }}>
                            <button
                              onClick={() => { window.location.href = `/customer/jobs/${job.id}`; }}
                              style={{ padding: '0.25rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', cursor: 'pointer', fontSize: '0.73rem', background: '#fff', color: '#374151' }}
                            >
                              View Job
                            </button>
                            {podFilesForJob(job).length > 0 && (
                              <>
                                <button
                                  onClick={() => setPodJobId(podJobId === job.id ? null : job.id)}
                                  style={{ padding: '0.25rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', cursor: 'pointer', fontSize: '0.73rem', background: '#fff', color: '#374151' }}
                                >
                                  View POD
                                </button>
                                <button
                                  onClick={() => void downloadPod(podFilesForJob(job)[0].path)}
                                  style={{ padding: '0.25rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', cursor: 'pointer', fontSize: '0.73rem', background: '#fff', color: '#374151' }}
                                >
                                  Download POD
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {podJobId === job.id && (
                        <div style={{ borderTop: '1px solid #f1f5f9', background: '#fafbfc', padding: '0.5rem 1rem' }}>
                          {podFilesForJob(job).map((file) => (
                            <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                              <span style={{ fontSize: '0.82rem', color: '#374151' }}>{file.label}</span>
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button onClick={() => void openPod(file.path)} style={{ padding: '0.2rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', background: '#fff', color: '#374151' }}>Open</button>
                                <button onClick={() => void downloadPod(file.path)} style={{ padding: '0.2rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem', background: '#fff', color: '#374151' }}>Download</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Customer Invoices ────────────────────────────────────────────── */}
            {tab === 'invoices' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {loading ? (
                  <LoadingCard text="Loading invoices…" />
                ) : invoices.length === 0 ? (
                  <EmptyCard icon="🧾" text="No invoices available yet." />
                ) : (
                  <>
                    <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>Customer Invoices</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              {['Invoice #', 'Job Ref', 'Issue Date', 'Due Date', 'Amount', 'Status', 'Actions'].map((h) => (
                                <th key={h} style={{ padding: '0.6rem 0.85rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((invoice, i) => (
                              <tr key={invoice.id} style={{ borderBottom: i < invoices.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <td style={{ padding: '0.7rem 0.85rem', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>{invoice.invoice_number}</td>
                                <td style={{ padding: '0.7rem 0.85rem', color: '#64748b', fontSize: '0.82rem' }}>{invoice.job_ref || '—'}</td>
                                <td style={{ padding: '0.7rem 0.85rem', color: '#374151', fontSize: '0.82rem' }}>{new Date(invoice.invoice_date).toLocaleDateString('en-GB')}</td>
                                <td style={{ padding: '0.7rem 0.85rem', color: '#374151', fontSize: '0.82rem' }}>{new Date(invoice.due_date).toLocaleDateString('en-GB')}</td>
                                <td style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{gbp(invoice.amount)}</td>
                                <td style={{ padding: '0.7rem 0.85rem' }}><WSStatusBadge status={invoice.status} /></td>
                                <td style={{ padding: '0.7rem 0.85rem' }}>
                                  <button
                                    disabled={downloadingInvoiceId === invoice.id}
                                    onClick={() => void downloadInvoice(invoice)}
                                    style={{ padding: '0.25rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', cursor: downloadingInvoiceId === invoice.id ? 'not-allowed' : 'pointer', fontSize: '0.73rem', background: '#fff', color: '#374151', opacity: downloadingInvoiceId === invoice.id ? 0.6 : 1 }}
                                  >
                                    {downloadingInvoiceId === invoice.id ? 'Preparing...' : 'Download PDF'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {invoices.map((invoice) => {
                      const statusRows = invoiceStatusById.get(invoice.id) ?? [];
                      const paymentRows = invoicePaymentsById.get(invoice.id) ?? [];
                      if (statusRows.length === 0 && paymentRows.length === 0) return null;
                      return (
                        <div key={`${invoice.id}-history`} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{invoice.invoice_number}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>
                                {gbp(invoice.amount)} · Due {new Date(invoice.due_date).toLocaleDateString('en-GB')}
                              </div>
                            </div>
                            <WSStatusBadge status={invoice.status} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', padding: '0.75rem 1rem' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Status History</div>
                              {statusRows.length === 0 ? (
                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>No status history recorded.</p>
                              ) : statusRows.map((row) => (
                                <p key={row.id} style={{ margin: '0 0 0.3rem', fontSize: '0.82rem', color: '#374151' }}>
                                  {row.from_status ?? 'Created'} → {row.to_status} · {dateDisplay(row.changed_at)}{row.note ? ` · ${row.note}` : ''}
                                </p>
                              ))}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Payment History</div>
                              {paymentRows.length === 0 ? (
                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>No payments recorded.</p>
                              ) : paymentRows.map((row) => (
                                <p key={row.id} style={{ margin: '0 0 0.3rem', fontSize: '0.82rem', color: '#374151' }}>
                                  {gbp(row.amount)} · {dateDisplay(row.paid_at)} · {row.settlement_method ?? 'Method not recorded'}{row.external_reference ? ` · Ref ${row.external_reference}` : ''}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ── Updates ─────────────────────────────────────────────────────── */}
            {tab === 'updates' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {loading ? (
                  <LoadingCard text="Loading updates…" />
                ) : updates.length === 0 ? (
                  <EmptyCard icon="🔔" text="No carrier updates or notifications yet." />
                ) : (
                  <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>Carrier Updates & Notifications</div>
                    {updates.map((update, i) => {
                      const payload = update.payload ?? {};
                      const route = ([payload.pickup_location, payload.delivery_location] as (string | undefined)[]).filter(Boolean).join(' → ');
                      return (
                        <div key={update.id} style={{ padding: '0.75rem 1rem', borderBottom: i < updates.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>{update.event_type.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                            {route || update.entity_type} · {dateDisplay(update.created_at)} · {update.status}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const wsInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.65rem',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '0.85rem',
  color: '#0f172a',
  background: '#fff',
  boxSizing: 'border-box',
  font: 'inherit',
};

const JOB_STATUS_COLOR: Record<string, string> = {
  draft:      '#94a3b8',
  posted:     '#1d4ed8',
  quoted:     '#3b82f6',
  awarded:    '#16a34a',
  allocated:  '#0ea5e9',
  collected:  '#0ea5e9',
  in_transit: '#0ea5e9',
  delivered:  '#16a34a',
  invoiced:   '#6366f1',
  paid:       '#15803d',
  cancelled:  '#ef4444',
  disputed:   '#f59e0b',
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  draft:      { bg: '#f1f5f9', color: '#64748b' },
  posted:     { bg: '#dbeafe', color: '#1d4ed8' },
  quoted:     { bg: '#e0f2fe', color: '#075985' },
  awarded:    { bg: '#d1fae5', color: '#065f46' },
  allocated:  { bg: '#d1fae5', color: '#065f46' },
  collected:  { bg: '#d1fae5', color: '#065f46' },
  in_transit: { bg: '#d1fae5', color: '#065f46' },
  delivered:  { bg: '#dcfce7', color: '#15803d' },
  invoiced:   { bg: '#e0e7ff', color: '#3730a3' },
  paid:       { bg: '#dcfce7', color: '#15803d' },
  cancelled:  { bg: '#fee2e2', color: '#991b1b' },
  disputed:   { bg: '#fef3c7', color: '#92400e' },
  submitted:  { bg: '#e0f2fe', color: '#075985' },
  accepted:   { bg: '#d1fae5', color: '#065f46' },
  rejected:   { bg: '#fee2e2', color: '#991b1b' },
  withdrawn:  { bg: '#f3f4f6', color: '#6b7280' },
  sent:       { bg: '#e0f2fe', color: '#075985' },
  overdue:    { bg: '#fee2e2', color: '#991b1b' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function WSBanner({ type, msg }: { type: 'ok' | 'warn' | 'error'; msg: string }) {
  const styles = {
    ok:    { background: '#dcfce7', border: '1px solid #22c55e',  color: '#14532d' },
    warn:  { background: '#fef3c7', border: '1px solid #f59e0b',  color: '#92400e' },
    error: { background: '#fef2f2', border: '1px solid #fca5a5',  color: '#991b1b' },
  };
  return (
    <div style={{ ...styles[type], borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.85rem', fontWeight: 600, fontSize: '0.88rem' }}>
      {msg}
    </div>
  );
}

function WSCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem 1rem' }}>
      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', marginBottom: '0.75rem' }}>{title}</div>
      {children}
    </div>
  );
}

function WSRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.45rem 0' }}>
      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>{title}</div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>{meta}</div>
    </div>
  );
}

function WSEmpty({ text }: { text: string }) {
  return <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>{text}</p>;
}

function WSField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: '4px', marginBottom: '0.6rem' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      {children}
    </div>
  );
}

function WSToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', color: '#374151' }}>
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ flexShrink: 0 }} />
    </label>
  );
}

function WSChecks({ items, selected, onChange }: { items: string[]; selected: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.35rem', marginBottom: '0.5rem' }}>
      {items.map((item) => (
        <label key={item} style={{ border: `1px solid ${selected.includes(item) ? '#1d4ed8' : '#e2e8f0'}`, background: selected.includes(item) ? '#eff6ff' : '#fff', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}>
          <input type="checkbox" checked={selected.includes(item)} onChange={() => onChange(item)} style={{ flexShrink: 0 }} />
          {item}
        </label>
      ))}
    </div>
  );
}

function WSOptLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ margin: '0.75rem 0 0.4rem', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</div>;
}

function WSStatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { bg: '#f1f5f9', color: '#64748b' };
  const label = status.replace(/_/g, ' ');
  return (
    <span style={{ background: s.bg, color: s.color, padding: '0.15rem 0.55rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      {text}
    </div>
  );
}

function EmptyCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{text}</p>
    </div>
  );
}
