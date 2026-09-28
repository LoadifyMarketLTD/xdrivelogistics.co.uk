'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import { PlatformEntityLink, type PlatformEntityType } from '@/app/super-admin/_components/control-plane';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard } from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';
import { Search } from 'lucide-react';

const X = {
  navy: '#0B2F6B', blue: '#1D57D8', white: '#FFFFFF', charcoal: '#1A1F2B', light: '#F4F6F8',
  border: '#E5E7EB', muted: '#667085', orange: '#F5A300', danger: '#D92D20',
} as const;

type SearchRow = {
  entityType: PlatformEntityType;
  entityId: string;
  reference: string;
  title: string;
  subtitle: string;
  status?: string | null;
};

type SourceNotice = { entityType: PlatformEntityType; reason: string };
type SearchPayload = {
  query?: string;
  rows?: SearchRow[];
  returned?: number;
  unavailableSources?: SourceNotice[];
  partialSources?: SourceNotice[];
  error?: string;
};

const ENTITY_LABEL: Partial<Record<PlatformEntityType, string>> = {
  job: 'Job', company: 'Company', user: 'User', driver: 'Driver', vehicle: 'Vehicle', invoice: 'Invoice',
  ticket: 'Ticket', dispute: 'Dispute', pod: 'POD', case: 'Case',
};

function SearchSurface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();
  const [draft, setDraft] = useState(query);
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [unavailableSources, setUnavailableSources] = useState<SourceNotice[]>([]);
  const [partialSources, setPartialSources] = useState<SourceNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(query), [query]);

  const load = useCallback(async () => {
    if (query.length < 2) {
      setRows([]);
      setUnavailableSources([]);
      setPartialSources([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active Platform Owner session.');
        return;
      }
      const params = new URLSearchParams({ q: query, limit: '80' });
      const response = await fetch(`/api/super-admin/search?${params.toString()}`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as SearchPayload;
      if (!response.ok) {
        setRows([]);
        setUnavailableSources([]);
        setPartialSources([]);
        setError(body.error ?? 'Global Platform Search is unavailable.');
        return;
      }
      setRows(body.rows ?? []);
      setUnavailableSources(body.unavailableSources ?? []);
      setPartialSources(body.partialSources ?? []);
    } catch {
      setRows([]);
      setUnavailableSources([]);
      setPartialSources([]);
      setError('Global Platform Search is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<PlatformEntityType, SearchRow[]>();
    for (const row of rows) map.set(row.entityType, [...(map.get(row.entityType) ?? []), row]);
    return Array.from(map.entries());
  }, [rows]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draft.trim();
    if (next.length < 2) return;
    router.push(`/super-admin/search?q=${encodeURIComponent(next)}`);
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <SuperAdminPage>
        <SuperAdminPageHeader eyebrow="Command" title="Global Platform Search" description="Find a company, job, person or record across the platform, then open its canonical inspector." icon={<Search aria-hidden="true" />} />

        <form onSubmit={submit} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', padding: '15px', border: `1px solid #DCE6F5`, borderRadius: '12px', background: X.white, boxShadow: '0 6px 20px rgba(14,45,91,.055)' }}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Job ref, company, email, driver, registration, invoice, ticket, dispute, POD or case"
            aria-label="Global Platform Search"
            autoComplete="off"
            style={{ flex: 1, minWidth: 0, height: '42px', border: `1px solid #C7D6EB`, borderRadius: '8px', padding: '0 13px', color: X.charcoal, background: '#F8FAFF', fontSize: '13px' }}
          />
          <button type="submit" disabled={draft.trim().length < 2 || loading} style={{ height: '42px', padding: '0 18px', borderRadius: '8px', border: `1px solid ${X.blue}`, background: X.blue, color: X.white, fontSize: '12px', fontWeight: 800, cursor: draft.trim().length < 2 || loading ? 'not-allowed' : 'pointer', opacity: draft.trim().length < 2 || loading ? .6 : 1 }}>
            Search
          </button>
        </form>

        {unavailableSources.map((notice) => (
          <div key={`unavailable-${notice.entityType}`} style={noticeStyle}>
            <strong>{ENTITY_LABEL[notice.entityType] ?? notice.entityType} source unavailable.</strong> {notice.reason}
          </div>
        ))}
        {partialSources.map((notice) => (
          <div key={`partial-${notice.entityType}`} style={noticeStyle}>
            <strong>{ENTITY_LABEL[notice.entityType] ?? notice.entityType} search is partial.</strong> {notice.reason}
          </div>
        ))}
        {error ? <div role="alert" style={{ marginBottom: '12px', border: `1px solid ${X.danger}`, borderRadius: '4px', background: X.white, color: X.danger, padding: '10px 12px', fontSize: '11px' }}>{error}</div> : null}

        {query.length < 2 ? (
          <SuperAdminSectionCard title="Search across the control plane" description="Enter at least two characters to find verified platform records.">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: X.muted, fontSize: '12px' }}>
              {['Jobs & quotes', 'Companies & people', 'Invoices & payments', 'Tickets & disputes', 'Documents & cases'].map((label) => (
                <span key={label} style={{ padding: '9px 12px', background: '#EEF4FF', color: X.navy, borderRadius: '8px', fontWeight: 700 }}>{label}</span>
              ))}
            </div>
          </SuperAdminSectionCard>
        ) : loading ? (
          <section style={emptyStyle}>Searching canonical platform sources…</section>
        ) : !error && rows.length === 0 ? (
          <section style={emptyStyle}>No matching entities were found in the available sources.</section>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {grouped.map(([entityType, entityRows]) => (
              <section key={entityType} style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', minHeight: '38px', padding: '7px 10px', borderBottom: `1px solid ${X.border}`, background: X.light }}>
                  <h2 style={{ margin: 0, color: X.navy, fontSize: '12px', fontWeight: 800 }}>{ENTITY_LABEL[entityType] ?? entityType}</h2>
                  <span style={{ color: X.muted, fontSize: '10px' }}>{entityRows.length} returned</span>
                </div>
                <div style={{ display: 'grid' }}>
                  {entityRows.map((row) => (
                    <article key={`${row.entityType}:${row.entityId}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '10px', alignItems: 'center', padding: '9px 10px', borderBottom: `1px solid ${X.border}` }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '3px' }}>
                          <span style={{ color: X.blue, fontSize: '9px', fontWeight: 900, textTransform: 'uppercase' }}>{ENTITY_LABEL[row.entityType] ?? row.entityType}</span>
                          <code style={{ color: X.muted, fontSize: '9px' }}>{row.reference}</code>
                          {row.status ? <span style={{ color: X.charcoal, background: X.light, border: `1px solid ${X.border}`, borderRadius: '4px', padding: '2px 5px', fontSize: '9px', fontWeight: 800 }}>{row.status}</span> : null}
                        </div>
                        <div style={{ color: X.navy, fontSize: '11px', fontWeight: 800, overflowWrap: 'anywhere' }}>{row.title}</div>
                        <div style={{ marginTop: '2px', color: X.muted, fontSize: '10px', overflowWrap: 'anywhere' }}>{row.subtitle}</div>
                      </div>
                      <PlatformEntityLink entityType={row.entityType} entityId={row.entityId} compact>Inspect</PlatformEntityLink>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </SuperAdminPage>
    </ProtectedRoute>
  );
}

export default function Page() {
  return <Suspense fallback={<div style={emptyStyle}>Loading Global Platform Search…</div>}><SearchSurface /></Suspense>;
}

const noticeStyle = { marginBottom: '8px', border: `1px solid ${X.border}`, borderLeft: `4px solid ${X.orange}`, borderRadius: '4px', background: X.white, padding: '9px 12px', color: X.charcoal, fontSize: '10px', lineHeight: 1.45 } as const;
const emptyStyle = { border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '18px', color: X.muted, fontSize: '11px', textAlign: 'center' } as const;
