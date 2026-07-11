'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../components/AuthContext';
import { WorkflowStageStrip } from '../../workflowUi';
import { COMPANY_CONFIG } from '../../../config/company';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabaseClient';
import { resolveActiveCompanyId } from '../../../../lib/activeCompany';
import type { Invoice } from '../../../../lib/types/database';
import { toLegacyInvoiceStatusForDb } from '../../../../lib/invoiceStatus';

type JobPrefill = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  pickup_location: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_datetime: string | null;
  load_details: string | null;
  special_requirements: string | null;
  budget_amount: number | null;
  currency: string | null;
};

const firstNonEmpty = (...values: Array<string | null | undefined>) =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';

const parsePositiveNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseVatRate = (value: string | null): 0 | 5 | 20 | null => {
  const parsed = value ? Number(value) : NaN;
  if (parsed === 0 || parsed === 5 || parsed === 20) return parsed;
  return null;
};

const computeDueDate = (invoiceDate: string, paymentTerms: Invoice['payment_terms']) => {
  if (paymentTerms === 'Pay now') return invoiceDate;
  const base = new Date(invoiceDate);
  base.setDate(base.getDate() + (paymentTerms === '14 days' ? 14 : 30));
  return base.toISOString().split('T')[0];
};

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasSupabaseSession } = useAuth();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobLoadError, setJobLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [jobId, setJobId] = useState(firstNonEmpty(searchParams.get('job_id'), searchParams.get('jobId')));
  const [jobRef, setJobRef] = useState(firstNonEmpty(searchParams.get('reference'), searchParams.get('jobRef'), searchParams.get('ref')));
  const [clientName, setClientName] = useState(
    firstNonEmpty(searchParams.get('client_name'), searchParams.get('clientName'), searchParams.get('customer_name'), searchParams.get('customerName'))
  );
  const [clientEmail, setClientEmail] = useState(
    firstNonEmpty(searchParams.get('client_email'), searchParams.get('clientEmail'), searchParams.get('customer_email'), searchParams.get('customerEmail'))
  );
  const [pickupLocation, setPickupLocation] = useState(firstNonEmpty(searchParams.get('pickupLocation'), searchParams.get('pickup_location')));
  const [pickupDateTime, setPickupDateTime] = useState(firstNonEmpty(searchParams.get('pickupDateTime'), searchParams.get('pickup_datetime')));
  const [deliveryLocation, setDeliveryLocation] = useState(firstNonEmpty(searchParams.get('deliveryLocation'), searchParams.get('delivery_location')));
  const [deliveryDateTime, setDeliveryDateTime] = useState(firstNonEmpty(searchParams.get('deliveryDateTime'), searchParams.get('delivery_datetime')));
  const [serviceDescription, setServiceDescription] = useState(firstNonEmpty(searchParams.get('serviceDescription'), searchParams.get('description')));
  const [currency, setCurrency] = useState(firstNonEmpty(searchParams.get('currency')) || 'GBP');
  const [amount, setAmount] = useState(parsePositiveNumber(firstNonEmpty(searchParams.get('amount'), searchParams.get('rate'), searchParams.get('price'))) ?? 0);
  const [vatRate, setVatRate] = useState<0 | 5 | 20>(parseVatRate(firstNonEmpty(searchParams.get('vat_rate'), searchParams.get('vatRate'))) ?? 20);
  const [paymentTerms, setPaymentTerms] = useState<Invoice['payment_terms']>('14 days');

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    let cancelled = false;

    const loadCompanyId = async () => {
      if (user.companyId) {
        setCompanyId(user.companyId);
        return;
      }
      const resolved = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: null });
      if (!cancelled) setCompanyId(resolved);
    };

    void loadCompanyId();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !companyId) return;
    let cancelled = false;

    const generateInvoiceNo = async () => {
      const fallback = `${COMPANY_CONFIG.invoice.invoicePrefix}-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-3)}`;
      const { data } = await supabase.rpc('next_invoice_number', { p_company_id: companyId });
      if (!cancelled) {
        setInvoiceNumber(typeof data === 'string' && data.trim().length > 0 ? data : fallback);
      }
    };

    void generateInvoiceNo();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !companyId || !jobId || !hasSupabaseSession) return;
    let cancelled = false;

    const loadJobPrefill = async () => {
      setLoadingJob(true);
      setJobLoadError('');
      const { data, error } = await supabase
        .from('jobs')
        .select('id, client_name, client_email, pickup_location, pickup_datetime, delivery_location, delivery_datetime, load_details, special_requirements, budget_amount, currency')
        .eq('id', jobId)
        .eq('company_id', companyId)
        .single();

      if (cancelled) return;
      setLoadingJob(false);

      if (error || !data) {
        setJobLoadError(error?.message ?? 'Unable to load job details for prefill.');
        return;
      }

      const job = data as JobPrefill;
      if (!jobRef) setJobRef(`JOB-${job.id.slice(0, 8).toUpperCase()}`);
      if (!clientName && job.client_name) setClientName(job.client_name);
      if (!clientEmail && job.client_email) setClientEmail(job.client_email);
      if (!pickupLocation && job.pickup_location) setPickupLocation(job.pickup_location);
      if (!pickupDateTime && job.pickup_datetime) setPickupDateTime(job.pickup_datetime);
      if (!deliveryLocation && job.delivery_location) setDeliveryLocation(job.delivery_location);
      if (!deliveryDateTime && job.delivery_datetime) setDeliveryDateTime(job.delivery_datetime);
      if (!serviceDescription) {
        const description = [job.load_details, job.special_requirements].filter(Boolean).join(' • ');
        if (description) setServiceDescription(description);
      }
      if (!amount && typeof job.budget_amount === 'number' && job.budget_amount > 0) setAmount(job.budget_amount);
      if (job.currency) setCurrency(job.currency);
      setJobId(job.id);
    };

    void loadJobPrefill();
    return () => {
      cancelled = true;
    };
  }, [companyId, hasSupabaseSession, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const missingRequiredData = useMemo(() => {
    const missing: string[] = [];
    if (!companyId) missing.push('company profile');
    if (!invoiceNumber) missing.push('invoice number');
    if (!jobRef.trim()) missing.push('reference/job ref');
    if (!clientName.trim()) missing.push('client name');
    if (!(amount > 0)) missing.push('amount');
    return missing;
  }, [amount, clientName, companyId, invoiceNumber, jobRef]);

  const invoiceDate = new Date().toISOString().split('T')[0];
  const dueDate = computeDueDate(invoiceDate, paymentTerms);
  const netAmount = amount > 0 ? Number((amount / (1 + vatRate / 100)).toFixed(2)) : 0;
  const vatAmount = amount > 0 ? Number((amount - netAmount).toFixed(2)) : 0;

  const handleCreateInvoice = async () => {
    setSaveError('');
    if (!isSupabaseConfigured || !companyId || !hasSupabaseSession) {
      setSaveError('A live Supabase session and company context are required to create invoices safely.');
      return;
    }
    if (missingRequiredData.length > 0) {
      setSaveError(`Missing required data: ${missingRequiredData.join(', ')}.`);
      return;
    }

    try {
      setSaving(true);
      const newId = crypto.randomUUID ? crypto.randomUUID() : `invoice_${Date.now()}`;
      const row: Omit<Invoice, 'created_at' | 'updated_at'> = {
        id: newId,
        company_id: companyId,
        created_by: user?.id ?? null,
        invoice_number: invoiceNumber,
        job_ref: jobRef.trim(),
        job_id: jobId || null,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status: toLegacyInvoiceStatusForDb('Draft'),
        client_name: clientName.trim(),
        client_address: null,
        client_email: clientEmail.trim() || null,
        pickup_location: pickupLocation.trim() || null,
        pickup_datetime: pickupDateTime.trim() || null,
        delivery_location: deliveryLocation.trim() || null,
        delivery_datetime: deliveryDateTime.trim() || null,
        delivery_recipient: null,
        service_description: serviceDescription.trim() || null,
        amount,
        net_amount: netAmount,
        vat_amount: vatAmount,
        vat_rate: vatRate,
        currency: currency || 'GBP',
        payment_terms: paymentTerms,
        invoice_origin: 'manual',
        late_fee: COMPANY_CONFIG.payment.lateFeeNote,
        pod_photos: null,
        signature: null,
        recipient_name: null,
        submitted_at: null,
        submitted_by: null,
        approved_at: null,
        approved_by: null,
        disputed_at: null,
        paid_at: null,
      };

      const { error } = await supabase.from('invoices').insert([row]);
      if (error) {
        setSaveError(`Failed to create invoice: ${error.message}`);
        return;
      }
      router.push(`/admin/invoices/${newId}`);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.72rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.92rem',
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <div style={{ background: '#1e293b', color: '#fff', padding: '1.5rem 2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem' }}>Create New Invoice</h1>
              <p style={{ margin: 0, opacity: 0.85 }}>New invoice route is active and ready for context-based creation.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Link href="/admin/invoices" style={{ color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.35)', padding: '0.55rem 0.9rem', borderRadius: '8px' }}>
                ← Invoices
              </Link>
              <Link href="/admin/jobs" style={{ color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.35)', padding: '0.55rem 0.9rem', borderRadius: '8px' }}>
                Jobs
              </Link>
              {jobId && (
                <Link href={`/admin/jobs/${encodeURIComponent(jobId.trim())}`} style={{ color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.35)', padding: '0.55rem 0.9rem', borderRadius: '8px' }}>
                  Job Detail
                </Link>
              )}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
          <WorkflowStageStrip activeStage="invoice" marginBottom="1rem" />

          {(jobLoadError || saveError) && (
            <div style={{ marginBottom: '1rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
              {jobLoadError || saveError}
            </div>
          )}

          <div style={{ marginBottom: '1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.45rem' }}>Creation Context</div>
            <div style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {loadingJob ? 'Loading job prefill...' : 'Query params and optional job context have been applied to this draft.'}
            </div>
            <div style={{ marginTop: '0.65rem', color: missingRequiredData.length ? '#b45309' : '#166534', fontSize: '0.9rem' }}>
              {missingRequiredData.length
                ? `Missing required data: ${missingRequiredData.join(', ')}. Complete the fields below before saving.`
                : 'All required data is present. You can create the invoice now.'}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Invoice Number</label>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Reference / Job Ref</label>
                <input value={jobRef} onChange={(e) => setJobRef(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Job ID</label>
                <input value={jobId} onChange={(e) => setJobId(e.target.value)} style={inputStyle} placeholder="optional" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Client Name</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Client Email</label>
                <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Amount</label>
                <input type="number" min="0" step="0.01" value={amount || ''} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>VAT Rate</label>
                <select value={vatRate} onChange={(e) => setVatRate(Number(e.target.value) as 0 | 5 | 20)} style={inputStyle}>
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={20}>20%</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Payment Terms</label>
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as Invoice['payment_terms'])} style={inputStyle}>
                  <option value="Pay now">Pay now</option>
                  <option value="14 days">14 days</option>
                  <option value="30 days">30 days</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Currency</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Pickup Location</label>
                <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Pickup Date/Time</label>
                <input value={pickupDateTime} onChange={(e) => setPickupDateTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Delivery Location</label>
                <input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Delivery Date/Time</label>
                <input value={deliveryDateTime} onChange={(e) => setDeliveryDateTime(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Service Description</label>
              <textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', background: '#f8fafc', color: '#334155', fontSize: '0.88rem' }}>
              Invoice date: <strong>{invoiceDate}</strong> · Due date: <strong>{dueDate}</strong> · Net: <strong>£{netAmount.toFixed(2)}</strong> · VAT: <strong>£{vatAmount.toFixed(2)}</strong> · Total: <strong>£{amount.toFixed(2)}</strong>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => void handleCreateInvoice()}
                disabled={saving}
                style={{
                  padding: '0.7rem 1.1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0f766e',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  fontWeight: 700,
                }}
              >
                {saving ? 'Creating...' : 'Create Invoice'}
              </button>
              <Link href="/admin/invoices" style={{ textDecoration: 'none', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '8px', padding: '0.68rem 1.05rem', fontWeight: 600 }}>
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
