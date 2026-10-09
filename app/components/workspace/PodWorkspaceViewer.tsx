'use client';

import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { canonicalPodStateTone, type CanonicalPodState } from '../../../lib/pod/canonicalPodEvidence';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type PodPresentation = {
  receiverName?: string;
  receiverCompany?: string;
  signatureData?: string;
  date?: string;
  time?: string;
  deliveryPhotoUris?: string[];
  damagePhotoUris?: string[];
  documentUris?: string[];
  quantityDelivered?: string;
  itemsMissing?: string;
  itemsDamaged?: string;
  receiverNotes?: string;
  driverNotes?: string;
  comments?: string;
  deliveredOn?: string;
  leftAt?: string;
  deliveryStatus?: string;
  noOfItems?: number;
  deliveryNotes?: string;
  completedBy?: string;
  completedByRole?: string;
  auditHistory?: unknown[];
  canonicalState?: CanonicalPodState;
  canonicalStateLabel?: string;
  canonicalComplete?: boolean;
  reviewStatus?: string | null;
  evidenceChecklist?: {
    generated?: boolean;
    deliveryPhoto?: boolean;
    recipientSignature?: boolean;
    recipientName?: boolean;
  };
};

const safeUrls = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

export default function PodWorkspaceViewer({
  jobId,
  title = 'Proof of Delivery',
}: {
  jobId: string;
  title?: string;
}) {
  const [pod, setPod] = useState<PodPresentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (!cancelled) {
          setError('Your session has expired. Please sign in again.');
          setLoading(false);
        }
        return;
      }

      const response = await fetch(
        `/api/workspace/jobs/${encodeURIComponent(jobId)}/pod`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        pod?: PodPresentation | null;
        error?: string;
      };

      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? 'POD could not be loaded.');
        setPod(null);
        setLoading(false);
        return;
      }

      setPod(payload.pod ?? null);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const deliveryPhotos = useMemo(
    () => safeUrls(pod?.deliveryPhotoUris),
    [pod?.deliveryPhotoUris],
  );
  const damagePhotos = useMemo(
    () => safeUrls(pod?.damagePhotoUris),
    [pod?.damagePhotoUris],
  );
  const documents = useMemo(
    () => safeUrls(pod?.documentUris),
    [pod?.documentUris],
  );

  if (error) return <AlertBanner tone="danger">{error}</AlertBanner>;

  if (loading) {
    return (
      <Panel title={title}>
        <div style={{ padding: '8px 2px', color: '#64748b', fontSize: 12 }}>
          Loading POD…
        </div>
      </Panel>
    );
  }

  if (!pod) {
    return (
      <Panel title={title}>
        <EmptyState
          compact
          title="POD not available"
          description="The assigned driver has not completed the mandatory POD yet."
        />
      </Panel>
    );
  }

  const signatureIsImage =
    typeof pod.signatureData === 'string' &&
    (pod.signatureData.startsWith('data:image/') ||
      pod.signatureData.startsWith('http://') ||
      pod.signatureData.startsWith('https://'));

  return (
    <Panel
      title={title}
      description="Canonical POD recorded on the job and shared with authorised workspace parties."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            POD status
          </div>
          <div style={{ marginTop: 4 }}>
            <StatusBadge value={pod.canonicalStateLabel ?? (pod.canonicalComplete ? 'POD complete' : 'POD incomplete')} tone={canonicalPodStateTone(pod.canonicalState ?? (pod.canonicalComplete ? 'complete' : 'incomplete'))} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Evidence contract
          </div>
          <strong style={{ display: 'block', marginTop: 4 }}>{[
            pod.evidenceChecklist?.generated ? 'Generated' : 'Generation missing',
            pod.evidenceChecklist?.deliveryPhoto ? 'Photo' : 'Photo missing',
            pod.evidenceChecklist?.recipientSignature ? 'Signature' : 'Signature missing',
            pod.evidenceChecklist?.recipientName ? 'Recipient' : 'Recipient missing',
          ].join(' · ')}</strong>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Received by
          </div>
          <strong style={{ display: 'block', marginTop: 4 }}>{pod.receiverName || 'Recipient'}</strong>
          {pod.receiverCompany ? (
            <span style={{ display: 'block', color: '#64748b', fontSize: 11 }}>{pod.receiverCompany}</span>
          ) : null}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Completed
          </div>
          <strong style={{ display: 'block', marginTop: 4 }}>
            {[pod.date, pod.time].filter(Boolean).join(' · ') || 'Not available'}
          </strong>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Delivery status
          </div>
          <strong style={{ display: 'block', marginTop: 4 }}>{pod.deliveryStatus || 'Completed Delivery'}</strong>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Items
          </div>
          <strong style={{ display: 'block', marginTop: 4 }}>
            {pod.noOfItems ?? pod.quantityDelivered ?? 'Not recorded'}
          </strong>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Evidence
          </div>
          <strong style={{ display: 'block', marginTop: 4 }}>
            {deliveryPhotos.length} delivery · {damagePhotos.length} damage · {documents.length} document
          </strong>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, .8fr) minmax(0, 1.2fr)',
          gap: 10,
          alignItems: 'start',
        }}
      >
        <div style={{ border: '1px solid #d8dee8', background: '#fff', padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
            Recipient signature
          </div>
          {signatureIsImage ? (
            <img
              src={pod.signatureData}
              alt="Recipient signature"
              style={{
                display: 'block',
                width: '100%',
                maxHeight: 180,
                objectFit: 'contain',
                border: '1px solid #e2e8f0',
                background: '#fff',
              }}
            />
          ) : (
            <div style={{ color: '#64748b', fontSize: 12 }}>
              {pod.signatureData ? 'Signature recorded.' : 'Signature unavailable.'}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {deliveryPhotos.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 5 }}>Delivery photos</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {deliveryPhotos.map((url, index) => (
                  <ActionButton key={url} tone="secondary" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                    Open photo {index + 1}
                  </ActionButton>
                ))}
              </div>
            </div>
          ) : null}

          {damagePhotos.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 5 }}>Damage evidence</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {damagePhotos.map((url, index) => (
                  <ActionButton key={url} tone="secondary" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                    Open damage {index + 1}
                  </ActionButton>
                ))}
              </div>
            </div>
          ) : null}

          {documents.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 5 }}>POD documents</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {documents.map((url, index) => (
                  <ActionButton key={url} tone="secondary" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                    Open document {index + 1}
                  </ActionButton>
                ))}
              </div>
            </div>
          ) : null}

          {(pod.deliveryNotes || pod.receiverNotes || pod.driverNotes || pod.comments || pod.leftAt) ? (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, fontSize: 12, lineHeight: 1.45 }}>
              {pod.leftAt ? <div><strong>Left at:</strong> {pod.leftAt}</div> : null}
              {pod.deliveryNotes ? <div><strong>Delivery notes:</strong> {pod.deliveryNotes}</div> : null}
              {pod.receiverNotes ? <div><strong>Receiver notes:</strong> {pod.receiverNotes}</div> : null}
              {pod.driverNotes ? <div><strong>Driver notes:</strong> {pod.driverNotes}</div> : null}
              {pod.comments ? <div><strong>Comments:</strong> {pod.comments}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
