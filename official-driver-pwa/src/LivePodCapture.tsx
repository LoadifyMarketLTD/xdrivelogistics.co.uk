import { useCallback, useRef, useState } from 'react';
import PodDetails, { type PodForm } from './PodDetails';
import { driverPost, renewSession, type LiveSession } from './liveApi';

type Props = { jobId: string; reference: string; initialItems: number; alreadyDelivered: boolean; session: LiveSession; onSession: (session: LiveSession) => void; onCompleted: (token: string) => Promise<void> };
const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
export default function LivePodCapture({ jobId, reference, initialItems, alreadyDelivered, session, onSession, onCompleted }: Props) {
  const [recipient, setRecipient] = useState('');
  const [details, setDetails] = useState<PodForm>({ leftAt: 'Goods Inwards', condition: 'Good condition', items: initialItems, notes: '' });
  const [signature, setSignature] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const deliveredSaved = alreadyDelivered;
  const [hardCopyAcknowledged, setHardCopyAcknowledged] = useState(false);
  // Preserve successful uploads across retries in this mounted form.
  const uploaded = useRef(new Map<File, string>());
  const onDetailsChange = useCallback((value: PodForm) => setDetails(value), []);
  const onSignatureSaved = useCallback((file: File) => setSignature(file), []);
  async function submit() {
    if (busy || done) return;
    if (!recipient.trim() || !signature || !files.some(f => f.type === 'image/jpeg' || f.type === 'image/png')) {
      setError('Recipient name, signature and at least one delivery photo are required.'); return;
    }
    const photos = files.filter(f => f.type === 'image/jpeg' || f.type === 'image/png');
    const documents = files.filter(f => f.type === 'application/pdf');
    if (photos.length > 10 || documents.length > 10) { setError('Maximum 10 delivery photos and 10 documents per POD.'); return; }
    if (details.items < 0 || details.items > 100000 || !Number.isInteger(details.items)) { setError('Enter a valid delivered item count.'); return; }
    setBusy(true); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      const photoUris: string[] = []; const documentUris: string[] = [];
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
      await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/pod`, current.token, { recipientName: recipient.trim(), leftAt: details.leftAt, itemCount: details.items, notes: [details.condition, details.notes].filter(Boolean).join(' | '), signatureData, photoUris, documentUris, hardCopyAcknowledged, deliveryStatus: details.condition === 'Refused' ? 'Refused' : details.condition === 'Shortage' ? 'Partial Delivery' : 'Completed Delivery' });
      setDone(true);
      // POD signature and evidence are now authoritative in the backend.
      await onCompleted(current.token);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete POD. Retry safely after checking the booking status.'); }
    finally { setBusy(false); }
  }
  return <section className="settings evidence-panel" aria-label="Live delivery POD">
    <PodDetails jobId={jobId} reference={reference} initialItems={initialItems} recipient={recipient} onRecipient={setRecipient} onChange={onDetailsChange} onSignature={onSignatureSaved} />
    <label>Delivery photos / documents<input type="file" multiple accept="image/jpeg,image/png,application/pdf" onChange={event => setFiles(Array.from(event.target.files || []))} /></label>
    {files.length > 0 && <p>{files.map(file => file.name).join(', ')}</p>}
    <label><input type="checkbox" checked={hardCopyAcknowledged} onChange={event => setHardCopyAcknowledged(event.target.checked)} /> Hard-copy POD requirement acknowledged (if required by the job)</label>
    <button className="primary" type="button" disabled={busy || done} onClick={() => void submit()}>{busy ? 'Saving delivery evidence...' : done ? 'POD saved' : 'Save POD and complete delivery'}</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
