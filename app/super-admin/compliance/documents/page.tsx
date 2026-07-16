'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, FileCheck2, LoaderCircle, RefreshCw, X, XCircle } from 'lucide-react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { StatusChip, formatDate, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { SUPER_ADMIN_THEME, superAdminCardStyle } from '@/app/super-admin/_components/superAdminTheme';

type DocumentRow = {
  id: string;
  entity_type: 'driver' | 'vehicle';
  entity_name: string;
  company_name: string;
  doc_type: string;
  status: string;
  expiry_date: string | null;
  issued_date: string | null;
  rejection_reason: string | null;
  verified_at: string | null;
  created_at: string;
  is_expired: boolean;
};

type Summary = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  expired: number;
};

const endpoint = '/api/super-admin/compliance?section=documents&limit=250';
const emptySummary: Summary = { total: 0, approved: 0, pending: 0, rejected: 0, expired: 0 };

const actionButton = (tone: 'neutral' | 'success' | 'danger'): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.35rem',
  minHeight: '34px',
  padding: '0.42rem 0.65rem',
  borderRadius: '7px',
  border: tone === 'neutral' ? `1px solid ${SUPER_ADMIN_THEME.cardBorder}` : '1px solid transparent',
  backgroundColor: tone === 'success' ? SUPER_ADMIN_THEME.success : tone === 'danger' ? SUPER_ADMIN_THEME.danger : '#FFFFFF',
  color: tone === 'neutral' ? SUPER_ADMIN_THEME.text : '#FFFFFF',
  fontSize: '0.74rem',
  fontWeight: 700,
  cursor: 'pointer',
});

export default function Page() {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DocumentRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active session.');
      const response = await fetch(endpoint, { headers: { Authorization: auth } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
      setRows(Array.isArray(body.rows) ? body.rows : []);
      setSummary(body.summary ?? emptySummary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const callDocumentApi = async (method: 'POST' | 'PATCH', payload: Record<string, unknown>) => {
    const auth = await getAuthHeader();
    if (!auth) throw new Error('No active session.');
    const response = await fetch('/api/super-admin/compliance', {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
    return body as Record<string, unknown>;
  };

  const openDocument = async (row: DocumentRow) => {
    setActiveDocumentId(row.id);
    setError(null);
    setNotice(null);
    const previewWindow = window.open('', '_blank');
    try {
      const body = await callDocumentApi('POST', {
        action: 'view',
        documentId: row.id,
        entityType: row.entity_type,
      });
      const signedUrl = typeof body.signedUrl === 'string' ? body.signedUrl : null;
      if (!signedUrl) throw new Error('The secure document link was not returned.');
      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.replace(signedUrl);
      } else {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (viewError) {
      previewWindow?.close();
      setError(viewError instanceof Error ? viewError.message : 'Unable to open the document.');
    } finally {
      setActiveDocumentId(null);
    }
  };

  const reviewDocument = async (row: DocumentRow, action: 'approve' | 'reject', reason?: string) => {
    setActiveDocumentId(row.id);
    setError(null);
    setNotice(null);
    try {
      await callDocumentApi('PATCH', {
        action,
        documentId: row.id,
        entityType: row.entity_type,
        reason,
      });
      setNotice(action === 'approve' ? 'Document approved successfully.' : 'Document rejected and the reason was recorded.');
      setRejectTarget(null);
      setRejectionReason('');
      await loadDocuments();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to save the review decision.');
    } finally {
      setActiveDocumentId(null);
    }
  };

  const submitRejection = () => {
    if (!rejectTarget || !rejectionReason.trim()) return;
    void reviewDocument(rejectTarget, 'reject', rejectionReason.trim());
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: SUPER_ADMIN_THEME.pageBg, padding: '1.25rem' }}>
        <div style={{ ...superAdminCardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '1rem 1.1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, display: 'grid', placeItems: 'center', background: SUPER_ADMIN_THEME.primarySurface, color: SUPER_ADMIN_THEME.primary }}>
              <FileCheck2 size={22} aria-hidden="true" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: SUPER_ADMIN_THEME.text, margin: 0 }}>Document Review</h1>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: SUPER_ADMIN_THEME.primary, backgroundColor: SUPER_ADMIN_THEME.primarySoft, padding: '0.18rem 0.5rem', borderRadius: 999 }}>Compliance</span>
              </div>
              <p style={{ color: SUPER_ADMIN_THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Open, verify, approve, or reject every driver and vehicle document across the platform.</p>
            </div>
          </div>
          <button type="button" onClick={() => void loadDocuments()} disabled={loading} style={{ ...actionButton('neutral'), opacity: loading ? 0.65 : 1 }}>
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </div>

        {error && <div role="alert" style={{ backgroundColor: '#F4F6F8', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: 8, padding: '0.7rem 0.9rem', color: SUPER_ADMIN_THEME.danger, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</div>}
        {notice && <div role="status" style={{ backgroundColor: '#F4F6F8', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: 8, padding: '0.7rem 0.9rem', color: SUPER_ADMIN_THEME.success, fontSize: '0.82rem', marginBottom: '1rem' }}>{notice}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} style={{ ...superAdminCardStyle, boxShadow: 'none', padding: '0.65rem 0.8rem' }}>
              <div style={{ color: SUPER_ADMIN_THEME.text, fontSize: '1.05rem', fontWeight: 750 }}>{value.toLocaleString()}</div>
              <div style={{ color: SUPER_ADMIN_THEME.muted, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.15rem' }}>{key}</div>
            </div>
          ))}
        </div>

        <div style={{ ...superAdminCardStyle, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2.5rem', display: 'grid', placeItems: 'center', gap: '0.65rem', color: SUPER_ADMIN_THEME.muted, fontSize: '0.86rem' }}>
              <LoaderCircle size={22} className="animate-spin" aria-hidden="true" /> Loading documents…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: SUPER_ADMIN_THEME.muted, fontSize: '0.86rem' }}>No documents found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120, fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${SUPER_ADMIN_THEME.cardBorder}`, backgroundColor: '#F4F6F8' }}>
                    {['Owner', 'Company', 'Document Type', 'Status', 'Expiry', 'Uploaded', 'Review Actions'].map((label) => (
                      <th key={label} style={{ padding: '0.75rem 0.9rem', textAlign: 'left', color: SUPER_ADMIN_THEME.muted, fontWeight: 650, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const busy = activeDocumentId === row.id;
                    return (
                      <tr key={`${row.entity_type}-${row.id}`} style={{ borderBottom: `1px solid ${SUPER_ADMIN_THEME.cardBorder}` }}>
                        <td style={{ padding: '0.8rem 0.9rem', color: SUPER_ADMIN_THEME.text, verticalAlign: 'top' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 650 }}>{row.entity_name}</div>
                          <div style={{ fontSize: '0.68rem', color: SUPER_ADMIN_THEME.subtle, textTransform: 'capitalize', marginTop: 2 }}>{row.entity_type}</div>
                        </td>
                        <td style={{ padding: '0.8rem 0.9rem', color: SUPER_ADMIN_THEME.text, verticalAlign: 'top', fontSize: '0.78rem' }}>{row.company_name}</td>
                        <td style={{ padding: '0.8rem 0.9rem', color: SUPER_ADMIN_THEME.text, verticalAlign: 'top' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{row.doc_type}</div>
                          {row.issued_date && <div style={{ fontSize: '0.67rem', color: SUPER_ADMIN_THEME.subtle, marginTop: 3 }}>Issued {formatDate(row.issued_date)}</div>}
                          {row.rejection_reason && <div style={{ maxWidth: 220, fontSize: '0.67rem', color: SUPER_ADMIN_THEME.danger, marginTop: 4 }}>Reason: {row.rejection_reason}</div>}
                        </td>
                        <td style={{ padding: '0.8rem 0.9rem', verticalAlign: 'top' }}>
                          <StatusChip value={row.status} />
                          {row.verified_at && <div style={{ fontSize: '0.65rem', color: SUPER_ADMIN_THEME.subtle, marginTop: 4 }}>{formatDateTime(row.verified_at)}</div>}
                        </td>
                        <td style={{ padding: '0.8rem 0.9rem', color: row.is_expired ? SUPER_ADMIN_THEME.danger : SUPER_ADMIN_THEME.text, verticalAlign: 'top', fontSize: '0.75rem', fontWeight: row.is_expired ? 700 : 400 }}>
                          {formatDate(row.expiry_date)}{row.is_expired ? ' · Expired' : ''}
                        </td>
                        <td style={{ padding: '0.8rem 0.9rem', color: SUPER_ADMIN_THEME.text, verticalAlign: 'top', fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</td>
                        <td style={{ padding: '0.65rem 0.9rem', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => void openDocument(row)} disabled={busy} style={{ ...actionButton('neutral'), opacity: busy ? 0.6 : 1 }} aria-label={`Open ${row.doc_type} for ${row.entity_name}`}>
                              {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />} Open
                            </button>
                            <button type="button" onClick={() => void reviewDocument(row, 'approve')} disabled={busy || row.status === 'approved'} style={{ ...actionButton('success'), opacity: busy || row.status === 'approved' ? 0.45 : 1 }}>
                              <Check size={14} aria-hidden="true" /> Approve
                            </button>
                            <button type="button" onClick={() => { setRejectTarget(row); setRejectionReason(row.rejection_reason ?? ''); setError(null); }} disabled={busy || row.status === 'rejected'} style={{ ...actionButton('danger'), opacity: busy || row.status === 'rejected' ? 0.45 : 1 }}>
                              <XCircle size={14} aria-hidden="true" /> Reject
                            </button>
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

        {rejectTarget && (
          <div role="dialog" aria-modal="true" aria-labelledby="reject-title" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: '1rem', backgroundColor: 'rgba(26, 31, 43, 0.58)' }}>
            <div style={{ ...superAdminCardStyle, width: 'min(100%, 520px)', padding: '1.1rem', boxShadow: '0 24px 70px rgba(26, 31, 43, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                  <h2 id="reject-title" style={{ margin: 0, color: SUPER_ADMIN_THEME.text, fontSize: '1.05rem' }}>Reject document</h2>
                  <p style={{ margin: '0.35rem 0 0', color: SUPER_ADMIN_THEME.muted, fontSize: '0.8rem' }}>{rejectTarget.doc_type} · {rejectTarget.entity_name}</p>
                </div>
                <button type="button" onClick={() => setRejectTarget(null)} aria-label="Close rejection dialog" style={{ border: 0, background: 'transparent', color: SUPER_ADMIN_THEME.muted, cursor: 'pointer', padding: 4 }}><X size={18} aria-hidden="true" /></button>
              </div>
              <label htmlFor="rejection-reason" style={{ display: 'block', marginTop: '1rem', marginBottom: '0.35rem', color: SUPER_ADMIN_THEME.text, fontSize: '0.78rem', fontWeight: 700 }}>Rejection reason</label>
              <textarea id="rejection-reason" autoFocus rows={5} maxLength={2000} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Explain what must be corrected or uploaded again." style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', border: `1px solid ${SUPER_ADMIN_THEME.cardBorder}`, borderRadius: 8, padding: '0.7rem', color: SUPER_ADMIN_THEME.text, backgroundColor: '#FFFFFF', font: 'inherit', fontSize: '0.82rem', outlineColor: SUPER_ADMIN_THEME.primary }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setRejectTarget(null)} style={actionButton('neutral')}>Cancel</button>
                <button type="button" onClick={submitRejection} disabled={!rejectionReason.trim() || activeDocumentId === rejectTarget.id} style={{ ...actionButton('danger'), opacity: !rejectionReason.trim() || activeDocumentId === rejectTarget.id ? 0.5 : 1 }}>
                  {activeDocumentId === rejectTarget.id ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />} Confirm rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
