'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { AccountSectionNav } from './AccountSectionNav';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type CompanyRow = {
  id: string;
  name: string;
  company_number: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  status: string | null;
  company_type: string | null;
};

type SettingsForm = {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
};

const EMPTY_FORM: SettingsForm = {
  name: '', email: '', phone: '', addressLine1: '', addressLine2: '', city: '', postcode: '', country: 'United Kingdom',
};

const inputStyle = {
  width: '100%',
  minHeight: 32,
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  padding: '0 8px',
  fontSize: 12,
  color: '#0f172a',
  background: '#ffffff',
} as const;

const labelStyle = {
  display: 'grid',
  gap: 4,
  color: '#334155',
  fontSize: 11,
  lineHeight: '14px',
  fontWeight: 700,
} as const;

const nullable = (value: string) => value.trim() || null;

const toForm = (company: CompanyRow): SettingsForm => ({
  name: company.name ?? '',
  email: company.email ?? '',
  phone: company.phone ?? '',
  addressLine1: company.address_line1 ?? '',
  addressLine2: company.address_line2 ?? '',
  city: company.city ?? '',
  postcode: company.postcode ?? '',
  country: company.country ?? 'United Kingdom',
});

export default function CustomerCompanySettingsPage() {
  const router = useRouter();
  const workspace = useCompanyWorkspaceData();
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!workspace.companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: queryError } = await supabase
      .from('companies')
      .select('id, name, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country, status, company_type')
      .eq('id', workspace.companyId)
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setCompany(null);
    } else if (data) {
      const resolved = data as CompanyRow;
      setCompany(resolved);
      setForm(toForm(resolved));
    } else {
      setCompany(null);
    }

    setLoading(false);
  }, [workspace.companyId]);

  useEffect(() => { void load(); }, [load]);

  const updateField = (field: keyof SettingsForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const save = async () => {
    if (!workspace.companyId) return;
    if (form.name.trim().length < 2) {
      setError('Company name must contain at least two characters.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const { data, error: updateError } = await supabase
      .from('companies')
      .update({
        name: form.name.trim(),
        email: nullable(form.email),
        phone: nullable(form.phone),
        address_line1: nullable(form.addressLine1),
        address_line2: nullable(form.addressLine2),
        city: nullable(form.city),
        postcode: nullable(form.postcode.toUpperCase()),
        country: form.country.trim() || 'United Kingdom',
      })
      .eq('id', workspace.companyId)
      .select('id, name, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country, status, company_type')
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
    } else if (data) {
      const resolved = data as CompanyRow;
      setCompany(resolved);
      setForm(toForm(resolved));
      setMessage('Customer company profile saved successfully.');
    } else {
      setError('The company profile could not be reloaded after saving.');
    }
    setSaving(false);
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer account"
        title="Account"
        description="Company identity, account tools and customer workspace administration in one compact account area."
        actions={<ActionButton tone="primary" disabled={loading || saving || !company} onClick={() => void save()}>{saving ? 'Saving…' : 'Save profile'}</ActionButton>}
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}

      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
        <AccountSectionNav
          title="Account sections"
          items={[
            { id: 'profile', label: 'Company Profile', detail: 'Identity and contact details', active: true, onClick: () => undefined },
            { id: 'team', label: 'Team', detail: 'Customer workspace members', onClick: () => router.push('/customer/team') },
            { id: 'invoices', label: 'Invoices', detail: 'Customer billing records', onClick: () => router.push('/customer/invoices') },
            { id: 'notifications', label: 'Notifications', detail: 'Workspace notifications', onClick: () => router.push('/customer/notifications') },
            { id: 'settings', label: 'Settings route', detail: 'Legacy-compatible account entry', onClick: () => router.push('/customer/settings') },
          ]}
          footer={<span style={{ color: '#64748b', fontSize: 10, lineHeight: '13px' }}>Only settings backed by the current verified schema are editable.</span>}
        />

        <main style={{ minWidth: 0, display: 'grid', gap: 8 }}>
          {loading ? (
            <Panel><EmptyState compact title="Loading customer account…" /></Panel>
          ) : !company ? (
            <Panel><EmptyState title="Customer company profile not found" description="The current account is not linked to a readable company record." /></Panel>
          ) : (
            <>
              <Panel title="Company profile" description="These fields are written only to the active customer company record and remain protected by company RLS.">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
                  <label style={labelStyle}>Company name<input style={inputStyle} value={form.name} onChange={(event) => updateField('name', event.target.value)} /></label>
                  <label style={labelStyle}>Email<input type="email" style={inputStyle} value={form.email} onChange={(event) => updateField('email', event.target.value)} /></label>
                  <label style={labelStyle}>Phone<input style={inputStyle} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} /></label>
                  <label style={labelStyle}>Address line 1<input style={inputStyle} value={form.addressLine1} onChange={(event) => updateField('addressLine1', event.target.value)} /></label>
                  <label style={labelStyle}>Address line 2<input style={inputStyle} value={form.addressLine2} onChange={(event) => updateField('addressLine2', event.target.value)} /></label>
                  <label style={labelStyle}>City<input style={inputStyle} value={form.city} onChange={(event) => updateField('city', event.target.value)} /></label>
                  <label style={labelStyle}>Postcode<input style={inputStyle} value={form.postcode} onChange={(event) => updateField('postcode', event.target.value)} /></label>
                  <label style={labelStyle}>Country<input style={inputStyle} value={form.country} onChange={(event) => updateField('country', event.target.value)} /></label>
                </div>
              </Panel>

              <Panel title="Registered identity">
                <DataTable columns={['Field', 'Value']} rows={[
                  ['Company number', company.company_number ?? 'Not recorded'],
                  ['VAT number', company.vat_number ?? 'Not recorded'],
                  ['Workspace type', company.company_type?.replace(/_/g, ' ') ?? 'Customer'],
                  ['Status', <StatusBadge key="company-status" value={company.status ?? 'unknown'} />],
                ]} />
              </Panel>

              <Panel title="Configuration boundary" description="Unsupported preferences are not presented as if they were saved.">
                <p style={{ margin: 0, color: '#64748b', fontSize: 11, lineHeight: '15px' }}>
                  Job-specific collection contacts, delivery contacts, payment terms and execution instructions belong to the transport record. Additional account preferences require a verified persistent source and remain unavailable until that contract exists.
                </p>
              </Panel>
            </>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
