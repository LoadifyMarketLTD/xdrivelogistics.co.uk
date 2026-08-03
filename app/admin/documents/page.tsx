'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { DriverDocument, VehicleDocument, DocStatus } from '../../../lib/types/database';
import { selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';
import { PageHeader, ActionButton, AlertBanner, StatusBadge } from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

interface DriverOption { id: string; display_name: string; }
interface VehicleOption { id: string; reg_plate: string; }

const DRIVER_DOC_TYPES = ['Driving Licence', 'CPC Card', 'Tacho Card', 'DBS Certificate', 'Medical Certificate', 'Insurance', 'Other'];
const VEHICLE_DOC_TYPES = ['MOT', 'Road Tax', 'Insurance', 'Operator Licence', 'Goods Vehicle Test', 'Other'];

type AnyDoc = (DriverDocument & { kind: 'driver'; subject_name?: string }) | (VehicleDocument & { kind: 'vehicle'; subject_name?: string });

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
  const isDriverWorkspace = user?.role === 'driver' || user?.ownerDriverWorkspace === true;
  const canVerifyDocuments = !isDriverWorkspace;
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
  const DOCS_PER_PAGE = 12;
  const [docsPage, setDocsPage] = useState(0);
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
    setDocsPage(0);
  }, [tab, docs.length]);

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

  const totalDocsPages = Math.max(1, Math.ceil(docs.length / DOCS_PER_PAGE));
  const safeDocsPage = Math.min(docsPage, totalDocsPages - 1);
  const paginatedDocs = docs.slice(safeDocsPage * DOCS_PER_PAGE, (safeDocsPage + 1) * DOCS_PER_PAGE);

  return (
    <ProtectedRoute>
      <PageHeader
        title={isDriverWorkspace ? 'POD / Documents' : 'Documents'}
        description={isDriverWorkspace ? 'Upload and view your driver and vehicle documents.' : 'Review and verify driver & vehicle documents'}
        actions={
          <ActionButton tone="primary" onClick={() => { setShowUpload(true); setForm({ ...DEFAULT_UPLOAD, kind: tab }); setUploadError(''); }}>
            + Upload Document
          </ActionButton>
        }
      />

      {!isSupabaseConfigured && <AlertBanner tone="warning">⚠️ Supabase is not configured. Database features are disabled.</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      {/* Tab bar */}
      <div className={cssStyles.jobsStatusTabs}>
        <button className={`${cssStyles.jobsStatusTab}${tab === 'driver' ? ` ${cssStyles.jobsStatusTabActive}` : ''}`} onClick={() => setTab('driver')}>🪪 Driver Documents</button>
        <button className={`${cssStyles.jobsStatusTab}${tab === 'vehicle' ? ` ${cssStyles.jobsStatusTabActive}` : ''}`} onClick={() => setTab('vehicle')}>🚛 Vehicle Documents</button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #d9e2ec', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #d9e2ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#202124' }}>Upload Document</h2>
              <button type="button" onClick={() => { setShowUpload(false); setForm(DEFAULT_UPLOAD); setUploadError(''); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5f6368', lineHeight: 1, padding: '0 4px' }} aria-label="Close">×</button>
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gap: '8px' }}>
              {uploadError && <AlertBanner tone="danger">{uploadError}</AlertBanner>}
              <div className={cssStyles.settingsFieldRow}>
                <label className={cssStyles.settingsLabel}>Document Type *</label>
                <select className={cssStyles.settingsInput} value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as 'driver' | 'vehicle', subjectId: '', docType: '' }))}>
                  <option value="driver">Driver Document</option>
                  <option value="vehicle">Vehicle Document</option>
                </select>
              </div>
              <div className={cssStyles.settingsFieldRow}>
                <label className={cssStyles.settingsLabel}>{form.kind === 'driver' ? 'Driver' : 'Vehicle'} *</label>
                <select className={cssStyles.settingsInput} value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {form.kind === 'driver'
                    ? drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)
                    : vehicles.map(v => <option key={v.id} value={v.id}>{v.reg_plate}</option>)}
                </select>
              </div>
              <div className={cssStyles.settingsFieldRow}>
                <label className={cssStyles.settingsLabel}>Document Category *</label>
                <select className={cssStyles.settingsInput} value={form.docType} onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}>
                  <option value="">— Select —</option>
                  {(form.kind === 'driver' ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={cssStyles.settingsFieldGrid}>
                <div>
                  <label className={cssStyles.settingsLabel}>Issued Date</label>
                  <input type="date" className={cssStyles.settingsInput} value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
                </div>
                <div>
                  <label className={cssStyles.settingsLabel}>Expiry Date</label>
                  <input type="date" className={cssStyles.settingsInput} value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                </div>
              </div>
              <div className={cssStyles.settingsFieldRow}>
                <label className={cssStyles.settingsLabel}>File * (PDF, JPG, PNG — max 10 MB)</label>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className={cssStyles.settingsInput}
                  onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))} />
              </div>
            </div>
            <div style={{ padding: '8px 16px', borderTop: '1px solid #d9e2ec', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <ActionButton tone="secondary" onClick={() => { setShowUpload(false); setForm(DEFAULT_UPLOAD); setUploadError(''); }}>Cancel</ActionButton>
              <ActionButton tone="primary" disabled={uploading} onClick={handleUpload}>{uploading ? 'Uploading…' : 'Upload'}</ActionButton>
            </div>
          </div>
        </div>
      )}

      <div className={cssStyles.operationalTableContainer}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>Loading…</div>
        ) : docs.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>
            <p style={{ margin: 0 }}>No documents found.</p>
          </div>
        ) : (
          <>
            <div className={cssStyles.operationalTableScroll}>
              <table className={cssStyles.operationalTable} style={{ minWidth: '860px' }}>
                <caption className={cssStyles.operationalTableCaption}>Documents</caption>
                <thead>
                  <tr className={cssStyles.operationalTableHeaderRow}>
                    {[tab === 'driver' ? 'Driver' : 'Vehicle', 'Doc Type', 'Issued', 'Expires', 'Status', 'Actions'].map(h => (
                      <th key={h} scope="col" className={cssStyles.operationalTableHeadCell}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDocs.map((d) => (
                    <tr key={d.id} className={cssStyles.operationalTableRow}>
                      <td className={cssStyles.operationalTableCell} style={{ fontWeight: 600 }}>{d.subject_name || '—'}</td>
                      <td className={cssStyles.operationalTableCell}>{d.doc_type}</td>
                      <td className={cssStyles.operationalTableCell}>{d.issued_date || '—'}</td>
                      <td className={cssStyles.operationalTableCell}>{d.expiry_date || '—'}</td>
                      <td className={cssStyles.operationalTableCell}>
                        <StatusBadge value={d.status} />
                      </td>
                      <td className={`${cssStyles.operationalTableCell} ${cssStyles.operationalTableActionCell}`}>
                        <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
                          {d.file_path && (
                            <a href={d.file_path} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', height: '28px', padding: '0 10px', backgroundColor: '#e0f2fe', color: '#075985', borderRadius: '4px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                              View
                            </a>
                          )}
                          {d.file_path && (
                            <ActionButton tone="secondary" onClick={() => downloadDocument(d.file_path as string, d.id)}>Download</ActionButton>
                          )}
                          {canVerifyDocuments && d.status !== 'approved' && (
                            <ActionButton tone="secondary" onClick={() => updateStatus(d.id, 'approved')}>Approve</ActionButton>
                          )}
                          {canVerifyDocuments && d.status !== 'rejected' && (
                            <ActionButton tone="danger" onClick={() => updateStatus(d.id, 'rejected')}>Reject</ActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {docs.length > DOCS_PER_PAGE && (
              <div className={cssStyles.operationalTableMeta}>
                <span>
                  Showing {safeDocsPage * DOCS_PER_PAGE + 1}–{Math.min((safeDocsPage + 1) * DOCS_PER_PAGE, docs.length)} of {docs.length}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <ActionButton tone="secondary" disabled={safeDocsPage === 0} onClick={() => setDocsPage((prev) => Math.max(prev - 1, 0))}>Previous</ActionButton>
                  <ActionButton tone="secondary" disabled={safeDocsPage >= totalDocsPages - 1} onClick={() => setDocsPage((prev) => Math.min(prev + 1, totalDocsPages - 1))}>Next</ActionButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
