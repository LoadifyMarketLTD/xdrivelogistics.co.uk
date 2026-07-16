'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import {
  WorkspaceShell,
  WorkspaceMain,
  WorkspaceHeader,
  WorkspaceContent,
  WorkspaceTable,
  WorkspaceTableTr,
  WorkspaceTableTd,
  WorkspaceStatusBadge,
  WorkspaceFieldLabel,
  LoadingCard,
  EmptyCard,
  ErrorBanner,
  wsInputStyle,
  wsBtnPrimary,
  wsBtnSecondary,
  wsBtnAction,
  type WorkspaceTab,
} from '../../components/workspace';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import type { DriverDocument, VehicleDocument, DocStatus } from '../../../lib/types/database';
import { selectWithMissingColumnFallback } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';

interface DriverOption { id: string; display_name: string; }
interface VehicleOption { id: string; reg_plate: string; }

const DRIVER_DOC_TYPES = ['Driving Licence', 'CPC Card', 'Tacho Card', 'DBS Certificate', 'Medical Certificate', 'Insurance', 'Other'];
const VEHICLE_DOC_TYPES = ['MOT', 'Road Tax', 'Insurance', 'Operator Licence', 'Goods Vehicle Test', 'Other'];

const DOCUMENT_TABS: WorkspaceTab[] = [
  { id: 'driver', label: '🪪 Driver Documents' },
  { id: 'vehicle', label: '🚛 Vehicle Documents' },
];

type AnyDoc = (DriverDocument & { kind: 'driver'; subject_name?: string }) | (VehicleDocument & { kind: 'vehicle'; subject_name?: string });

const STATUS_COLORS: Record<DocStatus, { bg: string; text: string }> = {
  pending: { bg: '#F4F6F8', text: '#F5A300' },
  approved: { bg: '#F4F6F8', text: '#0B2F6B' },
  rejected: { bg: '#F4F6F8', text: '#F5A300' },
  expired: { bg: '#F4F6F8', text: '#0B2F6B' },
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
      <WorkspaceShell>
        <WorkspaceMain>
          <WorkspaceHeader
            tabs={DOCUMENT_TABS}
            activeTab={tab}
            onTabChange={(id) => setTab(id as 'driver' | 'vehicle')}
            action={(
              <button
                onClick={() => { setShowUpload(true); setForm({ ...DEFAULT_UPLOAD, kind: tab }); setUploadError(''); }}
                style={{ ...wsBtnPrimary, flex: '0 0 auto', padding: '0.65rem 1rem' }}
              >
                + Upload Document
              </button>
            )}
          />
          <WorkspaceContent>
            <div style={{ marginBottom: '1rem' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#0B2F6B', margin: 0 }}>
                {isDriverWorkspace ? 'POD / Documents' : 'Documents'}
              </h1>
              <p style={{ color: '#0B2F6B', margin: '0.5rem 0 0 0' }}>
                {isDriverWorkspace ? 'Upload and view your driver and vehicle documents.' : 'Review and verify driver & vehicle documents'}
              </p>
            </div>

            {!isSupabaseConfigured && (
              <div style={{ backgroundColor: '#F4F6F8', border: '1px solid #F5A300', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', color: '#1A1F2B' }}>
                ⚠️ Supabase is not configured. Database features are disabled.
              </div>
            )}

            {error && <ErrorBanner msg={error} />}

            {showUpload && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26, 31, 43, 0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(26, 31, 43, 0.3)', maxHeight: '90vh', overflow: 'auto' }}>
                  <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: '700', color: '#0B2F6B' }}>Upload Document</h2>
                  {uploadError && <ErrorBanner msg={uploadError} />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <WorkspaceFieldLabel>Document Type *</WorkspaceFieldLabel>
                      <select
                        value={form.kind}
                        onChange={e => setForm(f => ({ ...f, kind: e.target.value as 'driver' | 'vehicle', subjectId: '', docType: '' }))}
                        style={wsInputStyle}
                      >
                        <option value="driver">Driver Document</option>
                        <option value="vehicle">Vehicle Document</option>
                      </select>
                    </div>
                    <div>
                      <WorkspaceFieldLabel>{form.kind === 'driver' ? 'Driver' : 'Vehicle'} *</WorkspaceFieldLabel>
                      <select
                        value={form.subjectId}
                        onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                        style={wsInputStyle}
                      >
                        <option value="">— Select —</option>
                        {form.kind === 'driver'
                          ? drivers.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)
                          : vehicles.map(v => <option key={v.id} value={v.id}>{v.reg_plate}</option>)}
                      </select>
                    </div>
                    <div>
                      <WorkspaceFieldLabel>Document Category *</WorkspaceFieldLabel>
                      <select
                        value={form.docType}
                        onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}
                        style={wsInputStyle}
                      >
                        <option value="">— Select —</option>
                        {(form.kind === 'driver' ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                      <div>
                        <WorkspaceFieldLabel>Issued Date</WorkspaceFieldLabel>
                        <input
                          type="date"
                          value={form.issuedDate}
                          onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))}
                          style={{ ...wsInputStyle, marginBottom: 0 }}
                        />
                      </div>
                      <div>
                        <WorkspaceFieldLabel>Expiry Date</WorkspaceFieldLabel>
                        <input
                          type="date"
                          value={form.expiryDate}
                          onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                          style={{ ...wsInputStyle, marginBottom: 0 }}
                        />
                      </div>
                    </div>
                    <div>
                      <WorkspaceFieldLabel>File * (PDF, JPG, PNG — max 10 MB)</WorkspaceFieldLabel>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                        style={{ ...wsInputStyle, fontSize: '0.9rem', padding: '0.55rem', marginBottom: 0 }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                      onClick={() => { setShowUpload(false); setForm(DEFAULT_UPLOAD); setUploadError(''); }}
                      style={wsBtnSecondary}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      style={{ ...wsBtnPrimary, flex: '0 0 auto', padding: '0.75rem 1.5rem', opacity: uploading ? 0.65 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}
                    >
                      {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <LoadingCard text="Loading documents..." />
            ) : docs.length === 0 ? (
              <EmptyCard icon="📄" text="No documents found." />
            ) : (
              <WorkspaceTable
                columns={[tab === 'driver' ? 'Driver' : 'Vehicle', 'Doc Type', 'Issued', 'Expires', 'Status', 'Actions']}
                minWidth="860px"
                pagination={{
                  page: safeDocsPage,
                  total: docs.length,
                  perPage: DOCS_PER_PAGE,
                  onPrev: () => setDocsPage((prev) => Math.max(prev - 1, 0)),
                  onNext: () => setDocsPage((prev) => Math.min(prev + 1, totalDocsPages - 1)),
                }}
              >
                {paginatedDocs.map((d, i) => {
                  const sc = STATUS_COLORS[d.status] ?? STATUS_COLORS.pending;
                  return (
                    <WorkspaceTableTr key={d.id} last={i === paginatedDocs.length - 1}>
                      <WorkspaceTableTd style={{ fontWeight: '600', color: '#0B2F6B' }}>{d.subject_name || '—'}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ color: '#0B2F6B' }}>{d.doc_type}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ color: '#0B2F6B' }}>{d.issued_date || '—'}</WorkspaceTableTd>
                      <WorkspaceTableTd style={{ color: '#0B2F6B' }}>{d.expiry_date || '—'}</WorkspaceTableTd>
                      <WorkspaceTableTd>
                        <WorkspaceStatusBadge bg={sc.bg} color={sc.text}>{d.status}</WorkspaceStatusBadge>
                      </WorkspaceTableTd>
                      <WorkspaceTableTd>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {d.file_path && (
                            <a
                              href={d.file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ ...wsBtnAction, backgroundColor: '#F4F6F8', color: '#1D57D8', textDecoration: 'none', display: 'inline-block' }}
                            >
                              View
                            </a>
                          )}
                          {d.file_path && (
                            <button
                              type="button"
                              onClick={() => downloadDocument(d.file_path as string, d.id)}
                              style={{ ...wsBtnAction, backgroundColor: '#F4F6F8', color: '#0B2F6B', border: 'none' }}
                            >
                              Download
                            </button>
                          )}
                          {canVerifyDocuments && d.status !== 'approved' && (
                            <button
                              onClick={() => updateStatus(d.id, 'approved')}
                              style={{ ...wsBtnAction, backgroundColor: '#F4F6F8', color: '#0B2F6B', border: 'none' }}
                            >
                              Approve
                            </button>
                          )}
                          {canVerifyDocuments && d.status !== 'rejected' && (
                            <button
                              onClick={() => updateStatus(d.id, 'rejected')}
                              style={{ ...wsBtnAction, backgroundColor: '#F4F6F8', color: '#1A1F2B', border: 'none' }}
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </WorkspaceTableTd>
                    </WorkspaceTableTr>
                  );
                })}
              </WorkspaceTable>
            )}
          </WorkspaceContent>
        </WorkspaceMain>
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
