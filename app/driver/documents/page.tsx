'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';

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
  { value: 'Driving Licence',    label: '🪪 Driving Licence' },
  { value: 'Insurance',          label: '🛡️ Insurance Certificate' },
  { value: 'DBS Certificate',    label: '🔍 DBS Certificate' },
  { value: 'CPC Card',           label: '📋 CPC Card' },
  { value: 'Tacho Card',         label: '⏱️ Tacho Card' },
  { value: 'Medical Certificate',label: '🏥 Medical Certificate' },
  { value: 'Other',              label: '📄 Other' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:  { bg: '#fef3c7', text: '#92400e' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
  expired:  { bg: '#f3f4f6', text: '#6b7280' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
  borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.82rem', fontWeight: 600,
  color: '#374151', marginBottom: '0.35rem',
};

export default function DriverDocumentsPage() {
  const { user } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DriverDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Signed URL cache for previews
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadDriver();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadDriver = async () => {
    if (!isSupabaseConfigured || !user?.id) { setLoading(false); return; }
    const { data } = await supabase
      .from('drivers')
      .select('id, company_id')
      .eq('user_id', user.id)
      .eq('app_access', true)
      .maybeSingle();
    if (data) {
      setDriverId(data.id as string);
      setCompanyId((data as { id: string; company_id: string | null }).company_id);
      await loadDocs(data.id as string);
    }
    setLoading(false);
  };

  const loadDocs = async (dId: string) => {
    const { data, error: err } = await supabase
      .from('driver_documents')
      .select('id, doc_type, file_path, issued_date, expiry_date, status, rejection_reason, created_at')
      .eq('driver_id', dId)
      .order('created_at', { ascending: false });
    if (!err && data) setDocs(data as DriverDoc[]);
  };

  const handleUpload = async () => {
    setUploadError('');
    setUploadSuccess('');
    if (!file) { setUploadError('Please select a file.'); return; }
    if (!driverId) { setUploadError('Driver profile not found.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('File must be under 10 MB.'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'bin';
    const ts = Date.now();
    const safeType = docType.toLowerCase().replace(/\s+/g, '_');
    const storagePath = `${companyId ?? 'no-company'}/${driverId}/${safeType}_${ts}.${ext}`;

    const { error: storErr } = await supabase.storage
      .from('driver-docs')
      .upload(storagePath, file, { upsert: false });

    if (storErr) {
      setUploading(false);
      setUploadError(`Upload failed: ${storErr.message}`);
      return;
    }

    const { error: dbErr } = await supabase.from('driver_documents').insert({
      driver_id: driverId,
      doc_type: docType,
      file_path: storagePath,
      issued_date: issuedDate || null,
      expiry_date: expiryDate || null,
      status: 'pending',
    });

    setUploading(false);
    if (dbErr) {
      // Attempt to clean up the orphan storage object
      await supabase.storage.from('driver-docs').remove([storagePath]);
      setUploadError(`Record save failed: ${dbErr.message}`);
      return;
    }

    setUploadSuccess(`${docType} uploaded and submitted for review.`);
    setFile(null);
    setIssuedDate('');
    setExpiryDate('');
    setDocType(DOC_TYPES[0].value);
    if (fileRef.current) fileRef.current.value = '';
    await loadDocs(driverId);
  };

  const getSignedUrl = async (filePath: string, docId: string) => {
    if (signedUrls[docId]) {
      window.open(signedUrls[docId], '_blank');
      return;
    }
    const { data } = await supabase.storage
      .from('driver-docs')
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      setSignedUrls(prev => ({ ...prev, [docId]: data.signedUrl }));
      window.open(data.signedUrl, '_blank');
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff', border: '1px solid #d7e0ea',
    borderRadius: '12px', padding: '1.25rem',
    boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Upload and manage your compliance documents.">
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '860px' }}>

          {/* Header */}
          <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a' }}>🗂️ My Documents</h1>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.86rem', color: '#64748b' }}>
                Upload your licence, insurance, DBS and other compliance documents for admin review.
              </p>
            </div>
            <button
              onClick={() => { setShowUpload(v => !v); setUploadError(''); setUploadSuccess(''); }}
              style={{ padding: '0.6rem 1.1rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {showUpload ? '✕ Cancel' : '+ Upload Document'}
            </button>
          </div>

          {/* Upload Form */}
          {showUpload && (
            <div style={{ ...cardStyle, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>📤 Upload New Document</h2>
              {uploadError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.7rem', marginBottom: '0.85rem', color: '#dc2626', fontSize: '0.88rem' }}>
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '0.7rem', marginBottom: '0.85rem', color: '#14532d', fontWeight: 600, fontSize: '0.88rem' }}>
                  ✅ {uploadSuccess}
                </div>
              )}
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <div>
                  <label style={labelStyle}>Document Type *</label>
                  <select style={inputStyle} value={docType} onChange={e => setDocType(e.target.value)}>
                    {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={labelStyle}>Issue Date</label>
                    <input style={inputStyle} type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Expiry Date</label>
                    <input style={inputStyle} type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>File * (PDF, JPG, PNG — max 10 MB)</label>
                  <input
                    ref={fileRef}
                    style={{ ...inputStyle, padding: '0.45rem' }}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <button
                  onClick={() => { void handleUpload(); }}
                  disabled={uploading || !file}
                  style={{ padding: '0.7rem 1rem', background: uploading || !file ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: uploading || !file ? 'not-allowed' : 'pointer' }}
                >
                  {uploading ? 'Uploading…' : 'Submit Document'}
                </button>
              </div>
            </div>
          )}

          {/* Document List */}
          {loading ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b', padding: '2rem' }}>Loading documents…</div>
          ) : docs.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b', padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
              <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>No documents uploaded yet</div>
              <div style={{ fontSize: '0.86rem' }}>Click &quot;Upload Document&quot; above to submit your compliance paperwork.</div>
            </div>
          ) : (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    {['Document', 'Issued', 'Expires', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc, i) => {
                    const sc = STATUS_COLORS[doc.status] ?? STATUS_COLORS.pending;
                    return (
                      <tr key={doc.id} style={{ borderBottom: i < docs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.88rem' }}>{doc.doc_type}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#64748b' }}>
                          {doc.issued_date ? new Date(doc.issued_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: doc.expiry_date && new Date(doc.expiry_date) < new Date() ? '#dc2626' : '#64748b' }}>
                          {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ background: sc.bg, color: sc.text, padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                            {doc.status}
                          </span>
                          {doc.rejection_reason && (
                            <div style={{ fontSize: '0.74rem', color: '#991b1b', marginTop: '0.2rem' }}>
                              ⚠️ {doc.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {doc.file_path ? (
                            <button
                              onClick={() => { void getSignedUrl(doc.file_path!, doc.id); }}
                              style={{ padding: '0.3rem 0.65rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}
                            >
                              View
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No file</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
            Signed in as {user?.email ?? '—'} · Documents are reviewed by your dispatcher within 1–2 business days
          </div>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}

