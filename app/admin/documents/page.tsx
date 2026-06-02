'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { DriverDocument, VehicleDocument, DocStatus } from '../../../lib/types/database';
import { selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';

interface DriverOption { id: string; display_name: string; }
interface VehicleOption { id: string; reg_plate: string; }

const DRIVER_DOC_TYPES = ['Driving Licence', 'CPC Card', 'Tacho Card', 'DBS Certificate', 'Medical Certificate', 'Insurance', 'Other'];
const VEHICLE_DOC_TYPES = ['MOT', 'Road Tax', 'Insurance', 'Operator Licence', 'Goods Vehicle Test', 'Other'];

type AnyDoc = (DriverDocument & { kind: 'driver'; subject_name?: string }) | (VehicleDocument & { kind: 'vehicle'; subject_name?: string });

const STATUS_COLORS: Record<DocStatus, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  approved: { bg: '#d1fae5', text: '#065f46' },
  rejected: { bg: '#fee2e2', text: '#991b1b' },
  expired: { bg: '#f3f4f6', text: '#6b7280' },
};
const ALLOWED_DOC_STATUS = new Set<DocStatus>(['pending', 'approved', 'rejected', 'expired']);

interface UploadForm {
  kind: 'driver' | 'vehicle';
  subjectId: string;
  docType: string;
  issuedDate: string;
  expiryDate: string;
  file: File | null;
}

const DEFAULT_UPLOAD: UploadForm = { kind: 'driver', subjectId: '', docType: '', issuedDate: '', expiryDate: '', file: null };

const getDownloadFilename = (filePath: string, docId: string) => {
  const fallback = `document-${docId}`;
  try {
    const url = new URL(filePath);
    const rawName = url.pathname.split('/').pop();
    if (!rawName) return fallback;
    const decoded = decodeURIComponent(rawName);
    return decoded.trim() || fallback;
  } catch {
    return fallback;
  }
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<AnyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'driver' | 'vehicle'>('driver');
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState<UploadForm>(DEFAULT_UPLOAD);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) {
      setCompanyId(null);
      return;
    }
    setCompanyId(user.companyId ?? null);
  }, [user?.id, user?.companyId]);

  const loadDocs = async () => {
    setLoading(true);
    setError('');
    if (!isSupabaseConfigured) { setLoading(false); return; }
    if (!companyId) {
      setDocs([]);
      setError('Company profile not loaded. Document data is hidden until company access resolves.');
      setLoading(false);
      return;
    }
    if (tab === 'driver') {
      const { data, error: driverError } = await supabase
        .from('driver_documents')
        .select('id, driver_id, doc_type, file_path, issued_date, expiry_date, status, rejection_reason, verified_by, verified_at, created_at, drivers!inner(display_name, company_id)')
        .eq('drivers.company_id', companyId)
        .order('created_at', { ascending: false });
      if (driverError) {
        setDocs([]);
        setError(`Failed to load driver documents: ${driverError.message}`);
      } else if (data) {
        setDocs(data.map((d: DriverDocument & { drivers?: Array<{ display_name: string }> }) => ({
          ...d,
          kind: 'driver' as const,
          subject_name: Array.isArray(d.drivers) ? d.drivers[0]?.display_name : undefined,
        })));
      }
    } else {
      const { rows, missingColumns, error: vehicleError } = await selectWithMissingColumnFallback<Record<string, unknown>>({
        table: 'vehicle_documents',
        columns: ['id', 'vehicle_id', 'doc_type', 'file_path', 'issued_date', 'expiry_date', 'status', 'rejection_reason', 'verified_by', 'verified_at', 'created_at'],
        execute: async (activeColumns) => {
          const vehicleRes = await supabase
            .from('vehicle_documents')
            .select(`${activeColumns.join(', ')}, vehicles!inner(reg_plate, company_id)`)
            .eq('vehicles.company_id', companyId)
            .order('created_at', { ascending: false });
          return {
            data: ((vehicleRes.data ?? []) as unknown) as Array<Record<string, unknown>>,
            error: vehicleRes.error,
          };
        },
      });

      if (vehicleError) {
        setDocs([]);
        setError(`Failed to load vehicle documents: ${vehicleError.message}`);
      } else {
        setDocs(rows.map((row) => {
          const d = (row as unknown) as VehicleDocument & { vehicles?: Array<{ reg_plate: string }> };
          return {
            ...d,
            doc_type: missingColumns.has('doc_type') ? 'Document' : (d.doc_type ?? 'Document'),
            file_path: missingColumns.has('file_path') ? null : (d.file_path ?? null),
            kind: 'vehicle' as const,
            subject_name: Array.isArray(d.vehicles) ? d.vehicles[0]?.reg_plate : undefined,
          };
        }));
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadDocs(); }, [tab, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!companyId || !isSupabaseConfigured) return;
    supabase.from('drivers').select('id, display_name').eq('company_id', companyId).eq('status', 'active')
      .then(({ data }) => setDrivers((data ?? []) as DriverOption[]));
    supabase.from('vehicles').select('id, reg_plate').eq('company_id', companyId)
      .then(({ data }) => setVehicles((data ?? []) as VehicleOption[]));
  }, [companyId]);

  const handleUpload = async () => {
    if (!companyId || !form.subjectId || !form.docType || !form.file) {
      setUploadError('Please fill in all required fields and select a file.');
      return;
    }
    setUploading(true);
    setUploadError('');
    const bucket = form.kind === 'driver' ? 'driver-docs' : 'vehicle-docs';
    const ext = form.file.name.split('.').pop() ?? 'bin';
    const filePath = `${companyId}/${form.subjectId}/${Date.now()}.${ext}`;
    const { error: storageError } = await supabase.storage.from(bucket).upload(filePath, form.file, { upsert: false });
    if (storageError) {
      setUploadError(`Upload failed: ${storageError.message}`);
      setUploading(false);
      return;
    }
    const { data: urlData, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
    if (signedError || !urlData?.signedUrl) {
      setUploadError(`Failed to generate secure file URL: ${signedError?.message ?? 'unknown error'}`);
      setUploading(false);
      return;
    }
    const fileUrl = urlData.signedUrl;
    if (form.kind === 'driver') {
      logRuntimeProof({
        flow: 'Upload Documents',
        authUid: user?.id ?? null,
        membershipId: user?.membershipId ?? null,
        companyId,
        payload: {
          driver_id: form.subjectId,
          doc_type: form.docType,
          file_path: fileUrl,
          issued_date: form.issuedDate || null,
          expiry_date: form.expiryDate || null,
          status: 'pending',
        },
        table: 'driver_documents',
        rlsPolicy: 'driver_docs_all_admin',
      });
      const { error: dbError } = await supabase.from('driver_documents').insert({
        driver_id: form.subjectId, doc_type: form.docType, file_path: fileUrl,
        issued_date: form.issuedDate || null, expiry_date: form.expiryDate || null, status: 'pending',
      });
      if (dbError) { setUploadError(`Database error: ${dbError.message}`); setUploading(false); return; }
    } else {
      const payload: Record<string, string | null> = {
        vehicle_id: form.subjectId,
        doc_type: form.docType,
        file_path: fileUrl,
        issued_date: form.issuedDate || null,
        expiry_date: form.expiryDate || null,
        status: 'pending',
      };
      logRuntimeProof({
        flow: 'Upload Documents',
        authUid: user?.id ?? null,
        membershipId: user?.membershipId ?? null,
        companyId,
        payload,
        table: 'vehicle_documents',
        rlsPolicy: 'vehicle_docs_all_admin',
      });
      const { error: dbError } = await supabase.from('vehicle_documents').insert(payload);
      if (dbError) { setUploadError(`Database error: ${dbError.message}`); setUploading(false); return; }
    }
    setForm(DEFAULT_UPLOAD);
    if (fileRef.current) fileRef.current.value = '';
    setShowUpload(false);
    setTab(form.kind);
    await loadDocs();
    setUploading(false);
  };

  const updateStatus = async (id: string, status: DocStatus) => {
    if (!isSupabaseConfigured || !companyId) return;
    if (!ALLOWED_DOC_STATUS.has(status)) {
      setError('Invalid document status update request.');
      return;
    }

    if (tab === 'driver') {
      const { data: verifiedDoc, error: verifyError } = await supabase
        .from('driver_documents')
        .select('id, driver_id, drivers!inner(company_id)')
        .eq('id', id)
        .eq('drivers.company_id', companyId)
        .limit(1)
        .maybeSingle();

      if (verifyError || !verifiedDoc) {
        setError('Driver document not found for the current company.');
        return;
      }

      const { error: updateError } = await supabase
        .from('driver_documents')
        .update({ status })
        .eq('id', id)
        .eq('driver_id', verifiedDoc.driver_id as string);

      if (updateError) {
        console.error('Failed to update document status:', updateError.message);
        setError(`Failed to update document status: ${updateError.message}`);
        return;
      }
    } else {
      const { data: verifiedDoc, error: verifyError } = await supabase
        .from('vehicle_documents')
        .select('id, vehicle_id, vehicles!inner(company_id)')
        .eq('id', id)
        .eq('vehicles.company_id', companyId)
        .limit(1)
        .maybeSingle();

      if (verifyError || !verifiedDoc) {
        setError('Vehicle document not found for the current company.');
        return;
      }

      const { error: updateError } = await supabase
        .from('vehicle_documents')
        .update({ status })
        .eq('id', id)
        .eq('vehicle_id', verifiedDoc.vehicle_id as string);

      if (updateError) {
        console.error('Failed to update document status:', updateError.message);
        setError(`Failed to update document status: ${updateError.message}`);
        return;
      }
    }

    setError('');
    loadDocs();
  };

  const downloadDocument = async (filePath: string, docId: string) => {
    setError('');
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = getDownloadFilename(filePath, docId);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(filePath, '_blank', 'noopener,noreferrer');
      setError('Direct download failed, so the file was opened in a new tab.');
    }
  };

  const tabStyle = (active: boolean) => ({
    padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600' as const, cursor: 'pointer',
    backgroundColor: active ? '#1F7A3D' : 'white', color: active ? 'white' : '#6b7280',
  });

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1rem' }}>
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Documents</h1>
            <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>Review and verify driver & vehicle documents</p>
          </div>

          {!isSupabaseConfigured && (
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#92400e' }}>
              ⚠️ Supabase is not configured. Database features are disabled.
            </div>
          )}

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', color: '#991b1b' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button style={tabStyle(tab === 'driver')} onClick={() => setTab('driver')}>🪪 Driver Documents</button>
              <button style={tabStyle(tab === 'vehicle')} onClick={() => setTab('vehicle')}>🚛 Vehicle Documents</button>
            </div>
            <button
              onClick={() => { setShowUpload(true); setForm({ ...DEFAULT_UPLOAD, kind: tab }); setUploadError(''); }}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}
            >
              + Upload Document
            </button>
          </div>

          {/* Upload modal */}
          {showUpload && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: '700', color: '#1f2937' }}>Upload Document</h2>
                {uploadError && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.9rem' }}>{uploadError}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>Document Type *</label>
                    <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as 'driver' | 'vehicle', subjectId: '', docType: '' }))}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem' }}>
                      <option value="driver">Driver Document</option>
                      <option value="vehicle">Vehicle Document</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>{form.kind === 'driver' ? 'Driver' : 'Vehicle'} *</label>
                    <select value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem' }}>
                      <option value="">— Select —</option>
                      {form.kind === 'driver'
                        ? drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)
                        : vehicles.map(v => <option key={v.id} value={v.id}>{v.reg_plate}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>Document Category *</label>
                    <select value={form.docType} onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem' }}>
                      <option value="">— Select —</option>
                      {(form.kind === 'driver' ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>Issued Date</label>
                      <input type="date" value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))}
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>Expiry Date</label>
                      <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>File * (PDF, JPG, PNG — max 10 MB)</label>
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button onClick={() => { setShowUpload(false); setForm(DEFAULT_UPLOAD); setUploadError(''); }}
                    style={{ padding: '0.75rem 1.5rem', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontWeight: '600', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleUpload} disabled={uploading}
                    style={{ padding: '0.75rem 1.5rem', backgroundColor: uploading ? '#9ca3af' : '#1F7A3D', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : docs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                <p>No documents found.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {[tab === 'driver' ? 'Driver' : 'Vehicle', 'Doc Type', 'Issued', 'Expires', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d, i) => {
                      const sc = STATUS_COLORS[d.status] ?? STATUS_COLORS.pending;
                      return (
                        <tr key={d.id} style={{ borderBottom: i < docs.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                          <td style={{ padding: '1rem', fontWeight: '600', color: '#1f2937' }}>{d.subject_name || '—'}</td>
                          <td style={{ padding: '1rem', color: '#6b7280' }}>{d.doc_type}</td>
                          <td style={{ padding: '1rem', color: '#6b7280' }}>{d.issued_date || '—'}</td>
                          <td style={{ padding: '1rem', color: '#6b7280' }}>{d.expiry_date || '—'}</td>
                          <td style={{ padding: '1rem' }}><span style={{ backgroundColor: sc.bg, color: sc.text, padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{d.status}</span></td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {d.file_path && (
                                <a href={d.file_path} target="_blank" rel="noopener noreferrer"
                                  style={{ padding: '0.375rem 0.75rem', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', textDecoration: 'none' }}>View</a>
                              )}
                              {d.file_path && (
                                <button
                                  type="button"
                                  onClick={() => downloadDocument(d.file_path as string, d.id)}
                                  style={{ padding: '0.375rem 0.75rem', backgroundColor: '#ecfdf5', color: '#065f46', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  Download
                                </button>
                              )}
                              {d.status !== 'approved' && <button onClick={() => updateStatus(d.id, 'approved')} style={{ padding: '0.375rem 0.75rem', backgroundColor: '#d1fae5', color: '#065f46', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>Approve</button>}
                              {d.status !== 'rejected' && <button onClick={() => updateStatus(d.id, 'rejected')} style={{ padding: '0.375rem 0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>Reject</button>}
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
        </div>
      </div>
    </ProtectedRoute>
  );
}
