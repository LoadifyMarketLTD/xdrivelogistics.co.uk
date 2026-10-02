'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DbJob } from '../../../lib/types/database';
import { getLoadDetailSections } from '../../../lib/loadPostingDetails';
import { canonicalExecutionStatus, nextDriverExecutionStatus } from '../../../lib/jobs/jobLifecyclePresentation';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from './WorkspaceUI';
import WorkspaceJobReplay from './WorkspaceJobReplay';
import DriverPodCapturePanel from './DriverPodCapturePanel';

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
  podRequired: boolean | null;
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

export default function DriverJobExecutionPage({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = user?.driverId?.trim() ?? '';
  const companyId = user?.companyId ?? '';
  const [job, setJob] = useState<DbJob | null>(null);
  const [sheet, setSheet] = useState<JobSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [collectionPhotos, setCollectionPhotos] = useState<string[]>([]);
  const collectionCameraInput = useRef<HTMLInputElement>(null);
  const collectionGalleryInput = useRef<HTMLInputElement>(null);

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

    const auth = await authHeader();
    if (auth) {
      try {
        const response = await fetch(`/api/driver/jobs/${encodeURIComponent(jobId)}/sheet`, { headers: { Authorization: auth }, cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as { sheet?: JobSheet; error?: string };
        if (response.ok) setSheet(payload.sheet ?? null);
      } catch {
        // Execution remains usable if enrichment is temporarily unavailable.
      }
    }
    setLoading(false);
  }, [authHeader, driverId, jobId]);

  useEffect(() => { void loadJob(); }, [loadJob]);


  const uploadCollectionEvidence = async (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Collection photos must be JPEG or PNG images.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Each collection photo must be 10 MB or smaller.');
    const auth = await authHeader();
    if (!auth) throw new Error('Your XDrive session is not available. Please sign in again.');
    const extension = file.type === 'image/png' ? 'png' : 'jpg';
    const objectName = `collection-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const response = await fetch(`/api/driver/mobile/jobs/${encodeURIComponent(jobId)}/evidence`, {
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
  const moveStatus = async (nextStatus: string) => {
    if (!job || !driverId) return;
    setWorking(true); setError(''); setMessage('');
    if (nextStatus === 'loaded') {
      if (!collectionPhotos.length) { setError('At least one collection photo is required before the job can be marked loaded.'); setWorking(false); return; }
      const auth = await authHeader();
      if (!auth) { setError('Your XDrive session is not available. Please sign in again.'); setWorking(false); return; }
      const handoverResponse = await fetch(`/api/driver/mobile/jobs/${encodeURIComponent(job.id)}/handover`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPaths: collectionPhotos, notes: notes.trim() || undefined }),
      });
      const handoverPayload = await handoverResponse.json().catch(() => ({})) as { error?: string };
      if (!handoverResponse.ok) { setError(handoverPayload.error || 'Collection handover could not be saved.'); setWorking(false); return; }

      const loadedResponse = await fetch(`/api/driver/mobile/jobs/${encodeURIComponent(job.id)}/loaded`, {
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
    if (nextStatus === 'delivered') {
      setError('Complete the POD panel before marking this job delivered.');
      setWorking(false);
      return;
    }
    const { error: transitionError } = await supabase.rpc('driver_update_job_status_atomic', {
      p_driver_id: driverId, p_job_id: job.id, p_next_status: nextStatus, p_driver_notes: notes.trim() || null,
    });
    if (transitionError) setError(transitionError.message);
    else { setMessage(`Job updated: ${statusLabel[nextStatus] ?? nextStatus}.`); await loadJob(); }
    setWorking(false);
  };

  if (loading) return <PageFrame><EmptyState title="Loading assigned job…" /></PageFrame>;
  if (!job) return <PageFrame><AlertBanner tone="danger">{error || 'Job not found.'}</AlertBanner></PageFrame>;

  const podJob = job as DbJob & {
    damage_photos?: string[] | null;
    pod_photos?: string[] | null;
    pod_required?: boolean | null;
    pod_generated?: boolean | null;
    pod_generated_at?: string | null;
  };
  const currentStatus = canonicalExecutionStatus(job.current_status ?? job.status);
  const nextStatus = nextDriverExecutionStatus(currentStatus);
  const nextLabel = nextStatus ? nextActionLabel[nextStatus] ?? statusLabel[nextStatus] ?? nextStatus : null;
  const navigationStage = currentStatus === 'on_my_way' ? 'pickup' : currentStatus === 'in_transit' ? 'delivery' : null;
  const navigationAddress = navigationStage === 'pickup'
    ? (sheet?.pickup.address ?? job.pickup_location ?? '')
    : navigationStage === 'delivery'
      ? (sheet?.delivery.address ?? job.delivery_location ?? '')
      : '';
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
          <div className="driver-detail-item"><span>Hard-copy POD</span><strong>{sheet?.hardCopyPod ?? (sheet?.podRequired === false ? 'Not required' : 'Requirement not supplied')}</strong></div>
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
          {nextStatus && nextLabel && nextStatus !== 'delivered' && <ActionButton tone="success" disabled={working} onClick={() => void moveStatus(nextStatus)}>{working ? 'Saving…' : nextLabel}</ActionButton>}
          {navigationStage && navigationAddress && <>
            <a href={mapsUrl(navigationAddress, navigationPostcode)} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>Google Maps ? {navigationStage === 'pickup' ? 'Pickup' : 'Delivery'}</a>
            <a href={wazeUrl(navigationAddress, navigationPostcode)} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>Waze ? {navigationStage === 'pickup' ? 'Pickup' : 'Delivery'}</a>
          </>}
          <a href={routeMapUrl(job)} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>Route / Track</a>
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
          {currentStatus === 'on_site_delivery' && (
            <DriverPodCapturePanel
              jobId={job.id}
              podRequired={sheet?.podRequired ?? podJob.pod_required ?? true}
              hardCopyPod={sheet?.hardCopyPod}
              existingDeliveryPhotos={Array.isArray(job.delivery_photos) ? job.delivery_photos : []}
              existingDamagePhotos={Array.isArray(podJob.damage_photos) ? podJob.damage_photos : []}
              existingDocuments={Array.isArray(podJob.pod_photos) ? podJob.pod_photos : []}
              existingRecipientName={job.client_signature_name}
              existingSignature={Boolean(job.delivery_signature_data)}
              driverNotes={notes}
              onError={setError}
              onSaved={async (notice) => {
                setError('');
                setMessage(notice);
                await loadJob();
              }}
            />
          )}
        </div>

        <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
          <Panel title="Operational timeline" description="Pickup, loading, transit, delivery and completion events."><DataTable columns={['Status', 'Time', 'Details']} rows={timelineRows} empty={<EmptyState title="No recorded history" />} /></Panel>
          <Panel title="Journey Replay" description="GPS route, tracked distance, speed evidence and lifecycle events for this assigned job."><WorkspaceJobReplay jobId={jobId} /></Panel>
          <Panel title="Notes" description="Driver operational notes remain separate from the awarded Order confirmation."><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Loading condition, waiting time, access issue or delivery note" style={{ ...inputStyle, resize: 'vertical' }} /></Panel>
          <Panel title="Documents"><div style={{ display: 'grid', gap: 5 }}>{sheet?.documents.length ? sheet.documents.map((document) => <div key={document.id ?? `${document.type}-${document.createdAt}`} className="driver-detail-item"><span>{document.type}</span><strong>{document.fileName ?? 'Job document'}</strong><small>{formatDateTime(document.createdAt)}</small></div>) : <EmptyState title="No job documents" />}</div></Panel>
          <Panel title="POD and invoice">
            <div className="driver-detail-grid">
              <div className="driver-detail-item">
                <span>POD status</span>
                <strong>{podJob.pod_generated ? 'Captured' : 'Not completed'}</strong>
                <small>{podJob.pod_generated_at ? formatDateTime(podJob.pod_generated_at) : 'No POD completion timestamp'}</small>
              </div>
              <div className="driver-detail-item"><span>Delivery photos</span><strong>{Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0}</strong></div>
              <div className="driver-detail-item"><span>Damage photos</span><strong>{Array.isArray(podJob.damage_photos) ? podJob.damage_photos.length : 0}</strong></div>
              <div className="driver-detail-item"><span>POD documents</span><strong>{Array.isArray(podJob.pod_photos) ? podJob.pod_photos.length : 0}</strong></div>
              <div className="driver-detail-item"><span>Recipient</span><strong>{job.client_signature_name ?? 'Not captured'}</strong></div>
              <div className="driver-detail-item"><span>Signature</span><strong>{job.delivery_signature_data ? 'Captured' : 'Not captured'}</strong></div>
              <div className="driver-detail-item"><span>Invoice</span><strong>{sheet?.invoices[0]?.number ?? 'Not generated'}</strong><small>{sheet?.invoices[0]?.paymentStatus ?? sheet?.invoices[0]?.status ?? ''}</small></div>
            </div>
          </Panel>
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 4, padding: '7px 8px', background: '#fff', color: '#0f172a', fontSize: 12 };
const linkButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 32, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#0b2f6b', fontSize: 12, fontWeight: 700, textDecoration: 'none' };
