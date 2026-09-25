'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { COMPANY_CONFIG } from '../../config/company';
import {
  DEFAULT_INVOICE_EMAIL_MESSAGE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  INVOICE_EMAIL_TOKENS,
} from '../../../lib/invoiceEmailTemplate';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, Panel } from './WorkspaceUI';

type FinanceTab = 'bank' | 'invoices' | 'email';
type FinanceSettings = {
  jobRefPrefix: string;
  invoicePrefix: string;
  defaultVatRate: number;
  defaultVatTreatment: string;
  paymentTerms: string;
  currency: string;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  invoiceEmailSubject: string;
  invoiceEmailMessage: string;
  updatedAt: string | null;
};

type FinanceResponse = { settings?: Partial<FinanceSettings>; error?: string };

const EMPTY_SETTINGS: FinanceSettings = {
  jobRefPrefix: COMPANY_CONFIG.invoice.jobRefPrefix,
  invoicePrefix: COMPANY_CONFIG.invoice.invoicePrefix,
  defaultVatRate: COMPANY_CONFIG.vat.defaultRate,
  defaultVatTreatment: 'standard',
  paymentTerms: COMPANY_CONFIG.payment.defaultTerm,
  currency: 'GBP',
  bankAccountName: '',
  bankSortCode: '',
  bankAccountNumber: '',
  invoiceEmailSubject: DEFAULT_INVOICE_EMAIL_SUBJECT,
  invoiceEmailMessage: DEFAULT_INVOICE_EMAIL_MESSAGE,
  updatedAt: null,
};

const sampleTokens: Record<string, string> = {
  'My company': 'XDrive Logistics Ltd',
  'Customer company': 'Sample Customer Ltd',
  'Invoice number': 'INV-1001',
  'Invoice date': '25 Sep 2026',
  'Currency symbol': '£',
  'Gross total': '108.00',
  'Load ID': 'XDL-83953373',
};
const renderTemplate = (template: string) => Object.entries(sampleTokens).reduce(
  (output, [token, value]) => output.replaceAll(`[[${token}]]`, value),
  template,
);
const sortCodeDisplay = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  return digits.replace(/(\d{2})(?=\d)/g, '$1-');
};

export default function CompanyFinanceSettingsPanel({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [tab, setTab] = useState<FinanceTab>('bank');
  const [settings, setSettings] = useState<FinanceSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setError('Your session has expired. Sign in again.'); setLoading(false); return; }
    const response = await fetch(`/api/settings/company-finance?companyId=${encodeURIComponent(companyId)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as FinanceResponse;
    if (!response.ok || !payload.settings) {
      setError(payload.error || 'Company finance settings could not be loaded.');
    } else {
      setSettings({ ...EMPTY_SETTINGS, ...payload.settings });
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setError('Your session has expired. Sign in again.'); setSaving(false); return; }
    const response = await fetch('/api/settings/company-finance', {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, ...settings }),
    });
    const payload = await response.json().catch(() => ({})) as FinanceResponse;
    if (!response.ok) setError(payload.error || 'Company finance settings could not be saved.');
    else { setNotice('Company finance and invoice defaults saved.'); await load(); }
    setSaving(false);
  };

  const previewSubject = useMemo(() => renderTemplate(settings.invoiceEmailSubject).replace('XDrive Logistics Ltd', companyName || 'XDrive Logistics Ltd'), [companyName, settings.invoiceEmailSubject]);
  const previewMessage = useMemo(() => renderTemplate(settings.invoiceEmailMessage).replaceAll('XDrive Logistics Ltd', companyName || 'XDrive Logistics Ltd'), [companyName, settings.invoiceEmailMessage]);

  if (loading) return <Panel><EmptyState compact title="Loading finance settings…" /></Panel>;

  return <div style={{ display: 'grid', gap: 10 }}>
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
    <div className="workspace-tab-strip" role="tablist" aria-label="Finance settings" style={{ display: 'flex', overflowX: 'auto' }}>
      {([['bank','Bank Details'],['invoices','Invoices'],['email','Email Template']] as Array<[FinanceTab,string]>).map(([id,label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} data-active={tab === id ? 'true' : 'false'} onClick={() => setTab(id)}>{label}</button>)}
    </div>

    {tab === 'bank' && <Panel title="Bank Details" description="Remittance details printed on XDrive invoices. These are not Stripe Connect credentials.">
      <div className="role-settings-form">
        <label>Account holder<input value={settings.bankAccountName} onChange={(e) => setSettings((v) => ({ ...v, bankAccountName: e.target.value.slice(0,120) }))} /></label>
        <label>Sort code<input inputMode="numeric" value={sortCodeDisplay(settings.bankSortCode)} onChange={(e) => setSettings((v) => ({ ...v, bankSortCode: e.target.value.replace(/\D/g,'').slice(0,6) }))} placeholder="12-34-56" /></label>
        <label>Account number<input inputMode="numeric" value={settings.bankAccountNumber} onChange={(e) => setSettings((v) => ({ ...v, bankAccountNumber: e.target.value.replace(/\D/g,'').slice(0,10) }))} /></label>
        <label>Currency<input disabled value="GBP" /></label>
      </div>
    </Panel>}

    {tab === 'invoices' && <Panel title="Invoice Defaults" description="Canonical defaults for new invoices. Historical invoice snapshots are not rewritten.">
      <div className="role-settings-form">
        <label>Job reference prefix<input value={settings.jobRefPrefix} onChange={(e) => setSettings((v) => ({ ...v, jobRefPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,12) }))} /></label>
        <label>Invoice prefix<input value={settings.invoicePrefix} onChange={(e) => setSettings((v) => ({ ...v, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,12) }))} /></label>
        <label>Payment terms<select value={settings.paymentTerms} onChange={(e) => setSettings((v) => ({ ...v, paymentTerms: e.target.value }))}>{COMPANY_CONFIG.payment.terms.map((term) => <option key={term} value={term}>{term}</option>)}</select></label>
        <label>VAT treatment<select value={settings.defaultVatTreatment} onChange={(e) => { const treatment = e.target.value; const rate = treatment === 'standard' ? 20 : treatment === 'reduced' ? 5 : treatment === 'zero_rated' || treatment === 'not_registered' ? 0 : settings.defaultVatRate; setSettings((v) => ({ ...v, defaultVatTreatment: treatment, defaultVatRate: rate })); }}><option value="standard">Standard rate</option><option value="reduced">Reduced rate</option><option value="zero_rated">Zero-rated</option><option value="reverse_charge">Reverse charge</option><option value="not_registered">Not VAT registered</option></select></label>
        <label>VAT rate<select value={settings.defaultVatRate} onChange={(e) => setSettings((v) => ({ ...v, defaultVatRate: Number(e.target.value) }))}><option value={0}>0%</option><option value={5}>5%</option><option value={20}>20%</option></select></label>
      </div>
      <div style={{ marginTop: 10, color: '#64748b', fontSize: 11 }}>Standard XDrive payment terms remain Pay now, 14 days or 30 days. Any exceptional extension is handled separately and is not a company default.</div>
    </Panel>}

    {tab === 'email' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10, alignItems: 'start' }}>
      <Panel title="Invoice Email Template" description="Saved company default. Authorised invoice senders can still override it for an individual invoice.">
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 800 }}>SUBJECT<input value={settings.invoiceEmailSubject} onChange={(e) => setSettings((v) => ({ ...v, invoiceEmailSubject: e.target.value.slice(0,500) }))} style={{ minHeight: 34 }} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 800 }}>MESSAGE<textarea rows={15} value={settings.invoiceEmailMessage} onChange={(e) => setSettings((v) => ({ ...v, invoiceEmailMessage: e.target.value.slice(0,10000) }))} style={{ resize: 'vertical' }} /></label>
          <div style={{ color: '#64748b', fontSize: 10 }}>Tokens: {INVOICE_EMAIL_TOKENS.map((token) => `[[${token}]]`).join(' · ')}</div>
          <ActionButton tone="secondary" onClick={() => setSettings((v) => ({ ...v, invoiceEmailSubject: DEFAULT_INVOICE_EMAIL_SUBJECT, invoiceEmailMessage: DEFAULT_INVOICE_EMAIL_MESSAGE }))}>Reset to XDrive Default</ActionButton>
        </div>
      </Panel>
      <Panel title="Invoice Email Preview" description="Sample values are used only for this preview.">
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11 }}><strong>Subject:</strong> {previewSubject}</div>
          <div style={{ padding: 10, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.55 }}>{previewMessage}</div>
        </div>
      </Panel>
    </div>}

    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActionButton tone="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Finance Settings'}</ActionButton></div>
  </div>;
}
