'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

interface DriverDoc {
  id: string;
  doc_type: string;
  file_path: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  rejection_reason: string | null;
  created_at: string;
}

const DOC_TYPES = [
  { value: 'Driving Licence', label: 'Driving Licence' },
  { value: 'Insurance', label: 'Insurance Certificate' },
  { value: 'DBS Certificate', label: 'DBS Certificate' },
  { value: 'CPC Card', label: 'CPC Card' },
  { value: 'Tacho Card', label: 'Tacho Card' },
  { value: 'Medical Certificate', label: 'Medical Certificate' },
  { value: 'Other', label: 'Other' },
];

const STATUS_TONES: Record<DriverDoc['status'], 'orange' | 'green' | 'red' | 'grey'> = {
  pending: 'orange', approved: 'green', rejected: 'red', expired: 'grey',
};

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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

export default function DriverDocumentsPage() {
  const { user } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DriverDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [loadError, setLoadError] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = async (currentDriverId: string) => {
    const { data, error } = await supabase
      .from('driver_documents')
      .select('id, doc_type, file_path, issued_date, expiry_date, status, rejection_reason, created_at')
      .eq('driver_id', currentDriverId)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError('Your compliance documents could not be loaded.');
      setDocs([]);
    } else {
      setLoadError('');
      setDocs((data ?? []) as DriverDoc[]);
    }
  };

  const loadDriver = async () => {
    if (!isSupabaseConfigured || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('drivers')
      .select('id, company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      setLoadError('Your driver profile could not be resolved for document management.');
      setLoading(false);
      return;
    }

    setDriverId(data.id as string);
    setCompanyId((data as { id: string; company_id: string | null }).company_id);
    await loadDocs(data.id as string);
    setLoading(false);
  };

  useEffect(() => {
    void loadDriver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const handleUpload = async () => {
    setUploadError('');
    setUploadSuccess('');
    if (!file) return setUploadError('Select a PDF or image before submitting.');
    if (!driverId) return setUploadError('Driver profile not found.');
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) return setUploadError('File must be 10 MB or smaller.');

    const extension = MIME_EXTENSIONS[file.type.toLowerCase()];
    if (!extension) return setUploadError('Use a PDF, JPG, PNG or WEBP document.');
    if (issuedDate && expiryDate && expiryDate < issuedDate) {
      return setUploadError('Expiry date cannot be before the issue date.');
    }

    setUploading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token?.trim();
    if (!accessToken) {
      setUploading(false);
      setUploadError('Your session has expired. Please sign in again.');
      return;
    }

    const tenantAnchor = companyId ?? driverId;
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const storagePath = `${tenantAnchor}/${driverId}/${uploadId}.${extension}`;
    const { error: storageError } = await supabase.storage
      .from('driver-docs')
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (storageError) {
      setUploading(false);
      setUploadError('The file upload failed. Please try again.');
      return;
    }

    const response = await fetch('/api/driver/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storagePath,
        docType,
        issuedDate,
        expiryDate,
        mimeType: file.type,
      }),
    }).catch(() => null);

    const recoverPersistedRecord = async () => {
      const { data, error } = await supabase
        .from('driver_documents')
        .select('id')
        .eq('driver_id', driverId)
        .eq('file_path', storagePath)
        .maybeSingle();
      return !error && Boolean(data?.id);
    };

    if (!response) {
      const persisted = await recoverPersistedRecord();
      if (!persisted) await supabase.storage.from('driver-docs').remove([storagePath]);
      setUploading(false);
      if (!persisted) {
        setUploadError('The document record could not be confirmed. The uploaded file was removed safely.');
        return;
      }
    } else {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        const persisted = await recoverPersistedRecord();
        if (!persisted) await supabase.storage.from('driver-docs').remove([storagePath]);
        setUploading(false);
        if (!persisted) {
          setUploadError(payload.error || 'The document could not be submitted. Please try again.');
          return;
        }
      } else {
        setUploading(false);
      }
    }

    setUploadSuccess(`${docType} submitted for review.`);
    setFile(null);
    setIssuedDate('');
    setExpiryDate('');
    setDocType(DOC_TYPES[0].value);
    if (fileRef.current) fileRef.current.value = '';
    await loadDocs(driverId);
  };

  const getSignedUrl = async (filePath: string, docId: string) => {
    if (signedUrls[docId]) {
      window.open(signedUrls[docId], '_blank', 'noopener,noreferrer');
      return;
    }
    const { data, error } = await supabase.storage.from('driver-docs').createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) {
      setLoadError('That document could not be opened.');
      return;
    }
    setSignedUrls((previous) => ({ ...previous, [docId]: data.signedUrl }));
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const complianceRail = (
    <aside className="driver-filter-rail" aria-label="Compliance document summary">
      <div className="driver-filter-rail__header">Compliance Documents</div>
      <div className="driver-filter-rail__body">
        <div className="driver-detail-item"><span>Documents</span><strong>{docs.length}</strong></div>
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
        subtitle="Driver compliance document review, expiry attention and upload. Operational eligibility is resolved separately by the canonical eligibility contract."
        headerActions={<ActionButton tone="primary" onClick={() => void loadDriver()} disabled={loading}>Refresh</ActionButton>}
      >
        {loadError && <AlertBanner tone="danger">{loadError}</AlertBanner>}
        {uploadError && <AlertBanner tone="danger">{uploadError}</AlertBanner>}
        {uploadSuccess && <AlertBanner tone="success">{uploadSuccess}</AlertBanner>}

        <div className="driver-board-layout driver-documents-board">
          {complianceRail}
          <main className="driver-board-main">
            {showUpload && (
              <section className="driver-row-details">
                <div className="driver-detail-tabs"><strong>Upload document</strong></div>
                <div className="driver-detail-grid">
                  <label className="driver-filter-field">Document type<select value={docType} onChange={(event) => setDocType(event.target.value)}>{DOC_TYPES.map((doc) => <option key={doc.value} value={doc.value}>{doc.label}</option>)}</select></label>
                  <label className="driver-filter-field">Issue date<input type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} /></label>
                  <label className="driver-filter-field">Expiry date<input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>
                  <label className="driver-filter-field">File<input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
                </div>
                <div className="driver-row-actions" style={{ marginTop: 5 }}>
                  <ActionButton tone="secondary" onClick={() => { setShowUpload(false); setUploadError(''); }}>Cancel</ActionButton>
                  <ActionButton tone="success" onClick={() => void handleUpload()} disabled={uploading || !file}>{uploading ? 'Uploading…' : 'Submit document'}</ActionButton>
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
              <div className="driver-load-row"><EmptyState compact title="No compliance documents uploaded" description="Upload the documents required for your driver record. Eligibility is assessed separately from this document register." /></div>
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
                    <article key={doc.id} className="driver-load-row" data-state={doc.status}>
                      <div className="driver-load-row__top">
                        <div className="driver-load-cell"><span className="driver-cell-label">Document</span><strong className="driver-cell-primary">{doc.doc_type}</strong><span className="driver-cell-secondary">Uploaded {fmtDate(doc.created_at)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Dates</span><strong className="driver-cell-primary">{fmtDate(doc.issued_date)} → {fmtDate(doc.expiry_date)}</strong><span className="driver-cell-secondary"><StatusBadge value={expiryLabel} tone={expiryTone} /></span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Review</span><strong className="driver-cell-primary">{doc.status}</strong><span className="driver-cell-secondary">{doc.rejection_reason ?? 'No review note'}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Record signal</span><strong className="driver-cell-primary">{recordSignal}</strong><span className="driver-cell-secondary">Document status only · not full eligibility</span></div>
                      </div>
                      <div className="driver-load-row__meta">
                        <span>Document #{doc.id.slice(0, 8).toUpperCase()}</span>
                        <StatusBadge value={doc.status} tone={STATUS_TONES[doc.status]} />
                        <div className="driver-row-actions">{doc.file_path ? <ActionButton tone="secondary" onClick={() => void getSignedUrl(doc.file_path as string, doc.id)}>View document</ActionButton> : <span>File unavailable</span>}</div>
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
