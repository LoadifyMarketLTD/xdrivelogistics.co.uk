import { Buffer } from 'node:buffer';
import { hasCompletePodEvidence } from '../jobs/podCompletion';
import type { SupabaseClient } from '@supabase/supabase-js';

type EvidenceImage = {
  bytes: Uint8Array;
  label?: string | null;
};

type InvoicePdfContext = {
  issuerEmail: string | null;
  issuerPhone: string | null;
  issuerWebsite: string | null;
  bankAccountName: string | null;
  bankSortCode: string | null;
  bankAccountNumber: string | null;
  paypalEmail: string | null;
  pickupDateTime: string | null;
  deliveryDateTime: string | null;
  recipientName: string | null;
  cargoDescription: string | null;
  vehicleDescription: string | null;
  logoBytes: Uint8Array | null;
  evidenceImages: EvidenceImage[];
  signatureAttestation: string | null;
};

const clean = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const labelise = (value: unknown) => {
  const raw = clean(value);
  if (!raw) return null;
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const finitePositive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const dataUrlBytes = (value: unknown) => {
  const raw = clean(value);
  if (!raw) return null;
  const match = raw.match(/^data:image\/(?:png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  try {
    return new Uint8Array(Buffer.from(match[1], 'base64'));
  } catch {
    return null;
  }
};

const downloadPodImage = async (supabase: SupabaseClient, path: string) => {
  const { data, error } = await supabase.storage.from('pod-photos').download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return bytes.byteLength ? bytes : null;
};

const loadCompanyLogo = async (supabase: SupabaseClient, value: unknown) => {
  const raw = clean(value);
  if (!raw) return null;

  const inline = dataUrlBytes(raw);
  if (inline?.byteLength) return inline;

  try {
    if (/^https:\/\//i.test(raw)) {
      const response = await fetch(raw, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      return bytes.byteLength ? bytes : null;
    }

    const storagePath = raw.replace(/^company-docs\//, '').replace(/^\/+/, '');
    if (!storagePath || storagePath.includes('..') || storagePath.includes('://')) return null;
    const { data, error } = await supabase.storage.from('company-docs').download(storagePath);
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    return bytes.byteLength ? bytes : null;
  } catch {
    return null;
  }
};

export async function loadInvoicePdfContext({
  supabase,
  companyId,
  jobId,
  requirePod = false,
}: {
  supabase: SupabaseClient;
  companyId: string;
  jobId: string | null;
  requirePod?: boolean;
}): Promise<InvoicePdfContext> {
  const [companyResult, settingsResult] = await Promise.all([
    supabase
      .from('companies')
      .select('email, phone, website, logo_url')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('company_settings')
      .select('bank_account_name, bank_sort_code, bank_account_number, paypal_email')
      .eq('company_id', companyId)
      .maybeSingle(),
  ]);

  const company = companyResult.data as {
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    logo_url?: string | null;
  } | null;
  const logoBytes = await loadCompanyLogo(supabase, company?.logo_url);
  const settings = settingsResult.data as {
    bank_account_name?: string | null;
    bank_sort_code?: string | null;
    bank_account_number?: string | null;
    paypal_email?: string | null;
  } | null;

  let pickupDateTime: string | null = null;
  let deliveryDateTime: string | null = null;
  let recipientName: string | null = null;
  let cargoDescription: string | null = null;
  let vehicleDescription: string | null = null;
  const evidenceImages: EvidenceImage[] = [];
  let signatureAttestation: string | null = null;

  if (jobId) {
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, pod_generated, pod_photos, pickup_datetime, delivery_datetime, pallets, boxes, bags, items, weight_kg, cargo_type, vehicle_type, collection_photo_url, delivery_photos, delivery_signature_data, client_signature_name')
      .eq('id', jobId)
      .maybeSingle();

    if (requirePod && (jobError || !job || !hasCompletePodEvidence(job))) throw new Error('Complete POD is required before sending this invoice.');
    if (job) {
      pickupDateTime = clean(job.pickup_datetime);
      deliveryDateTime = clean(job.delivery_datetime);
      recipientName = clean(job.client_signature_name);
      vehicleDescription = labelise(job.vehicle_type);

      const cargoParts: string[] = [];
      const pallets = finitePositive(job.pallets);
      const boxes = finitePositive(job.boxes);
      const bags = finitePositive(job.bags);
      const items = finitePositive(job.items);
      const weight = finitePositive(job.weight_kg);
      if (pallets) cargoParts.push(`${pallets} ${pallets === 1 ? 'Pallet' : 'Pallets'}`);
      if (boxes) cargoParts.push(`${boxes} ${boxes === 1 ? 'Box' : 'Boxes'}`);
      if (bags) cargoParts.push(`${bags} ${bags === 1 ? 'Bag' : 'Bags'}`);
      if (items) cargoParts.push(`${items} ${items === 1 ? 'Item' : 'Items'}`);
      if (weight) cargoParts.push(`${weight} kg`);
      if (!cargoParts.length) {
        const cargoType = labelise(job.cargo_type);
        if (cargoType) cargoParts.push(cargoType);
      }
      cargoDescription = cargoParts.join(' · ') || null;

      const imagePaths: Array<{ path: string; label: string }> = [];
      const collectionPath = clean(job.collection_photo_url);
      if (collectionPath) imagePaths.push({ path: collectionPath, label: 'Collection' });
      for (const [paths, label] of [[job.delivery_photos, 'Delivery'], [job.pod_photos, 'POD']] as const) {
        if (Array.isArray(paths)) for (const path of paths) {
          const cleaned = clean(path);
          if (cleaned && !imagePaths.some(image => image.path === cleaned)) imagePaths.push({ path: cleaned, label });
        }
      }
      for (const image of imagePaths) {
        if (!image.path.startsWith(`${companyId}/${jobId}/`) || image.path.includes('..') || image.path.includes('://') || image.path.includes('\\')) {
          if (requirePod) throw new Error('POD evidence does not belong to this job and supplier.');
          continue;
        }
        const bytes = await downloadPodImage(supabase, image.path);
        if (bytes) evidenceImages.push({ bytes, label: image.label });
        else if (requirePod) throw new Error('POD evidence could not be downloaded. Retry before sending.');
      }
      const raw = job.delivery_signature_data;
      const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
      const value = record?.value ?? raw;
      const signature = dataUrlBytes(value);
      if (signature) evidenceImages.push({ bytes: signature, label: 'Signature' });
      else if (record?.type === 'recipient_typed_name_attestation') {
        if (requirePod && (record.job_id !== jobId || record.recipient_name !== job.client_signature_name
          || !imagePaths.some(image => image.path === record.evidence_path))) throw new Error('Recipient attestation does not match the job evidence.');
        signatureAttestation = `Recipient typed-name attestation: ${clean(record.recipient_name) ?? 'Unknown'}. Confirmed: ${clean(record.confirmed_at) ?? 'Unknown'}. Evidence: ${clean(record.evidence_path) ?? 'Unknown'}`;
      } else {
        const path = clean(value);
        if (path?.startsWith(`${companyId}/${jobId}/`) && !path.includes('..') && !path.includes('://')) {
          const bytes = await downloadPodImage(supabase, path);
          if (bytes) evidenceImages.push({ bytes, label: 'Signature' });
          else if (requirePod) throw new Error('Recipient signature could not be downloaded.');
        } else if (requirePod) throw new Error('Recipient signature format is unsupported.');
      }
    }
  }

  return {
    issuerEmail: clean(company?.email),
    issuerPhone: clean(company?.phone),
    issuerWebsite: clean(company?.website),
    bankAccountName: clean(settings?.bank_account_name),
    bankSortCode: clean(settings?.bank_sort_code),
    bankAccountNumber: clean(settings?.bank_account_number),
    paypalEmail: clean(settings?.paypal_email),
    pickupDateTime,
    deliveryDateTime,
    recipientName,
    cargoDescription,
    vehicleDescription,
    logoBytes,
    evidenceImages,
    signatureAttestation,
  };
}
