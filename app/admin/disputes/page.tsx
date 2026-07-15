'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'closed';

type DisputeRow = {
  id: string;
  job_id: string;
  raised_by_company_id: string;
  status: DisputeStatus;
  description: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  jobs: {
    id: string;
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    delivery_datetime: string | null;
    status: string;
  } | null;
  companies: {
    id: string;
    name: string;
  } | null;
};

const STATUS_STYLE: Record<DisputeStatus, { bg: string; color: string }> = {
  open: { bg: '#fee2e2', color: '#991b1b' },
  investigating: { bg: '#fef3c7', color: '#92400e' },
  resolved: { bg: '#dcfce7', color: '#166534' },
  closed: { bg: '#e2e8f0', color: '#334155' },
};

export default function AdminDisputesPage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DisputeStatus>('all');
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const DISPUTES_PER_PAGE = 10;
  const [disputePage, setDisputePage] = useState(0);

  // Resolution panel state
  const [resolveStatus, setResolveStatus] = useState<DisputeStatus>('resolved');
  const [resolveNote, setResolveNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    const resolveCompany = async () => {
      if (!hasSupabaseSession || !user?.id || !isSupabaseConfigured) {
        if (!cancelled) setCompanyId(null);
        return;
      }
      if (user.companyId) {
        if (!cancelled) setCompanyId(user.companyId);
        return;
      }
      const resolved = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: null });
      if (!cancelled) setCompanyId(resolved);
    };
    void resolveCompany();
    return () => { cancelled = true; };
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  const loadDisputes = async () => {
    if (!companyId || !isSupabaseConfigured) {
      setDisputes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: queryError } = await supabase
      .from('job_disputes')
      .select('id, job_id, raised_by_company_id, status, description, resolution_note, resolved_at, created_at, jobs(id, pickup_location, delivery_location, pickup_datetime, delivery_datetime, status), companies:raised_by_company_id(id, name)')
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(`Failed to load disputes: ${queryError.message}`);
      setDisputes([]);
      setLoading(false);
      return;
    }

    const normalized = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
      const jobsJoin = row.jobs as DisputeRow['jobs'] | DisputeRow['jobs'][] | null | undefined;
      const companiesJoin = row.companies as DisputeRow['companies'] | DisputeRow['companies'][] | null | undefined;
      return {
        id: row.id as string,
        job_id: row.job_id as string,
        raised_by_company_id: row.raised_by_company_id as string,
        status: (row.status as DisputeStatus) ?? 'open',
        description: (row.description as string) ?? '',
        resolution_note: (row.resolution_note as string | null) ?? null,
        resolved_at: (row.resolved_at as string | null) ?? null,
        created_at: (row.created_at as string) ?? new Date().toISOString(),
        jobs: Array.isArray(jobsJoin) ? (jobsJoin[0] ?? null) : (jobsJoin ?? null),
        companies: Array.isArray(companiesJoin) ? (companiesJoin[0] ?? null) : (companiesJoin ?? null),
      } satisfies DisputeRow;
    });

    setDisputes(normalized);
    if (!selectedDisputeId && normalized[0]) {
      setSelectedDisputeId(normalized[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadDisputes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Pre-fill resolution form when selected dispute changes
  useEffect(() => {
    const d = disputes.find(x => x.id === selectedDisputeId);
    if (d) {
      setResolveStatus(d.status === 'open' ? 'investigating' : d.status);
      setResolveNote(d.resolution_note ?? '');
    }
    setSaveError('');
    setSaveSuccess('');
  }, [selectedDisputeId, disputes]);

  const handleSaveResolution = async () => {
    if (!selectedDisputeId) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    const updatePayload: Record<string, unknown> = {
      status: resolveStatus,
      resolution_note: resolveNote.trim() || null,
    };
    if (resolveStatus === 'resolved' || resolveStatus === 'closed') {
      updatePayload.resolved_at = new Date().toISOString();
    }
    const { error: updateErr } = await supabase
      .from('job_disputes')
      .update(updatePayload)
      .eq('id', selectedDisputeId);
    setSaving(false);
    if (updateErr) {
      setSaveError(updateErr.message);
      return;
    }
    setSaveSuccess('Dispute updated successfully.');
    await loadDisputes();
  };

  const filtered = useMemo(
    () => disputes.filter((item) => statusFilter === 'all' || item.status === statusFilter),
    [disputes, statusFilter]
  );
  useEffect(() => {
    setDisputePage(0);
  }, [statusFilter, disputes.length]);
  const totalDisputePages = Math.max(1, Math.ceil(filtered.length / DISPUTES_PER_PAGE));
  const safeDisputePage = Math.min(disputePage, totalDisputePages - 1);
  const paginatedDisputes = filtered.slice(
    safeDisputePage * DISPUTES_PER_PAGE,
    (safeDisputePage + 1) * DISPUTES_PER_PAGE,
  );

  const selectedDispute = filtered.find((item) => item.id === selectedDisputeId) ?? filtered[0] ?? null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db',
    borderRadius: '7px', fontSize: '0.86rem', boxSizing: 'border-box',
  };

  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <div style={{ backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 89px)', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.55rem', color: '#0f172a' }}>Dispute Management</h1>
            <p style={{ margin: '0.3rem 0 0', color: '#64748b', fontSize: '0.88rem' }}>Review and resolve disputes from the job_disputes queue.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.55rem' }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | DisputeStatus)} style={{ padding: '0.5rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.82rem' }}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <button onClick={() => void loadDisputes()} style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              Refresh
            </button>
          </div>
        </div>

        {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.8rem 0.9rem', marginBottom: '0.8rem', fontSize: '0.84rem', fontWeight: 600 }}>{error}</div>}

        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading disputes…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.2rem', color: '#64748b' }}>No disputes found for the selected status.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.1fr) minmax(280px, 0.9fr)', gap: '0.85rem' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Job', 'Status', 'Raised', 'Action'].map((h) => (
                        <th key={h} style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDisputes.map((dispute, index) => {
                      const style = STATUS_STYLE[dispute.status];
                      const active = selectedDispute?.id === dispute.id;
                      return (
                        <tr key={dispute.id} style={{ borderBottom: index < paginatedDisputes.length - 1 ? '1px solid #f1f5f9' : 'none', background: active ? '#eff6ff' : '#fff' }}>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>{dispute.jobs?.pickup_location ?? '—'} → {dispute.jobs?.delivery_location ?? '—'}</div>
                            <div style={{ marginTop: '0.15rem', color: '#94a3b8', fontSize: '0.74rem' }}>Job #{dispute.job_id.slice(0, 8)}</div>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ background: style.bg, color: style.color, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>{dispute.status}</span>
                          </td>
                          <td style={{ padding: '0.75rem', color: '#475569', fontSize: '0.82rem' }}>{new Date(dispute.created_at).toLocaleString('en-GB')}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <button onClick={() => setSelectedDisputeId(dispute.id)} style={{ padding: '0.35rem 0.65rem', border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}>
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > DISPUTES_PER_PAGE && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
                  <span>
                    Showing {safeDisputePage * DISPUTES_PER_PAGE + 1}–{Math.min((safeDisputePage + 1) * DISPUTES_PER_PAGE, filtered.length)} of {filtered.length}
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => setDisputePage((prev) => Math.max(prev - 1, 0))}
                      disabled={safeDisputePage === 0}
                      style={{ padding: '0.28rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: safeDisputePage === 0 ? '#f8fafc' : '#fff', cursor: safeDisputePage === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setDisputePage((prev) => Math.min(prev + 1, totalDisputePages - 1))}
                      disabled={safeDisputePage >= totalDisputePages - 1}
                      style={{ padding: '0.28rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: safeDisputePage >= totalDisputePages - 1 ? '#f8fafc' : '#fff', cursor: safeDisputePage >= totalDisputePages - 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedDispute && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'grid', gap: '0.8rem', alignContent: 'start' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Dispute ID</div>
                  <div style={{ color: '#0f172a', fontSize: '0.86rem', fontWeight: 700 }}>{selectedDispute.id}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Company</div>
                  <div style={{ color: '#0f172a', fontSize: '0.86rem', fontWeight: 600 }}>{selectedDispute.companies?.name ?? 'Unknown company'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Job status</div>
                  <div style={{ color: '#334155', fontSize: '0.84rem' }}>{selectedDispute.jobs?.status ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Pickup / Delivery</div>
                  <div style={{ color: '#334155', fontSize: '0.84rem' }}>
                    {selectedDispute.jobs?.pickup_location ?? '—'} → {selectedDispute.jobs?.delivery_location ?? '—'}
                  </div>
                  <div style={{ marginTop: '0.2rem', color: '#64748b', fontSize: '0.8rem' }}>
                    {selectedDispute.jobs?.pickup_datetime ? `Pickup: ${new Date(selectedDispute.jobs.pickup_datetime).toLocaleString('en-GB')}` : 'Pickup: —'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    {selectedDispute.jobs?.delivery_datetime ? `Delivery: ${new Date(selectedDispute.jobs.delivery_datetime).toLocaleString('en-GB')}` : 'Delivery: —'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Description</div>
                  <div style={{ marginTop: '0.25rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>
                    {selectedDispute.description}
                  </div>
                </div>
                {selectedDispute.resolved_at && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Resolved at {new Date(selectedDispute.resolved_at).toLocaleString('en-GB')}
                  </div>
                )}
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Raised at {new Date(selectedDispute.created_at).toLocaleString('en-GB')}
                </div>

                {/* â”€â”€ Resolution Panel â”€â”€ */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.9rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: '0.65rem' }}>⚖️ Update / Resolve Dispute</div>

                  {saveError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '7px', padding: '0.55rem 0.75rem', marginBottom: '0.65rem', color: '#dc2626', fontSize: '0.82rem' }}>
                      {saveError}
                    </div>
                  )}
                  {saveSuccess && (
                    <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '7px', padding: '0.55rem 0.75rem', marginBottom: '0.65rem', color: '#14532d', fontWeight: 600, fontSize: '0.82rem' }}>
                      ✅ {saveSuccess}
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>New Status</label>
                      <select
                        value={resolveStatus}
                        onChange={e => setResolveStatus(e.target.value as DisputeStatus)}
                        style={inputStyle}
                      >
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Resolution Note</label>
                      <textarea
                        value={resolveNote}
                        onChange={e => setResolveNote(e.target.value)}
                        placeholder="Describe the outcome, investigation findings, or reason for closure…"
                        rows={4}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                      />
                    </div>
                    <button
                      onClick={() => { void handleSaveResolution(); }}
                      disabled={saving}
                      style={{ padding: '0.6rem', background: saving ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.86rem' }}
                    >
                      {saving ? 'Saving…' : 'Save Resolution'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
