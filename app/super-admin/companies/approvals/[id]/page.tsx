'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type Company = {
  id: string;
  name: string;
  company_number: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  status: string;
  company_type: string | null;
  created_at: string;
};

type Application = {
  id: string;
  user_id: string;
  email: string;
  account_type: string;
  status: string;
  company_id: string | null;
  current_step: string;
  completion_percentage: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  payload: Record<string, unknown>;
};

type Readiness = {
  requiredDocuments: string[];
  missingDocuments: string[];
  unverifiedDocuments: string[];
  uploadReady: boolean;
  approvalReady: boolean;
};

type ReviewDocument = {
  id: string;
  kind: 'company' | 'driver';
  doc_type: string;
  file_path: string | null;
  status?: string | null;
  upload_status?: string | null;
  verification_status?: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  expiry_date: string | null;
  updated_at: string;
  signedUrl: string | null;
};

type SummaryResponse = {
  company?: Company;
  application?: Application | null;
  readiness?: Readiness | null;
  legacyCompanyWithoutOnboarding?: boolean;
  error?: string;
};

type DocumentsResponse = {
  application?: Application;
  documents?: ReviewDocument[];
  readiness?: Readiness;
  error?: string;
};

const THEME = {
  page: '#f4f6f8',
  card: '#ffffff',
  border: '#d7e0ea',
  text: '#0f172a',
  muted: '#64748b',
  navy: '#0b2f6b',
  blue: '#1d57d8',
  green: '#15803d',
  greenBg: '#ecfdf5',
  red: '#b91c1c',
  redBg: '#fef2f2',
  amber: '#92400e',
  amberBg: '#fffbeb',
};

const humanize = (value: string | null | undefined) =>
  (value ?? 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const documentStatus = (document: ReviewDocument) =>
  document.verification_status ?? document.status ?? document.upload_status ?? 'missing';

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const success = ['approved', 'verified', 'active'].includes(normalized);
  const danger = ['rejected', 'expired', 'missing'].includes(normalized);
  const background = success ? THEME.greenBg : danger ? THEME.redBg : THEME.amberBg;
  const color = success ? THEME.green : danger ? THEME.red : THEME.amber;

  return (
    <span style={{ display: 'inline-flex', borderRadius: 999, background, color, padding: '0.22rem 0.5rem', fontSize: '0.68rem', fontWeight: 850 }}>
      {humanize(status)}
    </span>
  );
}

function ReviewContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const companyId = decodeURIComponent(params?.id ?? '');

  const [company, setCompany] = useState<Company | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [documents, setDocuments] = useState<ReviewDocument[]>([]);
  const [legacyCompany, setLegacyCompany] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [applicationNotes, setApplicationNotes] = useState('');

  const fetchJson = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const auth = await getAuthHeader();
    if (!auth) throw new Error('No active Super Admin session.');

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: auth,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `Request failed with HTTP ${response.status}.`);
    return payload;
  }, []);

  const loadReview = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError('');

    try {
      const summary = await fetchJson<SummaryResponse>(`/api/super-admin/companies/${encodeURIComponent(companyId)}/onboarding`);
      setCompany(summary.company ?? null);
      setApplication(summary.application ?? null);
      setReadiness(summary.readiness ?? null);
      setLegacyCompany(Boolean(summary.legacyCompanyWithoutOnboarding));

      if (!summary.application?.id) {
        setDocuments([]);
        return;
      }

      const details = await fetchJson<DocumentsResponse>(`/api/super-admin/onboarding/${encodeURIComponent(summary.application.id)}/documents`);
      const nextDocuments = details.documents ?? [];
      setDocuments(nextDocuments);
      setReadiness(details.readiness ?? summary.readiness ?? null);
      setApplication(details.application ?? summary.application);
      setReviewNotes(Object.fromEntries(nextDocuments.map((document) => [document.id, document.review_notes ?? ''])));
      setExpiryDates(Object.fromEntries(nextDocuments.map((document) => [document.id, document.expiry_date ?? ''])));
      setApplicationNotes(details.application?.review_notes ?? summary.application.review_notes ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load onboarding review.');
    } finally {
      setLoading(false);
    }
  }, [companyId, fetchJson]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const requiredSet = useMemo(() => new Set(readiness?.requiredDocuments ?? []), [readiness?.requiredDocuments]);

  const reviewDocument = async (document: ReviewDocument, action: 'approve' | 'reject') => {
    if (!application?.id || actingKey) return;
    setActingKey(`${action}:${document.id}`);
    setError('');
    setMessage('');

    try {
      const payload = await fetchJson<{ readiness?: Readiness }>(
        `/api/super-admin/onboarding/${encodeURIComponent(application.id)}/documents`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            kind: document.kind,
            documentId: document.id,
            action,
            notes: reviewNotes[document.id]?.trim() || undefined,
            expiryDate: expiryDates[document.id] || null,
          }),
        },
      );
      setReadiness(payload.readiness ?? readiness);
      setMessage(`${humanize(document.doc_type)} ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await loadReview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document review failed.');
    } finally {
      setActingKey(null);
    }
  };

  const reviewApplication = async (action: 'approve' | 'reject' | 'request_changes') => {
    if (!application?.id || actingKey) return;
    if (action === 'approve' && !readiness?.approvalReady) {
      setError('All mandatory documents must be uploaded and verified before approval.');
      return;
    }

    const label = action === 'request_changes' ? 'request changes' : action;
    if (!window.confirm(`Confirm ${label} for this onboarding application?`)) return;

    setActingKey(`application:${action}`);
    setError('');
    setMessage('');
    try {
      await fetchJson(`/api/super-admin/onboarding/${encodeURIComponent(application.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, notes: applicationNotes.trim() || undefined }),
      });
      setMessage(`Onboarding ${action === 'request_changes' ? 'returned for changes' : `${action}d`} successfully.`);
      await loadReview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Onboarding review failed.');
    } finally {
      setActingKey(null);
    }
  };

  if (loading) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: THEME.page, color: THEME.muted }}>Loading compliance review…</main>;
  }

  return (
    <main style={{ minHeight: '100vh', background: THEME.page, padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <button
          onClick={() => router.push('/super-admin/companies/approvals')}
          style={{ border: 0, background: 'transparent', color: THEME.blue, padding: 0, marginBottom: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
        >
          ← Back to approvals
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, color: THEME.navy, fontSize: 'clamp(1.45rem, 3vw, 2rem)' }}>Compliance Review</h1>
            <p style={{ margin: '0.35rem 0 0', color: THEME.muted }}>
              Review private evidence before granting XDrive marketplace and driver access.
            </p>
          </div>
          {application && <StatusBadge status={application.status} />}
        </div>

        {error && <div style={{ border: '1px solid #fecaca', background: THEME.redBg, color: THEME.red, borderRadius: 10, padding: '0.75rem 0.9rem', marginBottom: '1rem' }}>{error}</div>}
        {message && <div style={{ border: '1px solid #bbf7d0', background: THEME.greenBg, color: THEME.green, borderRadius: 10, padding: '0.75rem 0.9rem', marginBottom: '1rem' }}>{message}</div>}

        <section style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.8rem' }}>
            <div><div style={{ color: THEME.muted, fontSize: '0.7rem', fontWeight: 800 }}>COMPANY</div><div style={{ marginTop: '0.2rem', fontWeight: 850, color: THEME.text }}>{company?.name ?? 'Unknown company'}</div></div>
            <div><div style={{ color: THEME.muted, fontSize: '0.7rem', fontWeight: 800 }}>TYPE</div><div style={{ marginTop: '0.2rem', color: THEME.text }}>{humanize(company?.company_type)}</div></div>
            <div><div style={{ color: THEME.muted, fontSize: '0.7rem', fontWeight: 800 }}>COMPANY NUMBER</div><div style={{ marginTop: '0.2rem', color: THEME.text }}>{company?.company_number ?? '—'}</div></div>
            <div><div style={{ color: THEME.muted, fontSize: '0.7rem', fontWeight: 800 }}>VAT</div><div style={{ marginTop: '0.2rem', color: THEME.text }}>{company?.vat_number ?? '—'}</div></div>
            <div><div style={{ color: THEME.muted, fontSize: '0.7rem', fontWeight: 800 }}>APPLICANT</div><div style={{ marginTop: '0.2rem', color: THEME.text }}>{application?.email ?? company?.email ?? '—'}</div></div>
            <div><div style={{ color: THEME.muted, fontSize: '0.7rem', fontWeight: 800 }}>SUBMITTED</div><div style={{ marginTop: '0.2rem', color: THEME.text }}>{formatDate(application?.submitted_at)}</div></div>
          </div>
        </section>

        {legacyCompany || !application ? (
          <section style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: '1.2rem' }}>
            <h2 style={{ margin: 0, color: THEME.text, fontSize: '1.05rem' }}>Legacy company record</h2>
            <p style={{ color: THEME.muted, lineHeight: 1.55, marginBottom: 0 }}>
              This company has no linked onboarding application. It can still be governed through the company status workflow, but no onboarding evidence can be verified here.
            </p>
          </section>
        ) : (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: readiness?.uploadReady ? THEME.greenBg : THEME.redBg, border: `1px solid ${readiness?.uploadReady ? '#bbf7d0' : '#fecaca'}`, borderRadius: 12, padding: '0.9rem' }}>
                <div style={{ color: readiness?.uploadReady ? THEME.green : THEME.red, fontWeight: 900 }}>Mandatory uploads</div>
                <div style={{ marginTop: '0.25rem', color: THEME.muted, fontSize: '0.8rem' }}>{readiness?.uploadReady ? 'All required files are present.' : `${readiness?.missingDocuments.length ?? 0} required file(s) missing.`}</div>
              </div>
              <div style={{ background: readiness?.approvalReady ? THEME.greenBg : THEME.amberBg, border: `1px solid ${readiness?.approvalReady ? '#bbf7d0' : '#fde68a'}`, borderRadius: 12, padding: '0.9rem' }}>
                <div style={{ color: readiness?.approvalReady ? THEME.green : THEME.amber, fontWeight: 900 }}>Approval readiness</div>
                <div style={{ marginTop: '0.25rem', color: THEME.muted, fontSize: '0.8rem' }}>{readiness?.approvalReady ? 'All mandatory evidence is verified.' : `${readiness?.unverifiedDocuments.length ?? 0} required document(s) still unverified.`}</div>
              </div>
            </section>

            {(readiness?.missingDocuments.length || readiness?.unverifiedDocuments.length) ? (
              <section style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: '0.9rem', marginBottom: '1rem' }}>
                {Boolean(readiness?.missingDocuments.length) && <p style={{ margin: '0 0 0.35rem', color: THEME.red }}><strong>Missing:</strong> {readiness?.missingDocuments.map(humanize).join(', ')}</p>}
                {Boolean(readiness?.unverifiedDocuments.length) && <p style={{ margin: 0, color: THEME.amber }}><strong>Not verified:</strong> {readiness?.unverifiedDocuments.map(humanize).join(', ')}</p>}
              </section>
            ) : null}

            <section style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ padding: '0.9rem 1rem', borderBottom: `1px solid ${THEME.border}` }}>
                <h2 style={{ margin: 0, color: THEME.text, fontSize: '1.05rem' }}>Private compliance documents</h2>
                <p style={{ margin: '0.25rem 0 0', color: THEME.muted, fontSize: '0.78rem' }}>Signed preview links expire after ten minutes.</p>
              </div>

              {documents.length === 0 ? (
                <div style={{ padding: '1.2rem', color: THEME.muted }}>No evidence records found.</div>
              ) : (
                <div style={{ display: 'grid' }}>
                  {documents.map((document) => {
                    const status = documentStatus(document);
                    const required = requiredSet.has(document.doc_type);
                    return (
                      <article key={document.id} style={{ padding: '1rem', borderBottom: `1px solid ${THEME.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.7rem', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <strong style={{ color: THEME.text }}>{humanize(document.doc_type)}</strong>
                              {required && <span style={{ color: THEME.red, fontSize: '0.65rem', fontWeight: 900 }}>REQUIRED</span>}
                              <StatusBadge status={status} />
                            </div>
                            <div style={{ marginTop: '0.25rem', color: THEME.muted, fontSize: '0.72rem' }}>Updated {formatDate(document.updated_at)}</div>
                          </div>
                          {document.signedUrl ? (
                            <a href={document.signedUrl} target="_blank" rel="noreferrer" style={{ color: THEME.blue, fontWeight: 850, textDecoration: 'none', fontSize: '0.78rem' }}>
                              Open private document ↗
                            </a>
                          ) : (
                            <span style={{ color: THEME.red, fontSize: '0.75rem', fontWeight: 750 }}>No file uploaded</span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(170px, 0.5fr)', gap: '0.65rem', marginTop: '0.75rem' }}>
                          <label style={{ color: THEME.muted, fontSize: '0.72rem' }}>
                            Review notes
                            <textarea
                              value={reviewNotes[document.id] ?? ''}
                              onChange={(event) => setReviewNotes((current) => ({ ...current, [document.id]: event.target.value }))}
                              rows={2}
                              style={{ width: '100%', marginTop: '0.25rem', border: `1px solid ${THEME.border}`, borderRadius: 8, padding: '0.55rem', resize: 'vertical' }}
                            />
                          </label>
                          <label style={{ color: THEME.muted, fontSize: '0.72rem' }}>
                            Expiry date
                            <input
                              type="date"
                              value={expiryDates[document.id] ?? ''}
                              onChange={(event) => setExpiryDates((current) => ({ ...current, [document.id]: event.target.value }))}
                              style={{ width: '100%', marginTop: '0.25rem', border: `1px solid ${THEME.border}`, borderRadius: 8, padding: '0.55rem' }}
                            />
                          </label>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                          <button
                            disabled={!document.signedUrl || actingKey !== null}
                            onClick={() => void reviewDocument(document, 'approve')}
                            style={{ border: 0, borderRadius: 8, background: THEME.green, color: '#fff', padding: '0.5rem 0.75rem', fontWeight: 850, cursor: !document.signedUrl || actingKey ? 'not-allowed' : 'pointer', opacity: !document.signedUrl || actingKey ? 0.55 : 1 }}
                          >
                            {actingKey === `approve:${document.id}` ? 'Approving…' : 'Approve document'}
                          </button>
                          <button
                            disabled={!document.signedUrl || actingKey !== null}
                            onClick={() => void reviewDocument(document, 'reject')}
                            style={{ border: '1px solid #fecaca', borderRadius: 8, background: '#fff', color: THEME.red, padding: '0.5rem 0.75rem', fontWeight: 850, cursor: !document.signedUrl || actingKey ? 'not-allowed' : 'pointer', opacity: !document.signedUrl || actingKey ? 0.55 : 1 }}
                          >
                            {actingKey === `reject:${document.id}` ? 'Rejecting…' : 'Reject document'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: '1rem' }}>
              <h2 style={{ margin: 0, color: THEME.text, fontSize: '1.05rem' }}>Application decision</h2>
              <label style={{ display: 'block', color: THEME.muted, fontSize: '0.75rem', marginTop: '0.7rem' }}>
                Decision notes
                <textarea
                  value={applicationNotes}
                  onChange={(event) => setApplicationNotes(event.target.value)}
                  rows={3}
                  style={{ width: '100%', marginTop: '0.25rem', border: `1px solid ${THEME.border}`, borderRadius: 8, padding: '0.6rem', resize: 'vertical' }}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  disabled={!readiness?.approvalReady || actingKey !== null || application.status === 'approved'}
                  onClick={() => void reviewApplication('approve')}
                  style={{ border: 0, borderRadius: 8, background: THEME.green, color: '#fff', padding: '0.62rem 0.85rem', fontWeight: 900, cursor: !readiness?.approvalReady || actingKey ? 'not-allowed' : 'pointer', opacity: !readiness?.approvalReady || actingKey ? 0.55 : 1 }}
                >
                  {actingKey === 'application:approve' ? 'Approving…' : 'Approve onboarding'}
                </button>
                <button
                  disabled={actingKey !== null || application.status === 'approved'}
                  onClick={() => void reviewApplication('request_changes')}
                  style={{ border: '1px solid #fde68a', borderRadius: 8, background: THEME.amberBg, color: THEME.amber, padding: '0.62rem 0.85rem', fontWeight: 900, cursor: actingKey ? 'not-allowed' : 'pointer' }}
                >
                  {actingKey === 'application:request_changes' ? 'Sending…' : 'Request changes'}
                </button>
                <button
                  disabled={actingKey !== null || application.status === 'approved'}
                  onClick={() => void reviewApplication('reject')}
                  style={{ border: '1px solid #fecaca', borderRadius: 8, background: THEME.redBg, color: THEME.red, padding: '0.62rem 0.85rem', fontWeight: 900, cursor: actingKey ? 'not-allowed' : 'pointer' }}
                >
                  {actingKey === 'application:reject' ? 'Rejecting…' : 'Reject onboarding'}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <ReviewContent />
    </ProtectedRoute>
  );
}
