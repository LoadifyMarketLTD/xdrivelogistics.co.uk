import { useRef, useState } from 'react';
import DeliverySignature from './DeliverySignature';
import { driverPost, renewSession, type LiveSession, type LiveStop } from './liveApi';

type Props = {
  jobId: string;
  stop: LiveStop;
  session: LiveSession;
  onSession: (session: LiveSession) => void;
  yourRef: string;
  customerRef?: string;
  vehicle: string;
  jobItems?: number;
  jobWeight?: number;
  packaging?: string;
  onRefresh: (token: string) => Promise<void>;
  onClose: () => void;
};

const apiBase = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
const pad = (value: number) => String(value).padStart(2, '0');
const localDateTime = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const extensionFor = (file: File) => file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';

export default function StopExecution({
  jobId, stop, session, onSession, yourRef, customerRef, vehicle, jobItems, jobWeight, packaging, onRefresh, onClose,
}: Props) {
  const handover = stop.handover;
  const [customerReference, setCustomerReference] = useState(handover?.customerReference || customerRef || '');
  const [itemCount, setItemCount] = useState(String(handover?.itemCount ?? jobItems ?? ''));
  const [weightKg, setWeightKg] = useState(String(handover?.weightKg ?? jobWeight ?? ''));
  const [etaAt, setEtaAt] = useState(localDateTime(handover?.etaAt || stop.timeWindowFrom));
  const [notes, setNotes] = useState(handover?.notes || '');
  const [recipientName, setRecipientName] = useState(handover?.recipientName || '');
  const [leftAt, setLeftAt] = useState(handover?.leftAt || 'Goods Inwards');
  const [deliveredOn, setDeliveredOn] = useState(localDateTime(handover?.deliveredOn || stop.completedAt));
  const [deliveryStatus, setDeliveryStatus] = useState(handover?.deliveryStatus || 'Completed Delivery');
  const [signature, setSignature] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const addPodInput = useRef<HTMLInputElement>(null);
  const addMoreInput = useRef<HTMLInputElement>(null);

  const appendFiles = (selected: File[]) => {
    const accepted = selected.filter(file =>
      ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) && file.size > 0 && file.size <= 10 * 1024 * 1024,
    );
    if (accepted.length !== selected.length) setError('Use JPG, PNG or PDF files up to 10 MB each.');
    else setError('');
    setFiles(current => [...current, ...accepted].slice(0, 20));
  };

  const upload = async (current: LiveSession, file: File, category: 'photos' | 'documents' | 'signature') => {
    const name = `stop-${stop.id}-${crypto.randomUUID()}.${extensionFor(file)}`;
    const response = await fetch(`${apiBase}/mobile/jobs/${encodeURIComponent(jobId)}/evidence`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + current.token,
        'Content-Type': file.type,
        'x-xdrive-evidence-kind': stop.type,
        'x-xdrive-evidence-category': category,
        'x-xdrive-stop-id': stop.id,
        'x-xdrive-evidence-name': name,
      },
      body: file,
    });
    const payload = await response.json().catch(() => ({})) as { storagePath?: string; error?: string };
    if (!response.ok || !payload.storagePath) throw new Error(payload.error || 'Stop evidence upload failed.');
    return payload.storagePath;
  };

  const arrive = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`, current.token, { stop_id: stop.id, status: 'arrived' });
      await onRefresh(current.token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Stop arrival could not be saved.');
    } finally { setBusy(false); }
  };

  const complete = async () => {
    if (busy) return;
    const items = Number(itemCount);
    const weight = weightKg.trim() === '' ? null : Number(weightKg);
    if (!Number.isInteger(items) || items < 0 || items > 100000) { setError('Enter a valid number of items.'); return; }
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100000)) { setError('Enter a valid weight.'); return; }
    if (stop.type === 'delivery' && !files.some(file => file.type === 'image/jpeg' || file.type === 'image/png')) {
      setError('Attach at least one delivery photo for this stop.');
      return;
    }
    if (stop.type === 'delivery' && deliveryStatus !== 'Completed Delivery') {
      setError('Record and resolve this delivery exception before completing the stop.');
      return;
    }
    if (stop.type === 'delivery' && items < 1) {
      setError('Enter at least one delivered item.');
      return;
    }
    if (stop.type === 'delivery' && (!recipientName.trim() || !leftAt.trim() || !deliveredOn || !signature)) {
      setError('Received By, signature, Left At and Delivered On are required for a delivery stop.');
      return;
    }
    setBusy(true); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      const photoPaths: string[] = [];
      const documentPaths: string[] = [];
      for (const file of files) {
        const category = file.type === 'application/pdf' ? 'documents' : 'photos';
        const path = await upload(current, file, category);
        (category === 'documents' ? documentPaths : photoPaths).push(path);
      }
      const signaturePath = stop.type === 'delivery' && signature ? await upload(current, signature, 'signature') : null;
      const payload = await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`, current.token, {
        stop_id: stop.id,
        status: 'completed',
        handover: {
          customerReference: customerReference.trim() || null,
          itemCount: items,
          weightKg: weight,
          etaAt: etaAt ? new Date(etaAt).toISOString() : null,
          packaging: packaging || null,
          notes: notes.trim() || null,
          photoPaths,
          documentPaths,
          recipientName: stop.type === 'delivery' ? recipientName.trim() : null,
          leftAt: stop.type === 'delivery' ? leftAt.trim() : null,
          deliveredOn: stop.type === 'delivery' ? new Date(deliveredOn).toISOString() : null,
          deliveryStatus: stop.type === 'delivery' ? deliveryStatus : null,
          signaturePath,
        },
      });
      await onRefresh(current.token);
      void payload;
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Stop could not be completed.');
    } finally { setBusy(false); }
  };

  const title = `${stop.type === 'collection' ? 'Collection' : 'Delivery'} Stop ${stop.sequence}`;
  return <section className="stop-execution" aria-label={title}>
    <header className="stop-execution__header">
      <div><strong>{title}</strong><span>{stop.address}</span></div>
      <button type="button" onClick={onClose}>Back</button>
    </header>
    <div className="stop-execution__route">
      <strong>{stop.address}</strong>
      <span>{stop.timeWindowFrom ? new Date(stop.timeWindowFrom).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'ASAP'}</span>
      {stop.company && <span>{stop.company}</span>}
      {stop.contactPerson && <span>Contact: {stop.contactPerson}</span>}
      {stop.telephone && <a href={'tel:' + stop.telephone}>{stop.telephone}</a>}
      {stop.notes && <p>{stop.notes}</p>}
    </div>
    {error && <p role="alert" className="notification-reason">{error}</p>}
    {stop.status === 'pending' && <button type="button" className="accept-action booking-next" disabled={busy} onClick={() => void arrive()}>{busy ? 'Saving...' : 'On Site at Stop'}</button>}
    {stop.status === 'arrived' && <>
      <div className="stop-execution__form">
        <label>Your Ref.<input value={yourRef} readOnly /></label>
        <label>Customer Ref.<input value={customerReference} onChange={event => setCustomerReference(event.target.value)} placeholder="Customer reference for this stop" /></label>
        <label>Number Of Items<input type="number" min="0" value={itemCount} onChange={event => setItemCount(event.target.value)} /></label>
        <label>Weight (kg)<input type="number" min="0" step="0.01" value={weightKg} onChange={event => setWeightKg(event.target.value)} /></label>
        <label>ETA for this stop<input type="datetime-local" value={etaAt} onChange={event => setEtaAt(event.target.value)} /></label>
        <div className="stop-execution__job-details"><strong>Job Details</strong><span>{vehicle}</span><span>Weight: {jobWeight ?? 'Not provided'} kg</span><span>Packaging: {packaging || 'Not provided'}</span></div>
        {stop.type === 'delivery' && <>
          <label>Received By (Full Name) *<input value={recipientName} onChange={event => setRecipientName(event.target.value)} placeholder="Recipient full name" /></label>
          <DeliverySignature recipient={recipientName} saved={!!signature || !!handover?.signaturePath} onSave={setSignature} onClear={() => setSignature(null)} />
          <label>Left At *<input value={leftAt} onChange={event => setLeftAt(event.target.value)} placeholder="Goods Inwards / Reception" /></label>
          <label>Delivered On *<input type="datetime-local" value={deliveredOn} onChange={event => setDeliveredOn(event.target.value)} /></label>
          <label>Delivery Status<select value={deliveryStatus} onChange={event => setDeliveryStatus(event.target.value)}><option>Completed Delivery</option><option>Partial Delivery</option><option>Failed Delivery</option><option>Refused</option><option>Left Safe</option></select></label>
        </>}
        <div className="stop-execution__attachments">
          <strong>Attach files</strong>
          {files.map((file, index) => <div key={file.name + index}><span>{file.name}</span><button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))}>Remove</button></div>)}
          <input ref={addPodInput} hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => { appendFiles(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} />
          <input ref={addMoreInput} hidden multiple type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => { appendFiles(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} />
          <button type="button" className="booking-yellow" onClick={() => addPodInput.current?.click()}>Add POD</button>
          <button type="button" className="booking-yellow" onClick={() => addMoreInput.current?.click()}>Add More</button>
          <small>JPG, PNG or PDF. Maximum 10 MB per file.</small>
        </div>
        <label>Driver's Notes<textarea rows={5} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Stop notes, exceptions or return instructions" /></label>
      </div>
      <button type="button" className="accept-action booking-next" disabled={busy} onClick={() => void complete()}>{busy ? 'Saving stop...' : 'Complete Stop'}</button>
    </>}
    {stop.status === 'completed' && <div className="stop-execution__completed"><strong>Stop completed</strong><span>{stop.completedAt ? new Date(stop.completedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span></div>}
  </section>;
}
