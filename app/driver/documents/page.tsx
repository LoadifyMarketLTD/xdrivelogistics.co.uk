'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { ActionButton, AlertBanner, EmptyState, KpiCard, KpiGrid, Panel, StatusBadge } from '../../components/workspace/WorkspaceUI';

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
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  expired: 'grey',
};

const inputStyle = {
  width: '100%',
  height: '32px',
  padding: '0 8px',
  border: '1px solid #d8dee8',
  borderRadius: '4px',
  background: '#fff',
  color: '#1a1f2b',
  fontSize: '12px',
  boxSizing: 'border-box' as const,
};

const labelStyle = {
  display: 'block',
  marginBottom: '3px',
  color: '#64748b',
  fontSize: '10px',
  lineHeight: '14px',
  fontWeight: 700,
  letterSpacing: '.03em',
  textTransform: 'uppercase' as const,
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
      .eq('app_access', true)
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

    if (!file) {
      setUploadError('Select a PDF or image before submitting.');
      return;
    }
    if (!driverId) {
      setUploadError('Driver profile not found.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be under 10 MB.');
      return;
    }

    setUploading(true);
    const extension = file.name.split('.').pop() ?? 'bin';
    const timestamp = Date.now();
    const safeType = docType.toLowerCase().replace(/\s+/g, '_');
    const storagePath = `${companyId ?? 'no-company'}/${driverId}/${safeType}_${timestamp}.${extension}`;

    const { error: storageError } = await supabase.storage
      .from('driver-docs')
      .upload(storagePath, file, { upsert: false });

    if (storageError) {
      setUploading(false);
      setUploadError('The file upload failed. Please try again.');
      return;
    }

    const { error: recordError } = await supabase.from('driver_documents').insert({
      driver_id: driverId,
      doc_type: docType,
      file_path: storagePath,
      issued_date: issuedDate || null,
      expiry_date: expiryDate || null,
      status: 'pending',
    });

    setUploading(false);
    if (recordError) {
      await supabase.storage.from('driver-docs').remove([storagePath]);
      setUploadError('The document record could not be created. The uploaded file was removed safely.');
      return;
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

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Compliance readiness, expiry attention and document upload in one operational register."
        headerActions={<ActionButton tone="primary" onClick={() => void loadDriver()} disabled={loading}>Refresh</ActionButton>}
      >
        {loadError && <AlertBanner tone="danger">{loadError}</AlertBanner>}
        {uploadError && <AlertBanner tone="danger">{uploadError}</AlertBanner>}
        {uploadSuccess && <AlertBanner tone="success">{uploadSuccess}</AlertBanner>}

        <KpiGrid>
          <KpiCard label="Documents" value={docs.length} detail="All driver evidence" tone="blue" />
          <KpiCard label="Approved" value={approved} detail="Ready for operations" tone="green" />
          <KpiCard label="Pending review" value={pending} detail="Awaiting approval" tone="orange" />
          <KpiCard label="Expiring ≤30d" value={expiringSoon} detail="Renewal attention" tone={expiringSoon ? 'orange' : 'green'} />
          <KpiCard label="Rejected" value={rejected} detail="Action required" tone={rejected ? 'red' : 'green'} />
          <KpiCard label="Expired" value={expired} detail="Not ready" tone={expired ? 'red' : 'green'} />
        </KpiGrid>

        {showUpload && (
          <Panel
            title="Upload document"
            description="PDF, JPG, PNG or WebP up to 10 MB. New submissions start in Pending review."
            actions={<ActionButton tone="secondary" onClick={() => { setShowUpload(false); setUploadError(''); }}>Cancel</ActionButton>}
          >
            <div className="driver-detail-grid" style={{ marginBottom: '8px' }}>
              <div>
                <label style={labelStyle}>Document type</label>
                <select style={inputStyle} value={docType} onChange={(event) => setDocType(event.target.value)}>
                  {DOC_TYPES.map((doc) => <option key={doc.value} value={doc.value}>{doc.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Issue date</label>
                <input style={inputStyle} type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Expiry date</label>
                <input style={inputStyle} type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>File</label>
                <input ref={fileRef} style={{ ...inputStyle, height: 'auto', minHeight: '32px', padding: '4px' }} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ActionButton tone="success" onClick={() => void handleUpload()} disabled={uploading || !file}>{uploading ? 'Uploading…' : 'Submit document'}</ActionButton>
            </div>
          </Panel>
        )}

        <Panel
          title="Compliance documents"
          description="Status, issue/expiry dates and direct document access."
          actions={!showUpload ? <ActionButton tone="success" onClick={() => { setShowUpload(true); setUploadError(''); setUploadSuccess(''); }}>+ Upload document</ActionButton> : undefined}
          flush
        >
          {loading ? (
            <div style={{ padding: '20px' }}><EmptyState compact title="Loading documents…" /></div>
          ) : docs.length === 0 ? (
            <div style={{ padding: '20px' }}><EmptyState title="No compliance documents uploaded" description="Upload the documents required for your driver profile and vehicle operations." action={<ActionButton tone="success" onClick={() => setShowUpload(true)}>Upload first document</ActionButton>} /></div>
          ) : (
            <div className="driver-ops-table-wrap">
              <table className="driver-ops-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Issued</th>
                    <th>Expires</th>
                    <th>Expiry state</th>
                    <th>Review status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => {
                    const days = daysUntil(doc.expiry_date);
                    const expiryLabel = days == null ? 'No expiry' : days < 0 ? 'Expired' : days <= 30 ? `${days} days` : 'Valid';
                    const expiryTone: 'green' | 'orange' | 'red' | 'grey' = days == null ? 'grey' : days < 0 ? 'red' : days <= 30 ? 'orange' : 'green';
                    return (
                      <tr key={doc.id}>
                        <td>
                          <strong>{doc.doc_type}</strong>
                          {doc.rejection_reason && <div style={{ marginTop: '2px', color: '#b91c1c', fontSize: '10px' }}>{doc.rejection_reason}</div>}
                        </td>
                        <td>{fmtDate(doc.issued_date)}</td>
                        <td>{fmtDate(doc.expiry_date)}</td>
                        <td><StatusBadge value={expiryLabel} tone={expiryTone} /></td>
                        <td><StatusBadge value={doc.status} tone={STATUS_TONES[doc.status]} /></td>
                        <td>{doc.file_path ? <ActionButton tone="secondary" onClick={() => void getSignedUrl(doc.file_path as string, doc.id)}>View</ActionButton> : <span style={{ color: '#64748b' }}>—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
