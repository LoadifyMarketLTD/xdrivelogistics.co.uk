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
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { logRuntimeProof } from '../../../lib/runtimeProof';

const TABS = [
  { id: 'memberCompany', label: 'Member / Company Info', icon: '🏢' },
  { id: 'help', label: 'Help', icon: '❓' },
  { id: 'contact', label: 'Contact', icon: '☎️' },
  { id: 'userProfile', label: 'User Profile', icon: '👤' },
  { id: 'companyProfile', label: 'Company Profile', icon: '🏭' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'usersDrivers', label: 'Users / Drivers', icon: '🚚' },
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

    let companyError: { message?: string | null } | null = null;
    logRuntimeProof({
      flow: 'Save Settings',
      authUid: user.id,
      membershipId: user.membershipId,
      companyId,
      payload: companyUpdatePayload,
      table: 'companies',
      rlsPolicy: 'companies_update_company_member',
    });
    while (Object.keys(companyUpdatePayload).length > 0) {
      const { error } = await supabase
        .from('companies')
        .update(companyUpdatePayload)
        .eq('id', companyId);

      if (!error) {
        companyError = null;
        break;
      }

      const missingColumn = getMissingColumnFromError(error, 'companies');
      if (missingColumn && Object.prototype.hasOwnProperty.call(companyUpdatePayload, missingColumn)) {
        delete companyUpdatePayload[missingColumn];
        companyError = error;
        continue;
      }

      companyError = error;
      break;
    }

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
      rlsPolicy: 'company_settings_upsert_company_member',
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

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.95rem',
    boxSizing: 'border-box' as const,
    backgroundColor: 'white',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '500' as const,
    color: '#374151',
    marginBottom: '0.5rem',
  };

  const fieldGroupStyle = {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 1fr',
    gap: '1.25rem',
    marginBottom: '1.25rem',
  };

  const sectionTitleStyle = {
    fontSize: '1rem',
    fontWeight: '600' as const,
    color: '#1f2937',
    marginBottom: '1.25rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #e5e7eb',
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
              Settings
            </h1>
            <p style={{ color: '#6b7280', margin: 0 }}>
              Configure system and company settings
            </p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'white',
              color: '#0A2239',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#0A2239';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        {saved && (
          <div style={{
            backgroundColor: '#dcfce7',
            border: '1px solid #1F7A3D',
            borderRadius: '8px',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            color: '#14532d',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            ✅ Settings saved successfully!
          </div>
        )}

        {saveError && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            color: '#991b1b',
            fontWeight: '600',
          }}>
            {saveError}
          </div>
        )}

        {!isSupabaseConfigured && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            color: '#92400e',
            fontWeight: '600',
          }}>
            Supabase is not configured. Settings are read-only until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are available.
          </div>
        )}

        {loading ? (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', padding: '2rem', color: '#6b7280' }}>
            Loading settings…
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
            <div style={{
              width: '220px',
              flexShrink: 0,
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    backgroundColor: activeTab === tab.id ? '#f0fdf4' : 'transparent',
                    color: activeTab === tab.id ? '#1F7A3D' : '#374151',
                    border: 'none',
                    borderLeft: activeTab === tab.id ? '4px solid #1F7A3D' : '4px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: activeTab === tab.id ? '600' : '400',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', padding: '2rem' }}>
              {activeTab === 'memberCompany' && (
                <div>
                  <h2 style={sectionTitleStyle}>Company Information</h2>
                  <div style={fieldGroupStyle}>
                    <div>
                      <label style={labelStyle}>Trading Name</label>
                      <input
                        style={inputStyle}
                        value={companyForm.name}
                        onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Legal Name</label>
                      <input
                        style={inputStyle}
                        value={companyForm.legalName}
                        onChange={(e) => setCompanyForm({ ...companyForm, legalName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={fieldGroupStyle}>
                    <div>
                      <label style={labelStyle}>Company Number</label>
                      <input
                        style={inputStyle}
                        value={companyForm.companyNumber}
                        onChange={(e) => setCompanyForm({ ...companyForm, companyNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Email Address</label>
                      <input
                        type="email"
                        style={inputStyle}
                        value={companyForm.email}
                        onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={labelStyle}>Phone Number</label>
                    <input
                      type="tel"
                      style={inputStyle}
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    />
                  </div>

                  <h2 style={{ ...sectionTitleStyle, marginTop: '1.5rem' }}>Address</h2>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={labelStyle}>Street Address</label>
                    <input
                      style={inputStyle}
                      value={companyForm.street}
                      onChange={(e) => setCompanyForm({ ...companyForm, street: e.target.value })}
                    />
                  </div>
                  <div style={fieldGroupStyle}>
                    <div>
                      <label style={labelStyle}>City</label>
                      <input
                        style={inputStyle}
                        value={companyForm.city}
                        onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Postcode</label>
                      <input
                        style={inputStyle}
                        value={companyForm.postcode}
                        onChange={(e) => setCompanyForm({ ...companyForm, postcode: e.target.value })}
                      />
                    </div>
                  </div>

                  <h2 style={{ ...sectionTitleStyle, marginTop: '1.5rem' }}>Reference Prefixes</h2>
                  <div style={fieldGroupStyle}>
                    <div>
                      <label style={labelStyle}>Job Reference Prefix</label>
                      <input
                        style={inputStyle}
                        value={companyForm.jobRefPrefix}
                        onChange={(e) => setCompanyForm({ ...companyForm, jobRefPrefix: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Invoice Prefix</label>
                      <input
                        style={inputStyle}
                        value={companyForm.invoicePrefix}
                        onChange={(e) => setCompanyForm({ ...companyForm, invoicePrefix: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'userProfile' && (
                <div>
                  <h2 style={sectionTitleStyle}>Account Details</h2>
                  <div style={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                  }}>
                    <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.25rem' }}>Logged in as</div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{user?.email}</div>
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={labelStyle}>Email Address</label>
                    <input
                      type="email"
                      style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#6b7280' }}
                      value={user?.email || ''}
                      readOnly
                    />
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      Contact your administrator to change your email address.
                    </p>
                  </div>
                  <h2 style={{ ...sectionTitleStyle, marginTop: '1.5rem' }}>Change Password</h2>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={labelStyle}>New Password</label>
                    <input
                      type="password"
                      style={inputStyle}
                      placeholder="Enter new password"
                      value={accountForm.newPassword}
                      onChange={(e) => setAccountForm({ ...accountForm, newPassword: e.target.value })}
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input
                      type="password"
                      style={inputStyle}
                      placeholder="Confirm new password"
                      value={accountForm.confirmPassword}
                      onChange={(e) => setAccountForm({ ...accountForm, confirmPassword: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !isSupabaseConfigured}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: changingPassword || !isSupabaseConfigured ? '#86efac' : '#1F7A3D',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        cursor: changingPassword || !isSupabaseConfigured ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {changingPassword ? 'Updating password…' : 'Update Password'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'other' && (
                <div>
                  <h2 style={sectionTitleStyle}>Email Notifications</h2>
                  <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Choose which events trigger an email notification.
                  </p>
                  {[
                    { key: 'emailNewJob', label: 'New job created', description: 'Receive an email when a new job is added' },
                    { key: 'emailStatusChange', label: 'Job status changed', description: 'Receive an email when a job status is updated' },
                    { key: 'emailInvoicePaid', label: 'Invoice paid', description: 'Receive an email when an invoice is marked as paid' },
                    { key: 'emailBidReceived', label: 'Bid received', description: 'Receive an email when a driver places a bid on a job' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.95rem' }}>{item.label}</div>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.2rem' }}>{item.description}</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={notifForm[item.key as keyof typeof notifForm]}
                          onChange={(e) => setNotifForm({ ...notifForm, [item.key]: e.target.checked })}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1F7A3D' }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'companyProfile' && (
                <div>
                  <h2 style={sectionTitleStyle}>System Settings</h2>
                  <div style={fieldGroupStyle}>
                    <div>
                      <label style={labelStyle}>Default VAT Rate (%)</label>
                      <select
                        style={inputStyle}
                        value={systemForm.defaultVatRate}
                        onChange={(e) => setSystemForm({ ...systemForm, defaultVatRate: e.target.value })}
                      >
                        {COMPANY_CONFIG.vat.rates.map((r) => (
                          <option key={r} value={String(r)}>{r}%</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Default Payment Terms</label>
                      <select
                        style={inputStyle}
                        value={systemForm.paymentTerms}
                        onChange={(e) => setSystemForm({ ...systemForm, paymentTerms: e.target.value })}
                      >
                        {COMPANY_CONFIG.payment.terms.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={fieldGroupStyle}>
                    <div>
                      <label style={labelStyle}>Currency</label>
                      <select
                        style={inputStyle}
                        value={systemForm.currency}
                        onChange={(e) => setSystemForm({ ...systemForm, currency: e.target.value })}
                      >
                        <option value="GBP">GBP – British Pound</option>
                        <option value="EUR">EUR – Euro</option>
                        <option value="USD">USD – US Dollar</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Date Format</label>
                      <select
                        style={inputStyle}
                        value={systemForm.dateFormat}
                        onChange={(e) => setSystemForm({ ...systemForm, dateFormat: e.target.value })}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>

                  <h2 style={{ ...sectionTitleStyle, marginTop: '1.5rem' }}>Bank Transfer Details</h2>
                  <div style={fieldGroupStyle}>
                    <div>
                      <label style={labelStyle}>Account Name</label>
                      <input
                        style={inputStyle}
                        value={systemForm.bankAccountName}
                        onChange={(e) => setSystemForm({ ...systemForm, bankAccountName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Sort Code</label>
                      <input
                        style={inputStyle}
                        value={systemForm.bankSortCode}
                        onChange={(e) => setSystemForm({ ...systemForm, bankSortCode: e.target.value })}
                        placeholder="XX-XX-XX"
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={labelStyle}>Account Number</label>
                    <input
                      style={inputStyle}
                      value={systemForm.bankAccountNumber}
                      onChange={(e) => setSystemForm({ ...systemForm, bankAccountNumber: e.target.value })}
                      placeholder="8-digit account number"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'help' && (
                <div>
                  <h2 style={sectionTitleStyle}>Help</h2>
                  <div style={{ display: 'grid', gap: '0.8rem' }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', backgroundColor: '#f9fafb' }}>
                      <div style={{ fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Need operational help?</div>
                      <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Use Diary for live jobs, Fleet for locations, and Drivers & Vehicles for admin management.</div>
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', backgroundColor: '#f9fafb' }}>
                      <div style={{ fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Support flow</div>
                      <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Collect screen details and route, then contact your internal support owner.</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'contact' && (
                <div>
                  <h2 style={sectionTitleStyle}>Contact</h2>
                  <div style={{ display: 'grid', gap: '0.8rem' }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Company Email</div>
                      <div style={{ color: '#111827', fontWeight: 600 }}>{companyForm.email || 'Not set'}</div>
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Company Phone</div>
                      <div style={{ color: '#111827', fontWeight: 600 }}>{companyForm.phone || 'Not set'}</div>
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Address</div>
                      <div style={{ color: '#111827', fontWeight: 600 }}>{[companyForm.street, companyForm.city, companyForm.postcode].filter(Boolean).join(', ') || 'Not set'}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  <h2 style={sectionTitleStyle}>Documents</h2>
                  <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Document management is available in the dedicated Documents page.</p>
                  <button onClick={() => router.push('/admin/documents')} style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                    Open Documents
                  </button>
                </div>
              )}

              {activeTab === 'usersDrivers' && (
                <div>
                  <h2 style={sectionTitleStyle}>Users / Drivers</h2>
                  <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Driver management and assignment are handled in the Drivers & Vehicles area.</p>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <button onClick={() => router.push('/admin/drivers-vehicles')} style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                      Open Drivers & Vehicles
                    </button>
                    <button onClick={() => router.push('/admin/drivers')} style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                      Open Drivers Manager
                    </button>
                  </div>
                </div>
              )}

              {['memberCompany', 'companyProfile', 'other'].includes(activeTab) && (
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSave}
                  disabled={saving || !isSupabaseConfigured}
                  style={{
                    padding: '0.75rem 2rem',
                    backgroundColor: saving || !isSupabaseConfigured ? '#86efac' : '#1F7A3D',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: saving || !isSupabaseConfigured ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!saving && isSupabaseConfigured) e.currentTarget.style.backgroundColor = '#166534';
                  }}
                  onMouseLeave={(e) => {
                    if (!saving && isSupabaseConfigured) e.currentTarget.style.backgroundColor = '#1F7A3D';
                  }}
                >
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
