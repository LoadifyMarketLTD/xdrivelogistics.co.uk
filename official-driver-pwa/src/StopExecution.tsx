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
const deliveryOutcomes = [
  'Completed Delivery',
  'Incorrect Goods',
  'Incorrect Address',
  'Job Cancelled',
  'Delivery Refused',
  'No Unloading Facilities',
  'Damaged Goods',
] as const;
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
  const isReturn = handover?.stopKind === 'return';
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

  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [cancelScope, setCancelScope] = useState<'stop'|'job'>('stop');
  const [cancelledByRole, setCancelledByRole] = useState('customer');
  const [cancelledByName, setCancelledByName] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [instructionChannel, setInstructionChannel] = useState('phone');
  const [goodsInCustody, setGoodsInCustody] = useState(stop.type === 'delivery');
  const [goodsDisposition, setGoodsDisposition] = useState(stop.type === 'delivery' ? 'return_to_collection' : 'none');
  const [resolutionAddress, setResolutionAddress] = useState('');

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

  const upload = async (current: LiveSession, file: File, category: 'photos' | 'damage' | 'documents' | 'signature') => {
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

  const transition = async (status: 'en_route'|'arrived') => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`, current.token, { stop_id: stop.id, status });
      await onRefresh(current.token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Stop status could not be saved.');
    } finally { setBusy(false); }
  };

  const uploadCurrentFiles = async (current: LiveSession, exception = false) => {
    const photoPaths: string[] = [];
    const documentPaths: string[] = [];
    for (const file of files) {
      const category = file.type === 'application/pdf' ? 'documents' : exception ? 'damage' : 'photos';
      const path = await upload(current, file, category);
      (category === 'documents' ? documentPaths : photoPaths).push(path);
    }
    return { photoPaths, documentPaths };
  };

  const complete = async () => {
    if (busy) return;
    const items = Number(itemCount);
    const weight = weightKg.trim() === '' ? null : Number(weightKg);
    if (!Number.isInteger(items) || items < (stop.type === 'delivery' ? 1 : 0) || items > 100000) { setError('Enter a valid number of items.'); return; }
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100000)) { setError('Enter a valid weight.'); return; }
    if (stop.type === 'delivery' && (!recipientName.trim() || !leftAt.trim() || !deliveredOn || !signature)) {
      setError('Received By, signature, Left At and Delivered On are required for a completed delivery.');
      return;
    }
    const imageCount = files.filter(file => file.type.startsWith('image/')).length;
    if (imageCount < 1) { setError(stop.type === 'delivery' ? 'Add at least one delivery photo.' : 'Add at least one collection photo.'); return; }

    setBusy(true); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      const { photoPaths, documentPaths } = await uploadCurrentFiles(current);
      const signaturePath = stop.type === 'delivery' && signature ? await upload(current, signature, 'signature') : null;
      await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`, current.token, {
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
          deliveryStatus: stop.type === 'delivery' ? 'Completed Delivery' : null,
          signaturePath,
        },
      });
      await onRefresh(current.token);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Stop could not be completed.');
    } finally { setBusy(false); }
  };

  const reportException = async () => {
    if (busy) return;
    const images = files.filter(file => file.type.startsWith('image/')).length;
    if (['Damaged Goods','Incorrect Goods'].includes(deliveryStatus) && images < 1) {
      setError('Add photographic evidence for damaged or incorrect goods.');
      return;
    }
    setBusy(true); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      const { photoPaths, documentPaths } = await uploadCurrentFiles(current, true);
      await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`, current.token, {
        stop_id: stop.id,
        status: 'exception',
        exception: { deliveryStatus, notes: notes.trim() || null, photoPaths, documentPaths },
      });
      await onRefresh(current.token);
      setError('Exception recorded. The stop remains open until authorised instructions resolve it.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Delivery exception could not be recorded.');
    } finally { setBusy(false); }
  };

  const cancelStop = async () => {
    if (busy) return;
    if (cancellationReason.trim().length < 5) { setError('Enter the cancellation reason.'); return; }
    setBusy(true); setError('');
    try {
      const current = await renewSession(session); onSession(current);
      await driverPost(`/mobile/jobs/${encodeURIComponent(jobId)}/stop-status`, current.token, {
        stop_id: stop.id,
        status: 'cancelled',
        cancellation: {
          scope: cancelScope,
          cancelledByRole,
          cancelledByName: cancelledByName.trim() || null,
          reason: cancellationReason.trim(),
          instructionChannel,
          goodsInCustody,
          goodsDisposition: goodsInCustody ? goodsDisposition : 'none',
          resolutionAddress: resolutionAddress.trim() || null,
          notes: notes.trim() || null,
        },
      });
      await onRefresh(current.token);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cancellation instruction could not be recorded.');
    } finally { setBusy(false); }
  };

  const title = isReturn
    ? `Return Stop ${stop.sequence}`
    : `${stop.type === 'collection' ? 'Collection' : 'Delivery'} Stop ${stop.sequence}`;
  const cancellationSelected = cancellationOpen || (stop.type === 'delivery' && deliveryStatus === 'Job Cancelled');
  const exceptionSelected = !cancellationSelected && stop.type === 'delivery' && deliveryStatus !== 'Completed Delivery';
  const cancellationForm = <div className="stop-cancellation">
    <h3>{cancelScope === 'job' ? 'Job Cancelled By' : 'Stop Cancelled By'}</h3>
    <label>Cancellation scope<select value={cancelScope} onChange={e => setCancelScope(e.target.value as 'stop'|'job')}><option value="stop">This stop only</option><option value="job">Entire job</option></select></label>
    <label>Instruction from<select value={cancelledByRole} onChange={e => setCancelledByRole(e.target.value)}>
      <option value="posting_company">Posting Company</option><option value="customer">Customer</option><option value="broker_dispatcher">Broker / Dispatcher</option>
      <option value="collection_contact">Collection Site Contact</option><option value="delivery_contact">Delivery Site Contact</option><option value="other_authorised_party">Other authorised party</option>
    </select></label>
    <label>Person / Contact Name<input value={cancelledByName} onChange={e => setCancelledByName(e.target.value)} /></label>
    <label>Cancellation Reason *<textarea value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} rows={3} /></label>
    <label>Instruction received by<select value={instructionChannel} onChange={e => setInstructionChannel(e.target.value)}><option value="phone">Phone</option><option value="message">Message</option><option value="email">Email</option><option value="in_person">In person</option><option value="other">Other</option></select></label>
    <label className="stop-cancellation__check"><input type="checkbox" checked={goodsInCustody} onChange={e => { setGoodsInCustody(e.target.checked); if (!e.target.checked) setGoodsDisposition('none'); }} /> Goods are already in my custody / vehicle</label>
    {goodsInCustody && <label>Goods disposition<select value={goodsDisposition} onChange={e => setGoodsDisposition(e.target.value)}>
      <option value="return_to_collection">Return to collection point</option><option value="return_to_sender_depot">Return to sender / depot</option>
      <option value="await_instructions">Hold goods and await instructions</option><option value="redirect_authorised">Redirect to authorised address</option><option value="replacement_stop">Replacement delivery stop</option>
    </select></label>}
    {goodsInCustody && ['return_to_sender_depot','redirect_authorised','replacement_stop'].includes(goodsDisposition) && <label>Return / replacement address *<input value={resolutionAddress} onChange={e => setResolutionAddress(e.target.value)} /></label>}
    <label>Driver's Notes<textarea rows={4} value={notes} onChange={event => setNotes(event.target.value)} /></label>
    <div className="document-source-picker">
      <button type="button" className="accept-action booking-next" disabled={busy} onClick={() => void cancelStop()}>{busy ? 'Saving...' : 'Record Cancellation'}</button>
      <button type="button" onClick={() => { setCancellationOpen(false); if (deliveryStatus === 'Job Cancelled') setDeliveryStatus('Completed Delivery'); }}>Back</button>
    </div>
  </div>;

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

    {error && <p role={error.startsWith('Exception recorded') ? 'status' : 'alert'} className="notification-reason">{error}</p>}

    {['pending','en_route','arrived'].includes(stop.status) && !cancellationSelected && <button type="button" className="stop-cancel-action" onClick={() => setCancellationOpen(true)}>Record Stop / Job Cancellation</button>}
    {cancellationOpen && stop.status !== 'arrived' && cancellationForm}
    {stop.status === 'pending' && !cancellationOpen && <button type="button" className="accept-action booking-next" disabled={busy} onClick={() => void transition('en_route')}>{busy ? 'Saving...' : `On My Way to ${isReturn ? 'Return' : 'Stop'}`}</button>}
    {stop.status === 'en_route' && !cancellationOpen && <button type="button" className="accept-action booking-next" disabled={busy} onClick={() => void transition('arrived')}>{busy ? 'Saving...' : `On Site - ${isReturn ? 'Return' : 'Stop'}`}</button>}

    {stop.status === 'arrived' && <>
      <div className="stop-execution__form">
        <label>Your Ref.<input value={yourRef} readOnly /></label>
        <label>Customer Ref.<input value={customerReference} onChange={event => setCustomerReference(event.target.value)} placeholder="Customer reference for this stop" /></label>

        {stop.type === 'delivery' && <label>Delivery Status
          <select value={deliveryStatus} onChange={event => setDeliveryStatus(event.target.value)}>
            {deliveryOutcomes.map(option => <option key={option}>{option}</option>)}
          </select>
        </label>}

        {!cancellationSelected && !exceptionSelected && <>
          <label>Number Of Items<input type="number" min={stop.type === 'delivery' ? '1' : '0'} value={itemCount} onChange={event => setItemCount(event.target.value)} /></label>
          <label>Weight (kg)<input type="number" min="0" step="0.01" value={weightKg} onChange={event => setWeightKg(event.target.value)} /></label>
          <label>ETA for this stop<input type="datetime-local" value={etaAt} onChange={event => setEtaAt(event.target.value)} /></label>
          <div className="stop-execution__job-details"><strong>Job Details</strong><span>{vehicle}</span><span>Weight: {jobWeight ?? 'Not provided'} kg</span><span>Packaging: {packaging || 'Not provided'}</span></div>
          {stop.type === 'delivery' && <>
            <label>Received By (Full Name) *<input value={recipientName} onChange={event => setRecipientName(event.target.value)} placeholder="Recipient full name" /></label>
            <DeliverySignature recipient={recipientName} saved={!!signature || !!handover?.signaturePath} onSave={setSignature} onClear={() => setSignature(null)} />
            <label>Left At *<input value={leftAt} onChange={event => setLeftAt(event.target.value)} placeholder="Goods Inwards / Reception" /></label>
            <label>Delivered On *<input type="datetime-local" value={deliveredOn} onChange={event => setDeliveredOn(event.target.value)} /></label>
          </>}
        </>}

        {cancellationSelected && cancellationForm}

        {(exceptionSelected || !cancellationSelected) && <div className="stop-execution__attachments">
          <strong>{exceptionSelected ? 'Exception evidence' : isReturn ? 'Proof of Return files' : 'Attach files'}</strong>
          {files.map((file, index) => <div key={file.name + index}><span>{file.name}</span><button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))}>Remove</button></div>)}
          <input ref={addPodInput} hidden type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => { appendFiles(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} />
          <input ref={addMoreInput} hidden multiple type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => { appendFiles(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} />
          <button type="button" className="booking-yellow" onClick={() => addPodInput.current?.click()}>{isReturn ? 'Add Proof of Return' : 'Add POD'}</button>
          <button type="button" className="booking-yellow" onClick={() => addMoreInput.current?.click()}>Add More</button>
          <small>JPG, PNG or PDF. Maximum 10 MB per file.</small>
        </div>}

        <label>Driver's Notes<textarea rows={5} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Stop notes, exceptions or return instructions" /></label>
      </div>

      {cancellationSelected
        ? <button type="button" className="accept-action booking-next" disabled={busy} onClick={() => void cancelStop()}>{busy ? 'Saving...' : 'Record Cancellation'}</button>
        : exceptionSelected
          ? <button type="button" className="accept-action booking-next" disabled={busy} onClick={() => void reportException()}>{busy ? 'Saving...' : 'Report Delivery Exception'}</button>
          : <button type="button" className="accept-action booking-next" disabled={busy} onClick={() => void complete()}>{busy ? 'Saving stop...' : isReturn ? 'Complete Return / Proof of Return' : 'Complete Stop'}</button>
      }
    </>}

    {stop.status === 'completed' && <div className="stop-execution__completed"><strong>{isReturn ? 'Return completed' : 'Stop completed'}</strong><span>{stop.completedAt ? new Date(stop.completedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span></div>}
    {stop.status === 'cancelled' && <div className="stop-execution__completed"><strong>Cancelled on instruction</strong><span>{stop.cancelledAt ? new Date(stop.cancelledAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span></div>}
  </section>;
}
