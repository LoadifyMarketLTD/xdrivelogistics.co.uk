'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DbJob } from '../../../lib/types/database';
import { getLoadDetailSections } from '../../../lib/loadPostingDetails';
import { canonicalExecutionStatus, nextDriverExecutionStatus } from '../../../lib/jobs/jobLifecyclePresentation';
import { hasCompletePodEvidence } from '../../../lib/jobs/podCompletion';
import { navigationDestination, navigationUrl } from '../../../lib/jobs/driverNavigationLinks';
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

const mapsUrl = (address: string, postcode?: string | null) => navigationUrl(address,postcode,'navigate') ?? 'https://www.google.com/maps';

const wazeUrl = (address: string, postcode?: string | null) => 'https://www.waze.com/ul?q='+encodeURIComponent(navigationDestination(address,postcode))+'&navigate=yes';

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

export default function DriverJobExecutionPage({ jobId, mobilePwa = false, podOnly = false }: { jobId: string; mobilePwa?: boolean; podOnly?: boolean }) {
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
  const [collectedItemCount, setCollectedItemCount] = useState('');
  const [collectionCondition, setCollectionCondition] = useState('Good');
  const [collectionDiscrepancy, setCollectionDiscrepancy] = useState('');
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const [pendingPodPhotos, setPendingPodPhotos] = useState<string[]>([]);
  const [pendingPodDocuments, setPendingPodDocuments] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [hardCopyAcknowledged, setHardCopyAcknowledged] = useState(false);
  const [podDeliveryStatus, setPodDeliveryStatus] = useState('Completed Delivery');
  const [podLeftAt, setPodLeftAt] = useState('');
  const [podItemCount, setPodItemCount] = useState('1');
  const [podWeight, setPodWeight] = useState('');
  const mobilePodOpen = podOnly;
  const [podDeliveredOn, setPodDeliveredOn] = useState('');
  const [podDraftLoaded, setPodDraftLoaded] = useState(false);
  const [podDraftSaving, setPodDraftSaving] = useState(false);
  const [podDraftError, setPodDraftError] = useState('');
  const [savedSignatureData, setSavedSignatureData] = useState('');
  const podDraftSaveQueue = useRef<Promise<unknown>>(Promise.resolve());
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
    if (!jobId || !driverId) {
      setError(!jobId ? 'Booking reference is missing.' : 'Driver account is not ready. Refresh your session or sign in again.');
      setJob(null);
      setLoading(false);
      return;
    }
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
    setPendingPodPhotos(Array.isArray(row.delivery_photos) ? row.delivery_photos.filter((v): v is string => typeof v === 'string') : []);
    setPendingPodDocuments(Array.isArray(row.pod_photos) ? row.pod_photos.filter((v): v is string => typeof v === 'string') : []);
    setRecipientName(row.client_signature_name ?? '');
    // Preserve the current hard-copy acknowledgement during evidence refresh.

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
            if (nextSheet.pod.itemCount != null) setPodItemCount(String(nextSheet.pod.itemCount));
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
  const podJobId = job?.id ?? '';
  const podAlreadyComplete = job ? hasCompletePodEvidence(job) : false;

  // Restore the server-owned POD draft only after the job and its sheet are loaded.
  useEffect(() => {
    if (!podOnly || loading || !podJobId || podAlreadyComplete) return;
    let cancelled = false;
    void (async () => {
      try {
        const auth = await authHeader();
        if (!auth) throw new Error('Your session is not available.');
        const response = await fetch('/api/driver/web/jobs/' + encodeURIComponent(podJobId) + '/pod-draft', {
          headers: { Authorization: auth }, cache: 'no-store',
        });
        const payload = await response.json() as { draft?: Record<string, unknown>; error?: string };
        if (!response.ok) throw new Error(payload.error || 'POD draft could not be loaded.');
        if (cancelled) return;
        const draft = payload.draft;
        if (draft) {
          const field = (key: string) => typeof draft[key] === 'string' ? draft[key] as string : null;
          setRecipientName(field('recipientName') ?? '');
          setPodLeftAt(field('leftAt') ?? '');
          setPodDeliveryStatus(field('deliveryStatus') ?? 'Completed Delivery');
          setPodItemCount(field('itemCount') ?? '1');
          setPodWeight(field('weight') ?? '');
          setPodDeliveredOn(field('deliveredOn') ?? '');
          setNotes(field('notes') ?? '');
          setHardCopyAcknowledged(draft.hardCopyAcknowledged === true);
          const signature = field('signatureData') ?? '';
          setSavedSignatureData(signature);
          if (signature) {
            const img = new Image();
            img.onload = () => {
              if (cancelled) return;
              const canvas = signatureRef.current;
              const ctx = canvas?.getContext('2d');
              if (canvas && ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = signature;
          }
        }
        setPodDraftLoaded(true);
      } catch (reason) {
        if (!cancelled) setPodDraftError(reason instanceof Error ? reason.message : 'POD draft unavailable.');
      }
    })();
    return () => { cancelled = true; };
  }, [podOnly, loading, podJobId, podAlreadyComplete, authHeader]);

  // Serialize debounced writes: an older draft must never overwrite a newer one.
  useEffect(() => {
    if (!podOnly || !podDraftLoaded || !podJobId || podAlreadyComplete) return;
    const id = podJobId;
    const data = {
      recipientName, leftAt: podLeftAt, deliveryStatus: podDeliveryStatus,
      itemCount: podItemCount, weight: podWeight, deliveredOn: podDeliveredOn,
      notes, signatureData: savedSignatureData, hardCopyAcknowledged,
      photoUris: pendingPodPhotos, documentUris: pendingPodDocuments,
    };
    const timer = setTimeout(() => {
      podDraftSaveQueue.current = podDraftSaveQueue.current.catch(() => undefined).then(async () => {
        setPodDraftSaving(true);
        const auth = await authHeader();
        if (!auth) throw new Error('Sign in again to save the POD draft.');
        const response = await fetch('/api/driver/web/jobs/' + encodeURIComponent(id) + '/pod-draft', {
          method: 'PUT', headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(body.error || 'POD draft was not saved.');
        setPodDraftError('');
      }).catch(reason => {
        setPodDraftError(reason instanceof Error ? reason.message : 'POD draft was not saved.');
      }).finally(() => setPodDraftSaving(false));
    }, 700);
    return () => clearTimeout(timer);
  }, [podOnly, podDraftLoaded, podJobId, podAlreadyComplete, authHeader, recipientName, podLeftAt,
      podDeliveryStatus, podItemCount, podWeight, podDeliveredOn, notes,
      savedSignatureData, hardCopyAcknowledged, pendingPodPhotos, pendingPodDocuments]);

  const savePodDraftNow = async () => {
    if (!podJobId || !podDraftLoaded || podAlreadyComplete) return;
    setPodDraftSaving(true);
    setPodDraftError('');
    try {
      const snapshot = {
        recipientName, leftAt: podLeftAt, deliveryStatus: podDeliveryStatus,
        itemCount: podItemCount, weight: podWeight, deliveredOn: podDeliveredOn,
        notes, signatureData: savedSignatureData || signatureData(),
        hardCopyAcknowledged, photoUris: pendingPodPhotos, documentUris: pendingPodDocuments,
      };
      await podDraftSaveQueue.current.catch(() => undefined);
      const auth = await authHeader();
      if (!auth) throw new Error('Sign in again to save the POD draft.');
      const response = await fetch('/api/driver/web/jobs/' + encodeURIComponent(podJobId) + '/pod-draft', {
        method: 'PUT', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'POD draft could not be saved.');
      setMessage('POD draft saved to XDrive.');
    } catch (reason) {
      setPodDraftError(reason instanceof Error ? reason.message : 'POD draft could not be saved.');
    } finally {
      setPodDraftSaving(false);
    }
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


  const uploadPodEvidence = async (file: File, category: 'photos' | 'documents') => {
    const allowed = category === 'photos' ? ['image/jpeg', 'image/png'] : ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) throw new Error('Use JPEG or PNG photos, or PDF documents.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Maximum file size is 10 MB.');
    const auth = await authHeader();
    if (!auth) throw new Error('Session expired. Sign in again.');
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const response = await fetch('/api/driver/web/jobs/' + encodeURIComponent(jobId) + '/evidence', {
      method: 'POST',
      headers: {Authorization: auth, 'Content-Type': file.type, 'x-xdrive-evidence-kind': 'delivery',
        'x-xdrive-evidence-category': category, 'x-xdrive-evidence-name': 'pod-' + Date.now() + '-' + crypto.randomUUID() + '.' + ext},
      body: file,
    });
    const payload = await response.json().catch(() => ({})) as {storagePath?: string; error?: string};
    if (!response.ok || !payload.storagePath) throw new Error(payload.error || 'Upload failed.');
    return payload.storagePath;
  };

  const verifySavedEvidence = async (paths: string[], column: 'delivery_photos' | 'pod_photos') => {
    const {data, error} = await supabase.from('jobs').select(column).eq('id', jobId).eq('assigned_driver_id', driverId).single();
    if (error || !data) throw new Error('Upload finished, but saving to the booking could not be verified. Refresh and retry.');
    const saved = (data as unknown as Record<string, unknown>)[column];
    if (!Array.isArray(saved) || paths.some(path => !saved.includes(path))) {
      throw new Error('Files were uploaded but not linked to this booking. Please retry.');
    }
  };
  const selectPodDocuments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    if (files.length + pendingPodDocuments.length > 10) {setError('A maximum of 10 POD documents can be attached.'); return;}
    setWorking(true); setError(''); setMessage('');
    try {
      const savedPaths: string[] = [];
      for (const file of files) savedPaths.push(await uploadPodEvidence(file, 'documents'));
      await verifySavedEvidence(savedPaths, 'pod_photos');
      setPendingPodDocuments(current => [...new Set([...current, ...savedPaths])].slice(0, 10));
      await loadJob();
      setMessage(files.length + ' POD document(s) verified and saved.');
    } catch (reason) {setError(reason instanceof Error ? reason.message : 'Document upload failed.');}
    finally {setWorking(false);}
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
      for (const file of files) paths.push(await uploadPodEvidence(file, 'photos'));
      setDeliveryPhotos((current) => [...new Set([...current, ...paths])].slice(0, 10));
      setPendingPodPhotos((current) => [...new Set([...current, ...paths])].slice(0, 10));
      await verifySavedEvidence(paths, 'delivery_photos');
      await loadJob();
      setMessage(`${paths.length} POD photo${paths.length === 1 ? '' : 's'} verified and saved.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Delivery photo upload failed.'); }
    finally { setWorking(false); }
  };

  const pointer = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const source = 'touches' in event ? event.touches[0] : event;
    return { x: (source.clientX - rect.left) * (canvas.width / rect.width), y: (source.clientY - rect.top) * (canvas.height / rect.height) };
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
    if (mobilePwa && (!Number.isInteger(Number(podItemCount)) || Number(podItemCount) < 1)) { setError('Number of items must be at least 1.'); return; }
    const newSignature = signatureData();
    const storedSignature = job.delivery_signature_data;
    const hasStoredSignature = typeof storedSignature === 'string'
      ? storedSignature.trim().length > 0
      : Boolean(storedSignature && typeof storedSignature === 'object');
    if (!newSignature && !savedSignatureData && !hasStoredSignature) {
      setError('Recipient signature is required to complete POD.');
      return;
    }

    if (mobilePwa && !podLeftAt.trim()) { setError('Left At is required.'); return; }
    if (mobilePwa && podDeliveryStatus !== 'Completed Delivery') { setError('Resolve delivery exception before completed POD.'); return; }
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
          signatureExceptionReason: '',
          signatureData: newSignature ?? savedSignatureData ?? '',
          photoUris: pendingPodPhotos,
          damagePhotoUris: [],
          documentUris: pendingPodDocuments,
          deliveryStatus: podDeliveryStatus,
          leftAt: podLeftAt.trim() || undefined,
          itemCount: podItemCount.trim() ? Number(podItemCount) : undefined,
          deliveredOn: podDeliveredOn || undefined,
          hardCopyAcknowledged: hardCopyRequired ? hardCopyAcknowledged : false,
          notes: [notes.trim(), podWeight.trim() ? 'Weight: '+podWeight.trim()+' kg' : ''].filter(Boolean).join(' | ') || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; ok?: boolean; alreadySubmitted?: boolean };
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || `POD submission was not confirmed by the server (HTTP ${response.status}).`);
      await loadJob();
      setMessage(payload.alreadySubmitted ? 'POD was already recorded. No duplicate was created.' : 'POD submitted and recorded. Invoice creation is now available.');
      clearSignature();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'POD could not be completed.');
    } finally {
      setWorking(false);
    }
  };

  const downloadPodPdf = async () => {
    if (!job || !hasCompletePodEvidence(job)) return;
    setWorking(true); setError('');
    try {
      const auth = await authHeader();
      if (!auth) throw new Error('Please sign in again.');
      const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(job.id)}/pod/pdf`, {
        headers: { Authorization: auth }, cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || 'POD PDF could not be generated.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Proof-of-Delivery-${job.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage('Your carrier-branded Proof of Delivery PDF is ready to open or share.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'POD PDF could not be downloaded.');
    } finally { setWorking(false); }
  };

  const createInvoice = async () => {
    if (!job || !canGenerateInvoices) return;
    if (!hasCompletePodEvidence(job)) {
      setError('Complete POD before creating an invoice. POD must be submitted and recorded.');
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
      setMessage('Draft invoice created. Review and approve it before sending to the buyer.');
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
      if (mobilePwa && (!collectedItemCount.trim() || !Number.isInteger(Number(collectedItemCount)) || Number(collectedItemCount) < 0)) { setError('Enter the actual number of items collected before confirming Loaded.'); setWorking(false); return; }
      if (mobilePwa && collectionCondition !== 'Good' && !collectionDiscrepancy.trim()) { setError('Describe the collection issue before confirming Loaded.'); setWorking(false); return; }
      const auth = await authHeader();
      if (!auth) { setError('Your XDrive session is not available. Please sign in again.'); setWorking(false); return; }
      const handoverResponse = await fetch(`/api/driver/web/jobs/${encodeURIComponent(job.id)}/handover`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPaths: collectionPhotos, itemCount: collectedItemCount.trim() ? Number(collectedItemCount) : null, packaging: sheet?.cargo.palletType ?? undefined, weightKg: sheet?.cargo.weightKg ?? undefined, notes: [`Cargo condition: ${collectionCondition}`, collectionDiscrepancy.trim(), notes.trim()].filter(Boolean).join(' | ') }),
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
    }
    // Delivery arrival and POD submission are separate operations.
    if (nextStatus === 'delivered') {
      fields.p_delivery_photos = deliveryPhotos;
      if (recipientName.trim()) fields.p_client_signature_name = recipientName.trim();
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
  const deliveredStage = ['delivered','completed','invoiced'].includes(currentStatus);
  const invoiceRecorded = Boolean(sheet?.invoices[0]?.id);
  const closeoutLabel = !podComplete ? 'POD required' : !invoiceRecorded ? 'POD complete - invoice pending' : 'POD and invoice recorded';
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


  if (mobilePwa) {
    const stops = [
      {name:'Collection',place:sheet?.pickup.address??job.pickup_location,postcode:sheet?.pickup.postcode??job.pickup_postcode,at:sheet?.pickup.dateTime??job.pickup_datetime,phone:sheet?.pickup.contactPhone,notes:sheet?.pickup.notes},
      {name:'Delivery',place:sheet?.delivery.address??job.delivery_location,postcode:sheet?.delivery.postcode??job.delivery_postcode,at:sheet?.delivery.dateTime??job.delivery_datetime,phone:sheet?.delivery.contactPhone,notes:sheet?.delivery.notes}
    ];
    const executionSteps = [
      ['accepted', 'Accepted'], ['on_my_way', 'On my way to pickup'],
      ['on_site_pickup', 'On site at collection'], ['loaded', 'Loaded'],
      ['in_transit', 'On my way to delivery'], ['on_site_delivery', 'On site at delivery'],
      ['delivered', 'Delivered'], ['completed', 'Completed'],
    ] as const;
    const activeStep = executionSteps.findIndex(([key]) => key === currentStatus);
    return <div className="fresh-mobile-booking" data-testid={podOnly ? 'mobile-pod-form' : 'mobile-booking-details'}>
      {!podOnly && <>
      <section className="fresh-mobile-booking-card fresh-booking-hero">
        <div className="fresh-booking-hero-top"><small>BOOKING {sheet?.bookingReference??sheet?.reference??'Reference pending'}</small><span className="fresh-booking-status">{statusLabel[currentStatus]??currentStatus}</span></div>
        <h1>{[job.pickup_location||sheet?.pickup.postcode||job.pickup_postcode,job.delivery_location||sheet?.delivery.postcode||job.delivery_postcode].filter(Boolean).join(' → ') || 'Booking details'}</h1>
        <div className="fresh-booking-financials">{sheet?.agreedRate!=null&&<div><small>Agreed Rate</small><strong>{money(sheet.agreedRate,sheet.currency??job.currency)}</strong></div>}{sheet?.paymentTerms&&<div><small>Payment Terms</small><strong>{sheet.paymentTerms}</strong></div>}</div>
        {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
      </section>
      {(sheet?.bookedBy||sheet?.memberCode||sheet?.memberPhone)&&<section className="fresh-mobile-booking-card fresh-booking-customer"><h2>Customer / Booking Company</h2><strong>{sheet?.bookedBy??'Company name not supplied'}</strong>{sheet?.memberCode&&<small>{sheet.memberCode}</small>}{sheet?.memberPhone&&<a href={'tel:'+sheet.memberPhone}>Call Company</a>}</section>}
      {currentStatus==='on_site_pickup'&&<section className="fresh-mobile-booking-card" aria-label="Collection verification"><h2>Collection confirmation</h2><p>Verify actual items and condition before confirming Loaded. Differences must be recorded, not assumed.</p><label>Items actually collected<input type="number" min="0" step="1" value={collectedItemCount} onChange={e=>setCollectedItemCount(e.target.value)} placeholder={sheet?.cargo.pallets!=null?String(sheet.cargo.pallets):'Enter actual count'}/></label><label>Cargo condition<select value={collectionCondition} onChange={e=>setCollectionCondition(e.target.value)}><option>Good</option><option>Damaged</option><option>Incomplete</option><option>Not ready</option></select></label><label>Collection discrepancies / notes<textarea value={collectionDiscrepancy} onChange={e=>setCollectionDiscrepancy(e.target.value)} placeholder="Record shortages, damage or loading problems"/></label><label>Collection photographs<input type="file" accept="image/jpeg,image/png" capture="environment" multiple disabled={working} onChange={e=>void selectCollectionPhotos(e)}/></label><small>{collectionPhotos.length} collection photograph(s) saved</small></section>}
      <section className="fresh-mobile-booking-card fresh-booking-stops"><h2>Stops</h2><div className="fresh-booking-stops-list">{stops.map(stop=><div className="fresh-booking-stop" key={stop.name}>
        <span className={'fresh-booking-stop-pin '+(stop.name==='Collection'?'collection':'delivery')} aria-hidden="true"/>
        <div className="fresh-booking-stop-body"><h3>{stop.name}</h3>{(stop.place||stop.postcode)&&<strong>{navigationDestination(stop.place,stop.postcode)}</strong>}{stop.at&&<p>{formatDateTime(stop.at)}</p>}{stop.notes&&<p>{stop.notes}</p>}
        <div className="fresh-mobile-booking-actions">{navigationUrl(stop.place,stop.postcode,'navigate')?<a target="_blank" rel="noopener noreferrer" href={mapsUrl(stop.place??'',stop.postcode)}>Navigate</a>:<span className="fresh-booking-no-address">Address unavailable</span>}{stop.phone&&<a href={'tel:'+stop.phone}>Call</a>}{navigationUrl(stop.place,stop.postcode,'view')&&<a target="_blank" rel="noopener noreferrer" href={navigationUrl(stop.place,stop.postcode,'view')!}>View Map</a>}</div>
        </div></div>)}</div></section>
      {(sheet?.cargo.pallets!=null||sheet?.cargo.weightKg!=null||sheet?.cargo.type||cargoDimensions!=='Not supplied'||sheet?.cargo.palletType||Boolean(sheet?.requirements?.length))&&<section className="fresh-mobile-booking-card fresh-booking-cargo"><h2>Cargo Summary</h2><div className="fresh-booking-cargo-grid">
        {sheet?.cargo.pallets!=null&&<div><small>Pallets</small><strong>{sheet.cargo.pallets}</strong></div>}
        {sheet?.cargo.type&&<div><small>Cargo type</small><strong>{sheet.cargo.type}</strong></div>}
        {sheet?.cargo.weightKg!=null&&<div><small>Weight</small><strong>{sheet.cargo.weightKg} kg</strong></div>}
        {cargoDimensions!=='Not supplied'&&<div><small>Dimensions</small><strong>{cargoDimensions}</strong></div>}
        {sheet?.cargo.palletType&&<div><small>Packaging</small><strong>{sheet.cargo.palletType}</strong></div>}
        {Boolean(sheet?.requirements?.length)&&<div><small>Handling / Requirements</small><strong>{sheet?.requirements?.join(', ')}</strong></div>}
      </div></section>}
      <section className="fresh-mobile-booking-card fresh-booking-next-action"><h2>Status &amp; Next Action</h2><strong>{statusLabel[currentStatus]??currentStatus}</strong><details className="fresh-booking-progress"><summary>View booking progress</summary><ol aria-label="Booking journey stages">{executionSteps.map(([key,label],index)=><li key={key} aria-current={index===activeStep?'step':undefined}><span>{activeStep>=0&&index<activeStep?'✓':index===activeStep?'●':'○'}</span> {label}</li>)}</ol></details>{currentStatus==='on_site_delivery'&&<div><label>Delivery evidence required before confirming delivery<input type="file" accept="image/jpeg,image/png" capture="environment" multiple disabled={working} onChange={e=>void selectDeliveryPhotos(e)}/></label><small>{deliveryPhotos.length} delivery photograph(s) saved</small>{deliveryPhotos.length===0&&<p>Please take a delivery photograph before confirming the handover.</p>}</div>}{nextStatus&&canShowLifecycleAction&&<button className="fresh-mobile-booking-primary" disabled={working} onClick={()=>void moveStatus(nextStatus)}>{nextLabel}</button>}</section>
      <section className="fresh-mobile-booking-card fresh-booking-secondary"><details><summary>More booking information</summary><h2>Booking information</h2><dl>{(sheet?.bookingReference??sheet?.reference)&&<><dt>Booking ID</dt><dd>{sheet?.bookingReference??sheet?.reference}</dd></>}{sheet?.bookedAt&&<><dt>Awarded at</dt><dd>{formatDateTime(sheet.bookedAt)}</dd></>}{sheet?.bookedBy&&<><dt>Company</dt><dd>{sheet?.bookedBy}</dd></>}{sheet?.memberCode&&<><dt>XD Member ID</dt><dd>{sheet?.memberCode}</dd></>}{sheet?.memberPhone&&<><dt>Company phone</dt><dd>{sheet?.memberPhone}</dd></>}{sheet?.allocatedVehicle?.source==='job'&&<><dt>Vehicle</dt><dd>{allocatedVehicleSummary}</dd></>}{sheet?.agreedRate!=null&&<><dt>Agreed rate</dt><dd>{money(sheet.agreedRate,sheet.currency??job.currency)}</dd></>}{sheet?.vatAmount!=null&&<><dt>VAT</dt><dd>{money(sheet.vatAmount,sheet.currency??job.currency)}</dd></>}{sheet?.paymentTerms&&<><dt>Payment terms</dt><dd>{sheet?.paymentTerms}</dd></>}{sheet?.distanceMiles!=null&&<><dt>Route distance</dt><dd>{sheet.distanceMiles+' miles'}</dd></>}{sheet?.cargo.type&&<><dt>Cargo</dt><dd>{sheet?.cargo.type}</dd></>}{sheet?.cargo.pallets!=null&&<><dt>Pallets</dt><dd>{sheet.cargo.pallets}</dd></>}{sheet?.cargo.weightKg!=null&&<><dt>Weight</dt><dd>{sheet.cargo.weightKg+' kg'}</dd></>}{cargoDimensions!=='Not supplied'&&<><dt>Dimensions</dt><dd>{cargoDimensions}</dd></>}{sheet?.cargo.cargoValueGbp!=null&&<><dt>Goods value</dt><dd>{money(sheet.cargo.cargoValueGbp)}</dd></>}{sheet?.cargo.palletType&&<><dt>Packaging</dt><dd>{sheet?.cargo.palletType}</dd></>}{Boolean(sheet?.requirements?.length)&&<><dt>Requirements</dt><dd>{sheet?.requirements?.join(', ')}</dd></>}{sheet?.pickup.contactName&&<><dt>Collection contact</dt><dd>{sheet?.pickup.contactName}</dd></>}{sheet?.pickup.contactPhone&&<><dt>Collection phone</dt><dd>{sheet?.pickup.contactPhone}</dd></>}{sheet?.delivery.contactName&&<><dt>Delivery contact</dt><dd>{sheet?.delivery.contactName}</dd></>}{sheet?.delivery.contactPhone&&<><dt>Delivery phone</dt><dd>{sheet?.delivery.contactPhone}</dd></>}{sheet?.pickup.dateTime&&<><dt>Collection date</dt><dd>{formatDateTime(sheet.pickup.dateTime)}</dd></>}{sheet?.delivery.dateTime&&<><dt>Delivery date</dt><dd>{formatDateTime(sheet.delivery.dateTime)}</dd></>}{sheet?.customerReference&&<><dt>Customer reference</dt><dd>{sheet?.customerReference}</dd></>}{sheet?.purchaseOrderNumber&&<><dt>PO number</dt><dd>{sheet?.purchaseOrderNumber}</dd></>}</dl>{bookingNotes.map(([k,v])=><p key={k}><strong>{k}</strong> {v}</p>)}</details></section>

<section className="fresh-mobile-booking-card"><h2>POD &amp; Documents</h2><strong>{statusLabel[currentStatus]??currentStatus}</strong>{deliveredStage&&!podComplete&&<button type="button" className="fresh-mobile-booking-primary" onClick={()=>router.push('/driver-pwa-fresh/bookings/'+encodeURIComponent(job.id)+'/pod')}>Complete required POD</button>}{deliveredStage&&podComplete&&<p role="status">POD complete and recorded.</p>}{podComplete&&!invoiceRecorded&&canGenerateInvoices&&<button type="button" className="fresh-mobile-booking-primary" disabled={working} onClick={()=>void createInvoice()}>Create Invoice</button>}{sheet?.invoices[0]?.id&&<><p>Invoice recorded: {sheet.invoices[0].number??'Draft invoice'} · {sheet.invoices[0].paymentStatus??sheet.invoices[0].status??'Draft'}</p><button type="button" className="fresh-mobile-booking-primary" onClick={()=>router.push(`/driver/finance/invoices/${sheet.invoices[0].id}`)}>View &amp; Review Invoice</button></>}{podComplete&&<button type="button" disabled={working} onClick={()=>void downloadPodPdf()}>Download POD PDF</button>}{podComplete&&<p>Delivery evidence is recorded in the booking. The invoice remains a draft until reviewed and sent by an authorised user.</p>}</section>
      </>}
      {podOnly && <section className="fresh-mobile-booking-card"><h1>Proof of Delivery</h1><p>{stops[0].place} → {stops[1].place}</p><p>{formatDateTime(stops[0].at)} / {formatDateTime(stops[1].at)}</p>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>}
{(mobilePodOpen||podOnly)&&<section className="fresh-mobile-booking-card fresh-mobile-pod">
<h2>POD</h2>
{podOnly&&<p role="status">{podDraftError ? 'Draft not saved: '+podDraftError : podDraftSaving ? 'Saving draft to XDrive...' : podDraftLoaded ? 'Draft connected to XDrive' : 'Loading saved draft...'}</p>}
<label>Delivery status<select value={podDeliveryStatus} onChange={e=>setPodDeliveryStatus(e.target.value)}><option>Completed Delivery</option><option>Partial Delivery</option><option>Failed Delivery</option><option>Refused</option><option>Left Safe</option></select></label>
<label>Number of Items *<div className="fresh-pod-stepper"><button type="button" onClick={()=>setPodItemCount(String(Math.max(1,(Number(podItemCount)||1)-1)))}>−</button><input type="number" min="1" required value={podItemCount} onChange={e=>setPodItemCount(e.target.value)}/><button type="button" onClick={()=>setPodItemCount(String((Number(podItemCount)||0)+1))}>+</button></div></label>
<label>Weight (kg)<div className="fresh-pod-stepper"><button type="button" onClick={()=>setPodWeight(String(Math.max(0,(Number(podWeight)||0)-1)))}>−</button><input type="number" min="0" step="0.1" value={podWeight} onChange={e=>setPodWeight(e.target.value)}/><button type="button" onClick={()=>setPodWeight(String((Number(podWeight)||0)+1))}>+</button></div></label>
<div><strong>Job Details</strong><p>{requestedVehicle}</p></div>
<label>Driver's Notes<textarea rows={4} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)}/><small>{notes.length}/500</small></label>
<label>Photo * (required) — {deliveryPhotos.length}/10<input type="file" accept="image/jpeg,image/png" multiple disabled={working||podComplete} onChange={e=>void selectDeliveryPhotos(e)}/></label>
{deliveryPhotos.length>0&&<ul aria-label="Saved POD photos">{deliveryPhotos.map(path=><li key={path}>{decodeURIComponent(path.split("/").pop()??"Photo")} — saved</li>)}</ul>}
<label>Add Document (optional)<input type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={working||podComplete} onChange={e=>void selectPodDocuments(e)}/></label>
{pendingPodDocuments.length>0&&<ul aria-label="Saved POD documents">{pendingPodDocuments.map(path=><li key={path}>{decodeURIComponent(path.split("/").pop()??"Document")} — saved</li>)}</ul>}
<label>Signature * (required)<canvas ref={signatureRef} width={300} height={120} onMouseDown={startSignature} onMouseMove={drawSignature} onMouseUp={()=>setSigning(false)} onTouchStart={startSignature} onTouchMove={drawSignature} onTouchEnd={()=>setSigning(false)} style={{touchAction:'none',width:'100%',maxWidth:300,border:'1px solid #94a3b8'}}/></label>
<div className="fresh-mobile-booking-actions"><button type="button" onClick={()=>{const next=signatureData();if(next){setSavedSignatureData(next);setPodDraftError('');setMessage('Signature captured. Saving to XDrive draft...');}else setPodDraftError('Please draw your signature before saving.');}}>Save Signature</button><button type="button" onClick={()=>{clearSignature();setSavedSignatureData('');setMessage('Signature cleared.');}}>Clear Signature</button></div>{savedSignatureData&&<p role="status">Signature captured — {podDraftSaving?'saving draft...':podDraftError?'draft save failed':'included in saved POD draft'}.</p>}
<div className="fresh-pod-left-at">
  <label htmlFor="pod-left-at">Left At *</label>
  <p>Tap the location where the goods were actually handed over:</p>
  <div className="fresh-pod-left-at-options" role="group" aria-label="Delivery handover location">
    {['Goods Inwards', 'Reception', 'Recipient', 'Warehouse', 'Loading Bay', 'Delivery Office', 'Authorised Safe Place'].map(option => (
      <button key={option} type="button" aria-pressed={podLeftAt === option}
        className={podLeftAt === option ? 'fresh-pod-left-at-selected' : ''}
        onClick={() => setPodLeftAt(option)}>{option}</button>
    ))}
  </div>
  <label htmlFor="pod-left-at">Other location / exact details</label>
  <input id="pod-left-at" required value={podLeftAt} onChange={e => setPodLeftAt(e.target.value)}
    placeholder="Select above or enter exact location" autoComplete="off" />
  <small>Only select an authorised safe place when delivery instructions permit it. The selected value is saved in the POD draft.</small>
</div>
<label>Delivered On<input type="date" value={podDeliveredOn} onChange={e=>setPodDeliveredOn(e.target.value)}/></label>
<label>Received By (Full Name) *<input required value={recipientName} onChange={e=>setRecipientName(e.target.value)}/></label>
{hardCopyRequired&&<label><input type="checkbox" checked={hardCopyAcknowledged} onChange={e=>setHardCopyAcknowledged(e.target.checked)}/> Hard-copy POD acknowledged</label>}
{!podComplete&&currentStatus==='on_site_delivery'&&<div role="status"><p>Delivery arrival is recorded, but the job has not yet been marked Delivered. Confirm the handover before sending POD.</p>{deliveryPhotos.length===0&&<p>Take at least one delivery photo before confirming the handover.</p>}<button type="button" className="fresh-mobile-booking-primary" disabled={working||deliveryPhotos.length===0} onClick={()=>void moveStatus('delivered')}>{working?'Saving...':'Confirm Delivered'}</button></div>}{!podComplete&&<div role="status" aria-label="POD submission checklist"><strong>Before sending POD</strong><ul><li>{deliveryPhotos.length>0?'✓':'○'} At least one saved delivery photo</li><li>{recipientName.trim()?'✓':'○'} Recipient full name</li><li>{savedSignatureData||job.delivery_signature_data?'✓':'○'} Saved recipient signature</li><li>{podLeftAt.trim()?'✓':'○'} Left At location</li>{hardCopyRequired&&<li>{hardCopyAcknowledged?'✓':'○'} Hard-copy POD acknowledged</li>}</ul>{error&&<p role="alert">POD not sent: {error}</p>}</div>}{!podComplete?<button type="button" className="fresh-mobile-booking-primary fresh-pod-send" disabled={working||!['delivered','completed','invoiced'].includes(currentStatus)} onClick={()=>void completePod()}>{working?'Saving...':'Send POD'}</button>:<p>POD recorded</p>}
{podOnly && (!podComplete ? <button type="button" className="fresh-mobile-booking-primary" disabled={working||podDraftSaving||!podDraftLoaded} onClick={()=>void savePodDraftNow()}>{podDraftSaving?"Saving POD...":"Save POD Draft"}</button> : <p role="status">POD saved and recorded. This completed POD cannot be overwritten.</p>)}
{podComplete&&<button type="button" disabled={working} onClick={()=>void downloadPodPdf()}>Download POD PDF</button>}
</section>}
{!podOnly&&<section className="fresh-mobile-booking-card" aria-label="Delivery closeout and documents"><h2>Delivery closeout &amp; documents</h2><p role="status">{closeoutLabel}</p><dl><dt>Delivery</dt><dd>{['delivered','completed','invoiced'].includes(currentStatus)?'Delivered':'In progress'}</dd><dt>Proof of Delivery</dt><dd>{podComplete?'Recorded and available':'Awaiting completed recipient evidence'}</dd><dt>Invoice</dt><dd>{sheet?.invoices[0]?.id?`${sheet.invoices[0].number??'Recorded invoice'} — ${sheet.invoices[0].status??'Draft'}`:podComplete?'Ready for authorised carrier owner/admin':'Available after POD'}</dd></dl>{podComplete&&!sheet?.invoices[0]?.id&&!canGenerateInvoices&&<p>Invoice generation is managed by the carrier company owner or administrator.</p>}</section>}{!podOnly&&<section className="fresh-mobile-booking-card"><details><summary>Event Log ({timelineRows.length})</summary><ol className="fresh-mobile-booking-history">{timelineRows.map(([status,time,detail],i)=><li key={i}><strong>{status}</strong><small>{time}</small><p>{detail}</p></li>)}</ol></details></section>}
    </div>;
  }
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Marketplace job"
        title={`${job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → ${job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}`}
        description={`Load ${sheet?.reference ?? `XDL-${job.id.slice(0, 8).toUpperCase()}`} · ${statusLabel[currentStatus] ?? currentStatus}`}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}
      {sheet?.partial && <AlertBanner tone="warning">Part of the awarded booking could not be enriched. Verified values are shown and missing values remain explicitly unavailable.</AlertBanner>}

      <div className="workspace-record-meta workspace-list-controls" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
        <span className="workspace-list-controls__right">
          <ActionButton tone="secondary" onClick={() => router.push(mobilePwa ? '/driver-pwa-fresh/bookings' : '/driver/jobs')}>← Back</ActionButton>
          <ActionButton tone="secondary" onClick={() => void loadJob()}>Refresh</ActionButton>
        </span>
      </div>

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
