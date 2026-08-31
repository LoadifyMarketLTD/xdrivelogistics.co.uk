'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type AnyRow = Record<string, unknown>;
type Company360Payload = {
  company?: AnyRow;
  summary?: Record<string, unknown>;
  onboarding?: { available?: boolean; latest?: AnyRow | null; applications?: AnyRow[]; missingDocuments?: string[]; missingDocumentsAvailable?: boolean; note?: string | null };
  people?: { available?: boolean; memberships?: AnyRow[]; governanceProfiles?: { createdBy?: AnyRow | null; reviewedBy?: AnyRow | null }; note?: string | null };
  fleet?: { available?: boolean; drivers?: AnyRow[]; vehicles?: AnyRow[]; note?: string | null };
  compliance?: { available?: boolean; companyDocuments?: AnyRow[]; driverDocuments?: AnyRow[]; vehicleDocuments?: AnyRow[]; fraudCases?: AnyRow[]; missingOnboardingDocuments?: string[]; note?: string | null };
  operations?: { postedJobs?: AnyRow[]; awardedJobs?: AnyRow[]; jobDisputes?: AnyRow[] };
  marketplace?: { quotes?: AnyRow[]; bids?: AnyRow[]; disputes?: AnyRow[] };
  finance?: { invoices?: AnyRow[]; payments?: AnyRow[]; disputes?: AnyRow[]; note?: string | null };
  support?: { tickets?: AnyRow[]; complaints?: AnyRow[]; invoiceDisputes?: AnyRow[]; jobDisputes?: AnyRow[]; cases?: AnyRow[]; fraudCases?: AnyRow[]; casesAvailable?: boolean; note?: string | null };
  notifications?: { rows?: AnyRow[]; note?: string | null };
  audit?: { rows?: AnyRow[]; available?: boolean; note?: string | null };
  error?: string;
};

const C = { navy: '#082a61', blue: '#1d57d8', orange: '#f59e0b', green: '#168553', red: '#d92d20', purple: '#7c3aed', text: '#172033', muted: '#66778e', border: '#dfe6ef', bg: '#f7f9fc', white: '#fff' } as const;

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

const rowTitle = (row: AnyRow, index: number) => display(
  row.title ?? row.subject ?? row.display_name ?? row.full_name ?? row.name ?? row.invoice_number ?? row.reference ?? row.event_type ?? row.action_type ?? row.doc_type ?? row.case_type ?? row.comment ?? row.description ?? row.reason ?? row.id,
  `Record ${index + 1}`,
);

function StatePill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warning' | 'danger' | 'success' | 'purple' }) {
  const color = tone === 'warning' ? C.orange : tone === 'danger' ? C.red : tone === 'success' ? C.green : tone === 'purple' ? C.purple : C.blue;
  return <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, border: `1px solid ${color}35`, borderRadius: 999, background: `${color}0d`, color, padding: '2px 8px', fontSize: 9, fontWeight: 850 }}>{children}</span>;
}

function Metric({ label, value, note, tone = 'default' }: { label: string; value: unknown; note?: string; tone?: 'default' | 'warning' | 'danger' | 'success' | 'purple' }) {
  const color = tone === 'warning' ? C.orange : tone === 'danger' ? C.red : tone === 'success' ? C.green : tone === 'purple' ? C.purple : C.blue;
  return (
    <div style={{ minHeight: 90, border: `1px solid ${C.border}`, borderRadius: 13, background: C.white, padding: 12 }}>
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
          <div style={{ marginTop: 4, color: C.text, fontSize: 10.5, fontWeight: 700, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{display(value)}</div>
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
        const status = display(row.current_status ?? row.payment_status ?? row.status ?? row.risk_status, '');
        const reference = display(row.load_ref ?? row.load_id ?? row.registration ?? row.reg_plate ?? row.reg ?? row.invoice_number ?? row.category ?? row.account_type ?? row.reason ?? row.entity_type ?? row.role_in_company ?? row.severity, '');
        return (
          <div key={`${display(row[idKey], String(index))}:${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 9, alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 9, background: C.white, padding: '8px 9px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.navy, fontSize: 10.5, fontWeight: 850, overflowWrap: 'anywhere' }}>{rowTitle(row, index)}</div>
              <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', color: C.muted, fontSize: 8.8 }}>
                {reference && reference !== '—' ? <span>{reference}</span> : null}
                {status && status !== '—' ? <span>· {status}</span> : null}
                {row.rating !== null && row.rating !== undefined ? <span>· rating {display(row.rating)}/5</span> : null}
                {row.amount !== null && row.amount !== undefined ? <span>· {display(row.currency, 'GBP')} {display(row.amount)}</span> : null}
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

function Domain({ title, description, href, children, defaultOpen = false, warning }: { title: string; description: string; href?: string; children: ReactNode; defaultOpen?: boolean; warning?: string | null }) {
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

const Subheading = ({ children }: { children: ReactNode }) => <strong style={{ display: 'block', marginBottom: 6, color: C.navy, fontSize: 10 }}>{children}</strong>;

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
  const peopleRows = useMemo(() => (payload?.people?.memberships ?? []).map((row) => {
    const profile = row.profile && typeof row.profile === 'object' ? row.profile as AnyRow : {};
    return { ...row, title: profile.full_name ?? row.invited_email ?? 'Company member', status: row.status ?? profile.status, reference: row.role_in_company ?? profile.role, id: row.user_id };
  }), [payload?.people?.memberships]);

  if (loading) return <div style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 14, color: C.muted, fontSize: 10 }}>Loading Company 360…</div>;
  if (error || !payload) return <div style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.red}`, borderRadius: 14, background: C.white, padding: 12, color: C.text, fontSize: 10 }}><strong>Company 360 unavailable.</strong> {error}</div>;

  const hasOnboarding = Boolean(payload.onboarding?.latest?.id);
  const onboardingCompletion = hasOnboarding ? Number(payload.onboarding?.latest?.completion_percentage ?? 0) : null;
  const missingDocs = payload.onboarding?.missingDocuments ?? [];
  const companyDocs = payload.compliance?.companyDocuments ?? [];
  const driverDocs = payload.compliance?.driverDocuments ?? [];
  const vehicleDocs = payload.compliance?.vehicleDocuments ?? [];
  const docs = [...companyDocs, ...driverDocs, ...vehicleDocs];
  const now = new Date().toISOString().slice(0, 10);
  const docIssueRows = docs.filter((row) => {
    const status = String(row.status ?? '').toLowerCase();
    const risk = String(row.risk_status ?? '').toLowerCase();
    const expired = typeof row.expiry_date === 'string' && row.expiry_date < now;
    return status !== 'approved' || expired || !['', 'clear', 'none', 'ok'].includes(risk);
  });
  const completionNeeded = (hasOnboarding && Number(onboardingCompletion) < 100) || missingDocs.length > 0 || docIssueRows.length > 0;
  const createdBy = company.created_by_profile && typeof company.created_by_profile === 'object' ? company.created_by_profile as AnyRow : {};
  const reviewedBy = company.reviewed_by_profile && typeof company.reviewed_by_profile === 'object' ? company.reviewed_by_profile as AnyRow : {};

  return (
    <section style={{ marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 16, background: C.bg, padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatePill>SUPER ADMIN VIEW</StatePill>
            <StatePill tone={String(company.status ?? '').toLowerCase() === 'active' ? 'success' : 'warning'}>{display(company.status)}</StatePill>
            {!hasOnboarding ? <StatePill tone="warning">No canonical onboarding record</StatePill> : completionNeeded ? <StatePill tone="warning">Completion required</StatePill> : <StatePill tone="success">Onboarding/document preflight clear</StatePill>}
          </div>
          <h2 style={{ margin: '8px 0 0', color: C.navy, fontSize: 20, fontWeight: 900 }}>Company 360</h2>
          <p style={{ margin: '5px 0 0', maxWidth: 900, color: C.muted, fontSize: 10.2, lineHeight: 1.5 }}>Platform Owner dossier: identity, governance, onboarding, company/driver/vehicle compliance, people, fleet, operations, marketplace, finance, support, disputes, cases, notifications and durable audit history in one place.</p>
        </div>
        <button type="button" onClick={() => void load()} style={{ minHeight: 34, border: `1px solid ${C.blue}`, borderRadius: 9, background: C.white, color: C.blue, padding: '0 11px', fontSize: 9.5, fontWeight: 850, cursor: 'pointer' }}>Refresh 360</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8, marginBottom: 12 }}>
        <Metric label="Onboarding" value={hasOnboarding ? `${onboardingCompletion}%` : 'No record'} note={hasOnboarding ? `${display(s.onboardingStatus, 'unknown')} · ${display(s.onboardingStep, 'no step')}` : 'Canonical onboarding provenance not found'} tone={hasOnboarding && Number(onboardingCompletion) >= 100 ? 'success' : 'warning'} />
        <Metric label="Document issues" value={docIssueRows.length} note={`${display(s.companyDocuments, '0')} company docs · ${display(s.expiredDocuments, '0')} expired`} tone={docIssueRows.length > 0 ? 'warning' : 'success'} />
        <Metric label="People / Drivers" value={`${display(s.members, '0')} / ${display(s.drivers, '0')}`} note="members / drivers" />
        <Metric label="Vehicles" value={s.vehicles} note="company fleet records" />
        <Metric label="Active jobs" value={s.activeJobs} note={`${display(s.postedJobs, '0')} posted · ${display(s.awardedJobs, '0')} awarded`} />
        <Metric label="Unpaid invoices" value={s.unpaidInvoices} note={`${display(s.invoices, '0')} invoices involving company`} tone={Number(s.unpaidInvoices ?? 0) > 0 ? 'warning' : 'success'} />
        <Metric label="Open exceptions" value={Number(s.openJobDisputes ?? 0) + Number(s.openInvoiceDisputes ?? 0)} note={`${display(s.openFraudCases, '0')} fraud · ${display(s.openCases, '0')} platform cases`} tone={Number(s.openJobDisputes ?? 0) + Number(s.openInvoiceDisputes ?? 0) + Number(s.openFraudCases ?? 0) + Number(s.openCases ?? 0) > 0 ? 'danger' : 'success'} />
        <Metric label="Communications" value={s.failedNotifications} note={`${display(s.openTickets, '0')} open support · ${display(s.auditEvents, '0')} audit events`} tone={Number(s.failedNotifications ?? 0) > 0 ? 'danger' : 'success'} />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <Domain title="1. Identity, legal record & platform governance" description="Canonical identity, legal/contact data, registered address, review state and Platform Owner governance metadata." defaultOpen>
          <Fields rows={[
            ['Stable company ID', company.id], ['XDrive ID', company.xd_id], ['Legal name', company.legal_name], ['Trading name', company.trading_name ?? company.name], ['Company number', company.company_number], ['VAT number', company.vat_number], ['Company type', company.company_type], ['Platform status', company.status],
            ['Email', company.email], ['Phone', company.phone], ['Website', company.website], ['Address line 1', company.address_line1], ['Address line 2', company.address_line2], ['City', company.city], ['Postcode', company.postcode], ['Country', company.country],
            ['Description', company.description], ['International work approved', company.international_work_approved], ['Created by', createdBy.full_name ?? company.created_by], ['Created', shortDate(company.created_at)], ['Last updated', shortDate(company.updated_at)], ['Reviewed by', reviewedBy.full_name ?? company.reviewed_by], ['Reviewed at', shortDate(company.reviewed_at)], ['Review notes', company.review_notes],
          ]} />
        </Domain>

        <Domain title="2. Onboarding, verification & Request completion" description="Latest onboarding state, completion, risk assessment, missing requirements and every linked onboarding application." href="/super-admin/companies/verification" warning={payload.onboarding?.note}>
          {hasOnboarding ? (
            <Fields rows={[
              ['Status', payload.onboarding?.latest?.status], ['Current step', payload.onboarding?.latest?.current_step], ['Completion', `${onboardingCompletion}%`], ['Account type', payload.onboarding?.latest?.account_type], ['Workspace mode', payload.onboarding?.latest?.workspace_mode], ['Owner-driver workspace', payload.onboarding?.latest?.owner_driver_workspace], ['Risk status', payload.onboarding?.latest?.risk_status], ['Risk reason', payload.onboarding?.latest?.risk_reason], ['Review notes', payload.onboarding?.latest?.review_notes], ['Submitted', shortDate(payload.onboarding?.latest?.submitted_at)], ['Reviewed', shortDate(payload.onboarding?.latest?.reviewed_at)], ['Last activity', shortDate(payload.onboarding?.latest?.last_activity_at)],
            ]} />
          ) : (
            <div style={{ borderLeft: `4px solid ${C.orange}`, borderRadius: 9, background: '#fffaf0', padding: 10, color: '#806b43', fontSize: 9.6, lineHeight: 1.5 }}><strong>No canonical onboarding application is linked to this company.</strong> This is shown as a provenance gap, not automatically treated as an incomplete onboarding flow. Review the company history before requesting completion.</div>
          )}
          <div style={{ marginTop: 10, border: `1px solid ${completionNeeded ? '#efc36f' : '#b7dec9'}`, borderRadius: 11, background: completionNeeded ? '#fffaf0' : '#f4fbf7', padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ color: completionNeeded ? '#8a5800' : C.green, fontSize: 10.5 }}>{completionNeeded ? 'Request completion preflight' : hasOnboarding ? 'Onboarding/document preflight clear' : 'Completion request not automatically available'}</strong>
                <div style={{ marginTop: 3, color: C.muted, fontSize: 9.2 }}>{!hasOnboarding ? 'A missing onboarding record is an investigation/provenance issue; it is not enough by itself to send a completion request.' : 'The live read model identifies incomplete onboarding plus missing, pending, rejected, expired or risky documents before a request is sent.'}</div>
              </div>
              {completionNeeded ? <StatePill tone="warning">Visual send action only — no mutation yet</StatePill> : !hasOnboarding ? <StatePill tone="warning">Investigate provenance</StatePill> : <StatePill tone="success">No request needed</StatePill>}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {missingDocs.length ? missingDocs.map((doc) => <StatePill key={doc} tone="warning">Missing: {doc}</StatePill>) : hasOnboarding ? <StatePill tone="success">No canonical missing onboarding docs returned</StatePill> : null}
              {docIssueRows.length ? <StatePill tone="warning">{docIssueRows.length} uploaded document issue(s)</StatePill> : null}
            </div>
          </div>
          {payload.onboarding?.applications?.length ? <div style={{ marginTop: 10 }}><Subheading>Onboarding application history</Subheading><RowList rows={payload.onboarding.applications} /></div> : null}
        </Domain>

        <Domain title="3. Documents, compliance, expiry & fraud" description="Company documents plus driver/vehicle document estate, expiries, review/risk status and fraud-review cases." href="/super-admin/companies/compliance" warning={payload.compliance?.note}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
            <StatePill>{companyDocs.length} company docs</StatePill><StatePill>{driverDocs.length} driver docs</StatePill><StatePill>{vehicleDocs.length} vehicle docs</StatePill>
            <StatePill tone={docIssueRows.length ? 'warning' : 'success'}>{docIssueRows.length} document issues</StatePill>
            <StatePill tone={Number(s.openFraudCases ?? 0) ? 'danger' : 'success'}>{display(s.openFraudCases, '0')} open fraud cases</StatePill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 10 }}>
            <div><Subheading>Company documents</Subheading><RowList rows={companyDocs} empty="No company documents returned." /></div>
            <div><Subheading>Driver documents</Subheading><RowList rows={driverDocs} empty="No driver documents returned." /></div>
            <div><Subheading>Vehicle documents</Subheading><RowList rows={vehicleDocs} empty="No vehicle documents returned." /></div>
            <div><Subheading>Identity & fraud review</Subheading><RowList rows={payload.compliance?.fraudCases ?? []} empty="No fraud-review cases returned." /></div>
          </div>
        </Domain>

        <Domain title="4. People, memberships & access authority" description="Every company membership, tenant role, linked user profile and governance account relationship." href="/super-admin/users" warning={payload.people?.note}>
          <RowList rows={peopleRows} kind="user" empty="No company memberships returned." />
        </Domain>

        <Domain title="5. Drivers & fleet" description="Drivers, account/readiness state, operational availability and all vehicles linked to this company." href="/super-admin/users/drivers" warning={payload.fleet?.note}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
            <div><Subheading>Drivers</Subheading><RowList rows={payload.fleet?.drivers ?? []} kind="driver" /></div>
            <div><Subheading>Vehicles</Subheading><RowList rows={payload.fleet?.vehicles ?? []} kind="vehicle" /></div>
          </div>
        </Domain>

        <Domain title="6. Operations, delivery work & disputes" description="Jobs posted by this company, jobs awarded to it for execution and disputes attached to that operational footprint." href="/super-admin/operations/jobs">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
            <div><Subheading>Posted jobs</Subheading><RowList rows={payload.operations?.postedJobs ?? []} kind="job" /></div>
            <div><Subheading>Awarded execution</Subheading><RowList rows={payload.operations?.awardedJobs ?? []} kind="job" /></div>
            <div><Subheading>Job disputes</Subheading><RowList rows={payload.operations?.jobDisputes ?? []} kind="dispute" /></div>
          </div>
        </Domain>

        <Domain title="7. Marketplace activity" description="Quotes, carrier bids and marketplace disputes involving this company." href="/super-admin/marketplace">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 10 }}>
            <div><Subheading>Quotes</Subheading><RowList rows={payload.marketplace?.quotes ?? []} /></div>
            <div><Subheading>Bids</Subheading><RowList rows={payload.marketplace?.bids ?? []} /></div>
            <div><Subheading>Marketplace disputes</Subheading><RowList rows={payload.marketplace?.disputes ?? []} kind="dispute" /></div>
          </div>
        </Domain>

        <Domain title="8. Finance, invoices & payments" description="All invoices where the company is issuer, buyer or supplier, plus payment ledger records and invoice disputes." href="/super-admin/finance" warning={payload.finance?.note}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 10 }}>
            <div><Subheading>Invoices</Subheading><RowList rows={payload.finance?.invoices ?? []} kind="invoice" /></div>
            <div><Subheading>Payment ledger</Subheading><RowList rows={payload.finance?.payments ?? []} /></div>
            <div><Subheading>Invoice disputes</Subheading><RowList rows={payload.finance?.disputes ?? []} /></div>
          </div>
        </Domain>

        <Domain title="9. Support, complaints, disputes & Platform Cases" description="Support tickets, reviews/complaints, commercial disputes, fraud cases and persistent Platform Owner cases." href="/super-admin/cases" warning={payload.support?.note}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            <div><Subheading>Support tickets</Subheading><RowList rows={payload.support?.tickets ?? []} kind="ticket" /></div>
            <div><Subheading>Complaints / reviews</Subheading><RowList rows={payload.support?.complaints ?? []} /></div>
            <div><Subheading>Platform cases</Subheading><RowList rows={payload.support?.cases ?? []} kind="case" /></div>
            <div><Subheading>Job disputes</Subheading><RowList rows={payload.support?.jobDisputes ?? []} kind="dispute" /></div>
            <div><Subheading>Invoice disputes</Subheading><RowList rows={payload.support?.invoiceDisputes ?? []} /></div>
            <div><Subheading>Fraud review</Subheading><RowList rows={payload.support?.fraudCases ?? []} /></div>
          </div>
        </Domain>

        <Domain title="10. Notifications & communications" description="Company-bound and onboarding notification events, delivery state, attempts and failures." href="/super-admin/notifications" warning={payload.notifications?.note}>
          <RowList rows={payload.notifications?.rows ?? []} />
        </Domain>

        <Domain title="11. Durable audit & governance history" description="Platform Owner governance actions against this company boundary, including status transitions, reasons and audit metadata." href="/super-admin/settings/audit-logs" warning={payload.audit?.note}>
          <RowList rows={payload.audit?.rows ?? []} />
        </Domain>
      </div>
    </section>
  );
}
