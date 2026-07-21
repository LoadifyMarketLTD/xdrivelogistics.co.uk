'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DbJob } from '../../../lib/types/database';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
} from './WorkspaceUI';

const statusLabel: Record<string, string> = {
  awarded: 'Awarded', allocated: 'Allocated', on_my_way: 'On my way to pickup',
  on_site_pickup: 'At pickup', loaded: 'Loaded', in_transit: 'On my way to delivery',
  on_site_delivery: 'At delivery', delivered: 'Delivered', completed: 'Completed',
};

const nextAction: Record<string, { status: string; label: string }> = {
  awarded: { status: 'on_my_way', label: 'Start journey to pickup' },
  allocated: { status: 'on_my_way', label: 'Start journey to pickup' },
  on_my_way: { status: 'on_site_pickup', label: 'Arrived at pickup' },
  on_site_pickup: { status: 'loaded', label: 'Confirm loaded' },
  loaded: { status: 'in_transit', label: 'Start journey to delivery' },
  in_transit: { status: 'on_site_delivery', label: 'Arrived at delivery' },
  on_site_delivery: { status: 'delivered', label: 'Confirm delivery' },
  delivered: { status: 'completed', label: 'Complete job' },
};

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

const mapsUrl = (address: string, postcode?: string | null) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(postcode ? `${address}, ${postcode}` : address)}`;

export default function DriverJobExecutionPage({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = user?.driverId?.trim() ?? '';
  const companyId = user?.companyId ?? '';
  const [job, setJob] = useState<DbJob | null>(null);
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

  const loadJob = useCallback(async () => {
    if (!jobId || !driverId) return;
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('assigned_driver_id', driverId)
      .maybeSingle();
    if (loadError || !data) {
      setError(loadError?.message ?? 'This job is not assigned to your driver account.');
      setJob(null);
    } else {
      const row = data as DbJob;
      setJob(row);
      setNotes(row.driver_notes ?? '');
      setCollectionPhoto(row.collection_photo_url ?? null);
      setDeliveryPhotos(Array.isArray(row.delivery_photos) ? row.delivery_photos : []);
      setRecipientName(row.client_signature_name ?? '');
    }
    setLoading(false);
  }, [driverId, jobId]);

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
    setWorking(true);
    setError('');
    try { setCollectionPhoto(await uploadImage(file, 'collection')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Collection photo upload failed.'); }
    finally { setWorking(false); }
  };

  const selectDeliveryPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setWorking(true);
    setError('');
    try {
      const paths: string[] = [];
      for (const file of files) paths.push(await uploadImage(file, 'delivery'));
      setDeliveryPhotos((current) => [...current, ...paths]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Delivery photo upload failed.');
    } finally { setWorking(false); }
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
    setSigning(true);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const drawSignature = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!signing) return;
    event.preventDefault();
    const point = pointer(event);
    const context = signatureRef.current?.getContext('2d');
    if (!point || !context) return;
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = '#0b2f6b';
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const signatureData = () => {
    const canvas = signatureRef.current;
    if (!canvas) return null;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasInk = pixels.some((value, index) => index % 4 !== 3 && value !== 0);
    return hasInk ? canvas.toDataURL('image/png') : null;
  };

  const moveStatus = async (nextStatus: string) => {
    if (!job || !driverId) return;
    setWorking(true);
    setError('');
    setMessage('');

    const fields: Record<string, unknown> = {};
    if (nextStatus === 'loaded') {
      if (!collectionPhoto) {
        setError('A loading photo is required before the job can be marked loaded.');
        setWorking(false);
        return;
      }
      fields.p_collection_photo_url = collectionPhoto;
    }
    if (nextStatus === 'delivered') {
      const signature = signatureData();
      if (!deliveryPhotos.length) {
        setError('At least one delivery photo is required.');
        setWorking(false);
        return;
      }
      if (!recipientName.trim()) {
        setError('Recipient name is required.');
        setWorking(false);
        return;
      }
      if (!signature) {
        setError('Recipient signature is required.');
        setWorking(false);
        return;
      }
      fields.p_delivery_photos = deliveryPhotos;
      fields.p_delivery_signature_data = signature;
      fields.p_client_signature_name = recipientName.trim();
    }

    const { error: transitionError } = await supabase.rpc('driver_update_job_status_atomic', {
      p_driver_id: driverId,
      p_job_id: job.id,
      p_next_status: nextStatus,
      p_driver_notes: notes.trim() || null,
      ...fields,
    });

    if (transitionError) setError(transitionError.message);
    else {
      setMessage(`Job updated: ${statusLabel[nextStatus] ?? nextStatus}.`);
      await loadJob();
    }
    setWorking(false);
  };

  if (loading) return <PageFrame><EmptyState title="Loading assigned job…" /></PageFrame>;
  if (!job) return <PageFrame><AlertBanner tone="danger">{error || 'Job not found.'}</AlertBanner></PageFrame>;

  const currentStatus = String(job.current_status ?? job.status).toLowerCase();
  const next = nextAction[currentStatus];
  const history = Array.isArray(job.status_history) ? job.status_history : [];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Driver execution"
        title={`Job ${job.id.slice(0, 8).toUpperCase()}`}
        description={`${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`}
        actions={<>
          <ActionButton tone="secondary" onClick={() => router.push('/driver/jobs')}>Back to jobs</ActionButton>
          <ActionButton tone="secondary" onClick={() => void loadJob()}>Refresh</ActionButton>
        </>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Current status" value={<span style={{ fontSize: '1rem' }}>{statusLabel[currentStatus] ?? currentStatus}</span>} tone="blue" />
        <KpiCard label="Pickup" value={<span style={{ fontSize: '0.9rem' }}>{formatDateTime(job.pickup_datetime)}</span>} tone="navy" />
        <KpiCard label="Delivery" value={<span style={{ fontSize: '0.9rem' }}>{formatDateTime(job.delivery_datetime)}</span>} tone="navy" />
        <KpiCard label="POD evidence" value={deliveryPhotos.length} tone={deliveryPhotos.length ? 'green' : 'orange'} />
      </KpiGrid>

      <TwoColumn>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel title="Route and contacts">
            <DataTable columns={['Stop', 'Address', 'Time', 'Navigation']} rows={[
              ['Pickup', job.pickup_location ?? 'Not set', formatDateTime(job.pickup_datetime), job.pickup_location ? <a key="pickup" href={mapsUrl(job.pickup_location, job.pickup_postcode)} target="_blank" rel="noopener noreferrer">Open map</a> : '—'],
              ['Delivery', job.delivery_location ?? 'Not set', formatDateTime(job.delivery_datetime), job.delivery_location ? <a key="delivery" href={mapsUrl(job.delivery_location, job.delivery_postcode)} target="_blank" rel="noopener noreferrer">Open map</a> : '—'],
            ]} />
          </Panel>

          {(currentStatus === 'on_site_pickup' || currentStatus === 'loaded') && (
            <Panel title="Collection evidence" description="A loading image is mandatory before confirming loaded.">
              <input ref={collectionInput} type="file" accept="image/*" capture="environment" hidden onChange={selectCollectionPhoto} />
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge value={collectionPhoto ? 'photo ready' : 'photo required'} tone={collectionPhoto ? 'green' : 'orange'} />
                <ActionButton tone="secondary" disabled={working} onClick={() => collectionInput.current?.click()}>{collectionPhoto ? 'Replace loading photo' : 'Take loading photo'}</ActionButton>
              </div>
            </Panel>
          )}

          {currentStatus === 'on_site_delivery' && (
            <>
              <Panel title="Delivery evidence" description="Photo, recipient name and signature are all required.">
                <input ref={deliveryInput} type="file" accept="image/*" capture="environment" multiple hidden onChange={selectDeliveryPhotos} />
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  <ActionButton tone="secondary" disabled={working} onClick={() => deliveryInput.current?.click()}>Add delivery photos ({deliveryPhotos.length})</ActionButton>
                  <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Recipient full name" style={inputStyle} />
                  <canvas ref={signatureRef} width={500} height={150} onMouseDown={startSignature} onMouseMove={drawSignature} onMouseUp={() => setSigning(false)} onMouseLeave={() => setSigning(false)} onTouchStart={startSignature} onTouchMove={drawSignature} onTouchEnd={() => setSigning(false)} style={{ width: '100%', height: 150, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', touchAction: 'none' }} />
                  <ActionButton tone="secondary" onClick={clearSignature}>Clear signature</ActionButton>
                </div>
              </Panel>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel title="Next required action" description="The sequence cannot skip pickup, transit, delivery or POD.">
            {next ? <ActionButton tone="success" disabled={working} onClick={() => void moveStatus(next.status)}>{working ? 'Saving…' : next.label}</ActionButton> : <EmptyState title="No further driver action" description="This job has reached its final operational state." />}
          </Panel>

          <Panel title="Driver notes">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Loading condition, waiting time, access issue or delivery note" style={{ ...inputStyle, resize: 'vertical' }} />
          </Panel>

          <Panel title="Status timeline">
            <DataTable columns={['Status', 'Time']} rows={history.map((entry: { status?: string; timestamp?: string }) => [statusLabel[String(entry.status)] ?? String(entry.status ?? 'Update'), formatDateTime(entry.timestamp)])} empty={<EmptyState title="No recorded history" />} />
          </Panel>
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8,
  padding: '0.65rem 0.75rem', background: '#fff', color: '#0f172a', fontSize: '0.85rem',
};
