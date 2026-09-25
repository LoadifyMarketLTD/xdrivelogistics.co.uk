'use client';

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, Panel } from './WorkspaceUI';

type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DepartmentResponse = {
  departments?: DepartmentRow[];
  department?: DepartmentRow;
  error?: string;
};

export default function CompanyDepartmentsPanel({ companyId }: { companyId: string }) {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { name: string; description: string }>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? `Bearer ${token}` : null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const authorization = await authHeader();
    if (!authorization) { setError('Your session has expired. Sign in again.'); setLoading(false); return; }
    const response = await fetch(`/api/settings/departments?companyId=${encodeURIComponent(companyId)}`, {
      headers: { Authorization: authorization }, cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as DepartmentResponse;
    if (!response.ok) {
      setError(payload.error || 'Departments could not be loaded.');
      setDepartments([]);
    } else {
      const rows = payload.departments ?? [];
      setDepartments(rows);
      setDrafts(Object.fromEntries(rows.map((row) => [row.id, { name: row.name, description: row.description ?? '' }])));
    }
    setLoading(false);
  }, [authHeader, companyId]);

  useEffect(() => { void load(); }, [load]);

  const createDepartment = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Department name is required.'); return; }
    setWorking('create'); setError(''); setNotice('');
    const authorization = await authHeader();
    if (!authorization) { setError('Your session has expired. Sign in again.'); setWorking(null); return; }
    const response = await fetch('/api/settings/departments', {
      method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, name: trimmed, description: description.trim() || null }),
    });
    const payload = await response.json().catch(() => ({})) as DepartmentResponse;
    setWorking(null);
    if (!response.ok || !payload.department) { setError(payload.error || 'Department could not be created.'); return; }
    setName(''); setDescription(''); setNotice(`Department “${payload.department.name}” created.`); await load();
  };

  const updateDepartment = async (departmentId: string) => {
    const draft = drafts[departmentId];
    if (!draft?.name.trim()) { setError('Department name cannot be empty.'); return; }
    setWorking(departmentId); setError(''); setNotice('');
    const authorization = await authHeader();
    if (!authorization) { setError('Your session has expired. Sign in again.'); setWorking(null); return; }
    const response = await fetch('/api/settings/departments', {
      method: 'PATCH', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, departmentId, name: draft.name.trim(), description: draft.description.trim() || null }),
    });
    const payload = await response.json().catch(() => ({})) as DepartmentResponse;
    setWorking(null);
    if (!response.ok || !payload.department) { setError(payload.error || 'Department could not be updated.'); return; }
    setNotice(`Department “${payload.department.name}” updated.`); await load();
  };

  const deleteDepartment = async (departmentId: string) => {
    const row = departments.find((item) => item.id === departmentId);
    if (!row || !window.confirm(`Delete department “${row.name}”?`)) return;
    setWorking(departmentId); setError(''); setNotice('');
    const authorization = await authHeader();
    if (!authorization) { setError('Your session has expired. Sign in again.'); setWorking(null); return; }
    const response = await fetch('/api/settings/departments', {
      method: 'DELETE', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, departmentId }),
    });
    const payload = await response.json().catch(() => ({})) as DepartmentResponse;
    setWorking(null);
    if (!response.ok) { setError(payload.error || 'Department could not be deleted.'); return; }
    setNotice(`Department “${row.name}” deleted.`); await load();
  };

  if (loading) return <Panel><EmptyState compact title="Loading departments…" /></Panel>;

  return <Panel title="Departments" description="Organise company members into operational departments without changing their security role.">
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(220px,2fr) auto', gap: 6, alignItems: 'end', marginBottom: 10 }}>
      <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 800 }}>DEPARTMENT NAME<input value={name} onChange={(event) => setName(event.target.value.slice(0,80))} placeholder="Operations" /></label>
      <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 800 }}>DESCRIPTION<input value={description} onChange={(event) => setDescription(event.target.value.slice(0,500))} placeholder="Optional team purpose" /></label>
      <ActionButton tone="primary" disabled={working === 'create' || !name.trim()} onClick={() => void createDepartment()}>{working === 'create' ? 'Creating…' : 'Add Department'}</ActionButton>
    </div>

    {departments.length === 0 ? <EmptyState compact title="No departments yet" description="Create departments such as Operations, Finance or Customer Service when your team needs them." /> : <div style={{ display: 'grid', gap: 6 }}>
      {departments.map((row) => {
        const draft = drafts[row.id] ?? { name: row.name, description: row.description ?? '' };
        const dirty = draft.name.trim() !== row.name || draft.description.trim() !== (row.description ?? '');
        return <div key={row.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) minmax(220px,2fr) auto auto', gap: 6, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 4, padding: 6 }}>
          <input aria-label={`Department name ${row.name}`} value={draft.name} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, name: event.target.value.slice(0,80) } }))} />
          <input aria-label={`Department description ${row.name}`} value={draft.description} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, description: event.target.value.slice(0,500) } }))} placeholder="Optional description" />
          <ActionButton tone="secondary" disabled={working === row.id || !dirty || !draft.name.trim()} onClick={() => void updateDepartment(row.id)}>Save</ActionButton>
          <ActionButton tone="danger" disabled={working === row.id} onClick={() => void deleteDepartment(row.id)}>Delete</ActionButton>
        </div>;
      })}
    </div>}
  </Panel>;
}
