'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
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
  name: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postcode: '',
  country: 'United Kingdom',
};

const inputStyle = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '0.62rem 0.7rem',
  fontSize: '0.82rem',
  color: '#0f172a',
  background: '#ffffff',
} as const;

const labelStyle = {
  display: 'grid',
  gap: '0.32rem',
  color: '#334155',
  fontSize: '0.72rem',
  fontWeight: 800,
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
      .select(
        'id, name, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country, status, company_type'
      )
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

  useEffect(() => {
    void load();
  }, [load]);

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
      .select(
        'id, name, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country, status, company_type'
      )
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
        eyebrow="Customer administration"
        title="Settings"
        description="Edit the customer company identity and contact details that are supported by the live company schema. Unsupported preferences are not presented as saved settings."
        actions={
          <ActionButton
            tone="primary"
            disabled={loading || saving || !company}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save company profile'}
          </ActionButton>
        }
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Loads" value={workspace.jobs.length} tone="blue" />
        <KpiCard label="Invoices" value={workspace.invoices.length} tone="navy" />
        <KpiCard
          label="Company status"
          value={company?.status?.replace(/_/g, ' ') ?? 'Not loaded'}
          tone={company?.status === 'active' ? 'green' : 'orange'}
        />
      </KpiGrid>

      {loading ? (
        <Panel>
          <EmptyState title="Loading customer settings…" />
        </Panel>
      ) : !company ? (
        <Panel>
          <EmptyState
            title="Customer company profile not found"
            description="The current account is not linked to a readable company record."
          />
        </Panel>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.75fr)',
            gap: '0.9rem',
            alignItems: 'start',
          }}
        >
          <Panel
            title="Company profile"
            description="These values are written only to the active customer company record and remain protected by company RLS."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.8rem',
              }}
            >
              <label style={labelStyle}>
                Company name
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Email
                <input
                  type="email"
                  style={inputStyle}
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Phone
                <input
                  style={inputStyle}
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Address line 1
                <input
                  style={inputStyle}
                  value={form.addressLine1}
                  onChange={(event) => updateField('addressLine1', event.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Address line 2
                <input
                  style={inputStyle}
                  value={form.addressLine2}
                  onChange={(event) => updateField('addressLine2', event.target.value)}
                />
              </label>

              <label style={labelStyle}>
                City
                <input
                  style={inputStyle}
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Postcode
                <input
                  style={inputStyle}
                  value={form.postcode}
                  onChange={(event) => updateField('postcode', event.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Country
                <input
                  style={inputStyle}
                  value={form.country}
                  onChange={(event) => updateField('country', event.target.value)}
                />
              </label>
            </div>
          </Panel>

          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <Panel title="Registered identity">
              <DataTable
                columns={['Field', 'Value']}
                rows={[
                  ['Company number', company.company_number ?? 'Not recorded'],
                  ['VAT number', company.vat_number ?? 'Not recorded'],
                  [
                    'Workspace type',
                    company.company_type?.replace(/_/g, ' ') ?? 'Customer',
                  ],
                  [
                    'Status',
                    <StatusBadge
                      key="company-status"
                      value={company.status ?? 'unknown'}
                    />,
                  ],
                ]}
              />
            </Panel>

            <Panel
              title="Configuration boundary"
              description="Only fields backed by the current live schema are editable."
            >
              <p
                style={{
                  margin: 0,
                  color: '#64748b',
                  fontSize: '0.78rem',
                  lineHeight: 1.55,
                }}
              >
                Collection contacts, delivery contacts, payment terms and granular
                notification preferences require dedicated persistent fields and
                server-side validation. They remain unavailable rather than being
                displayed as options that are not actually saved.
              </p>
            </Panel>
          </div>
        </div>
      )}
    </PageFrame>
  );
}
