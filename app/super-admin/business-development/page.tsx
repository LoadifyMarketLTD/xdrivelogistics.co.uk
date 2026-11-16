'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard, SuperAdminNotice,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Prospect = {
  id: string; legal_name: string; company_number: string | null; legal_form: string;
  segment: string; status: string; source_url: string; created_at: string;
};
type Result = { organisations?: Prospect[]; total?: number; error?: string };
const empty = { legal_name: '', company_number: '', website: '', legal_form: 'unknown', segment: 'customer', source_url: '' };

export default function BusinessDevelopmentPage() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(empty);
  const [reloadVersion, setReloadVersion] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Platform Owner session required.');
      const res = await fetch('/api/super-admin/business-development?page=' + page, {
        headers: { Authorization: auth }, cache: 'no-store',
      });
      const body = await res.json() as Result;
      if (!res.ok || !Array.isArray(body.organisations) || typeof body.total !== 'number')
        throw new Error(body.error ?? 'CRM is unavailable; check database migration.');
      setRows(body.organisations);
      setTotal(body.total);
    } catch (e) { setRows([]); setTotal(null); setError(e instanceof Error ? e.message : 'CRM unavailable.'); }
  }, [page, reloadVersion]);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Platform Owner session required.');
      const res = await fetch('/api/super-admin/business-development', {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json() as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Unable to save prospect.');
      setForm(empty); setPage(1); setReloadVersion(version => version + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save prospect.'); }
    finally { setBusy(false); }
  };

  return (
    <ProtectedRoute>
      <SuperAdminPage>
        <SuperAdminPageHeader eyebrow="Commercial acquisition" title="Business Development" description="Private UK B2B prospect register. No outreach is sent from this screen." />
        {error && <SuperAdminNotice tone="danger">{error}</SuperAdminNotice>}
        <SuperAdminSectionCard title="Add verified organisation">
          <form onSubmit={(event) => void create(event)} style={{ display: 'grid', gap: 12, maxWidth: 700 }}>
            <label>Legal company name <input required minLength={2} maxLength={240} value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></label>
            <label>Company number (optional) <input maxLength={32} value={form.company_number} onChange={e => setForm({ ...form, company_number: e.target.value })} /></label>
            <label>Website (HTTPS) <input type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></label>
            <label>Legal form <select value={form.legal_form} onChange={e => setForm({ ...form, legal_form: e.target.value })}>
              <option value="unknown">Unknown</option><option value="ltd">Limited company</option>
              <option value="llp">LLP</option><option value="sole_trader">Sole trader</option><option value="other">Other</option>
            </select></label>
            <label>Commercial segment <select value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
              <option value="customer">Customer</option><option value="broker">Broker</option>
              <option value="forwarder">Freight forwarder</option><option value="carrier">Carrier</option><option value="mixed">Mixed</option>
            </select></label>
            <label>Verified public source URL (HTTPS) <input required type="url" value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} /></label>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save prospect'}</button>
          </form>
        </SuperAdminSectionCard>
        <SuperAdminSectionCard title="Prospect organisations">
          <p>{total === null ? 'Not available' : total + ' organisations recorded'}</p>
          {rows.length === 0 ? <p>No verified prospects to display.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table><thead><tr><th>Organisation</th><th>Company number</th><th>Segment</th><th>Status</th><th>Source</th></tr></thead>
                <tbody>{rows.map(row => <tr key={row.id}>
                  <td>{row.legal_name}</td><td>{row.company_number ?? '—'}</td><td>{row.segment}</td>
                  <td>{row.status}</td><td><a href={row.source_url} target="_blank" rel="noopener noreferrer">Source</a></td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page}</span>
            <button disabled={total === null || page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </SuperAdminSectionCard>
      </SuperAdminPage>
    </ProtectedRoute>
  );
}
