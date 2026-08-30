'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase } from '../../../lib/supabaseClient';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type DocumentScope = 'driver' | 'vehicle';

type DriverDoc = {
  id: string;
  scope: DocumentScope;
  doc_type: string;
  vehicle_id: string | null;
  vehicle_label: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string | null;
  file_available: boolean;
  signed_url: string | null;
  legacy_path_normalized?: boolean;
};

type VehicleOption = {
  id: string;
  label: string;
  status: string | null;
  assigned_to_me: boolean;
  assigned_to_other_driver: boolean;
};

type DocumentsPayload = {
  documents?: DriverDoc[];
  vehicles?: VehicleOption[];
  driver?: {
    id: string;
    company_id: string;
    driver_type: string | null;
    app_access: boolean;
    membership_role: string;
    can_manage_company_vehicles: boolean;
  };
  error?: string;
};

const DRIVER_DOC_TYPES = [
  'Driving Licence',
  'Proof of Address',
  'Right to Work',
  'DBS Certificate',
  'CPC Card',
  'Tacho Card',
  'Medical Certificate',
  'Visa Document',
  'Other',
] as const;

const VEHICLE_DOC_TYPES = ['MOT', 'Insurance', 'Goods Vehicle Test', 'Other'] as const;

function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function statusTone(value: string): 'orange' | 'green' | 'red' | 'grey' {
  const status = value.toLowerCase();
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'expired') return 'grey';
  return 'orange';
}

async function bearerToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token?.trim() || null;
}

export default function DriverDocumentsPage() {
  const [docs, setDocs] = useState<DriverDoc[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [driver, setDriver] = useState<DocumentsPayload['driver'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [scope, setScope] = useState<DocumentScope>('driver');
  const [docType, setDocType] = useState<string>(DRIVER_DOC_TYPES[0]);
  const [vehicleId, setVehicleId] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [loadError, setLoadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    setLoading(true);
    setLoadError('');
    const token = await bearerToken();
    if (!token) {
      setLoadError('Your session has expired. Sign in again to manage documents.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/driver/documents', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as DocumentsPayload;
    if (!response.ok) {
      setLoadError(payload.error || 'Your compliance documents could not be loaded.');
      setDocs([]);
      setVehicles([]);
      setDriver(null);
      setLoading(false);
      return;
    }

    const nextVehicles = payload.vehicles ?? [];
    setDocs(payload.documents ?? []);
    setVehicles(nextVehicles);
    setDriver(payload.driver ?? null);
    setVehicleId((current) => {
      if (current && nextVehicles.some((vehicle) => vehicle.id === current)) return current;
      return nextVehicles.find((vehicle) => vehicle.assigned_to_me)?.id ?? nextVehicles[0]?.id ?? '';
    });
    setLoading(false);
  };

  useEffect(() => { void loadDocs(); }, []);

  const approved = useMemo(() => docs.filter((doc) => doc.status === 'approved').length, [docs]);
  const pending = useMemo(() => docs.filter((doc) => doc.status === 'pending').length, [docs]);
  const rejected = useMemo(() => docs.filter((doc) => doc.status === 'rejected').length, [docs]);
  const expiringSoon = useMemo(() => docs.filter((doc) => {
    const days = daysUntil(doc.expiry_date);
    return days != null && days >= 0 && days <= 30;
  }).length, [docs]);
  const expired = useMemo(() => docs.filter((doc) => {
    const days = daysUntil(doc.expiry_date);
    return doc.status === 'expired' || (days != null && days < 0);
  }).length, [docs]);
  const assignedVehicle = vehicles.find((vehicle) => vehicle.assigned_to_me) ?? null;
  const vehicleDocs = docs.filter((doc) => doc.scope === 'vehicle').length;
  const driverDocs = docs.filter((doc) => doc.scope === 'driver').length;

  const chooseScope = (nextScope: DocumentScope) => {
    setScope(nextScope);
    setDocType(nextScope === 'driver' ? DRIVER_DOC_TYPES[0] : VEHICLE_DOC_TYPES[0]);
    setUploadError('');
    setUploadSuccess('');
  };

  const handleUpload = async () => {
    setUploadError('');
    setUploadSuccess('');
    if (!file) return setUploadError('Select a PDF or image before submitting.');
    if (file.size > 10 * 1024 * 1024) return setUploadError('File must be 10 MB or smaller.');
    if (scope === 'vehicle' && !vehicleId) return setUploadError('Choose the vehicle this document belongs to.');

    const token = await bearerToken();
    if (!token) return setUploadError('Your session has expired. Sign in again.');

    setUploading(true);
    const form = new FormData();
    form.set('scope', scope);
    form.set('docType', docType);
    form.set('issuedDate', issuedDate);
    form.set('expiryDate', expiryDate);
    if (scope === 'vehicle') form.set('vehicleId', vehicleId);
    form.set('file', file);

    const response = await fetch('/api/driver/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    setUploading(false);
    if (!response.ok) {
      setUploadError(payload.error || 'The document could not be uploaded.');
      return;
    }

    setUploadSuccess(payload.message || `${docType} submitted for review.`);
    setFile(null);
    setIssuedDate('');
    setExpiryDate('');
    if (fileRef.current) fileRef.current.value = '';
    await loadDocs();
  };

  const openDocument = (doc: DriverDoc) => {
    if (!doc.file_available || !doc.signed_url) {
      setLoadError('That file is missing from secure storage. Upload a replacement document.');
      return;
    }
    window.open(doc.signed_url, '_blank', 'noopener,noreferrer');
  };

  const complianceRail = (
    <aside className="driver-filter-rail" aria-label="Compliance document summary">
      <div className="driver-filter-rail__header">Compliance Documents</div>
      <div className="driver-filter-rail__body">
        <div className="driver-detail-item"><span>Documents</span><strong>{docs.length}</strong></div>
        <div className="driver-detail-item"><span>Driver records</span><strong>{driverDocs}</strong></div>
        <div className="driver-detail-item"><span>Vehicle records</span><strong>{vehicleDocs}</strong></div>
        <div className="driver-detail-item"><span>Approved records</span><strong>{approved}</strong></div>
        <div className="driver-detail-item"><span>Pending review</span><strong>{pending}</strong></div>
        <div className="driver-detail-item"><span>Expiring ≤30d</span><strong>{expiringSoon}</strong></div>
        <div className="driver-detail-item"><span>Rejected</span><strong>{rejected}</strong></div>
        <div className="driver-detail-item"><span>Expired</span><strong>{expired}</strong></div>
        <ActionButton tone="success" onClick={() => { setShowUpload(true); setUploadError(''); setUploadSuccess(''); }}>+ Upload document</ActionButton>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Driver and vehicle compliance document review, expiry attention and secure upload. Operational eligibility remains server-authoritative."
        headerActions={<ActionButton tone="primary" onClick={() => void loadDocs()} disabled={loading}>Refresh</ActionButton>}
      >
        {loadError && <AlertBanner tone="danger">{loadError}</AlertBanner>}
        {uploadError && <AlertBanner tone="danger">{uploadError}</AlertBanner>}
        {uploadSuccess && <AlertBanner tone="success">{uploadSuccess}</AlertBanner>}
        {driver && !driver.app_access && <AlertBanner tone="warning">Document remediation is available while Driver app access is pending. Marketplace quoting and job execution remain locked until the canonical eligibility checks pass.</AlertBanner>}
        {driver && !assignedVehicle && <AlertBanner tone="warning">No active vehicle is assigned to your Driver profile. You may upload company vehicle documents, but operational eligibility remains blocked until exactly one active vehicle is assigned to you. Use Vehicles → Assign to me.</AlertBanner>}

        <div className="driver-board-layout driver-documents-board">
          {complianceRail}
          <main className="driver-board-main">
            {showUpload && (
              <section className="driver-row-details">
                <div className="driver-detail-tabs"><strong>Upload document</strong></div>
                <div className="driver-row-actions" style={{ marginBottom: 8, justifyContent: 'flex-start' }}>
                  <ActionButton tone={scope === 'driver' ? 'primary' : 'secondary'} onClick={() => chooseScope('driver')}>Driver document</ActionButton>
                  <ActionButton tone={scope === 'vehicle' ? 'primary' : 'secondary'} onClick={() => chooseScope('vehicle')}>Vehicle document</ActionButton>
                </div>
                <div className="driver-detail-grid">
                  <label className="driver-filter-field">Document type<select value={docType} onChange={(event) => setDocType(event.target.value)}>{(scope === 'driver' ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                  {scope === 'vehicle' && <label className="driver-filter-field">Vehicle<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} disabled={vehicles.length === 0}><option value="">Choose vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id} disabled={vehicle.assigned_to_other_driver && driver?.can_manage_company_vehicles !== true}>{vehicle.label}{vehicle.assigned_to_me ? ' · assigned to me' : vehicle.assigned_to_other_driver ? ' · assigned to another Driver' : ''}</option>)}</select></label>}
                  <label className="driver-filter-field">Issue date<input type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} /></label>
                  <label className="driver-filter-field">Expiry date<input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>
                  <label className="driver-filter-field">File<input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
                </div>
                {scope === 'vehicle' && vehicles.length === 0 && <AlertBanner tone="warning">No company vehicle is available. Add a vehicle first, then return here to upload MOT or Insurance.</AlertBanner>}
                <div className="driver-row-actions" style={{ marginTop: 5 }}>
                  <ActionButton tone="secondary" onClick={() => { setShowUpload(false); setUploadError(''); }}>Cancel</ActionButton>
                  {scope === 'vehicle' && <ActionButton tone="secondary" onClick={() => { window.location.href = '/driver/vehicles'; }}>Manage vehicles</ActionButton>}
                  <ActionButton tone="success" onClick={() => void handleUpload()} disabled={uploading || !file || (scope === 'vehicle' && !vehicleId)}>{uploading ? 'Uploading…' : 'Submit document'}</ActionButton>
                </div>
              </section>
            )}

            <div className="driver-board-summary">
              <span><strong>Compliance documents</strong> · {docs.length} record{docs.length === 1 ? '' : 's'}</span>
              {!showUpload && <ActionButton tone="success" onClick={() => { setShowUpload(true); setUploadError(''); setUploadSuccess(''); }}>+ Upload document</ActionButton>}
            </div>

            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading documents…" /></div>
            ) : docs.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="No compliance documents uploaded" description="Upload Driver identity/compliance records or vehicle MOT/Insurance records. Review status and operational eligibility are assessed separately." /></div>
            ) : (
              <div className="driver-load-list">
                {docs.map((doc) => {
                  const days = daysUntil(doc.expiry_date);
                  const expiryLabel = days == null ? 'No expiry recorded' : days < 0 ? 'Past expiry date' : days <= 30 ? `${days} days to expiry` : 'In date';
                  const expiryTone: 'green' | 'orange' | 'red' | 'grey' = days == null ? 'grey' : days < 0 ? 'red' : days <= 30 ? 'orange' : 'green';
                  const recordSignal = doc.status === 'approved'
                    ? (days != null && days < 0 ? 'Approved record · expiry attention' : 'Approved record')
                    : doc.status === 'pending'
                      ? 'Pending review'
                      : doc.status === 'rejected'
                        ? 'Rejected record'
                        : 'Expired record';
                  return (
                    <article key={`${doc.scope}:${doc.id}`} className="driver-load-row" data-state={doc.status}>
                      <div className="driver-load-row__top">
                        <div className="driver-load-cell"><span className="driver-cell-label">Document</span><strong className="driver-cell-primary">{doc.doc_type}</strong><span className="driver-cell-secondary">{doc.scope === 'vehicle' ? doc.vehicle_label || 'Vehicle document' : 'Driver document'} · Uploaded {fmtDate(doc.created_at)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Dates</span><strong className="driver-cell-primary">{fmtDate(doc.issued_date)} → {fmtDate(doc.expiry_date)}</strong><span className="driver-cell-secondary"><StatusBadge value={expiryLabel} tone={expiryTone} /></span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Review</span><strong className="driver-cell-primary">{doc.status}</strong><span className="driver-cell-secondary">{doc.rejection_reason ?? 'No review note'}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Record signal</span><strong className="driver-cell-primary">{recordSignal}</strong><span className="driver-cell-secondary">{doc.file_available ? 'Secure file available' : 'File missing · replacement required'}</span></div>
                      </div>
                      <div className="driver-load-row__meta">
                        <span>{doc.scope === 'vehicle' ? 'Vehicle' : 'Driver'} document #{doc.id.slice(0, 8).toUpperCase()}</span>
                        <StatusBadge value={doc.status} tone={statusTone(doc.status)} />
                        <div className="driver-row-actions">{doc.file_available ? <ActionButton tone="secondary" onClick={() => openDocument(doc)}>View document</ActionButton> : <span>File unavailable</span>}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
