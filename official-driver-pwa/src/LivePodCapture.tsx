import { useCallback, useRef, useState } from 'react';
import PodDetails, { type PodForm } from './PodDetails';
import { driverPost, renewSession, type LiveSession } from './liveApi';

type Props = { jobId: string; reference: string; initialItems: number; alreadyDelivered: boolean; initialRecipient?: string; initialSignature?: File | null; initialPhotoUris?: string[]; initialDelivery?: PodForm; session: LiveSession; onSession: (session: LiveSession) => void; onCompleted: (token: string) => Promise<void> };
const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
export default function LivePodCapture({ jobId, reference, initialItems, alreadyDelivered, initialRecipient = "", initialSignature = null, initialPhotoUris = [], initialDelivery, session, onSession, onCompleted }: Props) {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [details, setDetails] = useState<PodForm>(initialDelivery ?? { leftAt: 'Goods Inwards', condition: 'Good condition', items: initialItems, weightKg: null, deliveredOn: '', deliveredTime: '', notes: '' });
  const [signature, setSignature] = useState<File | null>(initialSignature);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const deliveredSaved = alreadyDelivered;
  const [hardCopyAcknowledged, setHardCopyAcknowledged] = useState(false);
  // Preserve successful uploads across retries in this mounted form.
  const uploaded = useRef(new Map<File, string>());
  const addPodInput = useRef<HTMLInputElement>(null);
  const addMoreInput = useRef<HTMLInputElement>(null);
  const onDetailsChange = useCallback((value: PodForm) => setDetails(value), []);
  const onSignatureSaved = useCallback((file: File) => setSignature(file), []);
  async function submit() {
    if (busy || done) return;
    if (!recipient.trim() || !signature || !files.some(f => f.type === 'image/jpeg' || f.type === 'image/png') && initialPhotoUris.length === 0) {
      setError('Recipient name, signature and at least one delivery photo are required.'); return;
    }
    const photos = files.filter(f => f.type === 'image/jpeg' || f.type === 'image/png');
    const documents = files.filter(f => f.type === 'application/pdf');
    if (photos.length > 10 || documents.length > 10) { setError('Maximum 10 delivery photos and 10 documents per POD.'); return; }
    if (details.items < 1 || details.items > 100000 || !Number.isInteger(details.items)) { setError('Enter a valid delivered item count.'); return; }
    if (details.weightKg !== null && (!Number.isFinite(details.weightKg) || details.weightKg < 0 || details.weightKg > 100000)) { setError('Enter a valid delivery weight.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(details.deliveredOn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(details.deliveredTime)) { setError('Delivered On date and delivery time are required.'); return; }
    setBusy(true); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      const photoUris: string[] = [...initialPhotoUris]; const documentUris: string[] = [];
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0) throw new Error('Use JPEG, PNG or PDF up to 10 MB.');
        const category = file.type === 'application/pdf' ? 'documents' : 'photos';
        const existingPath = uploaded.current.get(file);
        if (existingPath) {
          (category === 'photos' ? photoUris : documentUris).push(existingPath);
          continue;
        }
        const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-100)}`;
        const response = await fetch(`${base}/mobile/jobs/${encodeURIComponent(jobId)}/evidence`, { method: 'POST', headers: { Authorization: `Bearer ${current.token}`, 'Content-Type': file.type, 'x-xdrive-evidence-kind': 'delivery', 'x-xdrive-evidence-category': category, 'x-xdrive-evidence-name': safeName }, body: file });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || typeof result.storagePath !== 'string') throw new Error(result.error || 'POD evidence upload failed');
        uploaded.current.set(file, result.storagePath);
        (category === 'photos' ? photoUris : documentUris).push(result.storagePath);
      }
      const signatureData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read signature')); reader.readAsDataURL(signature); });
      // Delivery must be completed independently before POD can be submitted.
      if (!deliveredSaved) throw new Error('Complete Delivery must be saved before POD.');
      await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/pod`, current.token, { recipientName: recipient.trim(), leftAt: details.leftAt, itemCount: details.items, weightKg: details.weightKg, deliveredOn: details.deliveredOn, deliveredTime: details.deliveredTime, notes: [details.condition, details.notes].filter(Boolean).join(' | '), signatureData, photoUris, documentUris, hardCopyAcknowledged, deliveryStatus: details.condition === 'Refused' ? 'Refused' : details.condition === 'Shortage' ? 'Partial Delivery' : 'Completed Delivery' });
      setDone(true);
      // POD signature and evidence are now authoritative in the backend.
      await onCompleted(current.token);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete POD. Retry safely after checking the booking status.'); }
    finally { setBusy(false); }
  }
  return <section className="settings evidence-panel" aria-label="Live delivery POD">
    <PodDetails jobId={jobId} reference={reference} initialItems={initialItems} initialDelivery={initialDelivery} recipient={recipient} onRecipient={setRecipient} onChange={onDetailsChange} onSignature={onSignatureSaved} initialSignatureSaved={!!initialSignature} />
    <div className="stop-execution__attachments">
      <strong>Attach files</strong>
      {files.map((file,index)=><div key={file.name+index}><span>{file.name}</span><button type="button" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}>Remove</button></div>)}
      <input ref={addPodInput} hidden type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>{const next=Array.from(event.currentTarget.files||[]);setFiles(current=>[...current,...next].slice(0,20));event.currentTarget.value=''}}/>
      <input ref={addMoreInput} hidden multiple type="file" accept="image/jpeg,image/png,application/pdf" onChange={event=>{const next=Array.from(event.currentTarget.files||[]);setFiles(current=>[...current,...next].slice(0,20));event.currentTarget.value=''}}/>
      <button type="button" className="booking-yellow" onClick={()=>addPodInput.current?.click()}>Add POD</button>
      <button type="button" className="booking-yellow" onClick={()=>addMoreInput.current?.click()}>Add More</button>
      <small>JPG, PNG or PDF. Maximum 10 MB per file.</small>
    </div>
    <label><input type="checkbox" checked={hardCopyAcknowledged} onChange={event => setHardCopyAcknowledged(event.target.checked)} /> Hard-copy POD requirement acknowledged (if required by the job)</label>
    <button className="primary" type="button" disabled={busy || done} onClick={() => void submit()}>{busy ? 'Saving delivery evidence...' : done ? 'POD saved' : 'Save POD and complete delivery'}</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
