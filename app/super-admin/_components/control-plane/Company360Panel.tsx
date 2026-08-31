'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type AnyRow = Record<string, unknown>;
type Company360Payload = {
  company?: AnyRow;
  summary?: Record<string, unknown>;
  onboarding?: { available?: boolean; latest?: AnyRow | null; applications?: AnyRow[]; missingDocuments?: string[]; missingDocumentsAvailable?: boolean; note?: string | null };
  people?: { available?: boolean; memberships?: AnyRow[]; note?: string | null };
  fleet?: { available?: boolean; drivers?: AnyRow[]; vehicles?: AnyRow[]; note?: string | null };
  compliance?: { available?: boolean; driverDocuments?: AnyRow[]; vehicleDocuments?: AnyRow[]; missingOnboardingDocuments?: string[]; note?: string | null };
  operations?: { postedJobs?: AnyRow[]; awardedJobs?: AnyRow[] };
  marketplace?: { quotes?: AnyRow[]; bids?: AnyRow[] };
  finance?: { invoices?: AnyRow[]; payments?: AnyRow[]; disputes?: AnyRow[]; note?: string | null };
  support?: { tickets?: AnyRow[]; disputes?: AnyRow[]; cases?: AnyRow[]; casesAvailable?: boolean; note?: string | null };
  notifications?: { rows?: AnyRow[]; note?: string | null };
  audit?: { rows?: AnyRow[]; available?: boolean; note?: string | null };
  error?: string;
};

const C = { navy: '#082a61', blue: '#1d57d8', orange: '#f59e0b', green: '#168553', red: '#d92d20', text: '#172033', muted: '#66778e', border: '#dfe6ef', bg: '#f7f9fc', white: '#fff' } as const;

const display = (value: unknown, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const shortDate = (value: unknown) => {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return '—';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString('en-GB');
};

function StatePill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'warning' | 'danger' | 'success' }) {
  const color = tone === 'warning' ? C.orange : tone === 'danger' ? C.red : tone === 'success' ? C.green : C.blue;
  return <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, border: `1px solid ${color}35`, borderRadius: 999, background: `${color}0d`, color, padding: '2px 8px', fontSize: 9, fontWeight: 850 }}>{children}</span>;
}

function Metric({ label, value, note, tone = 'default' }: { label: string; value: unknown; note?: string; tone?: 'default' | 'warning' | 'danger' | 'success' }) {
  const color = tone === 'warning' ? C.orange : tone === 'danger' ? C.red : tone === 'success' ? C.green : C.blue;
  return (
    <div style={{ minHeight: 88, border: `1px solid ${C.border}`, borderRadius: 13, background: C.white, padding: 12 }}>
      <div style={{ color: C.muted, fontSize: 8.5, fontWeight: 850, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 7, color, fontSize: 23, lineHeight: 1, fontWeight: 900 }}>{display(value)}</div>
      {note ? <div style={{ marginTop: 7, color: C.muted, fontSize: 9, lineHeight: 1.4 }}>{note}</div> : null}
    </div>
  );
}

function Fields({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: '#fbfcfe', padding: 9 }}>
          <div style={{ color: C.muted, fontSize: 8, fontWeight: 850, textTransform: 'uppercase' }}>{label}</div>
          <div style={{ marginTop: 4, color: C.text, fontSize: 10.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{display(value)}</div>
        </div>
      ))}
    </div>
  );
}

function InspectLink({ type, id }: { type: string; id: unknown }) {
  const raw = typeof id === 'string' ? id : '';
  if (!raw) return null;
  return <Link href={`/super-admin/inspect/${encodeURIComponent(type)}/${encodeURIComponent(raw)}`} style={{ color: C.blue, fontSize: 9, fontWeight: 850, textDecoration: 'none' }}>Inspect →</Link>;
}

function RowList({ rows, kind, empty = 'No linked records.', idKey = 'id' }: { rows: AnyRow[]; kind?: string; empty?: string; idKey?: string }) {
  if (!rows.length) return <div style={{ color: C.muted, fontSize: 10 }}>{empty}</div>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map((row, index) => {
        const title = display(row.title ?? row.subject ?? row.display_name ?? row.full_name ?? row.name ?? row.invoice_number ?? row.reference ?? row.event_type ?? row.action_type ?? row.doc_type ?? row.id, `Record ${index + 1}`);
        const status = display(row.current_status ?? row.payment_status ?? row.status, '');
        const reference = display(row.load_ref ?? row.load_id ?? row.registration ?? row.reg_plate ?? row.reg ?? row.invoice_number ?? row.category ?? row.account_type ?? row.reason ?? row.entity_type, '');
        return (
          <div key={`${display(row[idKey], String(index))}:${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 9, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 9, background: C.white, padding: '8px 9px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.navy, fontSize: 10.5, fontWeight: 850, overflowWrap: 'anywhere' }}>{title}</div>
              <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', color: C.muted, fontSize: 8.8 }}>
                {reference && reference !== '—' ? <span>{reference}</span> : null}
                {status && status !== '—' ? <span>· {status}</span> : null}
                {row.created_at ? <span>· {shortDate(row.created_at)}</span> : null}
                {row.updated_at ? <span>· updated {shortDate(row.updated_at)}</span> : null}
              </div>
            </div>
            {kind ? <InspectLink type={kind} id={row[idKey]} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function Domain({ title, description, href, children, defaultOpen = false, warning }: { title: string; description: string; href?: string; children: React.ReactNode; defaultOpen?: boolean; warning?: string | null }) {
  return (
    <details open={defaultOpen} style={{ border: `1px solid ${C.border}`, borderRadius: 13, background: C.white, overflow: 'hidden' }}>
      <summary style={{ minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', listStyle: 'none', padding: '10px 12px', background: '#fbfcfe' }}>
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', color: C.navy, fontSize: 12, fontWeight: 900 }}>{title}</strong>
          <span style={{ display: 'block', marginTop: 3, color: C.muted, fontSize: 9.2, lineHeight: 1.4 }}>{description}</span>
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {warning ? <StatePill tone="warning">Source note</StatePill> : null}
          {href ? <Link href={href} onClick={(event) => event.stopPropagation()} style={{ color: C.blue, fontSize: 9, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' }}>Open module →</Link> : null}
        </span>
      </summary>
      <div style={{ borderTop: `1px solid ${C.border}`, padding: 12 }}>
        {warning ? <div style={{ marginBottom: 10, borderLeft: `3px solid ${C.orange}`, background: '#fffaf0', padding: '7px 9px', color: '#806b43', fontSize: 9.3 }}>{warning}</div> : null}
        {children}
      </div>
    </details>
  );
}

export default function Company360Panel({ companyId }: { companyId: string }) {
  const [payload, setPayload] = useState<Company360Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('No active Platform Owner session.');
      const response = await fetch(`/api/super-admin/inspect/company/${encodeURIComponent(companyId)}/360`, { headers: { Authorization: auth }, cache: 'no-store' });
      const body = await response.json().catch(() => ({})) as Company360Payload;
      if (!response.ok) throw new Error(body.error ?? 'Company 360 data is unavailable.');
      setPayload(body);
    } catch (caught) {
      setPayload(null);
      setError(caught instanceof Error ? caught.message : 'Company 360 data is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const s = payload?.summary ?? {};
  const company = payload?.company ?? {};
  const membershipRows = payload?.people?.memberships ?? [];
  const peopleRows = useMemo(() => membershipRows.map((row) => {
    const profile = row.profile && typeof row.profile === 'object' ? row.profile as AnyRow : {};
    return { ...row, title: profile.full_name ?? row.invited_email ?? 'Company member', status: row.status ?? profile.status, reference: row.role_in_company ?? profile.role, id: row.user_id };
  }), [membershipRows]);

  if (loading) return <div style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 14, color: C.muted, fontSize: 10 }}>Loading Company 360…</div>;
  if (error || !payload) return <div style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.red}`, borderRadius: 14, background: C.white, padding: 12, color: C.text, fontSize: 10 }}><strong>Company 360 unavailable.</strong> {error}</div>;

  const missingDocs = payload.onboarding?.missingDocuments ?? [];
  const docs = [...(payload.compliance?.driverDocuments ?? []), ...(payload.compliance?.vehicleDocuments ?? [])];
  const docIssueRows = docs.filter((row) => String(row.status ?? '').toLowerCase() !== 'approved' || (typeof row.expiry_date === 'string' && row.expiry_date < new Date().toISOString().slice(0, 10)));

  return (
    <section style={{ marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 16, background: C.bg, padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}><StatePill>SUPER ADMIN VIEW</StatePill><StatePill tone={String(company.status ?? '').toLowerCase() === 'active' ? 'success' : 'warning'}>{display(company.status)}</StatePill></div>
          <h2 style={{ margin: '8px 0 0', color: C.navy, fontSize: 19, fontWeight: 900 }}>Company 360</h2>
          <p style={{ margin: '5px 0 0', color: C.muted, fontSize: 10.2, lineHeight: 1.5 }}>Platform Owner dossier: company identity, onboarding, compliance, people, fleet, operations, marketplace, finance, support, notifications and governance history in one place.</p>
        </div>
        <button type="button" onClick={() => void load()} style={{ minHeight: 34, border: `1px solid ${C.blue}`, borderRadius: 9, background: C.white, color: C.blue, padding: '0 11px', fontSize: 9.5, fontWeight: 850, cursor: 'pointer' }}>Refresh 360</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 12 }}>
        <Metric label="Onboarding" value={`${display(s.onboardingCompletion, '0')}%`} note={`${display(s.onboardingStatus, 'not started')} · ${display(s.onboardingStep, 'no step')}`} tone={Number(s.onboardingCompletion ?? 0) >= 100 ? 'success' : 'warning'} />
        <Metric label="Document issues" value={s.documentIssues} note={`${display(s.expiredDocuments, '0')} expired · ${display(s.pendingDocuments, '0')} pending`} tone={Number(s.documentIssues ?? 0) > 0 ? 'warning' : 'success'} />
        <Metric label="People / Drivers" value={`${display(s.members, '0')} / ${display(s.drivers, '0')}`} note="members / drivers" />
        <Metric label="Vehicles" value={s.vehicles} note="company fleet records" />
        <Metric label="Active jobs" value={s.activeJobs} note={`${display(s.postedJobs, '0')} posted · ${display(s.awardedJobs, '0')} awarded`} />
        <Metric label="Unpaid invoices" value={s.unpaidInvoices} note={`${display(s.invoices, '0')} invoices total`} tone={Number(s.unpaidInvoices ?? 0) > 0 ? 'warning' : 'success'} />
        <Metric label="Open support" value={s.openTickets} note={`${display(s.supportTickets, '0')} support tickets`} tone={Number(s.openTickets ?? 0) > 0 ? 'warning' : 'success'} />
        <Metric label="Open cases" value={s.openCases} note={`${display(s.failedNotifications, '0')} failed notifications`} tone={Number(s.openCases ?? 0) > 0 ? 'danger' : 'success'} />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <Domain title="1. Identity & platform governance" description="Canonical company identity, contact information, legal identifiers and platform lifecycle." defaultOpen>
          <Fields rows={[
            ['Legal name', company.legal_name], ['Trading name', company.trading_name ?? company.name], ['Company number', company.company_number], ['VAT number', company.vat_number], ['XDrive ID', company.xd_id], ['Company type', company.company_type],
            ['Email', company.email], ['Phone', company.phone], ['Website', company.website], ['City', company.city], ['Postcode', company.postcode], ['Country', company.country], ['Created', shortDate(company.created_at)], ['Updated', shortDate(company.updated_at)],
          ]} />
        </Domain>

        <Domain title="2. Onboarding & verification" description="Latest onboarding state, completion, risk assessment, missing requirements and application history." href="/super-admin/companies/verification" warning={payload.onboarding?.note}>
          <Fields rows={[
            ['Status', payload.onboarding?.latest?.status], ['Current step', payload.onboarding?.latest?.current_step], ['Completion', `${display(payload.onboarding?.latest?.completion_percentage, '0')}%`], ['Account type', payload.onboarding?.latest?.account_type], ['Risk status', payload.onboarding?.latest?.risk_status], ['Risk reason', payload.onboarding?.latest?.risk_reason], ['Submitted', shortDate(payload.onboarding?.latest?.submitted_at)], ['Last activity', shortDate(payload.onboarding?.latest?.last_activity_at)],
          ]} />
          <div style={{ marginTop: 10 }}><strong style={{ color: C.navy, fontSize: 10 }}>Missing onboarding requirements</strong><div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>{missingDocs.length ? missingDocs.map((doc) => <StatePill key={doc} tone="warning">{doc}</StatePill>) : <StatePill tone="success">No missing requirements returned</StatePill>}</div></div>
        </Domain>

        <Domain title="3. Documents & compliance" description="Driver and vehicle document estate, pending/rejected items and expiries associated with this company." href="/super-admin/companies/compliance" warning={payload.compliance?.note}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 9 }}><StatePill>{docs.length} documents loaded</StatePill><StatePill tone={docIssueRows.length ? 'warning' : 'success'}>{docIssueRows.length} issues</StatePill></div>
          <RowList rows={docIssueRows} empty="No pending, rejected or expired driver/vehicle document issues returned." />
        </Domain>

        <Domain title="4. People & access" description="Company memberships, tenant roles and linked user identities." href="/super-admin/users" warning={payload.people?.note}>
          <RowList rows={peopleRows} kind="user" empty="No company memberships returned." />
        </Domain>

        <Domain title="5. Drivers & fleet" description="Drivers, operational availability and company vehicles linked to this organisation." href="/super-admin/users/drivers" warning={payload.fleet?.note}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Drivers</strong><div style={{ marginTop: 6 }}><RowList rows={payload.fleet?.drivers ?? []} kind="driver" /></div></div>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Vehicles</strong><div style={{ marginTop: 6 }}><RowList rows={payload.fleet?.vehicles ?? []} kind="vehicle" /></div></div>
          </div>
        </Domain>

        <Domain title="6. Operations" description="Jobs posted by the company and work awarded to the company for execution." href="/super-admin/operations/jobs">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Posted jobs</strong><div style={{ marginTop: 6 }}><RowList rows={payload.operations?.postedJobs ?? []} kind="job" /></div></div>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Awarded execution</strong><div style={{ marginTop: 6 }}><RowList rows={payload.operations?.awardedJobs ?? []} kind="job" /></div></div>
          </div>
        </Domain>

        <Domain title="7. Marketplace activity" description="Quotes submitted/owned by the company and marketplace bids placed by it." href="/super-admin/marketplace">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Quotes</strong><div style={{ marginTop: 6 }}><RowList rows={payload.marketplace?.quotes ?? []} /></div></div>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Bids</strong><div style={{ marginTop: 6 }}><RowList rows={payload.marketplace?.bids ?? []} /></div></div>
          </div>
        </Domain>

        <Domain title="8. Finance" description="Invoices, payment ledger records and invoice disputes associated with the company." href="/super-admin/finance" warning={payload.finance?.note}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Invoices</strong><div style={{ marginTop: 6 }}><RowList rows={payload.finance?.invoices ?? []} kind="invoice" /></div></div>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Payments</strong><div style={{ marginTop: 6 }}><RowList rows={payload.finance?.payments ?? []} /></div></div>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Invoice disputes</strong><div style={{ marginTop: 6 }}><RowList rows={payload.finance?.disputes ?? []} /></div></div>
          </div>
        </Domain>

        <Domain title="9. Support, disputes & Platform Cases" description="Support tickets, commercial disputes and cross-workspace Platform Owner investigation cases." href="/super-admin/cases" warning={payload.support?.note}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Support tickets</strong><div style={{ marginTop: 6 }}><RowList rows={payload.support?.tickets ?? []} kind="ticket" /></div></div>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Platform cases</strong><div style={{ marginTop: 6 }}><RowList rows={payload.support?.cases ?? []} kind="case" /></div></div>
            <div><strong style={{ color: C.navy, fontSize: 10 }}>Invoice/support disputes</strong><div style={{ marginTop: 6 }}><RowList rows={payload.support?.disputes ?? []} /></div></div>
          </div>
        </Domain>

        <Domain title="10. Notifications & communications" description="Company/onboarding notification events and their delivery state." href="/super-admin/notifications" warning={payload.notifications?.note}>
          <RowList rows={payload.notifications?.rows ?? []} />
        </Domain>

        <Domain title="11. Audit & governance history" description="Durable Platform Owner governance actions recorded against this company boundary." href="/super-admin/settings/audit-logs" warning={payload.audit?.note}>
          <RowList rows={payload.audit?.rows ?? []} />
        </Domain>
      </div>
    </section>
  );
}
