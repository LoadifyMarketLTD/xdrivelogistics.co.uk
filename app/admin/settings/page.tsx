'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { COMPANY_CONFIG } from '../../config/company';

const TABS = [
  { id: 'company', label: 'Company Info', icon: '🏢' },
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'system', label: 'System', icon: '⚙️' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('company');
  const [saved, setSaved] = useState(false);

  const [companyForm, setCompanyForm] = useState({
    name: COMPANY_CONFIG.name,
    legalName: COMPANY_CONFIG.legalName,
    companyNumber: COMPANY_CONFIG.companyNumber,
    email: COMPANY_CONFIG.email,
    phone: COMPANY_CONFIG.phoneDisplay,
    street: COMPANY_CONFIG.address.street,
    city: COMPANY_CONFIG.address.city,
    postcode: COMPANY_CONFIG.address.postcode,
    jobRefPrefix: COMPANY_CONFIG.invoice.jobRefPrefix,
    invoicePrefix: COMPANY_CONFIG.invoice.invoicePrefix,
  });

  const [notifForm, setNotifForm] = useState({
    emailNewJob: true,
    emailStatusChange: true,
    emailInvoicePaid: true,
    emailBidReceived: false,
  });

  const [systemForm, setSystemForm] = useState({
    defaultVatRate: String(COMPANY_CONFIG.vat.defaultRate),
    paymentTerms: COMPANY_CONFIG.payment.terms[0] as string,
    currency: 'GBP',
    dateFormat: 'DD/MM/YYYY',
    bankAccountName: COMPANY_CONFIG.payment.bankTransfer.accountName,
    bankSortCode: COMPANY_CONFIG.payment.bankTransfer.sortCode,
    bankAccountNumber: COMPANY_CONFIG.payment.bankTransfer.accountNumber,
  });

  const SETTINGS_KEY = 'danny_admin_settings';

  const handleSave = () => {
    const settings = { companyForm, notifForm, systemForm };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
        {/* Header */}
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

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Tab Sidebar */}
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

          {/* Content Panel */}
          <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', padding: '2rem' }}>

            {/* Company Info Tab */}
            {activeTab === 'company' && (
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

            {/* Account Tab */}
            {activeTab === 'account' && (
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
                  <input type="password" style={inputStyle} placeholder="Enter new password" />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={labelStyle}>Confirm New Password</label>
                  <input type="password" style={inputStyle} placeholder="Confirm new password" />
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
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

            {/* System Tab */}
            {activeTab === 'system' && (
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

            {/* Save Button */}
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSave}
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: '#1F7A3D',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#166534'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F7A3D'}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
