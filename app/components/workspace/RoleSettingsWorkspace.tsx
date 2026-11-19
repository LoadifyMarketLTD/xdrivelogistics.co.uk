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
type Section = 'overview' | 'profile' | 'company' | 'operations' | 'blocked' | 'finance' | 'security' | 'departments';

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
  contact_name: string | null;
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
    finance: '/driver/finance',
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
    team: '/admin/team',
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
  name: '', email: '', phone: '', contactName: '', website: '', description: '', address1: '', address2: '', city: '', postcode: '', country: 'United Kingdom',
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
  const billingRoles: readonly RoleMode[] = ['customer', 'broker', 'owner', 'carrier'];
  const companyProfileVisible = true;
  const canManageBilling = canEditCompany && billingRoles.includes(role);
  const financeSettingsVisible = canManageBilling;
  const companyOperationsVisible = canEditCompany && (role === 'carrier' || role === 'owner');
  // Trading profile editors are available to active authorised owners/admins of every independent trading company.
  const memberDirectoryEditorVisible = canEditCompany && billingRoles.includes(role);

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
    if (requested === 'operations' && memberDirectoryEditorVisible) {
      setSection('operations');
      return;
    }
    if (requested === 'blocked' && companyOperationsVisible) {
      setSection('blocked');
      return;
    }
    if (requested === 'finance' && financeSettingsVisible) setSection('finance');
    if (requested === 'departments' && companyOperationsVisible) setSection('departments');
  }, [companyOperationsVisible, companyProfileVisible, financeSettingsVisible, memberDirectoryEditorVisible, searchParams]);

  const load = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    // AuthContext already resolved the active company. Every read remains RLS-scoped and membership is rechecked below.
    const companyId = role==='owner'&&user.companyId ? user.companyId : await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
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
        .select('id,name,legal_name,trading_name,company_number,xd_id,vat_number,email,phone,contact_name,website,description,international_work_approved,address_line1,address_line2,city,postcode,country,status,company_type')
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
        contactName: companyRow.contact_name ?? '',
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
  }, [role,user?.companyId, user?.id]);

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
        contact_name: textOrNull(companyForm.contactName),
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

  // Reuse canonical editors and authorised routes.
  const ownerNav = [
    {group:'Account',label:'Account Readiness',action:()=>setSection('overview'),active:section==='overview'},
    {group:'Account',label:'My Profile',action:()=>setSection('profile'),active:section==='profile'},
    {group:'Account',label:'Security',action:()=>setSection('security'),active:section==='security'},
    {group:'Business',label:'Company Profile',action:()=>setSection('company'),active:section==='company'},
    ...(companyOperationsVisible?[{group:'Business',label:'Commercial & Operations',action:()=>setSection('operations'),active:section==='operations'}]:[]),
    {group:'Business',label:'Business Documents',action:()=>router.push('/driver/documents'),active:false},
    {group:'Operations',label:'Users & Drivers',action:()=>router.push('/driver/drivers-vehicles'),active:false},
    {group:'Operations',label:'Company Vehicles',action:()=>router.push('/driver/vehicles'),active:false},
    {group:'Operations',label:'Live Tracking',action:()=>router.push('/driver/freight-vision'),active:false},
    {group:'Operations',label:'Load Alert Preferences',action:()=>router.push('/driver/load-alerts'),active:false},
    {group:'Operations',label:'Notifications',action:()=>router.push('/driver/notifications'),active:false},
    ...(companyOperationsVisible?[{group:'Operations',label:'Departments',action:()=>setSection('departments'),active:section==='departments'},{group:'Operations',label:'Blocked Members',action:()=>setSection('blocked'),active:section==='blocked'}]:[]),
    {group:'Operations',label:'Network & Tools',action:()=>router.push('/driver/network'),active:false},
    ...(financeSettingsVisible?[{group:'Administration',label:'Finance Settings',action:()=>setSection('finance'),active:section==='finance'}, {group:'Administration',label:'Billing & Membership',action:()=>router.push('/driver/settings/billing'),active:false}]:[]),
    {group:'Administration',label:'Legal & Agreements',action:()=>router.push('/driver/account/legal-agreements'),active:false},
    {group:'Administration',label:'Event Log',action:()=>router.push('/driver/event-log'),active:false},
  ];
  const nav = useMemo(() => [
    { label: 'Overview', action: () => setSection('overview'), active: section === 'overview' },
    { label: 'My Profile', action: () => setSection('profile'), active: section === 'profile' },
    ...(companyProfileVisible ? [{ label: 'Company Settings', action: () => setSection('company'), active: section === 'company' }] : []),
    ...(memberDirectoryEditorVisible && !companyOperationsVisible ? [{label:'Member Directory Profile',action:()=>setSection('operations'),active:section==='operations'}] : []),
    ...(companyOperationsVisible ? [
      { label: 'Company Operations', action: () => setSection('operations'), active: section === 'operations' },
      { label: 'Blocked Members', action: () => setSection('blocked'), active: section === 'blocked' },
    ] : []),
    ...(routes.team ? [{ label: 'Users & Permissions', action: () => router.push(routes.team!), active: false }] : []),
    ...(role === 'owner' ? [{ label: 'Drivers / Staff', action: () => router.push('/driver/profile'), active: false }] : []),
    ...(role === 'fleet' ? [{ label: 'Drivers / Staff', action: () => router.push('/admin/drivers'), active: false }] : []),
    ...(routes.vehicles ? [{ label: 'Vehicles / Assets', action: () => router.push(routes.vehicles!), active: false }] : []),
    ...(routes.documents && role !== 'customer' ? [{ label: 'Documents', action: () => router.push(routes.documents!), active: false }] : []),
    ...(financeSettingsVisible ? [{ label: 'Finance & Invoices', action: () => setSection('finance'), active: section === 'finance' }, ...(routes.billing ? [{ label: 'Billing & Membership', action: () => router.push(routes.billing!), active: false }] : [])] : []),
    ...(role === 'finance' && routes.finance ? [{ label: 'Finance Workspace', action: () => router.push(routes.finance!), active: false }] : []),
    ...(routes.notifications ? [{ label: 'Notifications', action: () => router.push(routes.notifications!), active: false }] : []),
    { label: 'Security', action: () => setSection('security'), active: section === 'security' },
    ...(routes.audit ? [{ label: 'Audit / Event Log', action: () => router.push(routes.audit!), active: false }] : []),
    ...(routes.support ? [{ label: 'Support', action: () => router.push(routes.support!), active: false }] : []),
  ], [companyOperationsVisible, companyProfileVisible, financeSettingsVisible, memberDirectoryEditorVisible, role, router, routes.audit, routes.billing, routes.documents, routes.finance, routes.notifications, routes.support, routes.team, routes.vehicles, section]);

  const displayedNav: Array<{label:string;action:()=>void;active:boolean;group?:string}> = role === 'owner' ? ownerNav : nav;
  const readiness = company ? [
    {label:'Company identity',ready:Boolean(company.legal_name||company.name)&&Boolean(company.xd_id),target:'company' as const},
    {label:'Business contact',ready:Boolean(company.email&&company.phone&&company.contact_name),target:'company' as const},
    {label:'Business address',ready:Boolean(company.address_line1&&company.city&&company.postcode&&company.country),target:'company' as const},
    {label:'Personal contact',ready:Boolean(profile?.full_name&&profile.phone),target:'profile' as const},
  ] : [];

  return (
    <PageFrame>
      <PageHeader
        eyebrow={roleLabel ?? ROLE_LABEL[role]}
        title={role === 'owner' ? 'Account settings' : 'Settings'}
        description={`${roleLabel ?? ROLE_LABEL[role]} profile, security and authorised workspace controls.`}
        actions={
          section === 'company'
            ? <ActionButton tone="primary" disabled={!canEditCompany || saving || loading} onClick={() => void saveCompany()}>{saving ? 'Saving…' : 'Save'}</ActionButton>
            : section === 'profile'
              ? <ActionButton tone="primary" disabled={saving || loading} onClick={() => void saveProfile()}>{saving ? 'Saving…' : 'Save'}</ActionButton>
              : undefined
        }
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {success && <AlertBanner tone="success">{success}</AlertBanner>}

      <div className="role-settings-layout" data-owner-settings={role === 'owner' ? 'true' : undefined}>
        <aside className="role-settings-nav">
          <div className="role-settings-company">
            <strong>{role === 'owner' ? 'Account settings' : companyDisplay}</strong>
            <span>{identityCode} · {role}</span>
          </div>
          {displayedNav.map((item,index) => role==='owner' ? (
            <div key={item.label} className="role-settings-nav-item">{item.group&&item.group!==displayedNav[index-1]?.group&&<span className="role-settings-nav-group">{item.group}</span>}<button type="button" aria-current={item.active?'page':undefined} data-active={item.active ? 'true' : 'false'} onClick={item.action}>{item.label}</button></div>
          ) : <button key={item.label} type="button" data-active={item.active ? 'true' : 'false'} onClick={item.action}>{item.label}</button>)}
        </aside>

        <main className="role-settings-main">
          {loading ? <Panel><EmptyState compact title="Loading settings…" /></Panel> : !company ? (
            <Panel><EmptyState title="Company account not found" description="The signed-in account is not linked to a readable XDrive company record." /></Panel>
          ) : section === 'overview' ? (
            <div className="role-settings-overview">
              {role==='owner'&&<Panel title="Account Readiness" description="Profile completeness from recorded data, not compliance approval or permission to trade."><div className="owner-settings-readiness"><strong>{readiness.filter(item=>item.ready).length} of {readiness.length} basic information checks complete</strong><progress aria-label="Basic information completeness" value={readiness.filter(item=>item.ready).length} max={readiness.length}/>{readiness.map(item=><div key={item.label}><span>{item.label}</span><span className="owner-settings-check" data-ready={item.ready}>{item.ready?'Recorded':'Needs information'}</span><ActionButton tone="secondary" onClick={()=>setSection(item.target)}>Review</ActionButton></div>)}</div><div className="role-settings-actions"><ActionButton tone="secondary" onClick={()=>router.push('/driver/documents')}>Check business documents</ActionButton><ActionButton tone="secondary" onClick={()=>router.push('/driver/vehicles')}>Check vehicles</ActionButton><ActionButton tone="secondary" onClick={()=>router.push('/driver/load-alerts')}>Configure load alerts</ActionButton></div></Panel>}
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
                {role === 'owner' && <div className="role-settings-actions"><ActionButton tone="secondary" onClick={() => setSection('profile')}>Edit profile</ActionButton></div>}
              </Panel>
            </div>
          ) : section === 'company' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <Panel title="Company Settings" description={canEditCompany ? 'Edit the live company record used by this workspace.' : 'Your current membership can view company settings but cannot edit them.'}>
                <div className="role-settings-form">
                  <label>Company name<input disabled={!canEditCompany} value={companyForm.name} onChange={(e) => setCompanyForm((v) => ({ ...v, name: e.target.value }))} /></label>
                  <label>Contact person<input disabled={!canEditCompany} value={companyForm.contactName} onChange={(e) => setCompanyForm((v) => ({ ...v, contactName: e.target.value }))} /></label>
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
                  {role==='owner'&&<><div><span>Registered legal name</span><strong>{company.legal_name||'Not recorded'}</strong></div><div><span>Trading name</span><strong>{company.trading_name||'Not recorded'}</strong></div></>}
                  <div><span>Registered company number</span><strong>{company.company_number || 'Not recorded'}</strong></div>
                  <div><span>VAT number</span><strong>{company.vat_number || 'Not recorded'}</strong></div>
                  <div><span>Company type</span><strong>{company.company_type?.replace(/_/g, ' ') || 'Not recorded'}</strong></div>
                  <div><span>International work approval</span><strong>{company.international_work_approved === true ? 'Approved' : 'Not approved / not recorded'}</strong></div>
                  <div><span>Your company role</span><strong>{membershipRole || 'Not verified'}</strong></div>
                </div>
              </Panel>
              {memberDirectoryEditorVisible && <Panel title="Complete your Member Directory profile" description="Update your own company's business-facing information. Member IDs, verified identity and reputation are not self-editable."><div style={{display:'grid',gap:12}}><div><strong>Trading contact, specialist services, charges and booking footer</strong><p>Saved commercial details are used in your Directory profile. Review the information before saving; do not enter private addresses or sensitive data.</p><ActionButton tone="secondary" onClick={()=>setSection('operations')}>Manage Directory profile</ActionButton></div><div><strong>Payment terms</strong><p>Set canonical payment defaults in Finance &amp; Invoices. Existing awarded bookings retain their agreed terms.</p><ActionButton tone="secondary" onClick={()=>setSection('finance')}>Company finance settings</ActionButton></div><div><strong>Users and business documents</strong><p>Manage authorised users in your team area. Review or replace documents belonging to your own onboarding application; private files are not published to trading members.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{routes.team&&<ActionButton tone="secondary" onClick={()=>router.push(routes.team!)}>Manage users</ActionButton>}<ActionButton tone="secondary" onClick={()=>router.push("/onboarding/documents")}>My onboarding documents</ActionButton>{(role==='owner'||role==='carrier')&&routes.documents&&<ActionButton tone="secondary" onClick={()=>router.push(role==='carrier'?'/admin/documents/company':routes.documents!)}>Manage compliance documents</ActionButton>}</div></div><div><strong>Reputation and complaints</strong><p>Feedback, payment reliability and complaints must come from verified transactions or authorised processes; they cannot be edited on your own profile.</p></div></div></Panel>}
              {canEditCompany && role!=='owner' && <CompanyDepartmentsPanel companyId={company.id} />}
            </div>
          ) : section === 'operations' && (role === 'owner' || memberDirectoryEditorVisible) ? (
            memberDirectoryEditorVisible ? <div className="role-settings-subsection"><CompanyOperationsSettingsPanel key={company.id} companyId={company.id} companyName={companyDisplay} memberProfileOnly={!companyOperationsVisible} />{role === 'owner' && <div className="role-settings-actions"><ActionButton tone="secondary" onClick={() => setSection('blocked')}>Blocked members</ActionButton></div>}</div> : <Panel title="Company operations"><EmptyState compact title="Owner or administrator permission required" /></Panel>
          ) : section === 'departments' && companyOperationsVisible ? (
            <CompanyDepartmentsPanel key={company.id} companyId={company.id} />
          ) : section === 'blocked' && companyOperationsVisible ? (
            <div className="role-settings-subsection">{role === 'owner' && <div className="role-settings-actions"><ActionButton tone="secondary" onClick={() => setSection('operations')}>Back to operations</ActionButton></div>}<CompanyBlockedMembersPanel key={company.id} companyId={company.id} /></div>
          ) : section === 'finance' && (role === 'owner' || canManageBilling) ? (
            canManageBilling ? <div className="role-settings-subsection">{role === 'owner' && <div className="role-settings-actions"><ActionButton tone="secondary" onClick={() => setSection('company')}>Back to company settings</ActionButton></div>}<CompanyFinanceSettingsPanel key={company.id} companyId={company.id} companyName={companyDisplay} /></div> : <Panel title="Company finance settings"><EmptyState compact title="Owner or administrator permission required" /></Panel>
          ) : section === 'profile' ? (
            <Panel title="My Profile" description="Edit the personal profile attached to the signed-in XDrive account.">
              {role === 'owner' && <div className="role-settings-actions"><ActionButton tone="secondary" onClick={() => setSection('overview')}>Back to profile overview</ActionButton></div>}
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
