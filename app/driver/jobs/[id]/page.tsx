'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getJobClientFields } from '../../../../lib/jobClientFields';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import type { DbJob } from '../../../../lib/types/database';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../components/AuthContext';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Received',
  posted: 'Posted',
  allocated: 'Allocated',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
  // milestone events (stored in status_history only)
  driver_en_route: 'En Route to Pickup',
  arrived_pickup: 'Arrived at Pickup',
  arrived_delivery: 'Arrived at Delivery',
};

function buildMapsUrl(app: 'google' | 'waze' | 'apple', address: string, postcode?: string | null): string {
  const q = encodeURIComponent(postcode ? `${address}, ${postcode}` : address);
  if (app === 'google') return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  if (app === 'waze')   return `https://waze.com/ul?q=${q}&navigate=yes`;
  return `maps://maps.apple.com/?daddr=${q}`;
}

export default function DriverJobDetailPage() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? '';

  const [job, setJob] = useState<DbJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Driver notes
  const [driverNotes, setDriverNotes] = useState('');

  // Collection photo
  const [collectionPhotoPreview, setCollectionPhotoPreview] = useState<string | null>(null);
  const collectionInputRef = useRef<HTMLInputElement>(null);

  // Delivery photos (multiple)
  const [deliveryPhotoPreviews, setDeliveryPhotoPreviews] = useState<string[]>([]);
  const deliveryInputRef = useRef<HTMLInputElement>(null);

  // Signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sigClientName, setSigClientName] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  const [driverId, setDriverId] = useState('');
  // Track which milestone events have been recorded for this job session
  const [milestones, setMilestones] = useState<Set<string>>(new Set());

  const loadJob = useCallback(async () => {
    if (!jobId || !driverId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data, error: dbError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('assigned_driver_id', driverId)
      .maybeSingle();

    if (dbError || !data) {
      setError('Job not found.');
    } else {
      setJob(data as DbJob);
      setDriverNotes(data.driver_notes ?? '');
      setCollectionPhotoPreview(data.collection_photo_url ?? null);
      setDeliveryPhotoPreviews(data.delivery_photos ?? []);
      setSigClientName(data.client_signature_name ?? '');
      // Restore milestones already recorded in status_history
      const history = Array.isArray(data.status_history) ? data.status_history : [];
      setMilestones(new Set(history.map((e: { status: string }) => e.status)));
    }
    setLoading(false);
  }, [jobId, driverId]);

  useEffect(() => {
    if (!user?.driverId) return;
    setDriverId(user.driverId);
  }, [user?.driverId]);

  useEffect(() => {
    if (!driverId) return;
    loadJob();
  }, [driverId, loadJob]);

  // ── Canvas signature helpers ─────────────────────────────────
  const startSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSigning(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const drawSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0A2239';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const endSig = () => setIsSigning(false);

  const clearSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getSignatureDataUrl = () => canvasRef.current?.toDataURL('image/png') ?? null;

  // ── Photo helpers ────────────────────────────────────────────
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleRemoveCollectionPhoto = () => {
    setCollectionPhotoPreview(null);
    if (collectionInputRef.current) collectionInputRef.current.value = '';
  };

  const handleCollectionPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setCollectionPhotoPreview(dataUrl);
  };

  const handleDeliveryPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
    setDeliveryPhotoPreviews(prev => [...prev, ...dataUrls]);
  };

  // ── Status transition helpers ────────────────────────────────
  const appendStatusHistory = (
    current: DbJob['status_history'],
    newStatus: string
  ) => {
    const history = Array.isArray(current) ? current : [];
    return [...history, { status: newStatus, timestamp: new Date().toISOString() }];
  };

  const updateJobStatus = async (newStatus: string, extraFields: Record<string, unknown> = {}) => {
    if (!job || !driverId || !isSupabaseConfigured) return;
    setActionLoading(true);
    setError('');

    const newHistory = appendStatusHistory(job.status_history, newStatus);
    const { error: dbError } = await supabase
      .from('jobs')
      .update({
        status: newStatus,
        status_history: newHistory,
        driver_notes: driverNotes || null,
        ...extraFields,
      })
      .eq('id', job.id)
      .eq('assigned_driver_id', driverId);

    if (dbError) {
      setError(dbError.message);
    } else {
      setSuccessMsg(`Job marked as ${STATUS_LABEL[newStatus] ?? newStatus}`);
      await loadJob();
      setTimeout(() => setSuccessMsg(''), 3000);
    }
    setActionLoading(false);
  };

  // Record a milestone event in status_history WITHOUT changing jobs.status
  const recordMilestone = async (event: string) => {
    if (!job || !driverId || !isSupabaseConfigured || milestones.has(event)) return;
    setActionLoading(true);
    setError('');
    const newHistory = appendStatusHistory(job.status_history, event);
    const { error: dbError } = await supabase
      .from('jobs')
      .update({ status_history: newHistory })
      .eq('id', job.id)
      .eq('assigned_driver_id', driverId);
    if (dbError) {
      setError(dbError.message);
    } else {
      setMilestones(prev => new Set<string>([...prev, event]));
      setSuccessMsg(`✅ ${STATUS_LABEL[event] ?? event} recorded`);
      await loadJob();
      setTimeout(() => setSuccessMsg(''), 3000);
    }
    setActionLoading(false);
  };

  const handleCollect = () =>
    updateJobStatus('in_transit', {
      collection_photo_url: collectionPhotoPreview ?? null,
    });

  const handleDeliver = () => {
    const sigData = getSignatureDataUrl();
    updateJobStatus('delivered', {
      delivery_photos: deliveryPhotoPreviews.length ? deliveryPhotoPreviews : null,
      delivery_signature_data: sigData,
      client_signature_name: sigClientName || null,
    });
  };

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
        Loading job…
      </div>
    );
  }

  if (!job) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        {error || 'Job not found.'}
      </div>
    );
  }

  const canCollect = job.status === 'allocated';
  const canDeliver = job.status === 'in_transit';
  const clientFields = getJobClientFields(job);
  const hasEnRoute = milestones.has('driver_en_route');
  const hasArrivedPickup = milestones.has('arrived_pickup');
  const hasArrivedDelivery = milestones.has('arrived_delivery');

  return (
    <ProtectedRoute allowedRoles={['driver']}>
    <div style={{ minHeight: '100dvh', backgroundColor: '#f3f4f6', paddingBottom: '5rem' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: '#0A2239',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.push('/driver/jobs')}
          style={{ background: 'none', border: 'none', color: '#93c5fd', fontSize: '1.4rem', cursor: 'pointer', padding: 0 }}
        >
          ←
        </button>
        <div>
          <p style={{ color: '#93c5fd', fontSize: '0.7rem', margin: 0 }}>Job Detail</p>
          <h1 style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '700', margin: 0 }}>
            #{job.id.slice(0, 8).toUpperCase()}
          </h1>
        </div>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            fontWeight: '700',
            color: '#ffffff',
            backgroundColor: '#1e4d7b',
            padding: '0.25rem 0.65rem',
            borderRadius: '20px',
          }}
        >
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
      </header>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Alerts */}
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem', color: '#dc2626', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '0.75rem', color: '#15803d', fontSize: '0.875rem' }}>
            {successMsg}
          </div>
        )}

        {/* Route card */}
        <Section title="Route">
          <InfoRow icon="📦" label="Collection" value={job.pickup_location ?? 'TBC'} />
          {job.pickup_datetime && (
            <InfoRow icon="🕐" label="Pickup time" value={new Date(job.pickup_datetime).toLocaleString('en-GB')} />
          )}
          {/* Navigate to pickup */}
          {job.pickup_location && (
            <NavButtons address={job.pickup_location} postcode={job.pickup_postcode} label="Pickup" />
          )}
          <div style={{ borderTop: '1px dashed #e5e7eb', margin: '0.5rem 0' }} />
          <InfoRow icon="📍" label="Delivery" value={job.delivery_location ?? 'TBC'} />
          {job.delivery_datetime && (
            <InfoRow icon="🕐" label="Delivery time" value={new Date(job.delivery_datetime).toLocaleString('en-GB')} />
          )}
          {/* Navigate to delivery */}
          {job.delivery_location && (
            <NavButtons address={job.delivery_location} postcode={job.delivery_postcode} label="Delivery" />
          )}
          {/* Distance / duration */}
          {(job.job_distance_miles != null || job.job_distance_minutes != null) && (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.82rem', color: '#6b7280' }}>
              {job.job_distance_miles != null && <span>📏 {job.job_distance_miles.toFixed(1)} mi</span>}
              {job.job_distance_minutes != null && <span>⏱ {Math.round(job.job_distance_minutes)} min</span>}
            </div>
          )}
        </Section>

        {/* Milestone buttons for allocated job */}
        {canCollect && (
          <Section title="Journey Milestones">
            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 0.75rem' }}>
              Tap each milestone as you progress. These are visible to your dispatcher.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <MilestoneButton
                label="🚗 En Route to Pickup"
                done={hasEnRoute}
                disabled={actionLoading}
                onTap={() => recordMilestone('driver_en_route')}
              />
              <MilestoneButton
                label="📍 Arrived at Pickup"
                done={hasArrivedPickup}
                disabled={actionLoading || !hasEnRoute}
                onTap={() => recordMilestone('arrived_pickup')}
              />
            </div>
          </Section>
        )}

        {/* Milestone button for in_transit job */}
        {canDeliver && (
          <Section title="Journey Milestones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <MilestoneButton
                label="📍 Arrived at Delivery"
                done={hasArrivedDelivery}
                disabled={actionLoading}
                onTap={() => recordMilestone('arrived_delivery')}
              />
            </div>
          </Section>
        )}

        {/* Cargo */}
        <Section title="Cargo">
          <InfoRow icon="👤" label="Client" value={clientFields.name} />
          {clientFields.phone && <InfoRow icon="📞" label="Client phone" value={clientFields.phone} />}
          {clientFields.email && <InfoRow icon="✉️" label="Client email" value={clientFields.email} />}
          {job.cargo_type && <InfoRow icon="📋" label="Type" value={job.cargo_type} />}
          {job.load_details && <InfoRow icon="📝" label="Client / load reference" value={job.load_details} />}
          {clientFields.cargoNotes && (
            <InfoRow icon="⚠️" label="Special requirements" value={clientFields.cargoNotes} />
          )}
          {job.weight_kg != null && <InfoRow icon="⚖️" label="Weight" value={`${job.weight_kg} kg`} />}
        </Section>

        {/* Collection photo – shown when job is allocated */}
        {canCollect && (
          <Section title="Collection Photo">
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.75rem' }}>
              Take a photo at collection before confirming pick-up.
            </p>
            <input
              ref={collectionInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleCollectionPhoto}
            />
            {collectionPhotoPreview ? (
              <div>
                <img
                  src={collectionPhotoPreview}
                  alt="Collection"
                  style={{ width: '100%', borderRadius: '8px', marginBottom: '0.5rem' }}
                />
                <button
                  onClick={handleRemoveCollectionPhoto}
                  style={ghostBtn}
                >
                  Remove photo
                </button>
              </div>
            ) : (
              <button onClick={() => collectionInputRef.current?.click()} style={photoBtn}>
                📷 Take / Upload Photo
              </button>
            )}
          </Section>
        )}

        {/* Delivery photos + signature – shown when job is in_transit */}
        {canDeliver && (
          <>
            <Section title="Delivery Photos">
              <input
                ref={deliveryInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={{ display: 'none' }}
                onChange={handleDeliveryPhotos}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {deliveryPhotoPreviews.map((src, i) => (
                  <img key={i} src={src} alt={`Delivery ${i + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} />
                ))}
              </div>
              <button onClick={() => deliveryInputRef.current?.click()} style={photoBtn}>
                📷 Add Photo
              </button>
            </Section>

            <Section title="Client Signature">
              <input
                type="text"
                placeholder="Recipient name"
                value={sigClientName}
                onChange={e => setSigClientName(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '0.75rem', boxSizing: 'border-box' }}
              />
              <canvas
                ref={canvasRef}
                width={320}
                height={130}
                onMouseDown={startSig}
                onMouseMove={drawSig}
                onMouseUp={endSig}
                onMouseLeave={endSig}
                onTouchStart={startSig}
                onTouchMove={drawSig}
                onTouchEnd={endSig}
                style={{
                  width: '100%',
                  height: '130px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#fafafa',
                  touchAction: 'none',
                  cursor: 'crosshair',
                  display: 'block',
                }}
              />
              <button onClick={clearSig} style={{ ...ghostBtn, marginTop: '0.5rem' }}>
                Clear signature
              </button>
            </Section>
          </>
        )}

        {/* Driver notes */}
        <Section title="Driver Notes">
          <textarea
            value={driverNotes}
            onChange={e => setDriverNotes(e.target.value)}
            placeholder="Add notes about this job…"
            rows={3}
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.9rem',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </Section>

        {/* Status history */}
        {Array.isArray(job.status_history) && job.status_history.length > 0 && (
          <Section title="Status History">
            <ol style={{ margin: 0, padding: '0 0 0 1.25rem', fontSize: '0.85rem', color: '#374151' }}>
              {job.status_history.map((entry, i) => (
                <li key={i} style={{ marginBottom: '0.3rem' }}>
                  <strong>{STATUS_LABEL[entry.status] ?? entry.status}</strong>{' '}
                  <span style={{ color: '#6b7280' }}>
                    — {new Date(entry.timestamp).toLocaleString('en-GB')}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </div>

      {/* Action bar */}
      {(canCollect || canDeliver) && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '480px',
            padding: '1rem',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e5e7eb',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {canCollect && (
            <button
              onClick={handleCollect}
              disabled={actionLoading}
              style={actionBtn('#1d4ed8')}
            >
              {actionLoading ? 'Updating…' : '🚚 Confirm Collection'}
            </button>
          )}
          {canDeliver && (
            <button
              onClick={handleDeliver}
              disabled={actionLoading}
              style={actionBtn('#15803d')}
            >
              {actionLoading ? 'Updating…' : '✅ Confirm Delivery'}
            </button>
          )}
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}

// ── Small helpers ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '0.6rem 1rem', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '0.85rem 1rem' }}>{children}</div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
      <span>{icon}</span>
      <span style={{ color: '#6b7280', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#1f2937', fontWeight: '500' }}>{value}</span>
    </div>
  );
}

function NavButtons({ address, postcode, label }: { address: string; postcode?: string | null; label: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
      <a
        href={buildMapsUrl('google', address, postcode)}
        target="_blank"
        rel="noopener noreferrer"
        style={navLinkStyle('#4285F4')}
      >
        🗺 Google Maps
      </a>
      <a
        href={buildMapsUrl('waze', address, postcode)}
        target="_blank"
        rel="noopener noreferrer"
        style={navLinkStyle('#33ccff')}
      >
        🚦 Waze
      </a>
      <a
        href={buildMapsUrl('apple', address, postcode)}
        target="_blank"
        rel="noopener noreferrer"
        style={navLinkStyle('#555')}
      >
        🍎 Apple Maps
      </a>
      <span style={{ fontSize: '0.7rem', color: '#9ca3af', alignSelf: 'center' }}>Navigate to {label}</span>
    </div>
  );
}

function MilestoneButton({ label, done, disabled, onTap }: {
  label: string;
  done: boolean;
  disabled: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      disabled={done || disabled}
      style={{
        width: '100%',
        padding: '0.7rem 1rem',
        borderRadius: '10px',
        border: done ? '1px solid #86efac' : '1px solid #d1d5db',
        backgroundColor: done ? '#f0fdf4' : disabled ? '#f3f4f6' : '#eff6ff',
        color: done ? '#15803d' : disabled ? '#9ca3af' : '#1d4ed8',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: done || disabled ? 'default' : 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      {done ? '✅' : '⬜'} {label}
      {done && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#6b7280' }}>Recorded</span>}
    </button>
  );
}

const navLinkStyle = (color: string): React.CSSProperties => ({
  padding: '0.3rem 0.6rem',
  borderRadius: '6px',
  border: `1px solid ${color}22`,
  backgroundColor: `${color}11`,
  color,
  fontSize: '0.78rem',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
});

const photoBtn: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  backgroundColor: '#eff6ff',
  color: '#1d4ed8',
  border: '1px dashed #93c5fd',
  borderRadius: '8px',
  fontSize: '0.9rem',
  fontWeight: '600',
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6b7280',
  fontSize: '0.8rem',
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};

const actionBtn = (bg: string): React.CSSProperties => ({
  width: '100%',
  padding: '1rem',
  backgroundColor: bg,
  color: '#ffffff',
  border: 'none',
  borderRadius: '12px',
  fontSize: '1rem',
  fontWeight: '700',
  cursor: 'pointer',
});
