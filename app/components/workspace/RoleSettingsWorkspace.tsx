'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { useAuth } from '../AuthContext';
import CompanyDepartmentsPanel from './CompanyDepartmentsPanel';
import CompanyFinanceSettingsPanel from './CompanyFinanceSettingsPanel';
import CompanyOperationsSettingsPanel from './CompanyOperationsSettingsPanel';
import CompanyBlockedMembersPanel from './CompanyBlockedMembersPanel';
import MfaSecurityPanel from './MfaSecurityPanel';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from './WorkspaceUI';
import './role-settings-workspace.css';

type RoleMode = 'customer' | 'broker' | 'driver' | 'owner' | 'carrier' | 'fleet' | 'dispatcher' | 'finance' | 'compliance' | 'viewer';
type Section = 'overview' | 'profile' | 'company' | 'operations' | 'blocked' | 'finance' | 'security';

type CompanyRow = {
  id: string;
  name: string | null;
  legal_name: string | null;
  trading_name: string | null;
  company_number: string | null;
  xd_id: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  international_work_approved: boolean | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  status: string | null;
  company_type: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  xd_id: string | null;
  role: string | null;
  status: string | null;
};

const ROLE_LABEL: Record<RoleMode, string> = {
  customer: 'Customer / Shipper',
  broker: 'Broker',
  driver: 'Driver',
  owner: 'Owner Driver',
  carrier: 'Carrier / Company',
  fleet: 'Fleet Manager',
  dispatcher: 'Dispatcher',
  finance: 'Finance',
  compliance: 'Compliance',
  viewer: 'Viewer',
};

const routeMap: Record<RoleMode, {
  team?: string;
  vehicles?: string;
  documents?: string;
  notifications?: string;
  audit?: string;
  legal?: string;
  finance?: string;
  billing?: string;
  support?: string;
}> = {
  customer: {
    team: '/customer/team',
    documents: '/customer/documents',
    notifications: '/customer/notifications',
    audit: '/customer/event-log',
    legal: '/customer/account/legal-agreements',
    finance: '/customer/invoices',
    billing: '/customer/settings/billing',
    support: '/customer/support',
  },
  driver: {
    documents: '/driver/documents',
    notifications: '/driver/notifications',
    audit: '/driver/event-log',
    legal: '/driver/account/legal-agreements',
    support: '/driver/support',
  },
  broker: {
    team: '/broker/team',
    documents: '/broker/pod-review',
    notifications: '/broker/notifications',
    audit: '/broker/event-log',
    legal: '/broker/account/legal-agreements',
    finance: '/broker/finance',
    billing: '/broker/settings/billing',
    support: '/broker/support',
  },
  owner: {
    vehicles: '/driver/vehicles',
    documents: '/driver/documents',
    notifications: '/driver/notifications',
    audit: '/driver/event-log',
    legal: '/driver/account/legal-agreements',
    finance: '/driver/finance',
    billing: '/driver/settings/billing',
    support: '/driver/support',
  },
  carrier: {
    vehicles: '/admin/fleet/vehicles',
    documents: '/admin/documents',
    notifications: '/admin/notifications',
    audit: '/admin/event-log',
    legal: '/admin/settings/legal-agreements',
    finance: '/admin/invoices',
    billing: '/admin/settings/billing',
    support: '/admin/support',
  },
  fleet: {
    vehicles: '/admin/fleet/vehicles',
    documents: '/admin/documents',
    notifications: '/admin/notifications',
    audit: '/admin/event-log',
    legal: '/admin/settings/legal-agreements',
    finance: '/admin/invoices',
    billing: '/admin/settings/billing',
    support: '/admin/support',
  },
  dispatcher: {
    vehicles: '/admin/fleet/resources',
    notifications: '/admin/notifications',
    audit: '/admin/event-log',
    support: '/admin/support',
  },
  finance: {
    notifications: '/admin/notifications',
    audit: '/admin/event-log',
    finance: '/admin/finance',
    support: '/admin/support',
  },
  compliance: {
    documents: '/admin/documents',
    notifications: '/admin/notifications',
    audit: '/admin/event-log',
    support: '/admin/support',
  },
  viewer: {
    notifications: '/admin/notifications',
    audit: '/admin/event-log',
    support: '/admin/support',
  },
};

const blankCompany = {
  name: '', email: '', phone: '', website: '', description: '', address1: '', address2: '', city: '', postcode: '', country: 'United Kingdom',
};
const blankProfile = { fullName: '', phone: '' };
const textOrNull = (value: string) => value.trim() || null;

export default function RoleSettingsWorkspace({ role, roleLabel }: { role: RoleMode; roleLabel?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('overview');
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState(blankCompany);
  const [profileForm, setProfileForm] = useState(blankProfile);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canEditCompany = membershipRole === 'owner' || membershipRole === 'admin';
  const companyProfileRoles: readonly RoleMode[] = ['customer', 'broker', 'owner', 'carrier'];
  const billingRoles: readonly RoleMode[] = ['customer', 'broker', 'owner', 'carrier'];
  const companyProfileVisible = companyProfileRoles.includes(role);
  const canManageBilling = canEditCompany && billingRoles.includes(role);
  const financeSettingsVisible = canManageBilling;
  const companyOperationsVisible = canEditCompany && (role === 'carrier' || role === 'owner');

  useEffect(() => {
    const requested = searchParams.get('section');
    if (requested === 'overview' || requested === 'profile' || requested === 'security') {
      setSection(requested);
      return;
    }
    if (requested === 'company' && companyProfileVisible) {
      setSection('company');
      return;
    }
    if (requested === 'operations' && companyOperationsVisible) {
      setSection('operations');
      return;
    }
    if (requested === 'blocked' && companyOperationsVisible) {
      setSection('blocked');
      return;
    }
    if (requested === 'finance' && financeSettingsVisible) setSection('finance');
  }, [companyOperationsVisible, companyProfileVisible, financeSettingsVisible, searchParams]);

  const load = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const companyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
    if (!companyId) {
      setCompany(null);
      setProfile(null);
      setMembershipRole(null);
      setLoading(false);
      return;
    }

    const [companyResult, profileResult, roleResult] = await Promise.all([
      supabase
        .from('companies')
        .select('id,name,legal_name,trading_name,company_number,xd_id,vat_number,email,phone,website,description,international_work_approved,address_line1,address_line2,city,postcode,country,status,company_type')
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('user_id,full_name,phone,xd_id,role,status')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.rpc('active_company_membership_role', { p_company_id: companyId, p_user_id: user.id }),
    ]);

    if (companyResult.error) setError(companyResult.error.message);
    if (profileResult.error && !companyResult.error) setError(profileResult.error.message);

    const companyRow = (companyResult.data ?? null) as CompanyRow | null;
    const profileRow = (profileResult.data ?? null) as ProfileRow | null;
    setCompany(companyRow);
    setProfile(profileRow);
    setMembershipRole(typeof roleResult.data === 'string' ? roleResult.data.toLowerCase() : null);

    if (companyRow) {
      setCompanyForm({
        name: companyRow.name ?? companyRow.trading_name ?? companyRow.legal_name ?? '',
        email: companyRow.email ?? '',
        phone: companyRow.phone ?? '',
        website: companyRow.website ?? '',
        description: companyRow.description ?? '',
        address1: companyRow.address_line1 ?? '',
        address2: companyRow.address_line2 ?? '',
        city: companyRow.city ?? '',
        postcode: companyRow.postcode ?? '',
        country: companyRow.country ?? 'United Kingdom',
      });
    }
    if (profileRow) setProfileForm({ fullName: profileRow.full_name ?? '', phone: profileRow.phone ?? '' });
    setLoading(false);
  }, [user?.companyId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const saveCompany = async () => {
    if (!company?.id || !canEditCompany) return;
    if (companyForm.name.trim().length < 2) {
      setError('Company name must contain at least two characters.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        name: companyForm.name.trim(),
        email: textOrNull(companyForm.email),
        phone: textOrNull(companyForm.phone),
        website: textOrNull(companyForm.website),
        description: textOrNull(companyForm.description),
        address_line1: textOrNull(companyForm.address1),
        address_line2: textOrNull(companyForm.address2),
        city: textOrNull(companyForm.city),
        postcode: textOrNull(companyForm.postcode.toUpperCase()),
        country: companyForm.country.trim() || 'United Kingdom',
      })
      .eq('id', company.id);
    if (updateError) setError(updateError.message);
    else {
      setSuccess('Company profile saved.');
      await load();
    }
    setSaving(false);
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError('');
    setSuccess('');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: textOrNull(profileForm.fullName), phone: textOrNull(profileForm.phone) })
      .eq('user_id', user.id);
    if (updateError) setError(updateError.message);
    else {
      setSuccess('Profile saved.');
      await load();
    }
    setSaving(false);
  };

  const savePassword = async () => {
    setError('');
    setSuccess('');
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Password confirmation does not match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else {
      setSuccess('Password updated.');
      setPassword('');
      setPasswordConfirm('');
    }
    setSaving(false);
  };

  const companyDisplay = company?.trading_name || company?.name || company?.legal_name || 'Company account';
  const identityCode = company?.xd_id || 'Not assigned';
  const memberCode = profile?.xd_id || 'Not assigned';
  const routes = routeMap[role];

  const nav = useMemo(() => [
    { label: 'Overview', action: () => setSection('overview'), active: section === 'overview' },
    { label: 'My Profile', action: () => setSection('profile'), active: section === 'profile' },
    ...(companyProfileVisible ? [{ label: 'Company Profile', action: () => setSection('company'), active: section === 'company' }] : []),
    ...(companyOperationsVisible ? [
      { label: 'Company Operations', action: () => setSection('operations'), active: section === 'operations' },
      { label: 'Blocked Members', action: () => setSection('blocked'), active: section === 'blocked' },
    ] : []),
    ...(routes.team ? [{ label: 'Users & Permissions', action: () => router.push(routes.team!), active: false }] : []),
    ...(role === 'owner' ? [{ label: 'Driver Profile', action: () => router.push('/driver/profile'), active: false }] : []),
    ...(role === 'fleet' ? [{ label: 'Drivers / Staff', action: () => router.push('/admin/drivers'), active: false }] : []),
    ...(routes.vehicles ? [{ label: 'Vehicles / Assets', action: () => router.push(routes.vehicles!), active: false }] : []),
    ...(routes.documents ? [{ label: 'Documents', action: () => router.push(routes.documents!), active: false }] : []),
    ...(financeSettingsVisible ? [{ label: 'Company Finance Settings', action: () => setSection('finance'), active: section === 'finance' }] : []),
    ...(routes.finance ? [{ label: role === 'finance' ? 'Finance Workspace' : 'Finance & Invoices', action: () => router.push(routes.finance!), active: false }] : []),
    ...(financeSettingsVisible && routes.billing ? [{ label: 'Membership & Billing', action: () => router.push(routes.billing!), active: false }] : []),
    ...(routes.notifications ? [{ label: 'Notifications', action: () => router.push(routes.notifications!), active: false }] : []),
    { label: 'Security', action: () => setSection('security'), active: section === 'security' },
    ...(routes.audit ? [{ label: 'Audit / Event Log', action: () => router.push(routes.audit!), active: false }] : []),
    ...(routes.support ? [{ label: 'Support', action: () => router.push(routes.support!), active: false }] : []),
  ], [companyOperationsVisible, companyProfileVisible, financeSettingsVisible, role, router, routes.audit, routes.billing, routes.documents, routes.finance, routes.notifications, routes.support, routes.team, routes.vehicles, section]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow={roleLabel ?? ROLE_LABEL[role]}
        title="Settings"
        description={`${roleLabel ?? ROLE_LABEL[role]} profile, security and authorised workspace controls.`}
        actions={<>
          {(role === 'owner' || role === 'driver') && section !== 'overview' && <ActionButton tone="secondary" onClick={() => setSection('overview')}>Back to Settings</ActionButton>}
          {section === 'company'
            ? <ActionButton tone="primary" disabled={!canEditCompany || saving || loading} onClick={() => void saveCompany()}>{saving ? 'Saving…' : 'Save'}</ActionButton>
            : section === 'profile'
              ? <ActionButton tone="primary" disabled={saving || loading} onClick={() => void saveProfile()}>{saving ? 'Saving…' : 'Save'}</ActionButton>
              : null}
        </>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}

      <div className={role === 'owner' || role === 'driver' ? 'role-settings-layout role-settings-layout--topnav' : 'role-settings-layout'}>
        {role !== 'owner' && role !== 'driver' && (
          <aside className="role-settings-nav">
            <div className="role-settings-company">
              <strong>{companyDisplay}</strong>
              <span>{identityCode} · {role}</span>
            </div>
            {nav.map((item) => (
              <button key={item.label} type="button" data-active={item.active ? 'true' : 'false'} onClick={item.action}>{item.label}</button>
            ))}
          </aside>
        )}

        <main className="role-settings-main">
          {loading ? <Panel><EmptyState compact title="Loading settings…" /></Panel> : !company ? (
            <Panel><EmptyState title="Company account not found" description="The signed-in account is not linked to a readable XDrive company record." /></Panel>
          ) : section === 'overview' ? (
            <div className="role-settings-overview">
              <Panel title="Member info" description="Live account and company identity.">
                <div className="role-settings-member">
                  <div className="role-settings-mark">XD</div>
                  <div><strong>{companyDisplay}</strong><StatusBadge value={company.status ?? 'unknown'} /></div>
                </div>
                <div className="role-settings-kv">
                  <div><span>Member ID</span><strong>{memberCode}</strong></div>
                  <div><span>Company ID</span><strong>{identityCode}</strong></div>
                  <div><span>Main contact</span><strong>{profile?.full_name || user?.email || 'Not recorded'}</strong></div>
                  <div><span>Operating base</span><strong>{[company.city, company.postcode].filter(Boolean).join(', ') || 'Not recorded'}</strong></div>
                </div>
                <div className="role-settings-actions">
                  {companyProfileVisible && <ActionButton tone="secondary" onClick={() => setSection('company')}>Company Profile</ActionButton>}
                  {financeSettingsVisible && <ActionButton tone="secondary" onClick={() => setSection('finance')}>Company Finance Settings</ActionButton>}
                  {routes.finance && <ActionButton tone="secondary" onClick={() => router.push(routes.finance!)}>{"Finance & Invoices"}</ActionButton>}
                  {financeSettingsVisible && routes.billing && <ActionButton tone="secondary" onClick={() => router.push(routes.billing!)}>{"Membership & Billing"}</ActionButton>}
                  {!companyProfileVisible && <ActionButton tone="secondary" onClick={() => setSection('profile')}>My Profile</ActionButton>}
                </div>
              </Panel>

              <Panel title="Help & support" description="Workspace help and account assistance.">
                <div className="role-settings-links">
                  {routes.support && <button type="button" onClick={() => router.push(routes.support!)}><strong>Help Centre</strong><span>Workspace guidance and support information.</span></button>}
                  {routes.legal && <button type="button" onClick={() => router.push(routes.legal!)}><strong>{"Legal & Agreements"}</strong><span>Accepted terms and evidence history.</span></button>}
                  {routes.notifications && <button type="button" onClick={() => router.push(routes.notifications!)}><strong>Latest Updates</strong><span>Open workspace notifications.</span></button>}
                </div>
              </Panel>

              <Panel title={profile?.full_name || user?.email || 'My account'} description="Profile and workspace administration.">
                <div className="role-settings-links">
                  <button type="button" onClick={() => setSection('profile')}><strong>My Profile</strong><span>Personal account details.</span></button>
                  <button type="button" onClick={() => setSection('security')}><strong>Security</strong><span>Password and account protection.</span></button>
                  {companyOperationsVisible && <button type="button" onClick={() => setSection('operations')}><strong>Company Operations</strong><span>Operational preferences for your company.</span></button>}
                  {companyOperationsVisible && <button type="button" onClick={() => setSection('blocked')}><strong>Blocked Members</strong><span>Company member restrictions.</span></button>}
                  {companyProfileVisible && <button type="button" onClick={() => setSection('company')}><strong>Company Profile</strong><span>Company identity and contact details.</span></button>}
                  {routes.documents && <button type="button" onClick={() => router.push(routes.documents!)}><strong>Documents</strong><span>Operational and compliance records.</span></button>}
                  {routes.audit && <button type="button" onClick={() => router.push(routes.audit!)}><strong>Audit / Event Log</strong><span>Search account and transport activity.</span></button>}
                </div>
              </Panel>
            </div>
          ) : section === 'company' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <Panel title="Company Profile" description={canEditCompany ? 'Edit the live company record used by this workspace.' : 'Your current membership can view this company profile but cannot edit it.'}>
                <div className="role-settings-form">
                  <label>Company name<input disabled={!canEditCompany} value={companyForm.name} onChange={(e) => setCompanyForm((v) => ({ ...v, name: e.target.value }))} /></label>
                  <label>Email<input disabled={!canEditCompany} type="email" value={companyForm.email} onChange={(e) => setCompanyForm((v) => ({ ...v, email: e.target.value }))} /></label>
                  <label>Phone<input disabled={!canEditCompany} value={companyForm.phone} onChange={(e) => setCompanyForm((v) => ({ ...v, phone: e.target.value }))} /></label>
                  <label>Website<input disabled={!canEditCompany} type="url" value={companyForm.website} onChange={(e) => setCompanyForm((v) => ({ ...v, website: e.target.value }))} placeholder="https://example.co.uk" /></label>
                  <label style={{ gridColumn: '1 / -1' }}>Company description<textarea disabled={!canEditCompany} value={companyForm.description} onChange={(e) => setCompanyForm((v) => ({ ...v, description: e.target.value }))} rows={3} placeholder="Describe your transport operation and services." /></label>
                  <label>Address line 1<input disabled={!canEditCompany} value={companyForm.address1} onChange={(e) => setCompanyForm((v) => ({ ...v, address1: e.target.value }))} /></label>
                  <label>Address line 2<input disabled={!canEditCompany} value={companyForm.address2} onChange={(e) => setCompanyForm((v) => ({ ...v, address2: e.target.value }))} /></label>
                  <label>City<input disabled={!canEditCompany} value={companyForm.city} onChange={(e) => setCompanyForm((v) => ({ ...v, city: e.target.value }))} /></label>
                  <label>Postcode<input disabled={!canEditCompany} value={companyForm.postcode} onChange={(e) => setCompanyForm((v) => ({ ...v, postcode: e.target.value }))} /></label>
                  <label>Country<input disabled={!canEditCompany} value={companyForm.country} onChange={(e) => setCompanyForm((v) => ({ ...v, country: e.target.value }))} /></label>
                </div>
                <div className="role-settings-kv role-settings-kv--identity">
                  <div><span>Registered company number</span><strong>{company.company_number || 'Not recorded'}</strong></div>
                  <div><span>VAT number</span><strong>{company.vat_number || 'Not recorded'}</strong></div>
                  <div><span>Company type</span><strong>{company.company_type?.replace(/_/g, ' ') || 'Not recorded'}</strong></div>
                  <div><span>International work approval</span><strong>{company.international_work_approved === true ? 'Approved' : 'Not approved / not recorded'}</strong></div>
                  <div><span>Your company role</span><strong>{membershipRole || 'Not verified'}</strong></div>
                </div>
              </Panel>
              {canEditCompany && <CompanyDepartmentsPanel companyId={company.id} />}
            </div>
          ) : section === 'operations' && companyOperationsVisible ? (
            <CompanyOperationsSettingsPanel companyId={company.id} companyName={companyDisplay} />
          ) : section === 'blocked' && companyOperationsVisible ? (
            <CompanyBlockedMembersPanel companyId={company.id} />
          ) : section === 'finance' && canManageBilling ? (
            <CompanyFinanceSettingsPanel companyId={company.id} companyName={companyDisplay} />
          ) : section === 'profile' ? (
            <Panel title="My Profile" description="Edit the personal profile attached to the signed-in XDrive account.">
              <div className="role-settings-form">
                <label>Full name<input value={profileForm.fullName} onChange={(e) => setProfileForm((v) => ({ ...v, fullName: e.target.value }))} /></label>
                <label>Phone<input value={profileForm.phone} onChange={(e) => setProfileForm((v) => ({ ...v, phone: e.target.value }))} /></label>
                <label>Email<input disabled value={user?.email || ''} /></label>
                <label>Member ID<input disabled value={memberCode} /></label>
              </div>
            </Panel>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <Panel title="Security" description="Change the password for the currently signed-in XDrive account.">
                <div className="role-settings-form role-settings-form--security">
                  <label>New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
                  <label>Confirm password<input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" /></label>
                </div>
                <div className="role-settings-actions">
                  <ActionButton tone="primary" disabled={saving} onClick={() => void savePassword()}>{saving ? 'Updating…' : 'Update password'}</ActionButton>
                </div>
              </Panel>
              <MfaSecurityPanel />
            </div>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
