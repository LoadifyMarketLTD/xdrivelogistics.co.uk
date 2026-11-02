'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { getAccessToken } from '../_lib/getAccessToken';
import { ActionButton, AlertBanner, StatusBadge } from '../../components/workspace/WorkspaceUI';

type DocumentKind = 'driver' | 'vehicle';
type DocumentStatus = 'pending' | 'approved' | 'rejected' | 'expired';

type AdminDocumentRow = {
  id: string;
  kind: DocumentKind;
  subject_id: string;
  subject_name: string;
  doc_type: string;
  issued_date: string | null;
  expiry_date: string | null;
  status: DocumentStatus;
  review_status: string;
  file_available: boolean;
  created_at: string;
};

type DriverOption = { id: string; display_name: string; status?: string | null };
type VehicleOption = { id: string; reg_plate: string | null; registration?: string | null };

type UploadForm = {
  kind: DocumentKind;
  subjectId: string;
  docType: string;
  issuedDate: string;
  expiryDate: string;
  file: File | null;
};

const DRIVER_DOC_TYPES = [
  { value: 'driving_licence', label: 'Driving Licence', required: true },
  { value: 'proof_of_address', label: 'Proof of Address', required: true },
  { value: 'right_to_work', label: 'Right to Work', required: true },
  { value: 'cpc', label: 'Driver CPC', required: false },
  { value: 'visa_document', label: 'Visa / Immigration Document', required: false },
] as const;

const VEHICLE_DOC_TYPES = [
  { value: 'mot', label: 'MOT', required: true },
  { value: 'insurance', label: 'Vehicle Insurance', required: true },
  { value: 'road_tax', label: 'Road Tax', required: false },
  { value: 'operator_licence', label: 'Operator Licence', required: false },
  { value: 'goods_vehicle_test', label: 'Goods Vehicle Test', required: false },
  { value: 'other', label: 'Other', required: false },
] as const;

const DEFAULT_UPLOAD: UploadForm = {
  kind: 'driver',
  subjectId: '',
  docType: '',
  issuedDate: '',
  expiryDate: '',
  file: null,
};

const labelForDocType = (kind: DocumentKind, value: string) => {
  const source = kind === 'driver' ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES;
  return source.find((item) => item.value === value)?.label ?? value.replace(/_/g, ' ');
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const requestedType = searchParams.get('type');
  const pendingOnly = searchParams.get('view') === 'pending';
  const companyId = user?.companyId ?? null;

  const [tab, setTab] = useState<DocumentKind>(requestedType === 'vehicle' ? 'vehicle' : 'driver');
  const [docs, setDocs] = useState<AdminDocumentRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState<UploadForm>(DEFAULT_UPLOAD);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [docsPage, setDocsPage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const DOCS_PER_PAGE = 12;

  useEffect(() => {
    if (requestedType === 'driver' || requestedType === 'vehicle') setTab(requestedType);
  }, [requestedType]);

  const loadDocs = async () => {
    setLoading(true);
    setError('');
    if (!companyId) {
      setDocs([]);
      setLoading(false);
      return;
    }

    const { accessToken, error: tokenError } = await getAccessToken();
    if (tokenError || !accessToken) {
      setDocs([]);
      setError(tokenError ?? 'Session expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const response = await fetch(
      `/api/admin/documents?companyId=${encodeURIComponent(companyId)}&kind=${encodeURIComponent(tab)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
    );
    const payload = await response.json().catch(() => ({} as { error?: string; rows?: AdminDocumentRow[] }));
    if (!response.ok) {
      setDocs([]);
      setError(payload.error ?? 'Unable to load compliance documents.');
    } else {
      setDocs(Array.isArray(payload.rows) ? payload.rows : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadDocs();
  }, [tab, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDocsPage(0);
  }, [tab, docs.length, pendingOnly]);

  useEffect(() => {
    if (!companyId || !isSupabaseConfigured) return;
    // Pending/inactive Drivers MUST remain visible here: their compliance evidence
    // is exactly what is required before canonical activation can occur.
    supabase
      .from('drivers')
      .select('id, display_name, status')
      .eq('company_id', companyId)
      .order('display_name')
      .then(({ data }) => setDrivers((data ?? []) as DriverOption[]));
    supabase
      .from('vehicles')
      .select('id, reg_plate, registration')
      .eq('company_id', companyId)
      .order('reg_plate')
      .then(({ data }) => setVehicles((data ?? []) as VehicleOption[]));
  }, [companyId]);

  const handleUpload = async () => {
    if (!companyId || !form.subjectId || !form.docType || !form.file) {
      setUploadError('Choose the Driver/Vehicle, document category and file.');
      return;
    }
    if (form.file.size > 10 * 1024 * 1024) {
      setUploadError('File must be 10 MB or smaller.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const { accessToken, error: tokenError } = await getAccessToken();
      if (tokenError || !accessToken) {
        setUploadError(tokenError ?? 'Session expired. Please sign in again.');
        return;
      }

      const body = new FormData();
      body.append('companyId', companyId);
      body.append('kind', form.kind);
      body.append('subjectId', form.subjectId);
      body.append('docType', form.docType);
      body.append('issuedDate', form.issuedDate);
      body.append('expiryDate', form.expiryDate);
      body.append('file', form.file);

      const response = await fetch('/api/admin/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      });
      const payload = await response.json().catch(() => ({} as { error?: string }));
      if (!response.ok) {
        setUploadError(payload.error ?? 'Document upload could not be completed.');
        return;
      }

      const completedKind = form.kind;
      setForm(DEFAULT_UPLOAD);
      if (fileRef.current) fileRef.current.value = '';
      setShowUpload(false);
      setTab(completedKind);
      await loadDocs();
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async (docRow: AdminDocumentRow, download: boolean) => {
    if (!companyId) return;
    setError('');
    const { accessToken, error: tokenError } = await getAccessToken();
    if (tokenError || !accessToken) {
      setError(tokenError ?? 'Session expired. Please sign in again.');
      return;
    }

    const params = new URLSearchParams({
      companyId,
      kind: docRow.kind,
      id: docRow.id,
      ...(download ? { download: '1' } : {}),
    });
    const response = await fetch(`/api/admin/documents/signed-url?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({} as { error?: string; url?: string; fileName?: string }));
    if (!response.ok || !payload.url) {
      setError(payload.error ?? 'Secure document link could not be created.');
      return;
    }

    if (!download) {
      window.open(payload.url, '_blank', 'noopener,noreferrer');
      return;
    }

    const link = window.document.createElement('a');
    link.href = payload.url;
    link.download = payload.fileName ?? `document-${docRow.id}`;
    link.rel = 'noopener noreferrer';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const visibleDocs = pendingOnly ? docs.filter((document) => document.status === 'pending') : docs;
  const totalDocsPages = Math.max(1, Math.ceil(visibleDocs.length / DOCS_PER_PAGE));
  const safeDocsPage = Math.min(docsPage, totalDocsPages - 1);
  const paginatedDocs = visibleDocs.slice(safeDocsPage * DOCS_PER_PAGE, (safeDocsPage + 1) * DOCS_PER_PAGE);
  const docTypes = form.kind === 'driver' ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES;
  const selectedVehicleReadinessDoc = form.kind === 'vehicle' && ['mot', 'insurance'].includes(form.docType);

  return (
    <ProtectedRoute>
      <div className="carrier-register-page carrier-register-page--documents">
        <div style={{ width: '100%' }}>
          <div className="carrier-register-toolbar">
            <h1 className="carrier-register-title">Fleet Compliance Documents</h1>
            <p className="carrier-register-subtitle">
              Submit Driver identity and Vehicle compliance evidence. Platform Owner review controls approval; operational readiness updates from the canonical compliance state.
            </p>
          </div>

          <AlertBanner tone="info"><strong>Activation rule:</strong> creating a Driver is not enough. Required Driver evidence must be verified, exactly one active Vehicle must be assigned, and current MOT + Vehicle Insurance must be approved before the Driver becomes operationally ready.</AlertBanner>

          {!isSupabaseConfigured ? <AlertBanner tone="warning">Supabase is not configured. Database features are disabled.</AlertBanner> : null}
          {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="workspace-tab-strip" role="tablist" aria-label="Compliance document type" style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
              <button type="button" role="tab" aria-selected={tab === 'driver'} data-active={tab === 'driver' ? 'true' : 'false'} onClick={() => setTab('driver')}>Driver Identity</button>
              <button type="button" role="tab" aria-selected={tab === 'vehicle'} data-active={tab === 'vehicle' ? 'true' : 'false'} onClick={() => setTab('vehicle')}>Vehicle Compliance</button>
            </div>
            <button
              onClick={() => {
                setForm({ ...DEFAULT_UPLOAD, kind: tab });
                setUploadError('');
                setShowUpload(true);
              }}
              disabled={!companyId}
              className="carrier-register-action"
            >
              + Upload Document
            </button>
          </div>

          {showUpload && (
            <div className="carrier-register-modal-overlay">
              <div className="carrier-register-modal carrier-register-modal--documents" style={{ maxWidth: '540px' }}>
                <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.4rem', fontWeight: '700', color: '#1f2937' }}>Upload Compliance Document</h2>
                <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.86rem' }}>The file is stored privately and submitted for Platform Owner compliance review.</p>
                {uploadError ? <AlertBanner tone="danger">{uploadError}</AlertBanner> : null}

                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>Evidence for *</label>
                    <select
                      value={form.kind}
                      onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as DocumentKind, subjectId: '', docType: '' }))}
                      style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    >
                      <option value="driver">Driver Identity</option>
                      <option value="vehicle">Vehicle Compliance</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>{form.kind === 'driver' ? 'Driver' : 'Vehicle'} *</label>
                    <select
                      value={form.subjectId}
                      onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    >
                      <option value="">Select</option>
                      {form.kind === 'driver'
                        ? drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>{driver.display_name} {driver.status ? `(${driver.status})` : ''}</option>
                          ))
                        : vehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>{vehicle.reg_plate || vehicle.registration || 'Vehicle'}</option>
                          ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>Document category *</label>
                    <select
                      value={form.docType}
                      onChange={(event) => setForm((current) => ({ ...current, docType: event.target.value }))}
                      style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    >
                      <option value="">Select</option>
                      {docTypes.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}{item.required ? ' - required' : ' - conditional / optional'}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>Issued date</label>
                      <input type="date" value={form.issuedDate} onChange={(event) => setForm((current) => ({ ...current, issuedDate: event.target.value }))} style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>Expiry date {selectedVehicleReadinessDoc ? '*' : ''}</label>
                      <input type="date" value={form.expiryDate} onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))} style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>File * (PDF, JPG, PNG, WEBP - max 10 MB)</label>
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10 }}>
                  <ActionButton tone="secondary" onClick={() => { setShowUpload(false); setForm(DEFAULT_UPLOAD); setUploadError(''); }} disabled={uploading}>Cancel</ActionButton>
                  <ActionButton tone="success" onClick={() => void handleUpload()} disabled={uploading}>{uploading ? 'Uploading…' : 'Submit for Review'}</ActionButton>
                </div>
              </div>
            </div>
          )}

          <section className="carrier-register-results" aria-label="Compliance documents">
            {loading ? (
              <div className="carrier-register-empty" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : visibleDocs.length === 0 ? (
              <div className="carrier-register-empty" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
                <p style={{ margin: 0 }}>{pendingOnly ? 'No pending documents found.' : 'No compliance documents found.'}</p>
              </div>
            ) : (
              <>
                <div className="carrier-register-table-wrap">
                  <table className="carrier-register-table">
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        {[tab === 'driver' ? 'Driver' : 'Vehicle', 'Document', 'Issued', 'Expires', 'Status', 'Review', 'Actions'].map((heading) => (
                          <th key={heading} style={{ padding: '0.9rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDocs.map((item, index) => {
                        const documentStatusTone = item.status === 'approved' ? 'green' : item.status === 'pending' ? 'orange' : 'red';
                        return (
                          <tr key={item.id} style={{ borderBottom: index < paginatedDocs.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                            <td style={{ padding: '0.9rem', fontWeight: '700', color: '#1f2937' }}>{item.subject_name}</td>
                            <td style={{ padding: '0.9rem', color: '#475569' }}>{labelForDocType(item.kind, item.doc_type)}</td>
                            <td style={{ padding: '0.9rem', color: '#64748b' }}>{item.issued_date || '-'}</td>
                            <td style={{ padding: '0.9rem', color: '#64748b' }}>{item.expiry_date || '-'}</td>
                            <td style={{ padding: '0.9rem' }}><StatusBadge value={item.status} tone={documentStatusTone} /></td>
                            <td style={{ padding: '0.9rem', color: '#64748b', fontSize: '0.82rem' }}>{item.review_status.replace(/_/g, ' ')}</td>
                            <td style={{ padding: '0.9rem' }}>
                              {item.file_available ? (
                                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => void openDocument(item, false)} style={{ padding: '0.38rem 0.75rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>View</button>
                                  <button onClick={() => void openDocument(item, true)} style={{ padding: '0.38rem 0.75rem', backgroundColor: '#ecfdf5', color: '#065f46', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>Download</button>
                                </div>
                              ) : <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>No file</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {visibleDocs.length > DOCS_PER_PAGE && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                    <span>Showing {safeDocsPage * DOCS_PER_PAGE + 1}-{Math.min((safeDocsPage + 1) * DOCS_PER_PAGE, visibleDocs.length)} of {visibleDocs.length}</span>
                    <div style={{ display: 'flex', gap: '0.45rem' }}>
                      <button onClick={() => setDocsPage((page) => Math.max(page - 1, 0))} disabled={safeDocsPage === 0} style={{ padding: '0.35rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: safeDocsPage === 0 ? 'not-allowed' : 'pointer' }}>Previous</button>
                      <button onClick={() => setDocsPage((page) => Math.min(page + 1, totalDocsPages - 1))} disabled={safeDocsPage >= totalDocsPages - 1} style={{ padding: '0.35rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: safeDocsPage >= totalDocsPages - 1 ? 'not-allowed' : 'pointer' }}>Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </ProtectedRoute>
  );
}
