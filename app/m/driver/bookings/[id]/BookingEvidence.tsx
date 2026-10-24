'use client';
import { useRef, useState } from 'react';
import { readRouteAuthAccessToken } from '../../../../../lib/routeAuthCookie';

type EvidenceKind = 'collection' | 'delivery';
type EvidenceCategory = 'photos' | 'damage' | 'documents';

async function callJob(jobId: string, path: string, payload: unknown) {
  const token = readRouteAuthAccessToken();
  if (!token) throw new Error('Your session expired. Please sign in.');
  const response = await fetch(`/api/driver/web/jobs/${encodeURIComponent(jobId)}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The operation could not be completed.');
  return result;
}

async function uploadEvidence(jobId: string, file: File, kind: EvidenceKind, category: EvidenceCategory, stopId?: string) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Select a JPEG or PNG photo.');
  if (file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error('Photos must be 10 MB or smaller.');
  const token = readRouteAuthAccessToken();
  if (!token) throw new Error('Your session expired. Please sign in.');
  const name = `${kind}-${Date.now()}-${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
  const response = await fetch(`/api/driver/web/jobs/${encodeURIComponent(jobId)}/evidence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type,
      'x-xdrive-evidence-kind': kind,
      'x-xdrive-evidence-category': category,
      'x-xdrive-evidence-name': name,
      'x-xdrive-stop-id': stopId || '' },
    body: file,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.storagePath !== 'string') {
    throw new Error(result.error || 'The photo could not be uploaded.');
  }
  return result.storagePath as string;
}

type PhotoUploaderProps = {
  jobId: string;
  stopId?: string;
  kind: EvidenceKind;
  category?: EvidenceCategory;
  paths: string[];
  setPaths: (paths: string[]) => void;
  disabled: boolean;
};
export function PhotoUploader({ jobId, stopId, kind, category = 'photos', paths, setPaths, disabled }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const upload = async (files: FileList | null) => {
    if (!files?.length || disabled || uploading) return;
    setUploading(true); setError('');
    const next = [...paths];
    try {
      for (const file of Array.from(files)) {
        if (next.length >= 10) throw new Error('Maximum 10 photos per job.');
        const path = await uploadEvidence(jobId, file, kind, category, stopId);
        next.push(path);
        setPaths([...next]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload failed.');
    } finally { setUploading(false); }
  };
  return <div className="xd-mobile-upload">
    <label>Photo evidence (JPEG/PNG; max 10 MB each)
      <input type="file" accept="image/jpeg,image/png" multiple disabled={disabled || uploading || paths.length >= 10}
        onChange={event => { void upload(event.target.files); event.target.value = ''; }}/>
    </label>
    <p role="status">{uploading ? 'Uploading photo...' : `${paths.length} photo(s) uploaded`}</p>
    {error ? <p role="alert" className="xd-mobile-error">{error}</p> : null}
  </div>;
}

export function CollectionHandover({ jobId, existingPaths, onSaved }: {
  jobId: string; existingPaths: string[]; onSaved: () => Promise<void>;
}) {
  const [photos, setPhotos] = useState(existingPaths);
  const [count, setCount] = useState('');
  const [packaging, setPackaging] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!photos.length) { setError('Upload at least one collection photo before saving handover.'); return; }
    setBusy(true); setError('');
    try {
      await callJob(jobId, 'handover', {
        photoPaths: photos,
        documentPaths: [],
        itemCount: count || null,
        packaging,
        weightKg: weight || null,
        notes,
      });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Handover failed.');
    } finally { setBusy(false); }
  };
  return <form className="xd-mobile-card" onSubmit={event => void save(event)}>
    <h3>Collection handover</h3>
    <p>Record the collection condition before confirming Loaded.</p>
    <PhotoUploader jobId={jobId} kind="collection" paths={photos} setPaths={setPhotos} disabled={busy}/>
    <label>Items collected (optional)<input type="number" min="0" max="100000" step="1" value={count} onChange={event => setCount(event.target.value)}/></label>
    <label>Packaging (optional)<input maxLength={120} value={packaging} onChange={event => setPackaging(event.target.value)}/></label>
    <label>Weight (kg, optional)<input type="number" min="0" max="100000" step="0.1" value={weight} onChange={event => setWeight(event.target.value)}/></label>
    <label>Collection notes<textarea maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)}/></label>
    {error ? <p role="alert" className="xd-mobile-error">{error}</p> : null}
    <button type="submit" disabled={busy || !photos.length}>{busy ? 'Saving...' : 'Save collection handover'}</button>
  </form>;
}

export function StopCollectionHandover({ jobId, stopId, onSaved }: {
  jobId: string;
  stopId: string;
  onSaved: () => Promise<void>;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [count, setCount] = useState('');
  const [packaging, setPackaging] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!photos.length) { setError('Upload a collection photo for this stop.'); return; }
    setBusy(true); setError('');
    try {
      await callJob(jobId, 'stop-status', {
        stop_id: stopId,
        status: 'completed',
        handover: {
          photoPaths: photos,
          documentPaths: [],
          itemCount: count ? Number(count) : null,
          packaging,
          weightKg: weight ? Number(weight) : null,
          notes,
        },
      });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Stop handover could not be saved.');
    } finally { setBusy(false); }
  };

  return <form className="xd-mobile-card" onSubmit={event => void save(event)}>
    <h3>Complete collection stop</h3>
    <p>Collection stops require photo evidence and handover before completion.</p>
    <PhotoUploader jobId={jobId} stopId={stopId} kind="collection"
      paths={photos} setPaths={setPhotos} disabled={busy}/>
    <label>Items collected (optional)<input type="number" min="0" max="100000"
      step="1" value={count} onChange={event => setCount(event.target.value)}/></label>
    <label>Packaging (optional)<input maxLength={120} value={packaging}
      onChange={event => setPackaging(event.target.value)}/></label>
    <label>Weight kg (optional)<input type="number" min="0" max="100000"
      step="0.1" value={weight} onChange={event => setWeight(event.target.value)}/></label>
    <label>Handover notes<textarea maxLength={2000} value={notes}
      onChange={event => setNotes(event.target.value)}/></label>
    {error ? <p role="alert" className="xd-mobile-error">{error}</p> : null}
    <button type="submit" disabled={busy || !photos.length}>
      {busy ? 'Saving stop handover...' : 'Complete collection stop'}
    </button>
  </form>;
}

export function CollectionPass({ jobId }: { jobId: string }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const generate = async () => {
    setPending(true); setError('');
    try {
      const result = await callJob(jobId, 'collection-pass', { action: 'activate' });
      setCode(result.code || '');
      setStatus(result.status || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Collection pass unavailable.');
    } finally { setPending(false); }
  };
  return <div className="xd-mobile-card">
    <h3>Collection Pass</h3>
    <p>Where required, the posting company must verify your code before Loaded.</p>
    {status ? <p>Status: {status}</p> : null}
    {code ? <p><strong>Show code to collection staff: {code}</strong></p> : null}
    <button type="button" disabled={pending} onClick={() => void generate()}>{pending ? 'Generating...' : code ? 'Generate a new pass' : 'Activate pass'}</button>
    {error ? <p role="alert" className="xd-mobile-error">{error}</p> : null}
  </div>;
}

function SignaturePad({ canvas, onSigned }: { canvas: React.RefObject<HTMLCanvasElement | null>; onSigned: () => void }) {
  const active = useRef(false);
  const draw = (event: React.PointerEvent<HTMLCanvasElement>, start: boolean) => {
    const surface = canvas.current;
    if (!surface) return;
    const context = surface.getContext('2d');
    if (!context) return;
    const bounds = surface.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * (surface.width / bounds.width);
    const y = (event.clientY - bounds.top) * (surface.height / bounds.height);
    context.strokeStyle = '#15283f';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (start) { context.beginPath(); context.moveTo(x, y); context.lineTo(x + 0.1, y + 0.1); context.stroke(); }
    else { context.lineTo(x, y); context.stroke(); }
  };
  return <div>
    <p>Recipient signature (sign inside the box)</p>
    <canvas ref={canvas} width={640} height={220}
      className="xd-mobile-signature" aria-label="Signature pad"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); active.current = true; draw(event, true); onSigned(); }}
      onPointerMove={event => { if (active.current) draw(event, false); }}
      onPointerUp={() => { active.current = false; }}
      onPointerCancel={() => { active.current = false; }}/>
  </div>;
}

export function PodCapture({ jobId, existingPhotos, hardCopyPod, onSaved }: {
  jobId: string; existingPhotos: string[]; hardCopyPod: string; onSaved: () => Promise<void>;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [recipient, setRecipient] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('Completed Delivery');
  const [notes, setNotes] = useState('');
  const [hardCopy, setHardCopy] = useState(false);
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signature = useRef<HTMLCanvasElement | null>(null);
  const needsHardCopy = Boolean(hardCopyPod && !['no', 'none', 'not required', 'not supplied', 'false', '0', 'n/a']
    .includes(hardCopyPod.trim().toLowerCase()));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!photos.length && !existingPhotos.length) { setError('Upload at least one delivery photo.'); return; }
    if (!signed) { setError('The recipient must sign the pad.'); return; }
    if (needsHardCopy && !hardCopy) { setError('Acknowledge the required paper POD.'); return; }
    const drawn = signature.current?.toDataURL('image/png');
    if (!drawn) { setError('Signature could not be captured.'); return; }
    setBusy(true); setError('');
    try {
      await callJob(jobId, 'pod', {
        recipientName: recipient.trim(),
        deliveryStatus,
        photoUris: photos,
        signatureData: drawn,
        notes,
        hardCopyAcknowledged: hardCopy,
      });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'POD could not be saved.');
    } finally { setBusy(false); }
  };
  return <form className="xd-mobile-card" onSubmit={event => void save(event)}>
    <h3>Proof of delivery (POD)</h3>
    <p>Confirm the delivery recipient, outcome and signature. Attach photographic evidence before sending the POD.</p>
    <PhotoUploader jobId={jobId} kind="delivery" paths={photos} setPaths={setPhotos} disabled={busy}/>
    {existingPhotos.length ? <p>{existingPhotos.length} previously uploaded delivery photo(s) found.</p> : null}
    <label>Received by (full name) *<input required maxLength={200} autoComplete="name"
      value={recipient} onChange={event => setRecipient(event.target.value)}/></label>
    <label>Delivery outcome<select value={deliveryStatus} onChange={event => setDeliveryStatus(event.target.value)}>
      {['Completed Delivery', 'Partial Delivery', 'Failed Delivery', 'Refused', 'Left Safe']
        .map(value => <option key={value}>{value}</option>)}
    </select></label>
    <div className="xd-mobile-signature-wrap">
      <SignaturePad canvas={signature} onSigned={() => setSigned(true)}/>
      <button type="button" className="xd-mobile-button--secondary" onClick={() => {
        signature.current?.getContext('2d')?.clearRect(0, 0, 640, 220);
        setSigned(false);
      }}>Edit / clear signature</button>
    </div>
    {needsHardCopy ? <label className="xd-mobile-check"><input type="checkbox" checked={hardCopy}
      onChange={event => setHardCopy(event.target.checked)}/> I confirm the hard-copy POD requirement.</label> : null}
    <label>Delivery notes<textarea maxLength={5000} value={notes} onChange={event => setNotes(event.target.value)}/></label>
    {error ? <p role="alert" className="xd-mobile-error">{error}</p> : null}
    <button type="submit" disabled={busy || !recipient.trim()}>{busy ? 'Sending POD...' : 'Send POD'}</button>
  </form>;
}
