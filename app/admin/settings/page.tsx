'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { COMPANY_CONFIG } from '../../config/company';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  DEFAULT_COMPANY_SETTINGS,
  loadCompanySettings,
} from '../../../lib/companySettings';
import { logRuntimeProof } from '../../../lib/runtimeProof';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
} from '../../components/workspace/WorkspaceUI';
import './settings-exchange.css';

type SettingsTab = 'overview' | 'company' | 'user' | 'notifications' | 'system' | 'help' | 'contact';

const TABS: Array<{ id: SettingsTab; label: string; detail: string }> = [
  { id: 'overview', label: 'Overview', detail: 'Member, support and workspace controls' },
  { id: 'company', label: 'Company Profile', detail: 'Identity, contact, address and reference prefixes' },
  { id: 'user', label: 'User Profile', detail: 'Signed-in account and password' },
  { id: 'notifications', label: 'Notifications', detail: 'Supported email event preferences and inbox' },
  { id: 'system', label: 'Company Profile / Finance', detail: 'VAT, payment terms, currency and bank details' },
  { id: 'help', label: 'Help', detail: 'Operational support routes' },
  { id: 'contact', label: 'Contact', detail: 'Current company contact record' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [identity, setIdentity] = useState({
    companyXdId: '',
    companyStatus: '',
    companyType: '',
    memberXdId: '',
    profileRole: '',
    profileStatus: '',
    profileName: '',
  });
  const [saveError, setSaveError] = useState('');

  const [companyForm, setCompanyForm] = useState({
    name: DEFAULT_COMPANY_SETTINGS.companyName,
    legalName: DEFAULT_COMPANY_SETTINGS.legalName,
    companyNumber: DEFAULT_COMPANY_SETTINGS.companyNumber,
    email: DEFAULT_COMPANY_SETTINGS.email,
    phone: DEFAULT_COMPANY_SETTINGS.phone,
    street: DEFAULT_COMPANY_SETTINGS.street,
    city: DEFAULT_COMPANY_SETTINGS.city,
    postcode: DEFAULT_COMPANY_SETTINGS.postcode,
    jobRefPrefix: DEFAULT_COMPANY_SETTINGS.jobRefPrefix,
    invoicePrefix: DEFAULT_COMPANY_SETTINGS.invoicePrefix,
  });

  const [notifForm, setNotifForm] = useState({
    emailNewJob: DEFAULT_COMPANY_SETTINGS.emailNewJob,
    emailStatusChange: DEFAULT_COMPANY_SETTINGS.emailStatusChange,
    emailInvoicePaid: DEFAULT_COMPANY_SETTINGS.emailInvoicePaid,
    emailBidReceived: DEFAULT_COMPANY_SETTINGS.emailBidReceived,
  });

  const [systemForm, setSystemForm] = useState({
    defaultVatRate: String(DEFAULT_COMPANY_SETTINGS.defaultVatRate),
    paymentTerms: DEFAULT_COMPANY_SETTINGS.paymentTerms as string,
    currency: DEFAULT_COMPANY_SETTINGS.currency,
    dateFormat: DEFAULT_COMPANY_SETTINGS.dateFormat,
    bankAccountName: DEFAULT_COMPANY_SETTINGS.bankAccountName,
    bankSortCode: DEFAULT_COMPANY_SETTINGS.bankSortCode,
    bankAccountNumber: DEFAULT_COMPANY_SETTINGS.bankAccountNumber,
  });

  const [accountForm, setAccountForm] = useState({ newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      if (!isSupabaseConfigured || !hasSupabaseSession || !user?.id) {
        setLoading(false);
        return;
      }

      const resolvedCompanyId = user.companyId ?? null;
      if (cancelled) return;
      if (!resolvedCompanyId) {
        setSaveError('Company profile could not be resolved for this account.');
        setLoading(false);
        return;
      }

      setCompanyId(resolvedCompanyId);
      const [settings, companyIdentity, profileIdentity] = await Promise.all([
        loadCompanySettings(supabase, resolvedCompanyId),
        supabase
          .from('companies')
          .select('xd_id, status, company_type')
          .eq('id', resolvedCompanyId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('xd_id, full_name, role, status')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      setIdentity({
        companyXdId: typeof companyIdentity.data?.xd_id === 'string' ? companyIdentity.data.xd_id : '',
        companyStatus: typeof companyIdentity.data?.status === 'string' ? companyIdentity.data.status : '',
        companyType: typeof companyIdentity.data?.company_type === 'string' ? companyIdentity.data.company_type : '',
        memberXdId: typeof profileIdentity.data?.xd_id === 'string' ? profileIdentity.data.xd_id : '',
        profileRole: typeof profileIdentity.data?.role === 'string' ? profileIdentity.data.role : '',
        profileStatus: typeof profileIdentity.data?.status === 'string' ? profileIdentity.data.status : '',
        profileName: typeof profileIdentity.data?.full_name === 'string' ? profileIdentity.data.full_name : '',
      });

      setCompanyForm({
        name: settings.companyName,
        legalName: settings.legalName,
        companyNumber: settings.companyNumber,
        email: settings.email,
        phone: settings.phone,
        street: settings.street,
        city: settings.city,
        postcode: settings.postcode,
        jobRefPrefix: settings.jobRefPrefix,
        invoicePrefix: settings.invoicePrefix,
      });
      setNotifForm({
        emailNewJob: settings.emailNewJob,
        emailStatusChange: settings.emailStatusChange,
        emailInvoicePaid: settings.emailInvoicePaid,
        emailBidReceived: settings.emailBidReceived,
      });
      setSystemForm({
        defaultVatRate: String(settings.defaultVatRate),
        paymentTerms: settings.paymentTerms,
        currency: settings.currency,
        dateFormat: settings.dateFormat,
        bankAccountName: settings.bankAccountName,
        bankSortCode: settings.bankSortCode,
        bankAccountNumber: settings.bankAccountNumber,
      });
      setLoading(false);
    };

    void loadSettings();
    return () => { cancelled = true; };
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      setSaveError('Supabase is not configured. Settings cannot be saved.');
      return;
    }
    if (!companyId || !user?.id) {
      setSaveError('Company profile not loaded. Settings cannot be saved yet.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaved(false);

    const companyUpdatePayload: Record<string, string | null> = {
      name: companyForm.name,
      email: companyForm.email || null,
      phone: companyForm.phone || null,
      address_line1: companyForm.street || null,
      city: companyForm.city || null,
      postcode: companyForm.postcode || null,
    };

    logRuntimeProof({
      flow: 'Save Settings',
      authUid: user.id,
      membershipId: user.membershipId,
      companyId,
      payload: companyUpdatePayload,
      table: 'companies',
      rlsPolicy: 'companies_update_admin',
    });

    const { error: companyError } = await supabase.from('companies').update(companyUpdatePayload).eq('id', companyId);
    if (companyError) {
      setSaveError(`Company details could not be saved: ${companyError.message}`);
      setSaving(false);
      return;
    }

    const settingsPayload = {
      company_id: companyId,
      legal_name: companyForm.legalName || null,
      job_ref_prefix: companyForm.jobRefPrefix || null,
      invoice_prefix: companyForm.invoicePrefix || null,
      default_vat_rate: Number(systemForm.defaultVatRate),
      default_payment_terms: systemForm.paymentTerms || null,
      currency: systemForm.currency || null,
      date_format: systemForm.dateFormat || null,
      bank_account_name: systemForm.bankAccountName || null,
      bank_sort_code: systemForm.bankSortCode || null,
      bank_account_number: systemForm.bankAccountNumber || null,
      paypal_email: COMPANY_CONFIG.payment.paypal.email || null,
      notify_email_new_job: notifForm.emailNewJob,
      notify_email_status_change: notifForm.emailStatusChange,
      notify_email_invoice_paid: notifForm.emailInvoicePaid,
      notify_email_bid_received: notifForm.emailBidReceived,
      updated_by: user.id,
    };

    const { error: settingsError } = await supabase.from('company_settings').upsert(settingsPayload);
    logRuntimeProof({
      flow: 'Save Settings',
      authUid: user.id,
      membershipId: user.membershipId,
      companyId,
      payload: settingsPayload,
      table: 'company_settings',
      rlsPolicy: 'company_settings_insert_operator|company_settings_update_operator',
    });

    if (settingsError) {
      const migrationHint = settingsError.code === 'PGRST205'
        ? 'Run the latest Supabase migration before using Settings.'
        : settingsError.message;
      setSaveError(`Settings could not be saved: ${migrationHint}`);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async () => {
    setSaveError('');
    setSaved(false);
    if (!isSupabaseConfigured) {
      setSaveError('Supabase is not configured. Password cannot be updated.');
      return;
    }
    if (!accountForm.newPassword || accountForm.newPassword.length < 8) {
      setSaveError('New password must be at least 8 characters long.');
      return;
    }
    if (accountForm.newPassword !== accountForm.confirmPassword) {
      setSaveError('Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: accountForm.newPassword });
    setChangingPassword(false);
    if (error) {
      setSaveError(`Password could not be updated: ${error.message}`);
      return;
    }
    setAccountForm({ newPassword: '', confirmPassword: '' });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const saveEnabled = activeTab === 'company' || activeTab === 'notifications' || activeTab === 'system';

  return (
    <ProtectedRoute>
      <PageFrame>
        <PageHeader
          eyebrow="Workspace configuration"
          title="Settings"
          description="Company identity, user account, notifications and operational finance defaults."
          actions={(
            <>
              <ActionButton tone="secondary" onClick={() => router.push('/admin/notifications')}>Notification Inbox</ActionButton>
              <ActionButton tone="secondary" onClick={() => router.push('/admin')}>Dashboard</ActionButton>
              {saveEnabled && <ActionButton tone="primary" onClick={() => void handleSave()} disabled={saving || !isSupabaseConfigured}>{saving ? 'Saving…' : 'Save Settings'}</ActionButton>}
            </>
          )}
        />

        {saved && <AlertBanner tone="info">Settings saved successfully.</AlertBanner>}
        {saveError && <AlertBanner tone="danger">{saveError}</AlertBanner>}
        {!isSupabaseConfigured && <AlertBanner tone="warning">Supabase is not configured. Settings remain read-only until the workspace connection is available.</AlertBanner>}

        {loading ? (
          <Panel title="Settings"><EmptyState compact title="Loading settings…" /></Panel>
        ) : (
          <div className="settings-exchange-layout">
            <aside className="settings-exchange-nav" aria-label="Settings sections">
              {TABS.map((tab) => (
                <button key={tab.id} type="button" data-active={activeTab === tab.id ? 'true' : 'false'} onClick={() => setActiveTab(tab.id)}>
                  <strong>{tab.label}</strong>
                  <span>{tab.detail}</span>
                </button>
              ))}
              <div className="settings-exchange-nav-group">
                <span>Workspace</span>
                <button type="button" onClick={() => router.push('/admin/drivers')}><strong>Drivers / Staff</strong><small>Driver access and records</small></button>
                <button type="button" onClick={() => router.push('/admin/fleet/vehicles')}><strong>Vehicles / Assets</strong><small>Fleet resources and capability</small></button>
                <button type="button" onClick={() => router.push('/admin/documents')}><strong>Documents</strong><small>Compliance and company records</small></button>
                <button type="button" onClick={() => router.push('/admin/invoices')}><strong>Billing & Invoices</strong><small>Commercial records</small></button>
                <button type="button" onClick={() => router.push('/admin/support')}><strong>Support</strong><small>Help and support requests</small></button>
              </div>
            </aside>

            <main className="settings-exchange-main">
              {activeTab === 'overview' && (
                <div className="settings-overview-grid">
                  <Panel title="Member info" description="Live account and company identity resolved from XDrive.">
                    <div className="settings-member-card">
                      <div className="settings-member-mark">XD</div>
                      <div>
                        <strong>{companyForm.name || 'Company account'}</strong>
                        <span>{identity.profileStatus || identity.companyStatus || 'Status unavailable'}</span>
                      </div>
                    </div>
                    <div className="settings-identity-list">
                      <div><span>Member ID</span><strong>{identity.memberXdId || 'Not assigned'}</strong></div>
                      <div><span>Company ID</span><strong>{identity.companyXdId || 'Not assigned'}</strong></div>
                      <div><span>Account role</span><strong>{identity.profileRole?.replace(/_/g, ' ') || 'Not resolved'}</strong></div>
                      <div><span>Company type</span><strong>{identity.companyType?.replace(/_/g, ' ') || 'Not resolved'}</strong></div>
                    </div>
                    <div className="settings-actions settings-actions--left">
                      <ActionButton tone="secondary" onClick={() => setActiveTab('company')}>Company Profile</ActionButton>
                      <ActionButton tone="secondary" onClick={() => setActiveTab('system')}>Finance & Billing</ActionButton>
                    </div>
                  </Panel>

                  <Panel title="Help & support" description="Operational help without leaving the workspace.">
                    <div className="settings-link-list">
                      <button type="button" onClick={() => router.push('/admin/support')}><strong>Help Centre</strong><span>Support requests and platform assistance.</span></button>
                      <button type="button" onClick={() => router.push('/admin/settings/legal-agreements')}><strong>Legal & Agreements</strong><span>Accepted terms and evidence history.</span></button>
                      <button type="button" onClick={() => router.push('/admin/notifications')}><strong>Latest Updates</strong><span>Open the company notification inbox.</span></button>
                    </div>
                  </Panel>

                  <Panel title={identity.profileName || user?.email || 'My account'} description="Profile and workspace administration.">
                    <div className="settings-link-list">
                      <button type="button" onClick={() => setActiveTab('user')}><strong>My Profile</strong><span>Password and signed-in account controls.</span></button>
                      <button type="button" onClick={() => setActiveTab('company')}><strong>Company Profile</strong><span>Company identity and contact details.</span></button>
                      <button type="button" onClick={() => router.push('/admin/documents')}><strong>Documents</strong><span>Company and operational records.</span></button>
                      <button type="button" onClick={() => router.push('/admin/drivers-vehicles')}><strong>Users / Drivers</strong><span>Drivers, vehicles and resource readiness.</span></button>
                    </div>
                  </Panel>
                </div>
              )}

              {activeTab === 'company' && (
                <Panel title="Member / Company Information" description="The company identity used across XDrive operational and commercial records.">
                  <div className="settings-form-grid">
                    <label><span>Trading Name</span><input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} /></label>
                    <label><span>Legal Name</span><input value={companyForm.legalName} onChange={(e) => setCompanyForm({ ...companyForm, legalName: e.target.value })} /></label>
                    <label><span>Company Number</span><input value={companyForm.companyNumber} readOnly aria-readonly="true" title="Verified company identity. Change through the company verification workflow." /></label>
                    <label><span>Email Address</span><input type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} /></label>
                    <label><span>Phone Number</span><input type="tel" value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} /></label>
                    <label className="settings-field-wide"><span>Street Address</span><input value={companyForm.street} onChange={(e) => setCompanyForm({ ...companyForm, street: e.target.value })} /></label>
                    <label><span>City</span><input value={companyForm.city} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} /></label>
                    <label><span>Postcode</span><input value={companyForm.postcode} onChange={(e) => setCompanyForm({ ...companyForm, postcode: e.target.value })} /></label>
                    <label><span>Job Reference Prefix</span><input value={companyForm.jobRefPrefix} onChange={(e) => setCompanyForm({ ...companyForm, jobRefPrefix: e.target.value })} /></label>
                    <label><span>Invoice Prefix</span><input value={companyForm.invoicePrefix} onChange={(e) => setCompanyForm({ ...companyForm, invoicePrefix: e.target.value })} /></label>
                  </div>
                </Panel>
              )}

              {activeTab === 'user' && (
                <Panel title="User Profile" description="Signed-in account details and password control.">
                  <div className="settings-account-summary"><span>Logged in as</span><strong>{user?.email ?? 'Account email unavailable'}</strong></div>
                  <div className="settings-form-grid settings-form-grid--single">
                    <label><span>Email Address</span><input type="email" value={user?.email || ''} readOnly /></label>
                    <label><span>New Password</span><input type="password" placeholder="Enter new password" value={accountForm.newPassword} onChange={(e) => setAccountForm({ ...accountForm, newPassword: e.target.value })} /></label>
                    <label><span>Confirm New Password</span><input type="password" placeholder="Confirm new password" value={accountForm.confirmPassword} onChange={(e) => setAccountForm({ ...accountForm, confirmPassword: e.target.value })} /></label>
                  </div>
                  <div className="settings-actions"><ActionButton tone="primary" onClick={() => void handleChangePassword()} disabled={changingPassword || !isSupabaseConfigured}>{changingPassword ? 'Updating…' : 'Update Password'}</ActionButton></div>
                </Panel>
              )}

              {activeTab === 'notifications' && (
                <Panel title="Notifications" description="Email preferences supported by the current company settings contract. Recipient-scoped in-app notifications remain available in the Notification Inbox.">
                  <div className="settings-notification-list">
                    {[
                      { key: 'emailNewJob', label: 'New job created', description: 'Receive an email when a new job is added.' },
                      { key: 'emailStatusChange', label: 'Job status changed', description: 'Receive an email when a job status is updated.' },
                      { key: 'emailInvoicePaid', label: 'Invoice paid', description: 'Receive an email when an invoice is marked as paid.' },
                      { key: 'emailBidReceived', label: 'Bid / quote received', description: 'Receive an email when a marketplace bid is received.' },
                    ].map((item) => (
                      <label key={item.key} className="settings-notification-row">
                        <span><strong>{item.label}</strong><small>{item.description}</small></span>
                        <input type="checkbox" checked={notifForm[item.key as keyof typeof notifForm]} onChange={(e) => setNotifForm({ ...notifForm, [item.key]: e.target.checked })} />
                      </label>
                    ))}
                  </div>
                  <div className="settings-contract-note">
                    <strong>Load-alert parity status</strong>
                    <span>Granular CX-style location, vehicle-size, return-journey and live-position alert rules are not represented by the current company_settings schema. They remain a separate parity-ledger item rather than being fabricated as saved preferences here.</span>
                  </div>
                  <div className="settings-actions"><ActionButton tone="secondary" onClick={() => router.push('/admin/notifications')}>Open Notification Inbox</ActionButton></div>
                </Panel>
              )}

              {activeTab === 'system' && (
                <Panel title="Company Profile / Finance" description="Commercial defaults used by invoices and company-level operations.">
                  <div className="settings-form-grid">
                    <label><span>Default VAT Rate (%)</span><select value={systemForm.defaultVatRate} onChange={(e) => setSystemForm({ ...systemForm, defaultVatRate: e.target.value })}>{COMPANY_CONFIG.vat.rates.map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}</select></label>
                    <label><span>Default Payment Terms</span><select value={systemForm.paymentTerms} onChange={(e) => setSystemForm({ ...systemForm, paymentTerms: e.target.value })}>{COMPANY_CONFIG.payment.terms.map((term) => <option key={term} value={term}>{term}</option>)}</select></label>
                    <label><span>Currency</span><select value={systemForm.currency} onChange={(e) => setSystemForm({ ...systemForm, currency: e.target.value })}><option value="GBP">GBP – British Pound</option><option value="EUR">EUR – Euro</option><option value="USD">USD – US Dollar</option></select></label>
                    <label><span>Date Format</span><select value={systemForm.dateFormat} onChange={(e) => setSystemForm({ ...systemForm, dateFormat: e.target.value })}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></label>
                    <label><span>Bank Account Name</span><input value={systemForm.bankAccountName} onChange={(e) => setSystemForm({ ...systemForm, bankAccountName: e.target.value })} /></label>
                    <label><span>Sort Code</span><input value={systemForm.bankSortCode} onChange={(e) => setSystemForm({ ...systemForm, bankSortCode: e.target.value })} placeholder="XX-XX-XX" /></label>
                    <label><span>Account Number</span><input value={systemForm.bankAccountNumber} onChange={(e) => setSystemForm({ ...systemForm, bankAccountNumber: e.target.value })} placeholder="8-digit account number" /></label>
                  </div>
                </Panel>
              )}

              {activeTab === 'help' && (
                <Panel title="Help" description="Routes to the main operational workspaces.">
                  <div className="settings-link-list">
                    <button type="button" onClick={() => router.push('/admin/diary')}><strong>Diary</strong><span>Assigned and historical bookings, POD, notes, invoices and history.</span></button>
                    <button type="button" onClick={() => router.push('/admin/live-availability')}><strong>Live Availability</strong><span>Driver positions, availability and nearby exchange resources.</span></button>
                    <button type="button" onClick={() => router.push('/admin/fleet/resources')}><strong>Drivers & Vehicles</strong><span>Fleet resource register and operational readiness.</span></button>
                  </div>
                </Panel>
              )}

              {activeTab === 'contact' && (
                <Panel title="Contact" description="Current company contact details stored in the company profile.">
                  <div className="settings-contact-grid">
                    <div><span>Company Email</span><strong>{companyForm.email || 'Not set'}</strong></div>
                    <div><span>Company Phone</span><strong>{companyForm.phone || 'Not set'}</strong></div>
                    <div><span>Address</span><strong>{[companyForm.street, companyForm.city, companyForm.postcode].filter(Boolean).join(', ') || 'Not set'}</strong></div>
                  </div>
                </Panel>
              )}
            </main>
          </div>
        )}
      </PageFrame>
    </ProtectedRoute>
  );
}
