'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DbJob } from '../../../lib/types/database';
import { getLoadDetailSections } from '../../../lib/loadPostingDetails';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from './WorkspaceUI';

const statusLabel: Record<string, string> = {
  awarded: 'Accepted', allocated: 'Accepted', on_my_way: 'On my way to pickup',
  on_site_pickup: 'On site (pickup)', loaded: 'Loaded', in_transit: 'On my way to delivery',
  on_site_delivery: 'On site (delivery)', delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled',
};

const nextAction: Record<string, { status: string; label: string }> = {
  awarded: { status: 'on_my_way', label: 'On my Way to Pickup' },
  allocated: { status: 'on_my_way', label: 'On my Way to Pickup' },
  on_my_way: { status: 'on_site_pickup', label: 'On Site (Pickup)' },
  on_site_pickup: { status: 'loaded', label: 'Confirm Loaded' },
  loaded: { status: 'in_transit', label: 'On my Way to Delivery' },
  in_transit: { status: 'on_site_delivery', label: 'On Site (Delivery)' },
  on_site_delivery: { status: 'delivered', label: 'Confirm Delivered' },
  delivered: { status: 'completed', label: 'Complete Job' },
};

type JobSheet = {
  reference: string;
  loadId: string;
  status: string;
  bookedBy: string;
  memberCode: string | null;
  memberPhone: string | null;
  agreedRate: number | null;
  currency: string;
  customerReference: string | null;
  purchaseOrderNumber: string | null;
  bookingReference: string | null;
  distanceMiles: number | null;
  vehicleRequested: string | null;
  vehicleRef: string | null;
  vehicleType: string | null;
  paymentTerms: string;
  hardCopyPod: string;
  podRequired: boolean;
  pickupSlot: string | null;
  deliverySlot: string | null;
  loadNotes: string | null;
  driverNotes: string | null;
  timeline: Array<{ id: string | null; eventType: string; message: string | null; meta: unknown; createdAt: string | null }>;
  documents: Array<{ id: string | null; type: string; fileName: string | null; filePath: string | null; createdAt: string | null }>;
  invoices: Array<{ id: string | null; number: string | null; status: string | null; amount: number | null; currency: string }>;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const money = (amount: number | null | undefined, currency = 'GBP') => amount == null
  ? 'Not supplied'
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

const mapsUrl = (address: string, postcode?: string | null) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(postcode ? `${address}, ${postcode}` : address)}`;

const routeMapUrl = (job: DbJob) => {
  const params = new URLSearchParams({ api: '1' });
  if (job.pickup_postcode || job.pickup_location) params.set('origin', job.pickup_postcode || job.pickup_location || '');
  if (job.delivery_postcode || job.delivery_location) params.set('destination', job.delivery_postcode || job.delivery_location || '');
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

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
  const [collectionPhoto, setCollectionPhoto] = useState<string | null>(null);
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [signing, setSigning] = useState(false);
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const collectionInput = useRef<HTMLInputElement>(null);
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
    setCollectionPhoto(row.collection_photo_url ?? null);
    setDeliveryPhotos(Array.isArray(row.delivery_photos) ? row.delivery_photos : []);
    setRecipientName(row.client_signature_name ?? '');

    const auth = await authHeader();
    if (auth) {
      try {
        const response = await fetch(`/api/driver/jobs/${encodeURIComponent(jobId)}/sheet`, { headers: { Authorization: auth } });
        const payload = await response.json().catch(() => ({})) as { sheet?: JobSheet; error?: string };
        if (response.ok) setSheet(payload.sheet ?? null);
      } catch {
        // The execution screen remains usable even if commercial enrichment is temporarily unavailable.
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
    const path = `${companyId}/${jobId}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('pod-photos').upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);
    return path;
  };

  const selectCollectionPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorking(true); setError('');
    try { setCollectionPhoto(await uploadImage(file, 'collection')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Collection photo upload failed.'); }
    finally { setWorking(false); }
  };

  const selectDeliveryPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setWorking(true); setError('');
    try {
      const paths: string[] = [];
      for (const file of files) paths.push(await uploadImage(file, 'delivery'));
      setDeliveryPhotos((current) => [...current, ...paths]);
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

  const moveStatus = async (nextStatus: string) => {
    if (!job || !driverId) return;
    setWorking(true); setError(''); setMessage('');
    const fields: Record<string, unknown> = {};
    if (nextStatus === 'loaded') {
      if (!collectionPhoto) { setError('A loading photo is required before the job can be marked loaded.'); setWorking(false); return; }
      fields.p_collection_photo_url = collectionPhoto;
    }
    if (nextStatus === 'delivered') {
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

  const currentStatus = String(job.current_status ?? job.status).toLowerCase();
  const next = nextAction[currentStatus];
  const loadSections = getLoadDetailSections(job);
  const history = Array.isArray(job.status_history) ? job.status_history : [];
  const timelineRows = sheet?.timeline.length
    ? sheet.timeline.map((entry) => [statusLabel[entry.eventType] ?? entry.eventType.replace(/_/g, ' '), formatDateTime(entry.createdAt), entry.message ?? '—'])
    : history.map((entry) => [statusLabel[String(entry.status)] ?? String(entry.status ?? 'Update'), formatDateTime(entry.timestamp), entry.note ?? '—']);
  const bookedAt = sheet?.timeline.find((entry) => ['awarded', 'allocated', 'accepted'].includes(entry.eventType))?.createdAt ?? null;
  const requestedVehicle = sheet?.vehicleRequested
    ? (VEHICLE_TYPE_LABELS[sheet.vehicleRequested] ?? sheet.vehicleRequested.replace(/_/g, ' '))
    : (job.requested_vehicle_label ?? VEHICLE_TYPE_LABELS[job.vehicle_type ?? ''] ?? 'Not supplied');
  const allocatedVehicle = sheet?.vehicleType
    ? (VEHICLE_TYPE_LABELS[sheet.vehicleType] ?? sheet.vehicleType.replace(/_/g, ' '))
    : (VEHICLE_TYPE_LABELS[job.vehicle_type ?? ''] ?? 'Not supplied');
  const bookingNotes = sheet?.loadNotes?.trim() || job.load_details?.trim() || null;
  const paperworkInstructions = Array.isArray(job.document_checklist) && job.document_checklist.length
    ? job.document_checklist.join(' · ')
    : null;
  const workingInstructions = [job.special_requirements, job.access_restrictions].filter((value): value is string => Boolean(value?.trim()));

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

      <Panel title="Order" description="Awarded booking confirmation and operational instructions from the existing driver-authorised job data.">
        <div className="driver-detail-grid">
          <div className="driver-detail-item"><span>Booking / job reference</span><strong>{sheet?.bookingReference ?? job.booking_reference ?? sheet?.reference ?? `XDL-${job.id.slice(0, 8).toUpperCase()}`}</strong><small>Load ID {job.id.slice(0, 8).toUpperCase()}</small></div>
          <div className="driver-detail-item"><span>Booked / allocated</span><strong>{bookedAt ? formatDateTime(bookedAt) : 'Timestamp not exposed'}</strong></div>
          <div className="driver-detail-item"><span>Requested vehicle</span><strong>{requestedVehicle}</strong></div>
          <div className="driver-detail-item"><span>Allocated vehicle</span><strong>{allocatedVehicle}</strong><small>{sheet?.vehicleRef ? `Vehicle ref: ${sheet.vehicleRef}` : 'Vehicle ref not supplied'}</small></div>
          <div className="driver-detail-item"><span>Body type</span><strong>Not supplied</strong></div>
          <div className="driver-detail-item"><span>Subcontracted by</span><strong>{sheet?.bookedBy ?? job.client_name ?? 'Not supplied'}</strong><small>{sheet?.memberCode ? `Member ${sheet.memberCode}` : ''}</small></div>
          <div className="driver-detail-item"><span>Subcontracted to</span><strong>Company identity not exposed to driver</strong></div>
          <div className="driver-detail-item"><span>Agreed rate</span><strong>{money(sheet?.agreedRate, sheet?.currency ?? job.currency)}</strong></div>
          <div className="driver-detail-item"><span>Extras</span><strong>Not supplied</strong></div>
          <div className="driver-detail-item"><span>Payment terms</span><strong>{sheet?.paymentTerms ?? 'Not provided'}</strong></div>
          <div className="driver-detail-item"><span>Hard-copy POD</span><strong>{sheet?.hardCopyPod ?? (sheet?.podRequired === false ? 'Not required' : 'Requirement not supplied')}</strong></div>
          <div className="driver-detail-item"><span>Customer reference</span><strong>{sheet?.customerReference ?? job.customer_reference ?? 'Not supplied'}</strong></div>
          <div className="driver-detail-item"><span>PO number</span><strong>{sheet?.purchaseOrderNumber ?? job.purchase_order_number ?? 'Not supplied'}</strong></div>
          <div className="driver-detail-item"><span>Distance</span><strong>{sheet?.distanceMiles != null ? `${sheet.distanceMiles} miles` : job.job_distance_miles != null ? `${job.job_distance_miles} miles` : 'Not supplied'}</strong></div>
        </div>

        {bookingNotes && (
          <div className="driver-order-block">
            <strong>Notes &amp; Details</strong>
            <span>{bookingNotes}</span>
          </div>
        )}

        <div className="driver-order-stops">
          <section className="driver-order-stop">
            <div className="driver-order-stop__head"><strong>Pickup</strong><span>{formatDateTime(job.pickup_datetime)}{sheet?.pickupSlot ? ` · ${sheet.pickupSlot}` : ''}</span></div>
            <div className="driver-detail-grid">
              <div className="driver-detail-item"><span>Address</span><strong>{[job.pickup_location, job.pickup_postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong></div>
              <div className="driver-detail-item"><span>Company</span><strong>Not separately supplied</strong></div>
              <div className="driver-detail-item"><span>Contact</span><strong>{job.collection_contact_name ?? 'Not supplied'}</strong></div>
              <div className="driver-detail-item"><span>Phone</span><strong>{job.collection_contact_phone ?? 'Not supplied'}</strong></div>
            </div>
          </section>
          <section className="driver-order-stop">
            <div className="driver-order-stop__head"><strong>Delivery</strong><span>{formatDateTime(job.delivery_datetime)}{sheet?.deliverySlot ? ` · ${sheet.deliverySlot}` : ''}</span></div>
            <div className="driver-detail-grid">
              <div className="driver-detail-item"><span>Address</span><strong>{[job.delivery_location, job.delivery_postcode].filter(Boolean).join(', ') || 'Not supplied'}</strong></div>
              <div className="driver-detail-item"><span>Company</span><strong>Not separately supplied</strong></div>
              <div className="driver-detail-item"><span>Contact</span><strong>{job.delivery_contact_name ?? 'Not supplied'}</strong></div>
              <div className="driver-detail-item"><span>Phone</span><strong>{job.delivery_contact_phone ?? 'Not supplied'}</strong></div>
            </div>
          </section>
        </div>

        {(workingInstructions.length > 0 || paperworkInstructions || sheet?.hardCopyPod) && (
          <div className="driver-order-block">
            <strong>Working &amp; paperwork instructions</strong>
            {workingInstructions.map((instruction) => <span key={instruction}>{instruction}</span>)}
            {paperworkInstructions && <span>Paperwork: {paperworkInstructions}</span>}
            {sheet?.hardCopyPod && <span>POD: {sheet.hardCopyPod}</span>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
          {next && <ActionButton tone="success" disabled={working} onClick={() => void moveStatus(next.status)}>{working ? 'Saving…' : next.label}</ActionButton>}
          <a href={routeMapUrl(job)} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>Route / Track</a>
          {sheet?.memberPhone && <a href={`tel:${sheet.memberPhone.replace(/\s+/g, '')}`} style={linkButtonStyle}>Call Member</a>}
          {sheet?.invoices[0]?.id && <ActionButton tone="secondary" onClick={() => router.push(`/driver/finance/invoices/${sheet.invoices[0].id}`)}>View invoice (£)</ActionButton>}
        </div>
      </Panel>

      <TwoColumn>
        <div style={{ display: 'grid', gap: 8 }}>
          <Panel title="Route and navigation">
            <DataTable columns={['Stop', 'Address', 'Time', 'Navigation']} rows={[
              ['Pickup', [job.pickup_location, job.pickup_postcode].filter(Boolean).join(', ') || 'Not set', formatDateTime(job.pickup_datetime), job.pickup_location ? <a key="pickup" href={mapsUrl(job.pickup_location, job.pickup_postcode)} target="_blank" rel="noopener noreferrer">Open map</a> : '—'],
              ['Delivery', [job.delivery_location, job.delivery_postcode].filter(Boolean).join(', ') || 'Not set', formatDateTime(job.delivery_datetime), job.delivery_location ? <a key="delivery" href={mapsUrl(job.delivery_location, job.delivery_postcode)} target="_blank" rel="noopener noreferrer">Open map</a> : '—'],
            ]} />
          </Panel>

          {loadSections.map((section) => <Panel key={section.title} title={section.title}><div className="driver-detail-grid">{section.items.map((item) => <div className="driver-detail-item" key={`${section.title}-${item.label}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></Panel>)}

          {(currentStatus === 'on_site_pickup' || currentStatus === 'loaded') && <Panel title="Collection evidence" description="A loading image is mandatory before confirming loaded."><input ref={collectionInput} type="file" accept="image/*" capture="environment" hidden onChange={selectCollectionPhoto} /><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><StatusBadge value={collectionPhoto ? 'Photo ready' : 'Photo required'} tone={collectionPhoto ? 'green' : 'orange'} /><ActionButton tone="secondary" disabled={working} onClick={() => collectionInput.current?.click()}>{collectionPhoto ? 'Replace loading photo' : 'Take loading photo'}</ActionButton></div></Panel>}

          {currentStatus === 'on_site_delivery' && <Panel title="Delivery evidence" description="Photo, recipient name and signature are all required."><input ref={deliveryInput} type="file" accept="image/*" capture="environment" multiple hidden onChange={selectDeliveryPhotos} /><div style={{ display: 'grid', gap: 7 }}><ActionButton tone="secondary" disabled={working} onClick={() => deliveryInput.current?.click()}>Add delivery photos ({deliveryPhotos.length})</ActionButton><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Recipient full name" style={inputStyle} /><canvas ref={signatureRef} width={500} height={150} onMouseDown={startSignature} onMouseMove={drawSignature} onMouseUp={() => setSigning(false)} onMouseLeave={() => setSigning(false)} onTouchStart={startSignature} onTouchMove={drawSignature} onTouchEnd={() => setSigning(false)} style={{ width: '100%', height: 150, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', touchAction: 'none' }} /><ActionButton tone="secondary" onClick={clearSignature}>Clear signature</ActionButton></div></Panel>}
        </div>

        <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
          <Panel title="Operational timeline" description="Pickup, loading, transit, delivery and completion events."><DataTable columns={['Status', 'Time', 'Details']} rows={timelineRows} empty={<EmptyState title="No recorded history" />} /></Panel>
          <Panel title="Notes" description="Driver operational notes remain separate from the awarded Order confirmation."><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Loading condition, waiting time, access issue or delivery note" style={{ ...inputStyle, resize: 'vertical' }} /></Panel>
          <Panel title="Documents"><div style={{ display: 'grid', gap: 5 }}>{sheet?.documents.length ? sheet.documents.map((document) => <div key={document.id ?? `${document.type}-${document.createdAt}`} className="driver-detail-item"><span>{document.type}</span><strong>{document.fileName ?? 'Job document'}</strong><small>{formatDateTime(document.createdAt)}</small></div>) : <EmptyState title="No job documents" />}</div></Panel>
          <Panel title="POD and invoice"><div className="driver-detail-grid"><div className="driver-detail-item"><span>Delivery photos</span><strong>{deliveryPhotos.length}</strong></div><div className="driver-detail-item"><span>Recipient</span><strong>{job.client_signature_name ?? 'Not captured'}</strong></div><div className="driver-detail-item"><span>Invoice</span><strong>{sheet?.invoices[0]?.number ?? 'Not generated'}</strong><small>{sheet?.invoices[0]?.status ?? ''}</small></div></div></Panel>
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 4, padding: '7px 8px', background: '#fff', color: '#0f172a', fontSize: 12 };
const linkButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 32, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', color: '#0b2f6b', fontSize: 12, fontWeight: 700, textDecoration: 'none' };
