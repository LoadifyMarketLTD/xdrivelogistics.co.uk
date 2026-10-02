'use client';

import { useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, Panel, StatusBadge } from './WorkspaceUI';

type DeliveryStatus =
  | 'Completed Delivery'
  | 'Partial Delivery'
  | 'Failed Delivery'
  | 'Refused'
  | 'Left Safe';

type Props = {
  jobId: string;
  podRequired: boolean;
  hardCopyPod?: string | null;
  existingDeliveryPhotos?: string[];
  existingDamagePhotos?: string[];
  existingDocuments?: string[];
  existingRecipientName?: string | null;
  existingSignature?: boolean;
  driverNotes?: string;
  onSaved: (message: string) => void | Promise<void>;
  onError: (message: string) => void;
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  color: '#475569',
  fontSize: 11,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  padding: '7px 8px',
  background: '#fff',
  color: '#0f172a',
  fontSize: 12,
};

export default function DriverPodCapturePanel({
  jobId,
  podRequired,
  hardCopyPod,
  existingDeliveryPhotos = [],
  existingDamagePhotos = [],
  existingDocuments = [],
  existingRecipientName,
  existingSignature = false,
  driverNotes = '',
  onSaved,
  onError,
}: Props) {
  const [recipientName, setRecipientName] = useState(existingRecipientName ?? '');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('Completed Delivery');
  const [leftAt, setLeftAt] = useState('');
  const [itemCount, setItemCount] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [hardCopyAcknowledged, setHardCopyAcknowledged] = useState(false);
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);
  const [documents, setDocuments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);

  const signatureRef = useRef<HTMLCanvasElement>(null);
  const deliveryInput = useRef<HTMLInputElement>(null);
  const damageInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);

  const authHeader = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  };

  const uploadEvidence = async (
    file: File,
    category: 'photos' | 'damage' | 'documents',
  ) => {
    const allowed = category === 'documents'
      ? ['application/pdf', 'image/jpeg', 'image/png']
      : ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      throw new Error(category === 'documents'
        ? 'POD documents must be PDF, JPEG or PNG files.'
        : 'POD photos must be JPEG or PNG images.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Each POD file must be 10 MB or smaller.');
    }
    const auth = await authHeader();
    if (!auth) throw new Error('Your XDrive session is not available. Please sign in again.');

    const extension = file.type === 'application/pdf'
      ? 'pdf'
      : file.type === 'image/png'
        ? 'png'
        : 'jpg';
    const objectName = `${category}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const response = await fetch(
      `/api/driver/mobile/jobs/${encodeURIComponent(jobId)}/evidence`,
      {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': file.type,
          'x-xdrive-evidence-kind': 'delivery',
          'x-xdrive-evidence-category': category,
          'x-xdrive-evidence-name': objectName,
        },
        body: file,
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      storagePath?: string;
      error?: string;
    };
    if (!response.ok || !payload.storagePath) {
      throw new Error(payload.error || 'POD evidence upload failed.');
    }
    return payload.storagePath;
  };

  const selectEvidence = async (
    event: React.ChangeEvent<HTMLInputElement>,
    category: 'photos' | 'damage' | 'documents',
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    const photoCount =
      existingDeliveryPhotos.length +
      existingDamagePhotos.length +
      deliveryPhotos.length +
      damagePhotos.length;
    const documentCount = existingDocuments.length + documents.length;
    const remaining = category === 'documents'
      ? Math.max(0, 10 - documentCount)
      : Math.max(0, 10 - photoCount);

    if (remaining === 0) {
      onError(category === 'documents'
        ? 'A maximum of 10 POD documents can be attached.'
        : 'A maximum of 10 delivery and damage photos can be attached.');
      return;
    }
    if (files.length > remaining) {
      onError(`You can add up to ${remaining} more POD file${remaining === 1 ? '' : 's'}.`);
      return;
    }
    setBusy(true);
    onError('');
    try {
      const paths: string[] = [];
      for (const file of files) {
        paths.push(await uploadEvidence(file, category));
      }
      if (category === 'photos') {
        setDeliveryPhotos((current) => [...new Set([...current, ...paths])]);
      } else if (category === 'damage') {
        setDamagePhotos((current) => [...new Set([...current, ...paths])]);
      } else {
        setDocuments((current) => [...new Set([...current, ...paths])]);
      }
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'POD evidence upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const pointer = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = signatureRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const source = 'touches' in event ? event.touches[0] : event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  };
  const startSignature = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const point = pointer(event);
    const context = signatureRef.current?.getContext('2d');
    if (!point || !context) return;
    setSigning(true);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const drawSignature = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
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
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return null;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 !== 3 && value !== 0)
      ? canvas.toDataURL('image/png')
      : null;
  };

  const submitPod = async () => {
    const signature = signatureData();
    const deliveryPhotoCount = existingDeliveryPhotos.length + deliveryPhotos.length;
    const evidenceCount =
      deliveryPhotoCount +
      existingDamagePhotos.length +
      damagePhotos.length +
      existingDocuments.length +
      documents.length;

    if (!recipientName.trim()) {
      onError('Recipient name is required for POD.');
      return;
    }
    if (podRequired && deliveryPhotoCount === 0) {
      onError('At least one delivery photo is required for POD.');
      return;
    }
    if (podRequired && !signature && !existingSignature) {
      onError('Recipient signature is required for POD.');
      return;
    }
    if (!podRequired && evidenceCount === 0 && !signature && !existingSignature) {
      onError('Add POD evidence or a recipient signature before saving.');
      return;
    }
    setBusy(true);
    onError('');
    try {
      const auth = await authHeader();
      if (!auth) throw new Error('Your XDrive session is not available. Please sign in again.');

      const podResponse = await fetch(
        `/api/driver/mobile/jobs/${encodeURIComponent(jobId)}/pod`,
        {
          method: 'POST',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: recipientName.trim(),
            signatureData: signature || undefined,
            photoUris: deliveryPhotos,
            damagePhotoUris: damagePhotos,
            documentUris: documents,
            deliveryStatus,
            leftAt: leftAt.trim() || undefined,
            itemCount: itemCount.trim() ? Number(itemCount) : undefined,
            hardCopyAcknowledged,
            notes: podNotes.trim() || driverNotes.trim() || undefined,
          }),
        },
      );
      const podPayload = await podResponse.json().catch(() => ({})) as { error?: string };
      if (!podResponse.ok) {
        throw new Error(podPayload.error || 'POD could not be saved.');
      }

      const finalisable = deliveryStatus === 'Completed Delivery' || deliveryStatus === 'Left Safe';
      if (!finalisable) {
        await onSaved(
          `POD saved as ${deliveryStatus}. Job remains at delivery stage for operational resolution.`,
        );
        return;
      }
      const deliveredResponse = await fetch(
        `/api/driver/mobile/jobs/${encodeURIComponent(jobId)}/delivered`,
        {
          method: 'POST',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverNotes: driverNotes.trim() || null }),
        },
      );
      const deliveredPayload = await deliveredResponse.json().catch(() => ({})) as {
        error?: string;
      };
      if (!deliveredResponse.ok) {
        throw new Error(
          deliveredPayload.error || 'POD was saved, but the job could not be marked delivered.',
        );
      }

      await onSaved('POD saved and job updated: Delivered.');
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'POD could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const totalDeliveryPhotos = existingDeliveryPhotos.length + deliveryPhotos.length;
  const totalDamagePhotos = existingDamagePhotos.length + damagePhotos.length;
  const totalDocuments = existingDocuments.length + documents.length;
  const submitLabel =
    deliveryStatus === 'Completed Delivery' || deliveryStatus === 'Left Safe'
      ? 'Save POD & Mark Delivered'
      : 'Save POD Exception';

  return (
    <Panel
      title="Proof of Delivery (POD)"
      description="Capture delivery outcome, recipient, signature and evidence before finalising the job."
    >
      <input
        ref={deliveryInput}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        multiple
        hidden
        onChange={(event) => void selectEvidence(event, 'photos')}
      />
      <input
        ref={damageInput}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        hidden
        onChange={(event) => void selectEvidence(event, 'damage')}
      />
      <input
        ref={documentInput}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        multiple
        hidden
        onChange={(event) => void selectEvidence(event, 'documents')}
      />

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
          <label style={fieldLabelStyle}>
            <span>Delivery outcome</span>
            <select
              value={deliveryStatus}
              onChange={(event) => setDeliveryStatus(event.target.value as DeliveryStatus)}
              style={inputStyle}
            >
              <option>Completed Delivery</option>
              <option>Partial Delivery</option>
              <option>Failed Delivery</option>
              <option>Refused</option>
              <option>Left Safe</option>
            </select>
          </label>

          <label style={fieldLabelStyle}>
            <span>Recipient full name</span>
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Name of person receiving goods"
              style={inputStyle}
            />
          </label>
          <label style={fieldLabelStyle}>
            <span>Delivered item count</span>
            <input
              type="number"
              min={0}
              max={100000}
              value={itemCount}
              onChange={(event) => setItemCount(event.target.value)}
              placeholder="Optional"
              style={inputStyle}
            />
          </label>

          <label style={fieldLabelStyle}>
            <span>Left at / safe place</span>
            <input
              value={leftAt}
              onChange={(event) => setLeftAt(event.target.value)}
              placeholder="Reception, loading bay, safe place…"
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge
            value={`${totalDeliveryPhotos} delivery photo${totalDeliveryPhotos === 1 ? '' : 's'}`}
            tone={totalDeliveryPhotos ? 'green' : 'orange'}
          />
          <StatusBadge
            value={`${totalDamagePhotos} damage photo${totalDamagePhotos === 1 ? '' : 's'}`}
            tone={totalDamagePhotos ? 'orange' : 'grey'}
          />
          <StatusBadge
            value={`${totalDocuments} POD document${totalDocuments === 1 ? '' : 's'}`}
            tone={totalDocuments ? 'blue' : 'grey'}
          />
          <StatusBadge
            value={existingSignature ? 'Signature already stored' : 'Signature required'}
            tone={existingSignature ? 'green' : 'orange'}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ActionButton
            tone="secondary"
            disabled={busy || totalDeliveryPhotos + totalDamagePhotos >= 10}
            onClick={() => deliveryInput.current?.click()}
          >
            Add delivery photos
          </ActionButton>
          <ActionButton
            tone="secondary"
            disabled={busy || totalDeliveryPhotos + totalDamagePhotos >= 10}
            onClick={() => damageInput.current?.click()}
          >
            Add damage photos
          </ActionButton>
          <ActionButton
            tone="secondary"
            disabled={busy || totalDocuments >= 10}
            onClick={() => documentInput.current?.click()}
          >
            Add POD documents
          </ActionButton>
        </div>

        <label style={fieldLabelStyle}>
          <span>Delivery / POD notes</span>
          <textarea
            value={podNotes}
            onChange={(event) => setPodNotes(event.target.value)}
            rows={3}
            placeholder="Condition, shortages, refusal reason, safe-place detail or other delivery evidence notes"
            style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'grid', gap: 5 }}>
          <strong style={{ fontSize: 12, color: '#1a1f2b' }}>Recipient signature</strong>
          <canvas
            ref={signatureRef}
            width={500}
            height={150}
            onMouseDown={startSignature}
            onMouseMove={drawSignature}
            onMouseUp={() => setSigning(false)}
            onMouseLeave={() => setSigning(false)}
            onTouchStart={startSignature}
            onTouchMove={drawSignature}
            onTouchEnd={() => setSigning(false)}
            style={{
              width: '100%',
              height: 150,
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              background: '#fff',
              touchAction: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>
              {existingSignature
                ? 'A stored signature already exists. Draw again only when a replacement is required.'
                : 'Ask the recipient to sign in the box above.'}
            </span>
            <ActionButton tone="secondary" disabled={busy} onClick={clearSignature}>
              Clear signature
            </ActionButton>
          </div>
        </div>
        {hardCopyPod && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#334155' }}>
            <input
              type="checkbox"
              checked={hardCopyAcknowledged}
              onChange={(event) => setHardCopyAcknowledged(event.target.checked)}
            />
            <span>
              I confirm the hard-copy POD requirement has been followed:{' '}
              <strong>{hardCopyPod}</strong>
            </span>
          </label>
        )}

        <div
          style={{
            padding: '7px 9px',
            border: '1px solid #d8dee8',
            borderRadius: 4,
            background: '#f8fafc',
            color: '#475569',
            fontSize: 11,
            lineHeight: '15px',
          }}
        >
          Completed Delivery and Left Safe can finalise the job. Partial Delivery,
          Failed Delivery and Refused save the POD evidence but keep the job at the
          delivery stage for operational resolution.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ActionButton tone="success" disabled={busy} onClick={() => void submitPod()}>
            {busy ? 'Saving POD…' : submitLabel}
          </ActionButton>
        </div>
      </div>
    </Panel>
  );
}
