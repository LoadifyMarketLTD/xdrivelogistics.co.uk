'use client';

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, DataTable, EmptyState, Panel, StatusBadge } from './WorkspaceUI';

type BlockRow = {
  id: string;
  blocked_company_id: string;
  reason: string | null;
  created_at: string;
  company: {
    id: string;
    name: string | null;
    trading_name: string | null;
    legal_name: string | null;
    xd_id: string | null;
    company_number: string | null;
    status: string | null;
  } | null;
};

type ResponsePayload = { blocks?: BlockRow[]; error?: string };

const when = (value: string) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function CompanyBlockedMembersPanel({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: 'Bearer ' + token } : null;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const headers = await authHeaders();
    if (!headers) {
      setError('Your session has expired. Sign in again.');
      setLoading(false);
      return;
    }
    const response = await fetch('/api/settings/company-blocked-members?companyId=' + encodeURIComponent(companyId), {
      headers,
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as ResponsePayload;
    if (!response.ok) setError(payload.error || 'Blocked members could not be loaded.');
    else setRows(payload.blocks ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const blockMember = async () => {
    if (!reference.trim()) {
      setError('Enter an XD ID, company number or exact company name.');
      return;
    }
    setWorking(true);
    setError('');
    setNotice('');
    const headers = await authHeaders();
    if (!headers) {
      setError('Your session has expired. Sign in again.');
      setWorking(false);
      return;
    }
    const response = await fetch('/api/settings/company-blocked-members', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, blockedCompanyReference: reference.trim(), reason: reason.trim() }),
    });
    const payload = await response.json().catch(() => ({})) as ResponsePayload;
    if (!response.ok) setError(payload.error || 'Member could not be blocked.');
    else {
      setNotice('Member blocked.');
      setReference('');
      setReason('');
      await load();
    }
    setWorking(false);
  };

  const unblock = async (blockId: string) => {
    setWorking(true);
    setError('');
    setNotice('');
    const headers = await authHeaders();
    if (!headers) {
      setError('Your session has expired. Sign in again.');
      setWorking(false);
      return;
    }
    const response = await fetch('/api/settings/company-blocked-members', {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, blockId }),
    });
    const payload = await response.json().catch(() => ({})) as ResponsePayload;
    if (!response.ok) setError(payload.error || 'Member block could not be removed.');
    else {
      setNotice('Member unblocked.');
      await load();
    }
    setWorking(false);
  };

  return <div style={{ display: 'grid', gap: 10 }}>
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

    <Panel title="Block a Member" description="Blocked companies are prevented from normal commercial interaction where the XDrive workflow checks the company block contract.">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) minmax(260px,2fr) auto', gap: 8, alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 800 }}>XD ID / company number / exact company name<input value={reference} onChange={(e) => setReference(e.target.value.slice(0, 160))} placeholder="XD-001234 or company name" /></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 800 }}>Reason<input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="Internal reason (optional)" /></label>
        <ActionButton tone="primary" disabled={working} onClick={() => void blockMember()}>{working ? 'Saving…' : 'Block Member'}</ActionButton>
      </div>
    </Panel>

    <Panel title="Blocked Members" description="Owner/admin-controlled company blocks.">
      {loading ? <EmptyState compact title="Loading blocked members…" /> : (
        <DataTable
          columns={['Member', 'XD ID', 'Company number', 'Status', 'Reason', 'Blocked', 'Action']}
          rows={rows.map((row) => {
            const company = row.company;
            return [
              <strong key="name">{company?.trading_name || company?.name || company?.legal_name || 'Unknown company'}</strong>,
              company?.xd_id ?? '—',
              company?.company_number ?? '—',
              <StatusBadge key="status" value={company?.status ?? 'unknown'} tone={company?.status === 'active' ? 'green' : 'orange'} />,
              row.reason || '—',
              when(row.created_at),
              <ActionButton key="action" tone="secondary" disabled={working} onClick={() => void unblock(row.id)}>Unblock</ActionButton>,
            ];
          })}
          empty={<EmptyState compact title="No blocked members" description="Companies blocked from normal commercial interaction will appear here." />}
        />
      )}
    </Panel>
  </div>;
}
