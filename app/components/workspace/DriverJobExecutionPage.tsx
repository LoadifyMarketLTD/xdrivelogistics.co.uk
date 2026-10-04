'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DbJob } from '../../../lib/types/database';
import { getLoadDetailSections } from '../../../lib/loadPostingDetails';
import { canonicalExecutionStatus, nextDriverExecutionStatus } from '../../../lib/jobs/jobLifecyclePresentation';
import { hasCompletePodEvidence } from '../../../lib/jobs/podCompletion';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from './WorkspaceUI';
import WorkspaceJobReplay from './WorkspaceJobReplay';

const statusLabel: Record<string, string> = {
  awarded: 'Awarded', allocated: 'Allocated', accepted: 'Accepted', on_my_way: 'On my way to pickup',
  on_site_pickup: 'On site (pickup)', loaded: 'Loaded', in_transit: 'On my way to delivery',
  on_site_delivery: 'On site (delivery)', delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled',
};

const nextActionLabel: Record<string, string> = {
  accepted: 'Accept Job',
  on_my_way: 'On my Way to Pickup',
  on_site_pickup: 'On Site (Pickup)',
  loaded: 'Confirm Loaded',
  in_transit: 'On my Way to Delivery',
  on_site_delivery: 'On Site (Delivery)',
  delivered: 'Confirm Delivered',
  completed: 'Complete Job',
};

type JobSheet = {
  reference: string;
  loadId: string;
  status: string;
  bookedAt: string | null;
  postingCompanyId: string | null;
  bookedBy: string;
  memberCode: string | null;
  memberPhone: string | null;
  executingCompanyId: string | null;
  driverId: string;
  driverName: string | null;
  agreedRate: number | null;
  agreedGross: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  currency: string;
  paymentTerms: string | null;
  paymentDueDays: number | null;
  commercialSnapshotAvailable: boolean;
  customerName: string | null;
  customerReference: string | null;
  purchaseOrderNumber: string | null;
  bookingReference: string | null;
  distanceMiles: number | null;
  requestedVehicle: string | null;
  allocatedVehicle: {
    id: string | null;
    ref: string | null;
    type: string | null;
    make: string | null;
    model: string | null;
    payloadKg: number | null;
    palletsCapacity: number | null;
    hasTailLift: boolean | null;
    source: 'job' | 'none';
  };
  cargo: {
    type: string | null;
    weightKg: number | null;
    pallets: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    cargoValueGbp: number | null;
    palletType: string | null;
    stackable: boolean | null;
  };
  requirements: string[];
  hardCopyPod: string;
  podRequired: boolean;
  pickup: {
    address: string | null;
    postcode: string | null;
    dateTime: string | null;
    slot: string | null;
    contactName: string | null;
    contactPhone: string | null;
    notes: string | null;
  };
  delivery: {
    address: string | null;
    postcode: string | null;
    dateTime: string | null;
    slot: string | null;
    contactName: string | null;
    contactPhone: string | null;
    notes: string | null;
  };
  pod: {
    generated: boolean | null;
    generatedAt: string | null;
    photoCount: number;
    photoPaths: string[];
    photoUrls: string[];
    signatureData: string | null;
    receiverName: string | null;
    signatureRecorded: boolean;
    deliveredOn: string | null;
    leftAt: string | null;
    itemCount: number | null;
    deliveryStatus: string | null;
    notes: string | null;
  };
  publicQuoteNotes: string | null;
  executionInstructions: string | null;
  driverNotes: string | null;
  documentChecklist: string[];
  timeline: Array<{ id: string | null; eventType: string; message: string | null; meta: unknown; createdAt: string | null }>;
  documents: Array<{ id: string | null; type: string; fileName: string | null; filePath: string | null; createdAt: string | null }>;
  invoices: Array<{ id: string | null; number: string | null; status: string | null; paymentStatus: string | null; amount: number | null; currency: string; dueDate: string | null }>;
  partial: boolean;
  unavailable: {
    bodyType: string;
    extras: string;
    bookingFooter: string;
  };
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not supplied' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const money = (amount: number | null | undefined, currency = 'GBP') => amount == null
  ? 'Not supplied'
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

const mapsUrl = (address: string, postcode?: string | null) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(postcode ? `${address}, ${postcode}` : address)}`;

const wazeUrl = (address: string, postcode?: string | null) =>
  `https://www.waze.com/ul?q=${encodeURIComponent(postcode ? `${address}, ${postcode}` : address)}&navigate=yes`;

const routeMapUrl = (job: DbJob) => {
  const params = new URLSearchParams({ api: '1' });
  if (job.pickup_postcode || job.pickup_location) params.set('origin', job.pickup_postcode || job.pickup_location || '');
  if (job.delivery_postcode || job.delivery_location) params.set('destination', job.delivery_postcode || job.delivery_location || '');
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const vehicleName = (value: string | null | undefined) => value
  ? (VEHICLE_TYPE_LABELS[value] ?? value.replace(/_/g, ' '))
  : 'Not supplied';

const requiresHardCopyPod = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) return false;
  if (['no', 'none', 'false', '0', 'n/a'].includes(normalized)) return false;
  if (normalized.includes('not required') || normalized.includes('not supplied') || normalized.includes('no additional') || normalized.includes('no hard-copy') || normalized.includes('no hard copy')) return false;
  return true;
};

export default function DriverJobExecutionPage({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = user?.driverId?.trim() ?? '';
  const companyId = user?.companyId ?? '';
  const canGenerateInvoices = user?.membershipRole === 'owner' || user?.membershipRole === 'admin';
  const [job, setJob] = useState<DbJob | null>(null);
  const [sheet, setSheet] = useState<JobSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [collectionPhotos, setCollectionPhotos] = useState<string[]>([]);
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const [pendingPodPhotos, setPendingPodPhotos] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [hardCopyAcknowledged, setHardCopyAcknowledged] = useState(false);
  const [podDeliveryStatus, setPodDeliveryStatus] = useState('Completed Delivery');
  const [podLeftAt, setPodLeftAt] = useState('');
  const [podItemCount, setPodItemCount] = useState('');
  const [podDeliveredOn, setPodDeliveredOn] = useState('');
  const [showPodDetails, setShowPodDetails] = useState(false);
  const [podPhotoUrls, setPodPhotoUrls] = useState<string[]>([]);
  const [signing, setSigning] = useState(false);
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const collectionCameraInput = useRef<HTMLInputElement>(null);
  const collectionGalleryInput = useRef<HTMLInputElement>(null);
  const deliveryInput = useRef<HTMLInputElement>(null);

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  }, []);

  const loadJob = useCallback(async () => {
    if (!jobId || !driverId) return;
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.from('jobs').select('*').eq('id', jobId).eq('assigned_driver_id', driverId).maybeSingle();
    if (loadError || !data) {
      setError(loadError?.message ?? 'This job is not assigned to your driver account.');
      setJob(null);
      setSheet(null);
      setLoading(false);
      return;
    }

    const row = data as DbJob;
    setJob(row);
    setNotes(row.driver_notes ?? '');
    const pickupPhotos = Array.isArray(row.pickup_photos)
      ? row.pickup_photos.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : row.collection_photo_url
        ? [row.collection_photo_url]
        : [];
    setCollectionPhotos([...new Set(pickupPhotos)].slice(0, 10));
    setDeliveryPhotos(Array.isArray(row.delivery_photos) ? row.delivery_photos : []);
    setPendingPodPhotos([]);
    setRecipientName(row.client_signature_name ?? '');
    setHardCopyAcknowledged(false);

    const auth = await authHeader();
    if (auth) {
      try {
        const response = await fetch(`/api/driver/jobs/${encodeURIComponent(jobId)}/sheet`, { headers: { Authorization: auth }, cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as { sheet?: JobSheet; error?: string };
        if (response.ok) {
          const nextSheet = payload.sheet ?? null;
          setSheet(nextSheet);
          if (nextSheet?.pod) {
            setPodDeliveryStatus(nextSheet.pod.deliveryStatus ?? 'Completed Delivery');
            setPodLeftAt(nextSheet.pod.leftAt ?? '');
            setPodItemCount(nextSheet.pod.itemCount == null ? '' : String(nextSheet.pod.itemCount));
            setPodDeliveredOn(nextSheet.pod.deliveredOn ?? '');
          }
        }
      } catch {
        // Execution remains usable if enrichment is temporarily unavailable.
      }
    }
    setLoading(false);
  }, [authHeader, driverId, jobId]);

  useEffect(() => { void loadJob(); }, [loadJob]);

  const uploadImage = async (file: File, kind: 'collection' | 'delivery') => {
    if (!companyId) throw new Error('Company context is missing.');
    if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded here.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Images must be 15 MB or smaller.');
    const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
    const evidenceFolder = kind === 'delivery' ? 'photos' : 'collection';
    const path = `${companyId}/${jobId}/${evidenceFolder}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('pod-photos').upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);
    return path;
  };

  const uploadCollectionEvidence = async (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Collection photos must be JPEG or PNG images.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Each collection photo must be 10 MB or smaller.');
    const auth = await authHeader();
    if (!auth) throw new Error('Your XDrive session is not available. Please sign in again.');
    const extension = file.type === 'image/png' ? 'png' : 'jpg';
    const objectName = `collection-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const response = await fetch(`/api/driver/web/jobs/${encodeURIComponent(jobId)}/evidence`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': file.type,
        'x-xdrive-evidence-kind': 'collection',
        'x-xdrive-evidence-category': 'photos',
        'x-xdrive-evidence-name': objectName,
      },
      body: file,
    });
    const payload = await response.json().catch(() => ({})) as { storagePath?: string; error?: string };
    if (!response.ok || !payload.storagePath) throw new Error(payload.error || 'Collection photo upload failed.');
    return payload.storagePath;
  };

  const selectCollectionPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const remaining = Math.max(0, 10 - collectionPhotos.length);
    if (remaining === 0) { setError('A maximum of 10 collection photos can be attached.'); return; }
    if (files.length > remaining) { setError(`You can add up to ${remaining} more collection photo${remaining === 1 ? '' : 's'}.`); return; }
    setWorking(true); setError(''); setMessage('');
    try {
      const uploaded: string[] = [];
      for (const file of files) uploaded.push(await uploadCollectionEvidence(file));
      setCollectionPhotos((current) => [...new Set([...current, ...uploaded])].slice(0, 10));
      setMessage(`${uploaded.length} collection photo${uploaded.length === 1 ? '' : 's'} added.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Collection photo upload failed.');
      await loadJob();
    } finally { setWorking(false); }
  };
  const selectDeliveryPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const remaining = Math.max(0, 10 - deliveryPhotos.length);
    if (remaining === 0) { setError('A maximum of 10 delivery photos can be attached to POD.'); return; }
    if (files.length > remaining) { setError(`You can add up to ${remaining} more POD photo${remaining === 1 ? '' : 's'}.`); return; }
    setWorking(true); setError(''); setMessage('');
    try {
      const paths: string[] = [];
      for (const file of files) paths.push(await uploadImage(file, 'delivery'));
      setDeliveryPhotos((current) => [...new Set([...current, ...paths])].slice(0, 10));
      setPendingPodPhotos((current) => [...new Set([...current, ...paths])].slice(0, 10));
      setMessage(`${paths.length} POD photo${paths.length === 1 ? '' : 's'} added.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Delivery photo upload failed.'); }
    finally { setWorking(false); }
  };

  const pointer = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const source = 'touches' in event ? event.touches[0] : event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  };

  const startSignature = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const point = pointer(event);
    const context = signatureRef.current?.getContext('2d');
    if (!point || !context) return;
    setSigning(true); context.beginPath(); context.moveTo(point.x, point.y);
  };

  const drawSignature = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!signing) return;
    event.preventDefault();
    const point = pointer(event);
    const context = signatureRef.current?.getContext('2d');
    if (!point || !context) return;
    context.lineWidth = 2; context.lineCap = 'round'; context.strokeStyle = '#0b2f6b'; context.lineTo(point.x, point.y); context.stroke();
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const signatureData = () => {
    const canvas = signatureRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return null;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 !== 3 && value !== 0) ? canvas.toDataURL('image/png') : null;
  };

  const completePod = async () => {
    if (!job || !driverId) return;
    const status = canonicalExecutionStatus(job.current_status ?? job.status);
    if (!['delivered', 'completed', 'invoiced'].includes(status)) {
      setError('Mark the job Delivered before completing POD.');
      return;
    }
    if (hasCompletePodEvidence(job)) {
      setMessage('POD is already complete. Invoice creation is now available.');
      return;
    }
    if (!deliveryPhotos.length) {
      setError('At least one delivery photo is required to complete POD.');
      return;
    }
    if (!recipientName.trim()) {
      setError('Recipient name is required to complete POD.');
      return;
    }
    const newSignature = signatureData();
    const storedSignature = job.delivery_signature_data;
    const hasStoredSignature = typeof storedSignature === 'string'
      ? storedSignature.trim().length > 0
      : Boolean(storedSignature && typeof storedSignature === 'object');
    if (!newSignature && !hasStoredSignature) {
      setError('Recipient signature is required to complete POD.');
      return;
    }

    const hardCopyRequired = requiresHardCopyPod(sheet?.hardCopyPod ?? job.hard_copy_pod);
    if (hardCopyRequired && !hardCopyAcknowledged) {
      setError('Confirm the hard-copy POD requirement before completing POD.');
      return;
    }

    setWorking(true); setError(''); setMessage('');
    try {
      const auth = await authHeader();
      if (!auth) throw new Error('Your XDrive session is not available. Please sign in again.');
      const response = await fetch(`/api/driver/web/jobs/${encodeURIComponent(job.id)}/pod`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          signatureData: newSignature ?? '',
          photoUris: pendingPodPhotos,
          damagePhotoUris: [],
          documentUris: [],
          deliveryStatus: podDeliveryStatus,
          leftAt: podLeftAt.trim() || undefined,
          itemCount: podItemCount.trim() ? Number(podItemCount) : undefined,
          deliveredOn: podDeliveredOn || undefined,
          hardCopyAcknowledged: hardCopyRequired ? hardCopyAcknowledged : false,
          notes: notes.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'POD could not be completed.');
      setMessage('POD completed. Invoice creation is now available.');
      clearSignature();
      await loadJob();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'POD could not be completed.');
    } finally {
      setWorking(false);
    }
  };

  const createInvoice = async () => {
    if (!job || !canGenerateInvoices) return;
    if (!hasCompletePodEvidence(job)) {
      setError('Complete POD before creating an invoice. POD must include delivery evidence, recipient name and signature.');
      return;
    }

    setWorking(true); setError(''); setMessage('');
    try {
      const auth = await authHeader();
      if (!auth) throw new Error('Your XDrive session is not available. Please sign in again.');
      const response = await fetch(`/api/driver/finance/jobs/${encodeURIComponent(job.id)}/generate-invoice`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => ({})) as { invoice?: { id?: string }; error?: string };
      if (!response.ok || !payload.invoice?.id) throw new Error(payload.error || 'Invoice could not be created.');
      setMessage('Draft invoice created. Review it before sending.');
      router.push(`/driver/finance/invoices/${payload.invoice.id}/edit`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invoice could not be created.');
    } finally {
      setWorking(false);
    }
  };

  const moveStatus = async (nextStatus: string) => {
    if (!job || !driverId) return;
    setWorking(true); setError(''); setMessage('');
    if (nextStatus === 'completed' && !hasCompletePodEvidence(job)) {
      setError('Complete POD before completing this job.');
      setWorking(false);
      return;
    }
    const fields: Record<string, unknown> = {};
    if (nextStatus === 'loaded') {
      if (!collectionPhotos.length) { setError('At least one collection photo is required before the job can be marked loaded.'); setWorking(false); return; }
      const auth = await authHeader();
      if (!auth) { setError('Your XDrive session is not available. Please sign in again.'); setWorking(false); return; }
      const handoverResponse = await fetch(`/api/driver/web/jobs/${encodeURIComponent(job.id)}/handover`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPaths: collectionPhotos, notes: notes.trim() || undefined }),
      });
      const handoverPayload = await handoverResponse.json().catch(() => ({})) as { error?: string };
      if (!handoverResponse.ok) { setError(handoverPayload.error || 'Collection handover could not be saved.'); setWorking(false); return; }

      const loadedResponse = await fetch(`/api/driver/web/jobs/${encodeURIComponent(job.id)}/loaded`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverNotes: notes.trim() || null }),
      });
      const loadedPayload = await loadedResponse.json().catch(() => ({})) as { error?: string };
      if (!loadedResponse.ok) { setError(loadedPayload.error || 'Job could not be marked loaded.'); setWorking(false); return; }
      setMessage('Job updated: Loaded.');
      await loadJob();
      setWorking(false);
      return;
    }    if (nextStatus === 'delivered') {
      const signature = signatureData();
      if (!deliveryPhotos.length) { setError('At least one delivery photo is required.'); setWorking(false); return; }
      if (!recipientName.trim()) { setError('Recipient name is required.'); setWorking(false); return; }
      if (!signature) { setError('Recipient signature is required.'); setWorking(false); return; }
      fields.p_delivery_photos = deliveryPhotos;
      fields.p_delivery_signature_data = signature;
      fields.p_client_signature_name = recipientName.trim();
    }
    const { error: transitionError } = await supabase.rpc('driver_update_job_status_atomic', {
      p_driver_id: driverId, p_job_id: job.id, p_next_status: nextStatus, p_driver_notes: notes.trim() || null, ...fields,
    });
    if (transitionError) setError(transitionError.message);
    else { setMessage(`Job updated: ${statusLabel[nextStatus] ?? nextStatus}.`); await loadJob(); }
    setWorking(false);
  };

  if (loading) return <PageFrame><EmptyState title="Loading assigned job…" /></PageFrame>;
  if (!job) return <PageFrame><AlertBanner tone="danger">{error || 'Job not found.'}</AlertBanner></PageFrame>;

  const currentStatus = canonicalExecutionStatus(job.current_status ?? job.status);
  const nextStatus = nextDriverExecutionStatus(currentStatus);
  const nextLabel = nextStatus ? nextActionLabel[nextStatus] ?? statusLabel[nextStatus] ?? nextStatus : null;
  const podComplete = hasCompletePodEvidence(job);
  const hardCopyRequired = requiresHardCopyPod(sheet?.hardCopyPod ?? job.hard_copy_pod);
  const canShowLifecycleAction = !(nextStatus === 'completed' && !podComplete);
  const navigationStage = currentStatus === 'on_my_way' ? 'pickup' : currentStatus === 'in_transit' ? 'delivery' : null;
  const navigationAddress = navigationStage === 'pickup'
    ? (sheet?.pickup.address ?? job.pickup_location ?? '')
    : navigationStage === 'delivery'
      ? (sheet?.delivery.address ?? job.delivery_location ?? '')
      : '';
  const openPodDetails = () => {
    setShowPodDetails(true);
    setPodPhotoUrls(sheet?.pod.photoUrls ?? []);
  };

  const navigationPostcode = navigationStage === 'pickup'
    ? (sheet?.pickup.postcode ?? job.pickup_postcode)
    : navigationStage === 'delivery'
      ? (sheet?.delivery.postcode ?? job.delivery_postcode)
      : null;
  const loadSections = getLoadDetailSections(job);
  const history = Array.isArray(job.status_history) ? job.status_history : [];
  const timelineRows = sheet?.timeline.length
    ? sheet.timeline.map((entry) => [statusLabel[entry.eventType] ?? entry.eventType.replace(/_/g, ' '), formatDateTime(entry.createdAt), entry.message ?? '—'])
    : history.map((entry) => [statusLabel[String(entry.status)] ?? String(entry.status ?? 'Update'), formatDateTime(entry.timestamp), entry.note ?? '—']);

  const requestedVehicle = vehicleName(sheet?.requestedVehicle ?? job.requested_vehicle_label ?? job.vehicle_type);
  const allocatedVehicleType = vehicleName(sheet?.allocatedVehicle.type);
  const allocatedVehicleName = [sheet?.allocatedVehicle.make, sheet?.allocatedVehicle.model].filter(Boolean).join(' ');
  const allocatedVehicleSummary = sheet?.allocatedVehicle.source === 'job'
    ? [allocatedVehicleName, allocatedVehicleType, sheet.allocatedVehicle.ref].filter(Boolean).join(' · ') || 'Allocated vehicle recorded'
    : 'Not supplied';
  const allocatedVehicleDetail = sheet?.allocatedVehicle.source === 'job'
    ? 'Job-specific allocated vehicle source.'
    : undefined;
  const cargoDimensions = sheet && [sheet.cargo.lengthCm, sheet.cargo.widthCm, sheet.cargo.heightCm].some((value) => value != null)
    ? `${[sheet.cargo.lengthCm, sheet.cargo.widthCm, sheet.cargo.heightCm].map((value) => value ?? '—').join(' × ')} cm`
    : 'Not supplied';
  const carrierIdentity = sheet?.executingCompanyId
    ? sheet.executingCompanyId === companyId
      ? `Your carrier company · ${sheet.executingCompanyId.slice(0, 8).toUpperCase()}`
      : `Carrier company · ${sheet.executingCompanyId.slice(0, 8).toUpperCase()}`
    : 'Not supplied';
  const bookingNotes: Array<readonly [string, string]> = [];
  if (sheet?.executionInstructions) bookingNotes.push(['Private execution instructions', sheet.executionInstructions]);
  if (sheet?.publicQuoteNotes) bookingNotes.push(['Public quote notes retained on booking', sheet.publicQuoteNotes]);
  const stopInstructions = [sheet?.pickup.notes, sheet?.delivery.notes].filter((value): value is string => Boolean(value?.trim()));
  const paperworkInstructions = sheet?.documentChecklist ?? [];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Marketplace job"
        title={`${job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → ${job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}`}
        description={`Load ${sheet?.reference ?? `XDL-${job.id.slice(0, 8).toUpperCase()}`} · ${statusLabel[currentStatus] ?? currentStatus}`}
        actions={<><ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>← Back</ActionButton><ActionButton tone="secondary" onClick={() => void loadJob()}>Refresh</ActionButton></>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}
      {sheet?.partial && <AlertBanner tone="warning">Part of the awarded booking could not be enriched. Verified values are shown and missing values remain explicitly unavailable.</AlertBanner>}

      <Panel title="Order" description="Awarded booking confirmation and operational instructions from the driver-authorised job sheet.">
        <div className="driver-detail-grid">
          <div className="driver-detail-item"><span>Booking / job reference</span><strong>{sheet?.bookingReference ?? job.booking_reference ?? sheet?.reference ?? `XDL-${job.id.slice(0, 8).toUpperCase()}`}</strong><small>Load ID {job.id.slice(0, 8).toUpperCase()}</small></div>
          <div className="driver-detail-item"><span>Booked / awarded</span><strong>{formatDateTime(sheet?.bookedAt)}</strong></div>
          <div className="driver-detail-item"><span>Requested vehicle</span><strong>{requestedVehicle}</strong></div>
          <div className="driver-detail-item"><span>Allocated vehicle</span><strong>{allocatedVehicleSummary}</strong>{allocatedVehicleDetail && <small>{allocatedVehicleDetail}</small>}</div>
          <div className="driver-detail-item"><span>Body type</span><strong>Unavailable</strong><small>{sheet?.unavailable.bodyType ?? 'No verified body-type field is available.'}</small></div>
          <div className="driver-detail-item"><span>Subcontracted by</span><strong>{sheet?.bookedBy ?? 'Not supplied'}</strong><small>{[sheet?.memberCode ? `Member ${sheet.memberCode}` : null, sheet?.memberPhone].filter(Boolean).join(' · ')}</small></div>
          <div className="driver-detail-item"><span>Subcontracted to</span><strong>{carrierIdentity}</strong><small>Company name is not separately returned by the current driver-authorised sheet.</small></div>
          <div className="driver-detail-item"><span>Assigned driver</span><strong>{sheet?.driverName ?? 'Driver name not supplied'}</strong></div>
          <div className="driver-detail-item"><span>Agreed rate</span><strong>{money(sheet?.agreedRate, sheet?.currency ?? job.currency)}</strong><small>{sheet?.commercialSnapshotAvailable ? 'Commercial agreement snapshot available' : 'Accepted bid / job source; no commercial agreement snapshot'}</small></div>
          <div className="driver-detail-item"><span>Extras</span><strong>Unavailable</strong><small>{sheet?.unavailable.extras ?? 'No immutable extras snapshot is available.'}</small></div>
          <div className="driver-detail-item"><span>Payment terms</span><strong>{sheet?.paymentTerms ?? 'Historical terms unavailable'}</strong><small>{sheet?.paymentDueDays != null ? `${sheet.paymentDueDays} day(s)` : sheet?.commercialSnapshotAvailable ? 'Agreement snapshot' : 'No payment-term snapshot metadata supplied'}</small></div>
          <div className="driver-detail-item"><span>Hard-copy POD</span><strong>{sheet?.hardCopyPod ?? 'No separate hard-copy requirement supplied'}</strong></div>
          <div className="driver-detail-item"><span>Customer reference</span><strong>{sheet?.customerReference ?? job.customer_reference ?? 'Not supplied'}</strong></div>
          <div className="driver-detail-item"><span>PO number</span><strong>{sheet?.purchaseOrderNumber ?? job.purchase_order_number ?? 'Not supplied'}</strong></div>
          <div className="driver-detail-item"><span>Customer / load</span><strong>{sheet?.customerName ?? job.client_name ?? 'Not supplied'}</strong></div>
          <div className="driver-detail-item"><span>Distance</span><strong>{sheet?.distanceMiles != null ? `${sheet.distanceMiles} miles` : job.job_distance_miles != null ? `${job.job_distance_miles} miles` : 'Not supplied'}</strong></div>
          <div className="driver-detail-item"><span>Freight</span><strong>{vehicleName(sheet?.cargo.type ?? job.cargo_type)}</strong><small>{[sheet?.cargo.weightKg != null ? `${sheet.cargo.weightKg} kg` : null, sheet?.cargo.pallets != null ? `${sheet.cargo.pallets} pallet(s)` : null].filter(Boolean).join(' · ') || 'Weight / pallet count not supplied'}</small></div>
          <div className="driver-detail-item"><span>Dimensions</span><strong>{cargoDimensions}</strong></div>
          <div className="driver-detail-item"><span>Cargo value</span><strong>{money(sheet?.cargo.cargoValueGbp, sheet?.currency ?? job.currency)}</strong></div>
          <div className="driver-detail-item"><span>Pallet / stackable</span><strong>{sheet?.cargo.palletType ?? 'Not supplied'}</strong><small>{sheet?.cargo.stackable == null ? 'Stackability not supplied' : sheet.cargo.stackable ? 'Stackable' : 'Not stackable'}</small></div>
        </div>

        {bookingNotes.length > 0 && (
          <div className="driver-order-block">
            <strong>Notes &amp; Details</strong>
            {bookingNotes.map(([label, value]) => <span key={label}><b>{label}:</b> {value}</span>)}
          </div>
        )}

        <div className="driver-order-stops">
          <section className="driver-order-stop">
            <div className="driver-order-stop__head"><strong>Pickup</strong><span>{formatDateTime(sheet?.pickup.dateTime ?? job.pickup_datetime)}{sheet?.pickup.slot ? ` · ${sheet.pickup.slot}` : ''}</span></div>
            <div className="driver-detail-grid">
              <div className="driver-detail-item"><span>Address</span><strong>{[sheet?.pickup.address ?? job.pickup_location, sheet?.pickup.postcode ?? job.pickup_postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong></div>
              <div className="driver-detail-item"><span>Company</span><strong>{sheet?.bookedBy ?? 'Not separately supplied'}</strong><small>Posting company shown where this is the only verified company identity on the booking.</small></div>
              <div className="driver-detail-item"><span>Contact</span><strong>{sheet?.pickup.contactName ?? job.collection_contact_name ?? 'Not supplied'}</strong></div>
              <div className="driver-detail-item"><span>Phone</span><strong>{sheet?.pickup.contactPhone ?? job.collection_contact_phone ?? 'Not supplied'}</strong></div>
              {sheet?.pickup.notes && <div className="driver-detail-item"><span>Pickup notes</span><strong>{sheet.pickup.notes}</strong></div>}
            </div>
          </section>
          <section className="driver-order-stop">
            <div className="driver-order-stop__head"><strong>Delivery</strong><span>{formatDateTime(sheet?.delivery.dateTime ?? job.delivery_datetime)}{sheet?.delivery.slot ? ` · ${sheet.delivery.slot}` : ''}</span></div>
            <div className="driver-detail-grid">
              <div className="driver-detail-item"><span>Address</span><strong>{[sheet?.delivery.address ?? job.delivery_location, sheet?.delivery.postcode ?? job.delivery_postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong></div>
              <div className="driver-detail-item"><span>Company</span><strong>{sheet?.customerName ?? 'Not separately supplied'}</strong><small>Customer name shown only when it is the verified delivery-side company context available on the job.</small></div>
              <div className="driver-detail-item"><span>Contact</span><strong>{sheet?.delivery.contactName ?? job.delivery_contact_name ?? 'Not supplied'}</strong></div>
              <div className="driver-detail-item"><span>Phone</span><strong>{sheet?.delivery.contactPhone ?? job.delivery_contact_phone ?? 'Not supplied'}</strong></div>
              {sheet?.delivery.notes && <div className="driver-detail-item"><span>Delivery notes</span><strong>{sheet.delivery.notes}</strong></div>}
            </div>
          </section>
        </div>

        {(sheet?.requirements.length || stopInstructions.length || paperworkInstructions.length || sheet?.hardCopyPod) ? (
          <div className="driver-order-block">
            <strong>Working &amp; paperwork instructions</strong>
            {sheet?.requirements.map((instruction) => <span key={`req-${instruction}`}>{instruction}</span>)}
            {stopInstructions.map((instruction) => <span key={`stop-${instruction}`}>{instruction}</span>)}
            {paperworkInstructions.map((instruction) => <span key={`paper-${instruction}`}>Paperwork: {instruction}</span>)}
            {sheet?.hardCopyPod && <span>POD: {sheet.hardCopyPod}</span>}
          </div>
        ) : null}

        <div className="driver-order-block">
          <strong>Booking footer / working instructions</strong>
          <span>{sheet?.unavailable.bookingFooter ?? 'No historical booking-footer snapshot is available.'}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
          {currentStatus === 'delivered' && !podComplete && (
            <ActionButton tone="success" disabled={working} onClick={() => void completePod()}>
              {working ? 'Saving POD…' : 'Complete POD'}
            </ActionButton>
          )}
          {podComplete && (
            <ActionButton tone="secondary" onClick={() => void openPodDetails()}>View POD</ActionButton>
          )}
          {podComplete && !sheet?.invoices[0]?.id && canGenerateInvoices && (
            <ActionButton tone="primary" disabled={working} onClick={() => void createInvoice()}>
              {working ? 'Creating…' : 'Create Invoice'}
            </ActionButton>
          )}
          {podComplete && !sheet?.invoices[0]?.id && !canGenerateInvoices && (
            <StatusBadge value="POD complete · invoice ready for owner/admin" tone="green" />
          )}
          {canShowLifecycleAction && nextStatus && nextLabel && <ActionButton tone="success" disabled={working} onClick={() => void moveStatus(nextStatus)}>{working ? 'Saving…' : nextLabel}</ActionButton>}
          {navigationStage && navigationAddress && <>
            <a href={mapsUrl(navigationAddress, navigationPostcode)} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>Google Maps ? {navigationStage === 'pickup' ? 'Pickup' : 'Delivery'}</a>
            <a href={wazeUrl(navigationAddress, navigationPostcode)} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>Waze ? {navigationStage === 'pickup' ? 'Pickup' : 'Delivery'}</a>
          </>}
          <a href={routeMapUrl(job)} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>Route</a>
          <ActionButton tone="secondary" onClick={() => document.getElementById('journey-replay')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Journey Replay</ActionButton>
          {sheet?.memberPhone && <a href={`tel:${sheet.memberPhone.replace(/\s+/g, '')}`} style={linkButtonStyle}>Call Member</a>}
          {sheet?.invoices[0]?.id && <ActionButton tone="secondary" onClick={() => router.push(`/driver/finance/invoices/${sheet.invoices[0].id}`)}>View invoice (£)</ActionButton>}
        </div>
      </Panel>

      <TwoColumn>
        <div style={{ display: 'grid', gap: 8 }}>
          <Panel title="Route and navigation">
            <DataTable columns={['Stop', 'Address', 'Time', 'Navigation']} rows={[
              ['Pickup', [sheet?.pickup.address ?? job.pickup_location, sheet?.pickup.postcode ?? job.pickup_postcode].filter(Boolean).join(', ') || 'Not set', formatDateTime(sheet?.pickup.dateTime ?? job.pickup_datetime), (sheet?.pickup.address ?? job.pickup_location) ? <a key="pickup" href={mapsUrl(sheet?.pickup.address ?? job.pickup_location ?? '', sheet?.pickup.postcode ?? job.pickup_postcode)} target="_blank" rel="noopener noreferrer">Open map</a> : '—'],
              ['Delivery', [sheet?.delivery.address ?? job.delivery_location, sheet?.delivery.postcode ?? job.delivery_postcode].filter(Boolean).join(', ') || 'Not set', formatDateTime(sheet?.delivery.dateTime ?? job.delivery_datetime), (sheet?.delivery.address ?? job.delivery_location) ? <a key="delivery" href={mapsUrl(sheet?.delivery.address ?? job.delivery_location ?? '', sheet?.delivery.postcode ?? job.delivery_postcode)} target="_blank" rel="noopener noreferrer">Open map</a> : '—'],
            ]} />
          </Panel>

          {loadSections.map((section) => <Panel key={section.title} title={section.title}><div className="driver-detail-grid">{section.items.map((item) => <div className="driver-detail-item" key={`${section.title}-${item.label}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></Panel>)}

          {(currentStatus === 'on_site_pickup' || currentStatus === 'loaded') && (
            <Panel title="Collection evidence" description="Attach 1–10 verified loading photos. Take a photo or select several saved images in one action.">
              <input ref={collectionCameraInput} type="file" accept="image/jpeg,image/png" capture="environment" hidden onChange={selectCollectionPhotos} />
              <input ref={collectionGalleryInput} type="file" accept="image/jpeg,image/png" multiple hidden onChange={selectCollectionPhotos} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge value={collectionPhotos.length ? `${collectionPhotos.length} photo${collectionPhotos.length === 1 ? '' : 's'} ready` : 'Photo required'} tone={collectionPhotos.length ? 'green' : 'orange'} />
                <ActionButton tone="secondary" disabled={working || collectionPhotos.length >= 10} onClick={() => collectionCameraInput.current?.click()}>Take photo</ActionButton>
                <ActionButton tone="secondary" disabled={working || collectionPhotos.length >= 10} onClick={() => collectionGalleryInput.current?.click()}>Add photos</ActionButton>
              </div>
              {collectionPhotos.length > 0 && <div style={{ marginTop: 6, color: '#64748b', fontSize: 11 }}>Verified collection evidence: {collectionPhotos.length}/10 photos.</div>}
            </Panel>
          )}
          {(currentStatus === 'on_site_delivery' || (currentStatus === 'delivered' && !podComplete)) && (
            <Panel
              title={currentStatus === 'delivered' ? 'Complete Proof of Delivery (POD)' : 'Delivery evidence'}
              description={currentStatus === 'delivered'
                ? 'POD is mandatory for every job. Confirm the recipient, evidence and signature before invoice creation.'
                : 'Photo, recipient name and signature are all required before marking the job Delivered.'}
            >
              <input ref={deliveryInput} type="file" accept="image/*" capture="environment" multiple hidden onChange={selectDeliveryPhotos} />
              <div style={{ display: 'grid', gap: 7 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge value="POD required" tone="orange" />
                  <StatusBadge value={deliveryPhotos.length ? `${deliveryPhotos.length} delivery photo${deliveryPhotos.length === 1 ? '' : 's'}` : 'Delivery photo missing'} tone={deliveryPhotos.length ? 'green' : 'orange'} />
                  {job.delivery_signature_data ? <StatusBadge value="Signature recorded" tone="green" /> : null}
                </div>
                <ActionButton tone="secondary" disabled={working || deliveryPhotos.length >= 10} onClick={() => deliveryInput.current?.click()}>Add delivery photos ({deliveryPhotos.length}/10)</ActionButton>
                <div className="driver-detail-grid">
                  <label className="driver-detail-item"><span>Delivered on</span><input type="date" value={podDeliveredOn} onChange={(event) => setPodDeliveredOn(event.target.value)} style={inputStyle} /></label>
                  <label className="driver-detail-item"><span>Delivery status</span><select value={podDeliveryStatus} onChange={(event) => setPodDeliveryStatus(event.target.value)} style={inputStyle}><option>Completed Delivery</option><option>Partial Delivery</option><option>Failed Delivery</option><option>Refused</option><option>Left Safe</option></select></label>
                  <label className="driver-detail-item"><span>No. of items</span><input type="number" min="0" value={podItemCount} onChange={(event) => setPodItemCount(event.target.value)} style={inputStyle} /></label>
                  <label className="driver-detail-item"><span>Left at</span><input value={podLeftAt} onChange={(event) => setPodLeftAt(event.target.value)} placeholder="Goods inwards / reception / safe place" style={inputStyle} /></label>
                </div>
                <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Recipient full name" style={inputStyle} />
                <canvas ref={signatureRef} width={500} height={150} onMouseDown={startSignature} onMouseMove={drawSignature} onMouseUp={() => setSigning(false)} onMouseLeave={() => setSigning(false)} onTouchStart={startSignature} onTouchMove={drawSignature} onTouchEnd={() => setSigning(false)} style={{ width: '100%', height: 150, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', touchAction: 'none' }} />
                <ActionButton tone="secondary" onClick={clearSignature}>Clear new signature</ActionButton>
                {hardCopyRequired && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                    <input type="checkbox" checked={hardCopyAcknowledged} onChange={(event) => setHardCopyAcknowledged(event.target.checked)} />
                    Hard-copy POD requirement completed
                  </label>
                )}
                {currentStatus === 'delivered' && (
                  <ActionButton tone="success" disabled={working} onClick={() => void completePod()}>
                    {working ? 'Saving POD…' : 'Complete POD'}
                  </ActionButton>
                )}
              </div>
            </Panel>
          )}
        </div>

        <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
          <Panel title="Operational timeline" description="Pickup, loading, transit, delivery and completion events."><DataTable columns={['Status', 'Time', 'Details']} rows={timelineRows} empty={<EmptyState title="No recorded history" />} /></Panel>
          <div id="journey-replay"><Panel title="Journey Replay" description="GPS route, tracked distance, speed evidence and lifecycle events for this assigned job."><WorkspaceJobReplay jobId={jobId} /></Panel></div>
          <Panel title="Notes" description="Driver operational notes remain separate from the awarded Order confirmation."><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Loading condition, waiting time, access issue or delivery note" style={{ ...inputStyle, resize: 'vertical' }} /></Panel>
          <Panel title="Documents"><div style={{ display: 'grid', gap: 5 }}>{sheet?.documents.length ? sheet.documents.map((document) => <div key={document.id ?? `${document.type}-${document.createdAt}`} className="driver-detail-item"><span>{document.type}</span><strong>{document.fileName ?? 'Job document'}</strong><small>{formatDateTime(document.createdAt)}</small></div>) : <EmptyState title="No job documents" />}</div></Panel>
          <Panel title="POD and invoice" description="POD is mandatory for every job. Invoice creation is available only after POD is complete.">
            <div className="driver-detail-grid">
              <div className="driver-detail-item"><span>POD required</span><strong>Yes</strong></div>
              <div className="driver-detail-item"><span>POD status</span><strong>{podComplete ? 'Complete' : 'Pending'}</strong><small>{job.pod_generated_at ? formatDateTime(job.pod_generated_at) : 'Complete POD after delivery'}</small></div>
              <div className="driver-detail-item"><span>Delivery photos</span><strong>{deliveryPhotos.length}</strong></div>
              <div className="driver-detail-item"><span>Recipient</span><strong>{(job.client_signature_name ?? recipientName) || 'Not captured'}</strong></div>
              <div className="driver-detail-item"><span>Hard-copy POD</span><strong>{hardCopyRequired ? 'Required' : 'No additional hard-copy requirement'}</strong></div>
              <div className="driver-detail-item"><span>Invoice</span><strong>{sheet?.invoices[0]?.number ?? (podComplete ? 'Ready to create' : 'Locked until POD')}</strong><small>{sheet?.invoices[0]?.paymentStatus ?? sheet?.invoices[0]?.status ?? (podComplete ? 'POD complete' : 'POD pending')}</small></div>
            </div>
            {podComplete && <div className="driver-row-actions" style={{ marginTop: 8 }}>
              <ActionButton tone="secondary" onClick={() => void openPodDetails()}>View POD</ActionButton>
              {sheet?.invoices[0]?.id ? <ActionButton tone="primary" onClick={() => router.push(`/driver/finance/invoices/${sheet.invoices[0].id}`)}>View Invoice</ActionButton> : canGenerateInvoices ? <ActionButton tone="primary" disabled={working} onClick={() => void createInvoice()}>{working ? 'Creating...' : 'Create Invoice'}</ActionButton> : null}
            </div>}
          </Panel>
          {podComplete && showPodDetails && (
            <Panel title="Proof of Delivery" description="Recorded delivery confirmation and POD evidence for this job.">
              <div className="driver-detail-grid">
                <div className="driver-detail-item"><span>Received by</span><strong>{sheet?.pod.receiverName ?? job.client_signature_name ?? 'Not captured'}</strong></div>
                <div className="driver-detail-item"><span>Delivered on</span><strong>{sheet?.pod.deliveredOn ?? formatDateTime(job.pod_generated_at)}</strong></div>
                <div className="driver-detail-item"><span>Delivery status</span><strong>{sheet?.pod.deliveryStatus ?? 'Completed Delivery'}</strong></div>
                <div className="driver-detail-item"><span>Left at</span><strong>{sheet?.pod.leftAt ?? 'Not recorded'}</strong></div>
                <div className="driver-detail-item"><span>No. of items</span><strong>{sheet?.pod.itemCount ?? 'Not recorded'}</strong></div>
                <div className="driver-detail-item"><span>POD completed</span><strong>{formatDateTime(sheet?.pod.generatedAt ?? job.pod_generated_at)}</strong></div>
              </div>
              {sheet?.pod.notes && <div className="driver-order-block"><strong>Delivery notes</strong><span>{sheet.pod.notes}</span></div>}
              {((sheet?.pod.signatureData ?? (typeof job.delivery_signature_data === 'string' ? job.delivery_signature_data : null))?.startsWith('data:image/')) && <div className="driver-order-block"><strong>Recipient signature</strong><img src={sheet?.pod.signatureData ?? String(job.delivery_signature_data)} alt="Recipient signature" style={{ maxWidth: 320, maxHeight: 120, border: '1px solid #cbd5e1', background: '#fff' }} /></div>}
              <div className="driver-order-block"><strong>POD files</strong>{podPhotoUrls.length ? podPhotoUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">Delivery photo {index + 1}</a>) : <span>{sheet?.pod.photoCount ? `${sheet.pod.photoCount} delivery photo(s) recorded` : 'No delivery photo links available'}</span>}</div>
              <div className="driver-row-actions"><ActionButton tone="secondary" onClick={() => setShowPodDetails(false)}>Close POD</ActionButton></div>
            </Panel>
          )}
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 4, padding: '7px 8px', background: '#fff', color: '#0f172a', fontSize: 12 };
const linkButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 32, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#0b2f6b', fontSize: 12, fontWeight: 700, textDecoration: 'none' };
