'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { Field, PageLayout } from './BaseUi';

type Application = {
  id: string;
  account_type: 'broker_shipper';
  status: string;
  current_step: string;
  completion_percentage: number;
  payload: Record<string, unknown>;
};

type BrokerPayload = {
  company_name: string;
  trading_name: string;
  company_number: string;
  vat_number: string;
  billing_address: string;
  trading_address: string;
  contact_person: string;
  finance_contact: string;
  contact_email: string;
  contact_phone: string;
};

const defaultPayload: BrokerPayload = {
  company_name: '',
  trading_name: '',
  company_number: '',
  vat_number: '',
  billing_address: '',
  trading_address: '',
  contact_person: '',
  finance_contact: '',
  contact_email: '',
  contact_phone: '',
};

const brokerDocs = ['company_registration', 'vat_registration', 'public_liability'] as const;

export function BrokerOnboarding({ token }: { token: string }) {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<BrokerPayload>(defaultPayload);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const authHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return {};
    return { Authorization: 'Bearer ' + session.access_token };
  };

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const headers = await authHeaders();
      const query = token && token !== 'resume' ? `?token=${encodeURIComponent(token)}` : '';
      const res = await fetch(`/api/onboarding/broker/session${query}`, { method: 'GET', headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load onboarding session.');
        return;
      }

      setApplication(data.application);
      const payload = (data.application?.payload ?? {}) as Partial<BrokerPayload>;
      setFormData({ ...defaultPayload, ...payload });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load onboarding session.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const saveProgress = async (currentStep: string, completionPercentage: number) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const res = await fetch('/api/onboarding/broker/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          currentStep,
          completionPercentage,
          status: 'in_progress',
          payload: formData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save onboarding progress.');
        return;
      }
      setApplication(data.application);
      setMessage('Progress saved. You can continue later from this step.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save onboarding progress.');
    } finally {
      setSaving(false);
    }
  };

  const submitOnboarding = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const saveRes = await fetch('/api/onboarding/broker/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          currentStep: 'review_summary',
          completionPercentage: 100,
          payload: formData,
        }),
      });
      if (!saveRes.ok) {
        const payload = await saveRes.json();
        setError(payload.error ?? 'Failed to save onboarding summary.');
        return;
      }

      const res = await fetch('/api/onboarding/submit/broker', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit onboarding.');
        return;
      }
      setApplication(data.application);
      setMessage('Onboarding submitted successfully. Your account is now pending review.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit onboarding.');
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (docType: (typeof brokerDocs)[number], file: File) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const form = new FormData();
      form.set('docType', docType);
      form.set('file', file);

      const res = await fetch('/api/onboarding/documents', {
        method: 'POST',
        headers,
        body: form,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Document upload failed.');
        return;
      }

      setMessage(`Uploaded ${docType.replace(/_/g, ' ')}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document upload failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main style={{ padding: '2rem' }}>Loading onboarding...</main>;
  }

  if (!application) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Onboarding unavailable</h1>
        <p>{error || 'No onboarding application found.'}</p>
      </main>
    );
  }

  const progress = Number(application.completion_percentage ?? 0);

  return (
    <PageLayout
      title="Broker / Shipper Onboarding"
      status={application.status}
      currentStep={application.current_step}
      progress={progress}
      error={error}
      message={message}
      saving={saving}
      onSave={() => void saveProgress(application.current_step || 'document_upload', Math.max(progress, 60))}
      onSubmit={() => void submitOnboarding()}
      backToLogin={() => router.push('/login')}
      submitDisabled={application.status === 'approved'}
    >
      <section>
        <h2>Broker / Shipper Details</h2>
        <Field label="Company Name" value={formData.company_name} onChange={(v) => setFormData((prev) => ({ ...prev, company_name: v }))} />
        <Field label="Trading Name" value={formData.trading_name} onChange={(v) => setFormData((prev) => ({ ...prev, trading_name: v }))} />
        <Field label="Company Number" value={formData.company_number} onChange={(v) => setFormData((prev) => ({ ...prev, company_number: v }))} />
        <Field label="VAT Number" value={formData.vat_number} onChange={(v) => setFormData((prev) => ({ ...prev, vat_number: v }))} />
        <Field label="Billing Address" value={formData.billing_address} onChange={(v) => setFormData((prev) => ({ ...prev, billing_address: v }))} />
        <Field label="Trading Address" value={formData.trading_address} onChange={(v) => setFormData((prev) => ({ ...prev, trading_address: v }))} />
        <Field label="Contact Person" value={formData.contact_person} onChange={(v) => setFormData((prev) => ({ ...prev, contact_person: v }))} />
        <Field label="Finance Contact" value={formData.finance_contact} onChange={(v) => setFormData((prev) => ({ ...prev, finance_contact: v }))} />
        <Field label="Email" type="email" value={formData.contact_email} onChange={(v) => setFormData((prev) => ({ ...prev, contact_email: v }))} />
        <Field label="Phone" value={formData.contact_phone} onChange={(v) => setFormData((prev) => ({ ...prev, contact_phone: v }))} />
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Document Upload</h2>
        {brokerDocs.map((doc) => (
          <div key={doc} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <span>{doc.replace(/_/g, ' ')}</span>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void uploadDocument(doc, file);
              }}
            />
          </div>
        ))}
      </section>
    </PageLayout>
  );
}
