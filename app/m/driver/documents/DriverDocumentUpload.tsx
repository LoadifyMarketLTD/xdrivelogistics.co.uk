'use client';
import { useRef, useState, type FormEvent } from 'react';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

const mimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const driverDocumentTypes = [
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'proof_of_address', label: 'Proof of address' },
  { value: 'right_to_work', label: 'Right to work' },
  { value: 'cpc', label: 'Driver CPC' },
  { value: 'visa_document', label: 'Visa / immigration document' },
];
const ownerInsuranceType = { value: 'insurance', label: 'Owner Driver insurance' };
const vehicleDocumentTypes = [
  { value: 'mot', label: 'MOT' },
  { value: 'insurance', label: 'Vehicle insurance' },
];

async function encodeFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const separator = value.indexOf(',');
      if (!value.startsWith('data:') || separator < 0) reject(new Error('Invalid file.'));
      else resolve(value.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

export default function DriverDocumentUpload({ hasAssignedVehicle, ownerDriver, onUploaded }: {
  hasAssignedVehicle: boolean;
  ownerDriver: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [kind, setKind] = useState<'driver' | 'vehicle'>('driver');
  const [docType, setDocType] = useState('driving_licence');
  const typeOptions = kind === 'vehicle' ? vehicleDocumentTypes
    : ownerDriver ? [...driverDocumentTypes, ownerInsuranceType] : driverDocumentTypes;
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !file) return;
    if (!mimeTypes.has(file.type)) { setError('Use a PDF, JPG, PNG or WEBP document.'); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setError('Document must be 10 MB or smaller.'); return;
    }
    if (issuedDate && expiryDate && issuedDate > expiryDate) {
      setError('Expiry date cannot be before the issue date.'); return;
    }
    if (kind === 'vehicle' && (!expiryDate || expiryDate < new Date().toISOString().slice(0, 10))) {
      setError('A current MOT or insurance expiry date is required.'); return;
    }
    if (kind === 'vehicle' && !hasAssignedVehicle) {
      setError('No assigned vehicle is available.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in again.');
      const base64 = await encodeFile(file);
      const response = await fetch('/api/driver/mobile/resources', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload_document', docType, fileName: file.name,
          mimeType: file.type, base64, issuedDate, expiryDate, isVehicleDocument: kind === 'vehicle' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Document upload failed.');
      setFile(null); setIssuedDate(''); setExpiryDate('');
      if (inputRef.current) inputRef.current.value = '';
      await onUploaded();
      setNotice('Document uploaded for review.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document upload failed.');
    } finally { setBusy(false); }
  };

  return <form className="xd-mobile-card xd-mobile-upload" onSubmit={event => void submit(event)}>
    <h2>Upload document</h2>
    {error ? <p role="alert" className="xd-mobile-error">{error}</p> : null}
    {notice ? <p role="status" className="xd-mobile-success">{notice}</p> : null}
    <label>For
      <select value={kind} onChange={event => {
        const next = event.target.value as 'driver' | 'vehicle';
        setKind(next);
        setDocType(next === 'vehicle' ? 'mot' : 'driving_licence');
        setExpiryDate('');
      }}>
        <option value="driver">Driver</option>
        {hasAssignedVehicle ? <option value="vehicle">Assigned vehicle</option> : null}
      </select>
    </label>
    <label>Document type
      <select value={docType} onChange={event => setDocType(event.target.value)}>
        {typeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <label>Issue date (optional)
      <input type="date" value={issuedDate} onChange={event => setIssuedDate(event.target.value)}/>
    </label>
    <label>Expiry date {kind === 'vehicle' ? '(required)' : '(optional)'}
      <input type="date" required={kind === 'vehicle'} value={expiryDate} onChange={event => setExpiryDate(event.target.value)}/>
    </label>
    <label>Document (PDF or image, maximum 10 MB)
      <input ref={inputRef} type="file" required
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        onChange={event => setFile(event.target.files?.[0] ?? null)}/>
    </label>
    <button type="submit" disabled={busy || !file}>
      {busy ? 'Uploading...' : 'Upload for review'}
    </button>
  </form>;
}
