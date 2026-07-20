'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
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

type CompanySettingsRow = {
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
  status: string;
  company_type: string | null;
};

type CompanySettingsForm = {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  country: string;
};

type MembershipRow = {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  role_in_company: string;
  status: string;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  status: string | null;
};

const EMPTY_FORM: CompanySettingsForm = {
  name: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
  country: 'United Kingdom',
};

const fieldStyle = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '0.62rem 0.7rem',
  fontSize: '0.82rem',
  color: '#0f172a',
  background: '#fff',
} as const;

const labelStyle = {
  display: 'grid',
  gap: '0.32rem',
  color: '#334155',
  fontSize: '0.72rem',
  fontWeight: 800,
} as const;

const toForm = (row: CompanySettingsRow): CompanySettingsForm => ({
  name: row.name ?? '',
  email: row.email ?? '',
  phone: row.phone ?? '',
  address_line1: row.address_line1 ?? '',
  address_line2: row.address_line2 ?? '',
  city: row.city ?? '',
  postcode: row.postcode ?? '',
  country: row.country ?? 'United Kingdom',
});

const nullable = (value: string) => value.trim() || null;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export function BrokerCompanySettingsPage() {
  const data = useCompanyWorkspaceData();
  const [company, setCompany] = useState<CompanySettingsRow | null>(null);
  const [form, setForm] = useState<CompanySettingsForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadCompany = useCallback(async () => {
    if (!data.companyId) {
      setLoading(false);
      setCompany(null);
      return;
    }

    setLoading(true);
    setError('');
    const { data: row, error: queryError } = await supabase
      .from('companies')
      .select(
        'id, name, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country, status, company_type'
      )
      .eq('id', data.companyId)
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setCompany(null);
    } else if (row) {
      const resolved = row as CompanySettingsRow;
      setCompany(resolved);
      setForm(toForm(resolved));
    } else {
      setCompany(null);
    }
    setLoading(false);
  }, [data.companyId]);

  useEffect(() => {
    void loadCompany();
  }, [loadCompany]);

  const updateField = (field: keyof CompanySettingsForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const save = async () => {
    if (!data.companyId) return;
    if (form.name.trim().length < 2) {
      setError('Company name must contain at least two characters.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const payload = {
      name: form.name.trim(),
      email: nullable(form.email),
      phone: nullable(form.phone),
      address_line1: nullable(form.address_line1),
      address_line2: nullable(form.address_line2),
      city: nullable(form.city),
      postcode: nullable(form.postcode.toUpperCase()),
      country: form.country.trim() || 'United Kingdom',
    };

    const { data: updated, error: updateError } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', data.companyId)
      .select(
        'id, name, company_number, vat_number, email, phone, address_line1, address_line2, city, postcode, country, status, company_type'
      )
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
    } else if (updated) {
      const resolved = updated as CompanySettingsRow;
      setCompany(resolved);
      setForm(toForm(resolved));
      setMessage('Company profile saved successfully.');
    } else {
      setError('The company profile could not be reloaded after saving.');
    }
    setSaving(false);
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker administration"
        title="Settings"
        description="Edit the company identity and contact details that are already supported by the live company schema. Commercial preferences that do not yet have persistent fields are not presented as saved settings."
        actions={
          <ActionButton tone="primary" disabled={saving || loading || !company} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save company profile'}
          </ActionButton>
        }
      />

      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Managed loads" value={data.jobs.length} tone="blue" />
        <KpiCard label="Invoices" value={data.invoices.length} tone="navy" />
        <KpiCard
          label="Company status"
          value={company?.status?.replace(/_/g, ' ') ?? 'Not loaded'}
          tone={company?.status === 'active' ? 'green' : 'orange'}
        />
      </KpiGrid>

      {loading ? (
        <Panel><EmptyState title="Loading company settings…" /></Panel>
      ) : !company ? (
        <Panel><EmptyState title="Company profile not found" description="The current account is not linked to a readable company record." /></Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.75fr)', gap: '0.9rem', alignItems: 'start' }}>
          <Panel title="Company profile" description="These fields are saved directly to the current broker company record and remain company-scoped by RLS.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
              <label style={labelStyle}>
                Company name
                <input style={fieldStyle} value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              </label>
              <label style={labelStyle}>
                Email
                <input type="email" style={fieldStyle} value={form.email} onChange={(event) => updateField('email', event.target.value)} />
              </label>
              <label style={labelStyle}>
                Phone
                <input style={fieldStyle} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
              </label>
              <label style={labelStyle}>
                Address line 1
                <input style={fieldStyle} value={form.address_line1} onChange={(event) => updateField('address_line1', event.target.value)} />
              </label>
              <label style={labelStyle}>
                Address line 2
                <input style={fieldStyle} value={form.address_line2} onChange={(event) => updateField('address_line2', event.target.value)} />
              </label>
              <label style={labelStyle}>
                City
                <input style={fieldStyle} value={form.city} onChange={(event) => updateField('city', event.target.value)} />
              </label>
              <label style={labelStyle}>
                Postcode
                <input style={fieldStyle} value={form.postcode} onChange={(event) => updateField('postcode', event.target.value)} />
              </label>
              <label style={labelStyle}>
                Country
                <input style={fieldStyle} value={form.country} onChange={(event) => updateField('country', event.target.value)} />
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
                  ['Workspace type', company.company_type?.replace(/_/g, ' ') ?? 'Standard'],
                  ['Status', <StatusBadge key="status" value={company.status} />],
                ]}
              />
            </Panel>
            <Panel title="Configuration boundaries" description="Only settings backed by the current live schema are editable here.">
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.55 }}>
                Customer payment terms, margin thresholds, carrier sourcing rules and granular notification preferences require dedicated persistent fields and server-side validation. They remain intentionally unavailable rather than being displayed as settings that are not actually saved.
              </p>
            </Panel>
          </div>
        </div>
      )}
    </PageFrame>
  );
}

export function CustomerCompanyTeamPage() {
  const { user } = useAuth();
  const workspace = useCompanyWorkspaceData();
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTeam = useCallback(async () => {
    if (!workspace.companyId) {
      setMemberships([]);
      setProfiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data: membershipRows, error: membershipError } = await supabase
      .from('company_memberships')
      .select('id, user_id, invited_email, role_in_company, status, created_at')
      .eq('company_id', workspace.companyId)
      .order('created_at', { ascending: true });

    if (membershipError) {
      setError(membershipError.message);
      setMemberships([]);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const resolvedMemberships = (membershipRows ?? []) as MembershipRow[];
    const userIds = resolvedMemberships
      .map((membership) => membership.user_id)
      .filter((value): value is string => Boolean(value));

    let resolvedProfiles: ProfileRow[] = [];
    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, status')
        .in('user_id', userIds);

      if (profileError) {
        setError(profileError.message);
      } else {
        resolvedProfiles = (profileRows ?? []) as ProfileRow[];
      }
    }

    setMemberships(resolvedMemberships);
    setProfiles(resolvedProfiles);
    setLoading(false);
  }, [workspace.companyId]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const profileByUser = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles]
  );

  const activeCount = memberships.filter((membership) => membership.status === 'active').length;
  const invitedCount = memberships.filter((membership) => membership.status === 'invited').length;
  const adminCount = memberships.filter((membership) =>
    ['owner', 'admin'].includes(membership.role_in_company)
  ).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer administration"
        title="Team"
        description="Company members who can post loads, review quotes, track deliveries or view invoices. Names and profile status are resolved from the company membership and profile records instead of exposing raw user IDs."
        actions={<ActionButton tone="secondary" onClick={() => void loadTeam()}>Refresh</ActionButton>}
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Active members" value={activeCount} tone="green" />
        <KpiCard label="Invited" value={invitedCount} tone="orange" />
        <KpiCard label="Owners / admins" value={adminCount} tone="navy" />
      </KpiGrid>

      <Panel title="Company team" description="The roster is restricted to the active customer company.">
        <DataTable
          columns={['Member', 'Contact', 'Role', 'Membership', 'Profile', 'Joined']}
          rows={memberships.map((membership) => {
            const profile = membership.user_id ? profileByUser.get(membership.user_id) : undefined;
            const isCurrentUser = membership.user_id === user?.id;
            const memberName = profile?.full_name?.trim()
              || membership.invited_email
              || (isCurrentUser ? user?.email : null)
              || 'Company member';
            const contact = membership.invited_email
              || (isCurrentUser ? user?.email : null)
              || profile?.phone
              || 'Not recorded';

            return [
              <strong key="member">{memberName}{isCurrentUser ? ' (you)' : ''}</strong>,
              contact,
              membership.role_in_company.replace(/_/g, ' '),
              <StatusBadge key="membership" value={membership.status} />,
              <StatusBadge key="profile" value={profile?.status ?? (membership.user_id ? 'profile unavailable' : 'invited')} tone={profile?.status === 'active' ? 'green' : 'grey'} />,
              formatDate(membership.created_at),
            ];
          })}
          empty={<EmptyState title={loading ? 'Loading team…' : 'No team members found'} />}
        />
      </Panel>

      {!loading && memberships.length > 0 && (
        <Panel title="Team management boundary" style={{ marginTop: '0.9rem' }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.55 }}>
            This page now reports the real roster accurately. Inviting, suspending or changing customer-company roles is not exposed here until a dedicated server-authorised membership endpoint exists; direct client-side membership writes would weaken the company boundary.
          </p>
        </Panel>
      )}
    </PageFrame>
  );
}
