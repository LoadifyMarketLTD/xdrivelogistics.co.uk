'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { PageHeader, ActionButton, AlertBanner, StatusBadge } from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

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
    width: '100%', height: '32px', padding: '0 8px', border: '1px solid #d9e2ec',
    borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box',
  };

  return (
    <ProtectedRoute allowedRoles={['owner', 'company_admin', 'company_staff']}>
      <PageHeader
        title="Dispute Management"
        description="Review and resolve disputes from the job_disputes queue."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | DisputeStatus)} className={cssStyles.settingsInput} style={{ width: 'auto' }}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <ActionButton tone="secondary" onClick={() => void loadDisputes()}>Refresh</ActionButton>
          </div>
        }
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>Loading disputes…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#5f6368', fontSize: '12px' }}>No disputes found for the selected status.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.1fr) minmax(260px, 0.9fr)', gap: '8px' }}>
          {/* Left: dispute list */}
          <div className={cssStyles.operationalTableContainer}>
            <div className={cssStyles.operationalTableScroll}>
              <table className={cssStyles.operationalTable} style={{ minWidth: '560px' }}>
                <caption className={cssStyles.operationalTableCaption}>Disputes</caption>
                <thead>
                  <tr className={cssStyles.operationalTableHeaderRow}>
                    {['Job', 'Status', 'Raised', 'Action'].map((h) => (
                      <th key={h} scope="col" className={cssStyles.operationalTableHeadCell}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDisputes.map((dispute) => {
                    const active = selectedDispute?.id === dispute.id;
                    return (
                      <tr key={dispute.id} className={cssStyles.operationalTableRow} style={{ background: active ? '#eff6ff' : undefined }}>
                        <td className={cssStyles.operationalTableCell}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{dispute.jobs?.pickup_location ?? '—'} → {dispute.jobs?.delivery_location ?? '—'}</div>
                          <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '1px' }}>Job #{dispute.job_id.slice(0, 8)}</div>
                        </td>
                        <td className={cssStyles.operationalTableCell}>
                          <StatusBadge value={dispute.status} />
                        </td>
                        <td className={cssStyles.operationalTableCell}>{new Date(dispute.created_at).toLocaleString('en-GB')}</td>
                        <td className={`${cssStyles.operationalTableCell} ${cssStyles.operationalTableActionCell}`}>
                          <ActionButton tone="secondary" onClick={() => setSelectedDisputeId(dispute.id)}>View</ActionButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > DISPUTES_PER_PAGE && (
              <div className={cssStyles.operationalTableMeta}>
                <span>
                  Showing {safeDisputePage * DISPUTES_PER_PAGE + 1}–{Math.min((safeDisputePage + 1) * DISPUTES_PER_PAGE, filtered.length)} of {filtered.length}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <ActionButton tone="secondary" disabled={safeDisputePage === 0} onClick={() => setDisputePage((prev) => Math.max(prev - 1, 0))}>Previous</ActionButton>
                  <ActionButton tone="secondary" disabled={safeDisputePage >= totalDisputePages - 1} onClick={() => setDisputePage((prev) => Math.min(prev + 1, totalDisputePages - 1))}>Next</ActionButton>
                </div>
              </div>
            )}
          </div>

          {/* Right: resolution panel */}
          {selectedDispute && (
            <div style={{ background: '#fff', border: '1px solid #d9e2ec', borderRadius: '4px', padding: '12px', display: 'grid', gap: '8px', alignContent: 'start' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#5f6368', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dispute ID</div>
                <div style={{ color: '#202124', fontSize: '12px', fontWeight: 700 }}>{selectedDispute.id}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#5f6368', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company</div>
                <div style={{ color: '#202124', fontSize: '12px', fontWeight: 600 }}>{selectedDispute.companies?.name ?? 'Unknown company'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#5f6368', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job status</div>
                <div style={{ color: '#334155', fontSize: '12px' }}>{selectedDispute.jobs?.status ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#5f6368', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pickup / Delivery</div>
                <div style={{ color: '#334155', fontSize: '12px' }}>
                  {selectedDispute.jobs?.pickup_location ?? '—'} → {selectedDispute.jobs?.delivery_location ?? '—'}
                </div>
                <div style={{ color: '#5f6368', fontSize: '11px' }}>
                  {selectedDispute.jobs?.pickup_datetime ? `Pickup: ${new Date(selectedDispute.jobs.pickup_datetime).toLocaleString('en-GB')}` : 'Pickup: —'}
                </div>
                <div style={{ color: '#5f6368', fontSize: '11px' }}>
                  {selectedDispute.jobs?.delivery_datetime ? `Delivery: ${new Date(selectedDispute.jobs.delivery_datetime).toLocaleString('en-GB')}` : 'Delivery: —'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#5f6368', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
                <div style={{ marginTop: '4px', padding: '8px', borderRadius: '4px', border: '1px solid #d9e2ec', background: '#f5f7fa', color: '#334155', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                  {selectedDispute.description}
                </div>
              </div>
              {selectedDispute.resolved_at && (
                <div style={{ fontSize: '11px', color: '#5f6368' }}>
                  Resolved at {new Date(selectedDispute.resolved_at).toLocaleString('en-GB')}
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#5f6368' }}>
                Raised at {new Date(selectedDispute.created_at).toLocaleString('en-GB')}
              </div>

              {/* Resolution Panel */}
              <div style={{ borderTop: '1px solid #d9e2ec', paddingTop: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#202124', marginBottom: '8px' }}>⚖️ Update / Resolve Dispute</div>

                {saveError && <AlertBanner tone="danger">{saveError}</AlertBanner>}
                {saveSuccess && <AlertBanner tone="success">✅ {saveSuccess}</AlertBanner>}

                <div style={{ display: 'grid', gap: '8px' }}>
                  <div>
                    <label className={cssStyles.settingsLabel}>New Status</label>
                    <select value={resolveStatus} onChange={e => setResolveStatus(e.target.value as DisputeStatus)} style={inputStyle}>
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className={cssStyles.settingsLabel}>Resolution Note</label>
                    <textarea
                      value={resolveNote}
                      onChange={e => setResolveNote(e.target.value)}
                      placeholder="Describe the outcome, investigation findings, or reason for closure…"
                      rows={4}
                      style={{ ...inputStyle, height: 'auto', resize: 'vertical', minHeight: '80px', padding: '6px 8px' }}
                    />
                  </div>
                  <ActionButton tone="primary" disabled={saving} onClick={() => { void handleSaveResolution(); }}>
                    {saving ? 'Saving…' : 'Save Resolution'}
                  </ActionButton>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ProtectedRoute>
  );
}
