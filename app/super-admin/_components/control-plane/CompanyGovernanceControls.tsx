'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type AnyRow = Record<string, unknown>;
type GovernanceAction = 'approve' | 'reject' | 'suspend' | 'reinstate';
type Payload = {
  company?: AnyRow;
  identityResolution?: {
    recordState?: string;
    canonicalCompany?: AnyRow | null;
  };
  people?: { memberships?: AnyRow[] };
  compliance?: {
    companyDocuments?: AnyRow[];
    driverDocuments?: AnyRow[];
    vehicleDocuments?: AnyRow[];
  };
  summary?: Record<string, unknown>;
  error?: string;
};

const C = { navy:'#082a61', blue:'#1d57d8', green:'#168553', orange:'#f59e0b', red:'#d92d20', text:'#172033', muted:'#66778e', border:'#dfe6ef', white:'#fff' } as const;

const actionsForStatus = (status: string, legacy: boolean): GovernanceAction[] => {
  if (legacy) return [];
  const normalized = status.trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'pending_approval') return ['approve', 'reject'];
  if (normalized === 'active') return ['suspend'];
  if (normalized === 'suspended') return ['reinstate'];
  return [];
};

const labelFor = (action: GovernanceAction) => action === 'approve' ? 'Approve company' : action === 'reject' ? 'Reject company' : action === 'suspend' ? 'Suspend company' : 'Reinstate company';

export default function CompanyGovernanceControls({ companyId }: { companyId: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<GovernanceAction | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<GovernanceAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/inspect/company/${encodeURIComponent(companyId)}/360`, { headers: { Authorization: auth }, cache: 'no-store' });
      const body = await response.json().catch(() => ({})) as Payload;
      if (!response.ok) throw new Error(body.error ?? 'Company governance context is unavailable.');
      setPayload(body);
    } catch (caught) {
      setPayload(null);
      setError(caught instanceof Error ? caught.message : 'Company governance context is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPreviewMode(typeof window !== 'undefined' && window.location.hostname.startsWith('deploy-preview-')); }, []);

  const company = payload?.company ?? {};
  const legacy = payload?.identityResolution?.recordState === 'legacy_orphaned';
  const actions = actionsForStatus(String(company.status ?? ''), legacy);
  const allDocs = useMemo(() => [
    ...(payload?.compliance?.companyDocuments ?? []),
    ...(payload?.compliance?.driverDocuments ?? []),
    ...(payload?.compliance?.vehicleDocuments ?? []),
  ], [payload]);
  const approvedDocs = allDocs.filter((row) => String(row.status ?? '').toLowerCase() === 'approved').length;
  const memberProfile = useMemo(() => {
    for (const membership of payload?.people?.memberships ?? []) {
      if (String(membership.status ?? '').toLowerCase() !== 'active') continue;
      if (membership.profile && typeof membership.profile === 'object') return membership.profile as AnyRow;
    }
    return null;
  }, [payload]);
  const companyXdId = String(company.xd_id ?? '').trim();
  const profileXdId = String(memberProfile?.xd_id ?? '').trim();
  const identityMismatch = !legacy && Boolean(companyXdId && profileXdId && companyXdId !== profileXdId);

  const applyAction = async (action: GovernanceAction, reason = '') => {
    if (previewMode) {
      setMessage('Preview only: this action is shown for functional parity but mutations are disabled in Deploy Preview.');
      return;
    }
    setActing(action);
    setMessage(null);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/companies/${encodeURIComponent(companyId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Company ${action} action failed.`);
      setMessage(`${labelFor(action)} completed and recorded in the governance audit.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Company ${action} action failed.`);
    } finally {
      setActing(null);
    }
  };

  const initiate = (action: GovernanceAction) => {
    if (previewMode) {
      setMessage('Preview only: governance actions are visible for review, but Production writes are blocked.');
      return;
    }
    if (action === 'reject' || action === 'suspend') setPendingConfirm(action);
    else void applyAction(action);
  };

  const confirmDangerous = pendingConfirm;

  return (
    <>
      <ActionConfirmModal
        open={confirmDangerous !== null}
        title={confirmDangerous === 'suspend' ? 'Suspend company' : 'Reject company'}
        description={confirmDangerous === 'suspend'
          ? <>This will suspend <strong>{String(company.trading_name ?? company.legal_name ?? company.name ?? 'this company')}</strong>. The existing canonical governance endpoint will enforce the status transition and record the reason.</>
          : <>This will reject <strong>{String(company.trading_name ?? company.legal_name ?? company.name ?? 'this company')}</strong>. The reason will be recorded in the durable governance audit.</>}
        confirmLabel={confirmDangerous === 'suspend' ? 'Confirm suspension' : 'Confirm rejection'}
        danger
        reasonRequired
        reasonPlaceholder={confirmDangerous === 'suspend' ? 'Explain why this company is being suspended…' : 'Explain why this company is being rejected…'}
        submitting={acting !== null}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={(reason) => {
          if (!confirmDangerous) return;
          setPendingConfirm(null);
          void applyAction(confirmDangerous, reason);
        }}
      />

      <section style={{ marginBottom: 12, border:`1px solid ${C.border}`, borderRadius:14, background:C.white, padding:12 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ color:C.muted, fontSize:8.5, fontWeight:850, letterSpacing:'.07em', textTransform:'uppercase' }}>Platform Owner governance</div>
            <h2 style={{ margin:'4px 0 0', color:C.navy, fontSize:14, fontWeight:900 }}>Authoritative company controls</h2>
            <p style={{ margin:'4px 0 0', color:C.muted, fontSize:9.5, lineHeight:1.45 }}>Preserves the functional governance already available in Super Admin: approve, reject, suspend and reinstate through the canonical audited endpoint.</p>
          </div>
          <Link href="/super-admin/companies" style={{ color:C.blue, fontSize:9.5, fontWeight:850, textDecoration:'none' }}>All companies →</Link>
        </div>

        {previewMode ? <div style={{ marginTop:10, borderLeft:`4px solid ${C.orange}`, background:'#fffaf0', padding:'7px 9px', color:'#806b43', fontSize:9.5 }}><strong>Deploy Preview safety:</strong> governance controls are displayed for parity review, but server-side mutations are disabled. No Production company status can be changed from #431.</div> : null}
        {loading ? <div style={{ marginTop:10, color:C.muted, fontSize:10 }}>Loading governance state…</div> : null}
        {error ? <div role="alert" style={{ marginTop:10, borderLeft:`4px solid ${C.red}`, background:'#fff7f7', padding:'7px 9px', color:C.red, fontSize:9.5 }}>{error}</div> : null}
        {message ? <div style={{ marginTop:10, borderLeft:`4px solid ${C.green}`, background:'#f4fbf7', padding:'7px 9px', color:C.green, fontSize:9.5 }}>{message}</div> : null}

        {!loading && payload ? (
          <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:12, alignItems:'center' }}>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ border:`1px solid ${legacy ? C.red : C.green}35`, borderRadius:999, background:legacy?'#fff7f7':'#f4fbf7', color:legacy?C.red:C.green, padding:'3px 8px', fontSize:9, fontWeight:850 }}>{legacy ? 'Legacy / orphaned — mutations suppressed' : `Status: ${String(company.status ?? 'unknown')}`}</span>
              <span style={{ border:`1px solid ${C.border}`, borderRadius:999, padding:'3px 8px', color:C.text, fontSize:9, fontWeight:800 }}>{approvedDocs}/{allDocs.length} compliance documents approved</span>
              {identityMismatch ? <span style={{ border:`1px solid ${C.orange}55`, borderRadius:999, background:'#fffaf0', color:'#9a6200', padding:'3px 8px', fontSize:9, fontWeight:850 }}>Identity review: Company ID {companyXdId} ≠ Profile ID {profileXdId}</span> : null}
            </div>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', justifyContent:'flex-end' }}>
              {actions.map((action) => {
                const dangerous = action === 'reject' || action === 'suspend';
                const color = dangerous ? C.red : C.green;
                const disabled = acting !== null || previewMode;
                return <button key={action} type="button" disabled={disabled} onClick={() => initiate(action)} title={previewMode ? 'Preview only — Production mutation disabled' : undefined} style={{ minHeight:32, border:`1px solid ${color}`, borderRadius:8, background:C.white, color, padding:'0 10px', fontSize:9.5, fontWeight:850, cursor:disabled?'not-allowed':'pointer', opacity: disabled ? .62 : 1 }}>{acting === action ? 'Working…' : `${labelFor(action)}${previewMode ? ' · preview' : ''}`}</button>;
              })}
              {!actions.length && !legacy ? <span style={{ color:C.muted, fontSize:9.5 }}>No governance status transition is authorised from the current state.</span> : null}
            </div>
          </div>
        ) : null}

        {identityMismatch ? <div style={{ marginTop:9, color:'#806b43', fontSize:9.2, lineHeight:1.45 }}>The XDrive ID mismatch is surfaced for review only. It does not automatically block an otherwise operational company.</div> : null}
      </section>
    </>
  );
}
