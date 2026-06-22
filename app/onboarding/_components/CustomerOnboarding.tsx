'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { Field, PageLayout } from './BaseUi';

type Application = {
  id: string;
  account_type: 'customer_shipper';
  status: string;
  current_step: string;
  completion_percentage: number;
  payload: Record<string, unknown>;
};

type CustomerPayload = {
  full_name: string;
  contact_email: string;
  contact_phone: string;
  company_name: string;
  billing_address: string;
};

const defaultPayload: CustomerPayload = {
  full_name: '',
  contact_email: '',
  contact_phone: '',
  company_name: '',
  billing_address: '',
};

export function CustomerOnboarding({ token }: { token: string }) {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<CustomerPayload>(defaultPayload);
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
      const res = await fetch(`/api/onboarding/customer/session${query}`, { method: 'GET', headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load onboarding session.');
        return;
      }

      setApplication(data.application);
      const payload = (data.application?.payload ?? {}) as Partial<CustomerPayload>;
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
      const res = await fetch('/api/onboarding/customer/session', {
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
      setMessage('Progress saved.');
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
      const saveRes = await fetch('/api/onboarding/customer/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          currentStep: 'workspace_ready',
          completionPercentage: 100,
          payload: formData,
        }),
      });
      if (!saveRes.ok) {
        const payload = await saveRes.json();
        setError(payload.error ?? 'Failed to save onboarding summary.');
        return;
      }

      const res = await fetch('/api/onboarding/submit/customer', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to complete onboarding.');
        return;
      }
      setApplication(data.application);
      setMessage('Customer onboarding complete. Redirecting to your workspace...');
      window.setTimeout(() => router.push('/customer'), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete onboarding.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main style={{ padding: '2rem' }}>Loading onboarding...</main>;

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
      title="Customer / Shipper Onboarding"
      status={application.status}
      currentStep={application.current_step}
      progress={progress}
      error={error}
      message={message}
      saving={saving}
      onSave={() => void saveProgress(application.current_step || 'customer_details', Math.max(progress, 70))}
      onSubmit={() => void submitOnboarding()}
      backToLogin={() => router.push('/login')}
      submitDisabled={application.status === 'approved'}
    >
      <section>
        <h2>Customer Details</h2>
        <Field label="Full Name" value={formData.full_name} onChange={(v) => setFormData((prev) => ({ ...prev, full_name: v }))} />
        <Field label="Email" type="email" value={formData.contact_email} onChange={(v) => setFormData((prev) => ({ ...prev, contact_email: v }))} />
        <Field label="Phone" value={formData.contact_phone} onChange={(v) => setFormData((prev) => ({ ...prev, contact_phone: v }))} />
        <Field label="Company Name" value={formData.company_name} onChange={(v) => setFormData((prev) => ({ ...prev, company_name: v }))} />
        <Field label="Billing Address" value={formData.billing_address} onChange={(v) => setFormData((prev) => ({ ...prev, billing_address: v }))} />
      </section>
    </PageLayout>
  );
}
