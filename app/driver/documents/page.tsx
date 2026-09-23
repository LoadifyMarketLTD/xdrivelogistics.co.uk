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
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Hire & Reward', label: 'Hire & Reward' },
] as const;
type DocumentType = typeof DOC_TYPES[number]['value'];

const STATUS_TONES: Record<DriverDoc['status'], 'orange' | 'green' | 'red' | 'grey'> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  expired: 'grey',
};

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function fmtDate(value: string | null) {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not supplied' : date.toLocaleDateString('en-GB');
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function canonicalDocumentType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (normalized === 'driving licence' || normalized === 'driver licence' || normalized === 'drivers licence') return 'Driving Licence';
  if (normalized === 'insurance' || normalized === 'insurance certificate') return 'Insurance';
  if (
    normalized === 'hire reward'
    || normalized === 'hire and reward'
    || normalized === 'hire reward insurance'
    || normalized === 'hire and reward insurance'
  ) return 'Hire & Reward';
  return value;
}

export default function DriverDocumentsPage() {
  const { user } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DriverDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [docType, setDocType] = useState<DocumentType>(DOC_TYPES[0].value);
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [loadError, setLoadError] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token?.trim();
    if (!accessToken) {
      setLoadError('Your session has expired. Please sign in again.');
      setDocs([]);
      return;
    }

    const response = await fetch('/api/driver/documents', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }).catch(() => null);

    if (!response) {
      setLoadError('Your compliance documents could not be loaded.');
      setDocs([]);
      return;
    }

    const payload = await response.json().catch(() => ({})) as {
      documents?: DriverDoc[];
      error?: string;
    };

    if (!response.ok) {
      setLoadError(payload.error || 'Your compliance documents could not be loaded.');
      setDocs([]);
      return;
    }

    setLoadError('');
    setDocs(payload.documents ?? []);
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
    await loadDocs();
    setLoading(false);
  };

  useEffect(() => {
    void loadDriver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const canonicalDocs = useMemo(() => {
    const latest = new Map<string, DriverDoc>();
    for (const document of docs) {
      const type = canonicalDocumentType(document.doc_type);
      if (!DOC_TYPES.some((item) => item.value === type)) continue;
      if (!latest.has(type)) latest.set(type, { ...document, doc_type: type });
    }
    return latest;
  }, [docs]);

  const requiredReady = DOC_TYPES.filter((item) => canonicalDocs.get(item.value)?.status === 'approved').length;
  const attentionCount = DOC_TYPES.filter((item) => {
    const document = canonicalDocs.get(item.value);
    if (!document) return true;
    const days = daysUntil(document.expiry_date);
    return document.status !== 'approved' || (days != null && days <= 30);
  }).length;

  const handleUpload = async () => {
    setUploadError('');
    setUploadSuccess('');
    if (!file) return setUploadError('Select a PDF or image before submitting.');
    if (!driverId) return setUploadError('Driver profile not found.');
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) return setUploadError('File must be 10 MB or smaller.');

    const extension = MIME_EXTENSIONS[file.type.toLowerCase()];
    if (!extension) return setUploadError('Use a PDF, JPG, PNG or WEBP document.');
    if (issuedDate && expiryDate && expiryDate < issuedDate) return setUploadError('Expiry date cannot be before the issue date.');

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
      body: JSON.stringify({ storagePath, docType, issuedDate, expiryDate, mimeType: file.type }),
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
    await loadDocs();
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

  const openUploadFor = (type: string) => {
    setDocType(type as DocumentType);
    setShowUpload(true);
    setUploadError('');
    setUploadSuccess('');
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Keep the three Driver compliance records current. Expired and replaced copies are removed automatically."
        headerActions={<ActionButton tone="secondary" onClick={() => void loadDriver()} disabled={loading}>Refresh</ActionButton>}
      >
        {loadError && <AlertBanner tone="danger">{loadError}</AlertBanner>}
        {uploadError && <AlertBanner tone="danger">{uploadError}</AlertBanner>}
        {uploadSuccess && <AlertBanner tone="success">{uploadSuccess}</AlertBanner>}

        <div className="driver-compliance-register">
          <div className="driver-register-toolbar">
            <div>
              <strong>Required documents</strong>
              <span>{requiredReady}/3 approved · {attentionCount} requiring attention</span>
            </div>
            {!showUpload && <ActionButton tone="success" onClick={() => openUploadFor(DOC_TYPES[0].value)}>+ Upload document</ActionButton>}
          </div>

          {showUpload && (
            <section className="driver-compact-editor" aria-label="Upload document">
              <label>Document type
                <select value={docType} onChange={(event) => setDocType(event.target.value as DocumentType)}>
                  {DOC_TYPES.map((document) => <option key={document.value} value={document.value}>{document.label}</option>)}
                </select>
              </label>
              <label>Issue date<input type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} /></label>
              <label>Expiry date<input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>
              <label>File<input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
              <div className="driver-compact-editor__actions">
                <ActionButton tone="secondary" onClick={() => { setShowUpload(false); setUploadError(''); }}>Cancel</ActionButton>
                <ActionButton tone="success" onClick={() => void handleUpload()} disabled={uploading || !file}>{uploading ? 'Uploading…' : 'Submit document'}</ActionButton>
              </div>
            </section>
          )}

          {loading ? (
            <EmptyState compact title="Loading documents…" />
          ) : (
            <div className="driver-register-table-wrap">
              <table className="driver-register-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Issue date</th>
                    <th>Expiry date</th>
                    <th>Status</th>
                    <th>Attention</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {DOC_TYPES.map((required) => {
                    const document = canonicalDocs.get(required.value);
                    const days = daysUntil(document?.expiry_date ?? null);
                    const expiryLabel = days == null ? 'No expiry supplied' : days <= 30 ? (days < 0 ? 'Expired' : `${days} days`) : 'In date';
                    const attention = !document
                      ? 'Missing'
                      : document.status !== 'approved'
                        ? document.status
                        : days != null && days <= 30
                          ? expiryLabel
                          : 'Ready';
                    const tone = !document || document.status === 'rejected' || (days != null && days < 0)
                      ? 'red'
                      : document.status === 'pending' || (days != null && days <= 30)
                        ? 'orange'
                        : 'green';

                    return (
                      <tr key={required.value}>
                        <td><strong>{required.label}</strong>{document && <small>Uploaded {fmtDate(document.created_at)}</small>}</td>
                        <td>{document ? fmtDate(document.issued_date) : '—'}</td>
                        <td>{document ? fmtDate(document.expiry_date) : '—'}</td>
                        <td>{document ? <StatusBadge value={document.status} tone={STATUS_TONES[document.status]} /> : <StatusBadge value="Missing" tone="red" />}</td>
                        <td><StatusBadge value={attention} tone={tone} /></td>
                        <td>
                          <div className="driver-register-actions">
                            {document?.file_path && <ActionButton tone="secondary" onClick={() => void getSignedUrl(document.file_path as string, document.id)}>View</ActionButton>}
                            <ActionButton tone={document ? 'secondary' : 'success'} onClick={() => openUploadFor(required.value)}>{document ? 'Replace' : 'Upload'}</ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
