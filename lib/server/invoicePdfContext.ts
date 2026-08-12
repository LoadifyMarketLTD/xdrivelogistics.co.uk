import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';

type EvidenceImage = {
  bytes: Uint8Array;
  label?: string | null;
};

type InvoicePdfContext = {
  issuerEmail: string | null;
  issuerPhone: string | null;
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

const loadLogo = async (origin: string) => {
  try {
    const response = await fetch(`${origin.replace(/\/$/, '')}/xdrive-logo-primary.png`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength ? bytes : null;
  } catch {
    return null;
  }
};

export async function loadInvoicePdfContext({
  supabase,
  companyId,
  jobId,
  origin,
}: {
  supabase: SupabaseClient;
  companyId: string;
  jobId: string | null;
  origin: string;
}): Promise<InvoicePdfContext> {
  const [companyResult, settingsResult, logoBytes] = await Promise.all([
    supabase
      .from('companies')
      .select('email, phone')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('company_settings')
      .select('bank_account_name, bank_sort_code, bank_account_number, paypal_email')
      .eq('company_id', companyId)
      .maybeSingle(),
    loadLogo(origin),
  ]);

  const company = companyResult.data as { email?: string | null; phone?: string | null } | null;
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

  if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('pickup_datetime, delivery_datetime, pallets, boxes, bags, items, weight_kg, cargo_type, vehicle_type, collection_photo_url, delivery_photos, delivery_signature_data, client_signature_name')
      .eq('id', jobId)
      .maybeSingle();

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
      if (Array.isArray(job.delivery_photos)) {
        for (const path of job.delivery_photos) {
          const cleaned = clean(path);
          if (cleaned) imagePaths.push({ path: cleaned, label: 'Delivery' });
          if (imagePaths.length >= 3) break;
        }
      }

      for (const image of imagePaths) {
        const bytes = await downloadPodImage(supabase, image.path);
        if (bytes) evidenceImages.push({ bytes, label: image.label });
      }

      const signature = dataUrlBytes(job.delivery_signature_data);
      if (signature) evidenceImages.push({ bytes: signature, label: 'Signature' });
    }
  }

  return {
    issuerEmail: clean(company?.email),
    issuerPhone: clean(company?.phone),
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
    evidenceImages: evidenceImages.slice(0, 4),
  };
}
