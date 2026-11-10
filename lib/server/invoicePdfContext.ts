import { Buffer } from 'node:buffer';
import { hasCompletePodEvidence } from '../jobs/podCompletion';
import { officialXDriveLogoBytes } from './officialXDrivePdfLogo';
import { isUnrelatedXDriveInvoicePdf } from './podEvidenceClassification';
import type { ProfessionalPodDetails, HandoverDetails } from './professionalPodPdf';
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
  deliveredAt: string | null;
  leftAt: string | null;
  deliveryNotes: string | null;
  recipientName: string | null;
  cargoDescription: string | null;
  vehicleDescription: string | null;
  logoBytes: Uint8Array | null;
  evidenceImages: EvidenceImage[];
  signatureAttestation: string | null;
  podSummary: { deliveredOn: string | null; receivedBy: string | null; leftAt: string | null; noOfItems: number | null; deliveryStatus: string | null; deliveryNotes: string | null } | null;
  podDetails: ProfessionalPodDetails | null;
  podHandover: HandoverDetails | null;
  podSignatureDataUrl: string | null;
  podDeliveryPhotoCount: number;
};

const clean = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const cleanIssuerWebsite = (value: unknown) => {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'xdrivelogistics.co.uk' || host === 'app.xdrivelogistics.co.uk') return null;
    return raw;
  } catch {
    return raw;
  }
};

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
      .select('email, phone, website')
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
  const logoBytes = await officialXDriveLogoBytes();
  const settings = settingsResult.data as {
    bank_account_name?: string | null;
    bank_sort_code?: string | null;
    bank_account_number?: string | null;
    paypal_email?: string | null;
  } | null;

  let pickupDateTime: string | null = null;
  let deliveryDateTime: string | null = null;
  let deliveredAt: string | null = null;
  let leftAt: string | null = null;
  let deliveryNotes: string | null = null;
  let recipientName: string | null = null;
  let signedPodConfirmed = false;
  let cargoDescription: string | null = null;
  let vehicleDescription: string | null = null;
  const evidenceImages: EvidenceImage[] = [];
  let signatureAttestation: string | null = null;
  let podSummary: InvoicePdfContext['podSummary'] = null;
  let podDetails: ProfessionalPodDetails | null = null;
  let podHandover: HandoverDetails | null = null;
  let podSignatureDataUrl: string | null = null;
  let podDeliveryPhotoCount = 0;

  if (jobId) {
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, pod_generated, pod_photos, damage_photos, pickup_photos, pickup_datetime, delivery_datetime, delivered_at, delivery_notes, pallets, boxes, bags, items, weight_kg, cargo_type, vehicle_type, collection_photo_url, delivery_photos, delivery_signature_data, client_signature_name, pickup_location, delivery_location, pod_generated_at, collection_contact_name, delivery_contact_name, no_of_items, delivery_status')
      .eq('id', jobId)
      .maybeSingle();

    if (requirePod && (jobError || !job || !hasCompletePodEvidence(job))) throw new Error('Complete POD is required before sending this invoice.');
    // Recover authoritative signed handover metadata, retaining the official PDF renderer.
    const { data: pod, error: podError } = await supabase.from('proof_of_delivery')
      .select('delivered_on, received_by, left_at, no_of_items, delivery_status, delivery_notes, photo_urls')
      .eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (requirePod && (podError || !pod)) throw new Error('Complete signed POD record is missing or unavailable.');
    if (pod) {
      if (requirePod && (!clean(pod.received_by) || !clean(pod.delivered_on) || !clean(pod.delivery_status) || pod.no_of_items == null || !Number.isFinite(Number(pod.no_of_items)))) throw new Error('POD handover record is incomplete.');
      podSummary = { deliveredOn: clean(pod.delivered_on), receivedBy: clean(pod.received_by), leftAt: clean(pod.left_at), noOfItems: pod.no_of_items == null ? null : Number(pod.no_of_items), deliveryStatus: clean(pod.delivery_status), deliveryNotes: clean(pod.delivery_notes) };
      deliveredAt = clean(pod.delivered_on) || deliveredAt;
      recipientName = clean(pod.received_by) || recipientName;
      leftAt = clean(pod.left_at) || leftAt;
      deliveryNotes = clean(pod.delivery_notes) || deliveryNotes;
    }
    if (job) {
      pickupDateTime = clean(job.pickup_datetime);
      deliveryDateTime = clean(job.delivery_datetime);
      deliveredAt = deliveredAt || clean(job.delivered_at);
      recipientName = recipientName || clean(job.client_signature_name);
      signedPodConfirmed = hasCompletePodEvidence(job);
      if (signedPodConfirmed) {
        podDetails = { ...job, id: job.id };
        podDeliveryPhotoCount = Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0;
      }
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
      if (Array.isArray(job.pickup_photos)) for (const path of job.pickup_photos) {
        const cleaned = clean(path);
        if (cleaned && !imagePaths.some(image => image.path === cleaned)) imagePaths.push({ path: cleaned, label: 'Collection' });
      }
      for (const [paths, label] of [[job.delivery_photos, 'Delivery'], [job.pod_photos, 'POD'], [job.damage_photos, 'Damage evidence']] as const) {
        if (Array.isArray(paths)) for (const path of paths) {
          const cleaned = clean(path);
          if (cleaned && !imagePaths.some(image => image.path === cleaned)) imagePaths.push({ path: cleaned, label });
        }
      }
      if (pod && Array.isArray(pod.photo_urls)) for (const path of pod.photo_urls) {
        const cleaned = clean(path);
        if (cleaned && !imagePaths.some(image => image.path === cleaned)) imagePaths.push({ path: cleaned, label: 'POD document evidence' });
      }
      for (const image of imagePaths) {
        if (!image.path.startsWith(`${companyId}/${jobId}/`) || image.path.includes('..') || image.path.includes('://') || image.path.includes('\\')) {
          if (requirePod) throw new Error('POD evidence does not belong to this job and supplier.');
          continue;
        }
        if (image.label === 'POD' && isUnrelatedXDriveInvoicePdf(image.path)) continue;
        const bytes = await downloadPodImage(supabase, image.path);
        if (bytes) evidenceImages.push({ bytes, label: image.label });
        else if (requirePod) throw new Error('POD evidence could not be downloaded. Retry before sending.');
      }
      const raw = job.delivery_signature_data;
      const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
      const value = record?.value ?? raw;
      const signature = dataUrlBytes(value);
      if (signature) {
        evidenceImages.push({ bytes: signature, label: 'Signature' });
        if (signedPodConfirmed && typeof value === 'string' && /^data:image\/(?:png|jpeg);base64,/i.test(value)) {
          podSignatureDataUrl = value;
        }
      }
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

  // The signed POD draft is the authoritative record for handover metadata.
  // A blank draft field never replaces a valid invoice/job snapshot.
  if (jobId && signedPodConfirmed) {
    const { data: handover } = await supabase.from('driver_pod_drafts')
      .select('form_data').eq('job_id', jobId).order('updated_at', { ascending: false })
      .limit(1).maybeSingle();
    const draft = handover?.form_data && typeof handover.form_data === 'object' && !Array.isArray(handover.form_data)
      ? handover.form_data as Record<string, unknown> : null;
    leftAt = leftAt || clean(draft?.leftAt);
    deliveryNotes = clean(draft?.notes) || deliveryNotes;
    podHandover = {
      leftAt: leftAt,
      itemCount: podSummary?.noOfItems ?? ((typeof draft?.itemCount === 'string' || typeof draft?.itemCount === 'number') ? draft.itemCount : null),
      deliveryStatus: podSummary?.deliveryStatus || clean(draft?.deliveryStatus),
      notes: podSummary?.deliveryNotes || clean(draft?.notes),
    };
  }

  return {
    issuerEmail: clean(company?.email),
    issuerPhone: clean(company?.phone),
    issuerWebsite: cleanIssuerWebsite(company?.website),
    bankAccountName: clean(settings?.bank_account_name),
    bankSortCode: clean(settings?.bank_sort_code),
    bankAccountNumber: clean(settings?.bank_account_number),
    paypalEmail: clean(settings?.paypal_email),
    pickupDateTime,
    deliveryDateTime,
    deliveredAt,
    leftAt,
    deliveryNotes,
    recipientName,
    cargoDescription,
    vehicleDescription,
    logoBytes,
    evidenceImages,
    signatureAttestation,
    podSummary,
    podDetails,
    podHandover,
    podSignatureDataUrl,
    podDeliveryPhotoCount,
  };
}
