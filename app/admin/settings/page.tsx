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
  PageHeader,
} from '../../components/workspace/WorkspaceUI';
import styles from '../../components/workspace/WorkspaceUI.module.css';

const TABS = [
  { id: 'memberCompany', label: 'Member / Company Info', icon: '🏢' },
  { id: 'help', label: 'Help', icon: '❓' },
  { id: 'contact', label: 'Contact', icon: '☎️' },
  { id: 'userProfile', label: 'User Profile', icon: '👤' },
  { id: 'companyProfile', label: 'Company Profile', icon: '🏭' },
  { id: 'other', label: 'Other', icon: '⚙️' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, hasSupabaseSession } = useAuth();
  const [activeTab, setActiveTab] = useState('memberCompany');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
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
  const [accountForm, setAccountForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
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

      const settings = await loadCompanySettings(supabase, resolvedCompanyId);
      if (cancelled) return;

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

    loadSettings();

    return () => {
      cancelled = true;
    };
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
      company_number: companyForm.companyNumber || null,
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
    const { error: companyError } = await supabase
      .from('companies')
      .update(companyUpdatePayload)
      .eq('id', companyId);

    if (companyError) {
      setSaveError(`Company details could not be saved: ${companyError.message}`);
      setSaving(false);
      return;
    }

    const { error: settingsError } = await supabase
      .from('company_settings')
      .upsert({
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
      });
    logRuntimeProof({
      flow: 'Save Settings',
      authUid: user.id,
      membershipId: user.membershipId,
      companyId,
      payload: {
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
        notify_email_new_job: notifForm.emailNewJob,
        notify_email_status_change: notifForm.emailStatusChange,
        notify_email_invoice_paid: notifForm.emailInvoicePaid,
        notify_email_bid_received: notifForm.emailBidReceived,
        updated_by: user.id,
      },
      table: 'company_settings',
      rlsPolicy: 'company_settings_insert_operator|company_settings_update_operator',
    });

    if (settingsError) {
      const migrationHint =
        settingsError.code === 'PGRST205'
          ? 'Run the latest Supabase migration before using Settings.'
          : settingsError.message;
      setSaveError(`Settings could not be saved: ${migrationHint}`);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
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
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <ProtectedRoute>
      {/* Page background — contract Section 1: #f4f6f8, 12px padding */}
      <div style={{ background: '#f4f6f8', padding: '12px' }}>
        <PageHeader
          eyebrow="Administration"
          title="Settings"
          description="Configure system and company settings."
          actions={
            <ActionButton tone="secondary" onClick={() => router.push('/admin')}>
              ← Dashboard
            </ActionButton>
          }
        />

        {saved && <AlertBanner tone="success">Settings saved successfully.</AlertBanner>}
        {saveError && <AlertBanner tone="danger">{saveError}</AlertBanner>}
        {!isSupabaseConfigured && (
          <AlertBanner tone="warning">
            Supabase is not configured. Settings are read-only until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are available.
          </AlertBanner>
        )}

        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '16px', color: '#6b7280', fontSize: '12px' }}>
            Loading settings…
          </div>
        ) : (
          <div className={styles.settingsLayout}>
            {/* Left nav rail */}
            <nav className={styles.settingsSideNav} aria-label="Settings sections">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.settingsSideNavBtn} ${activeTab === tab.id ? styles.settingsSideNavBtnActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Main content panel */}
            <div className={styles.settingsPanel}>
              {activeTab === 'memberCompany' && (
                <div>
                  <h2 className={styles.settingsSectionTitle}>Company Information</h2>
                  <div className={styles.settingsFieldGrid}>
                    <div>
                      <label className={styles.settingsLabel}>Trading Name</label>
                      <input className={styles.settingsInput} value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label className={styles.settingsLabel}>Legal Name</label>
                      <input className={styles.settingsInput} value={companyForm.legalName} onChange={(e) => setCompanyForm({ ...companyForm, legalName: e.target.value })} />
                    </div>
                  </div>
                  <div className={styles.settingsFieldGrid}>
                    <div>
                      <label className={styles.settingsLabel}>Company Number</label>
                      <input className={styles.settingsInput} value={companyForm.companyNumber} onChange={(e) => setCompanyForm({ ...companyForm, companyNumber: e.target.value })} />
                    </div>
                    <div>
                      <label className={styles.settingsLabel}>Email Address</label>
                      <input type="email" className={styles.settingsInput} value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} />
                    </div>
                  </div>
                  <div className={styles.settingsFieldRow}>
                    <label className={styles.settingsLabel}>Phone Number</label>
                    <input type="tel" className={styles.settingsInput} value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} />
                  </div>

                  <h2 className={`${styles.settingsSectionTitle} ${styles.settingsSectionTitleSpaced}`}>Address</h2>
                  <div className={styles.settingsFieldRow}>
                    <label className={styles.settingsLabel}>Street Address</label>
                    <input className={styles.settingsInput} value={companyForm.street} onChange={(e) => setCompanyForm({ ...companyForm, street: e.target.value })} />
                  </div>
                  <div className={styles.settingsFieldGrid}>
                    <div>
                      <label className={styles.settingsLabel}>City</label>
                      <input className={styles.settingsInput} value={companyForm.city} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} />
                    </div>
                    <div>
                      <label className={styles.settingsLabel}>Postcode</label>
                      <input className={styles.settingsInput} value={companyForm.postcode} onChange={(e) => setCompanyForm({ ...companyForm, postcode: e.target.value })} />
                    </div>
                  </div>

                  <h2 className={`${styles.settingsSectionTitle} ${styles.settingsSectionTitleSpaced}`}>Reference Prefixes</h2>
                  <div className={styles.settingsFieldGrid}>
                    <div>
                      <label className={styles.settingsLabel}>Job Reference Prefix</label>
                      <input className={styles.settingsInput} value={companyForm.jobRefPrefix} onChange={(e) => setCompanyForm({ ...companyForm, jobRefPrefix: e.target.value })} />
                    </div>
                    <div>
                      <label className={styles.settingsLabel}>Invoice Prefix</label>
                      <input className={styles.settingsInput} value={companyForm.invoicePrefix} onChange={(e) => setCompanyForm({ ...companyForm, invoicePrefix: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'userProfile' && (
                <div>
                  <h2 className={styles.settingsSectionTitle}>Account Details</h2>
                  <div className={styles.settingsAccountInfo}>
                    <div className={styles.settingsInfoCardLabel}>Logged in as</div>
                    <div className={styles.settingsInfoCardValue}>{user?.email}</div>
                  </div>
                  <div className={styles.settingsFieldRow}>
                    <label className={styles.settingsLabel}>Email Address</label>
                    <input type="email" className={`${styles.settingsInput} ${styles.settingsInputReadonly}`} value={user?.email ?? ''} readOnly />
                    <p className={styles.settingsHint}>Contact your administrator to change your email address.</p>
                  </div>

                  <h2 className={`${styles.settingsSectionTitle} ${styles.settingsSectionTitleSpaced}`}>Change Password</h2>
                  <div className={styles.settingsFieldRow}>
                    <label className={styles.settingsLabel}>New Password</label>
                    <input type="password" className={styles.settingsInput} placeholder="Enter new password" value={accountForm.newPassword} onChange={(e) => setAccountForm({ ...accountForm, newPassword: e.target.value })} />
                  </div>
                  <div className={styles.settingsFieldRow}>
                    <label className={styles.settingsLabel}>Confirm New Password</label>
                    <input type="password" className={styles.settingsInput} placeholder="Confirm new password" value={accountForm.confirmPassword} onChange={(e) => setAccountForm({ ...accountForm, confirmPassword: e.target.value })} />
                  </div>
                  <div className={styles.settingsActionRow}>
                    <ActionButton tone="success" disabled={changingPassword || !isSupabaseConfigured} onClick={handleChangePassword}>
                      {changingPassword ? 'Updating…' : 'Update Password'}
                    </ActionButton>
                  </div>
                </div>
              )}

              {activeTab === 'other' && (
                <div>
                  <h2 className={styles.settingsSectionTitle}>Email Notifications</h2>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }}>Choose which events trigger an email notification.</p>
                  {[
                    { key: 'emailNewJob', label: 'New job created', description: 'Receive an email when a new job is added' },
                    { key: 'emailStatusChange', label: 'Job status changed', description: 'Receive an email when a job status is updated' },
                    { key: 'emailInvoicePaid', label: 'Invoice paid', description: 'Receive an email when an invoice is marked as paid' },
                    { key: 'emailBidReceived', label: 'Bid received', description: 'Receive an email when a driver places a bid on a job' },
                  ].map((item) => (
                    <div key={item.key} className={styles.settingsNotifRow}>
                      <div>
                        <div className={styles.settingsNotifLabel}>{item.label}</div>
                        <div className={styles.settingsNotifDescription}>{item.description}</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={notifForm[item.key as keyof typeof notifForm]}
                          onChange={(e) => setNotifForm({ ...notifForm, [item.key]: e.target.checked })}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#1D57D8' }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'companyProfile' && (
                <div>
                  <h2 className={styles.settingsSectionTitle}>System Settings</h2>
                  <div className={styles.settingsFieldGrid}>
                    <div>
                      <label className={styles.settingsLabel}>Default VAT Rate (%)</label>
                      <select className={styles.settingsInput} value={systemForm.defaultVatRate} onChange={(e) => setSystemForm({ ...systemForm, defaultVatRate: e.target.value })}>
                        {COMPANY_CONFIG.vat.rates.map((r) => (
                          <option key={r} value={String(r)}>{r}%</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={styles.settingsLabel}>Default Payment Terms</label>
                      <select className={styles.settingsInput} value={systemForm.paymentTerms} onChange={(e) => setSystemForm({ ...systemForm, paymentTerms: e.target.value })}>
                        {COMPANY_CONFIG.payment.terms.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className={styles.settingsFieldGrid}>
                    <div>
                      <label className={styles.settingsLabel}>Currency</label>
                      <select className={styles.settingsInput} value={systemForm.currency} onChange={(e) => setSystemForm({ ...systemForm, currency: e.target.value })}>
                        <option value="GBP">GBP – British Pound</option>
                        <option value="EUR">EUR – Euro</option>
                        <option value="USD">USD – US Dollar</option>
                      </select>
                    </div>
                    <div>
                      <label className={styles.settingsLabel}>Date Format</label>
                      <select className={styles.settingsInput} value={systemForm.dateFormat} onChange={(e) => setSystemForm({ ...systemForm, dateFormat: e.target.value })}>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>

                  <h2 className={`${styles.settingsSectionTitle} ${styles.settingsSectionTitleSpaced}`}>Bank Transfer Details</h2>
                  <div className={styles.settingsFieldGrid}>
                    <div>
                      <label className={styles.settingsLabel}>Account Name</label>
                      <input className={styles.settingsInput} value={systemForm.bankAccountName} onChange={(e) => setSystemForm({ ...systemForm, bankAccountName: e.target.value })} />
                    </div>
                    <div>
                      <label className={styles.settingsLabel}>Sort Code</label>
                      <input className={styles.settingsInput} value={systemForm.bankSortCode} onChange={(e) => setSystemForm({ ...systemForm, bankSortCode: e.target.value })} placeholder="XX-XX-XX" />
                    </div>
                  </div>
                  <div className={styles.settingsFieldRow}>
                    <label className={styles.settingsLabel}>Account Number</label>
                    <input className={styles.settingsInput} value={systemForm.bankAccountNumber} onChange={(e) => setSystemForm({ ...systemForm, bankAccountNumber: e.target.value })} placeholder="8-digit account number" />
                  </div>
                </div>
              )}

              {activeTab === 'help' && (
                <div>
                  <h2 className={styles.settingsSectionTitle}>Help</h2>
                  <div className={styles.settingsInfoCard}>
                    <div className={styles.settingsInfoCardValue}>Need operational help?</div>
                    <div className={styles.settingsInfoCardLabel} style={{ marginTop: '4px' }}>Use Diary for live jobs, Fleet for locations, and Drivers &amp; Vehicles for admin management.</div>
                  </div>
                  <div className={styles.settingsInfoCard}>
                    <div className={styles.settingsInfoCardValue}>Support flow</div>
                    <div className={styles.settingsInfoCardLabel} style={{ marginTop: '4px' }}>Collect screen details and route, then contact your internal support owner.</div>
                  </div>
                </div>
              )}

              {activeTab === 'contact' && (
                <div>
                  <h2 className={styles.settingsSectionTitle}>Contact</h2>
                  <div className={styles.settingsInfoCard}>
                    <div className={styles.settingsInfoCardLabel}>Company Email</div>
                    <div className={styles.settingsInfoCardValue}>{companyForm.email || 'Not set'}</div>
                  </div>
                  <div className={styles.settingsInfoCard}>
                    <div className={styles.settingsInfoCardLabel}>Company Phone</div>
                    <div className={styles.settingsInfoCardValue}>{companyForm.phone || 'Not set'}</div>
                  </div>
                  <div className={styles.settingsInfoCard}>
                    <div className={styles.settingsInfoCardLabel}>Address</div>
                    <div className={styles.settingsInfoCardValue}>{[companyForm.street, companyForm.city, companyForm.postcode].filter(Boolean).join(', ') || 'Not set'}</div>
                  </div>
                </div>
              )}

              {['memberCompany', 'companyProfile', 'other'].includes(activeTab) && (
                <div className={styles.settingsActionRow}>
                  <ActionButton
                    tone="success"
                    disabled={saving || !isSupabaseConfigured}
                    onClick={handleSave}
                  >
                    {saving ? 'Saving…' : 'Save Settings'}
                  </ActionButton>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
