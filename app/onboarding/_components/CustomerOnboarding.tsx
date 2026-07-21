'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classifyOnboardingLifecycleStatus } from '../../../lib/accessLifecycle';
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

type CustomerFieldErrors = Partial<Record<keyof CustomerPayload, string>>;

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  application?: Application;
};

const defaultPayload: CustomerPayload = {
  full_name: '',
  contact_email: '',
  contact_phone: '',
  company_name: '',
  billing_address: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const apiErrorMessage = (payload: ApiErrorPayload, fallback: string) => {
  const firstFieldError = Object.entries(payload.details?.fieldErrors ?? {})
    .find(([, messages]) => messages?.[0]);
  return firstFieldError
    ? `${firstFieldError[0].replace(/_/g, ' ')}: ${firstFieldError[1]?.[0]}`
    : payload.error ?? payload.details?.formErrors?.[0] ?? fallback;
};

export function CustomerOnboarding({ token }: { token: string }) {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<CustomerPayload>(defaultPayload);
  const [fieldErrors, setFieldErrors] = useState<CustomerFieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const authHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const routeForStatus = useCallback((status: string) => {
    const lifecycle = classifyOnboardingLifecycleStatus(status);
    if (lifecycle === 'approved') {
      router.replace('/customer');
      return true;
    }
    if (lifecycle === 'review') {
      router.replace('/pending-approval');
      return true;
    }
    if (lifecycle === 'rejected') {
      router.replace('/forbidden?reason=onboarding-rejected');
      return true;
    }
    return false;
  }, [router]);

  const updateField = (field: keyof CustomerPayload, value: string) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setError('');
  };

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        router.replace('/login?next=/onboarding/customer/resume');
        return;
      }
      const query = token && token !== 'resume' ? `?token=${encodeURIComponent(token)}` : '';
      const res = await fetch(`/api/onboarding/customer/session${query}`, { method: 'GET', headers, cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as ApiErrorPayload | null;
      if (!res.ok || !data?.application) {
        setError(apiErrorMessage(data ?? {}, 'Failed to load onboarding session.'));
        return;
      }

      if (routeForStatus(data.application.status)) return;
      setApplication(data.application);
      const payload = (data.application.payload ?? {}) as Partial<CustomerPayload>;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setFormData({
        ...defaultPayload,
        contact_email: user?.email ?? '',
        ...payload,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load onboarding session.');
    } finally {
      setLoading(false);
    }
  }, [routeForStatus, router, token]);

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
      const data = (await res.json().catch(() => null)) as ApiErrorPayload | null;
      if (!res.ok || !data?.application) {
        setError(apiErrorMessage(data ?? {}, 'Failed to save onboarding progress.'));
        return;
      }
      setApplication(data.application);
      setMessage('Progress saved. You can sign out and continue later.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save onboarding progress.');
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(signOutError.message);
        return;
      }
      router.replace('/login');
    } finally {
      setSaving(false);
    }
  };

  const submitOnboarding = async () => {
    const normalizedPayload: CustomerPayload = {
      full_name: formData.full_name.trim(),
      contact_email: formData.contact_email.trim().toLowerCase(),
      contact_phone: formData.contact_phone.trim(),
      company_name: formData.company_name.trim(),
      billing_address: formData.billing_address.trim(),
    };
    const validationErrors: CustomerFieldErrors = {};
    if (!normalizedPayload.full_name) validationErrors.full_name = 'Full Name is required.';
    if (!normalizedPayload.contact_email) validationErrors.contact_email = 'Email is required.';
    else if (!EMAIL_PATTERN.test(normalizedPayload.contact_email)) validationErrors.contact_email = 'Enter a valid email address.';

    if (Object.keys(validationErrors).length > 0) {
      setFormData(normalizedPayload);
      setFieldErrors(validationErrors);
      setError('Please correct the highlighted fields before submitting.');
      return;
    }

    setFormData(normalizedPayload);
    setFieldErrors({});
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
          payload: normalizedPayload,
        }),
      });
      const savePayload = (await saveRes.json().catch(() => null)) as ApiErrorPayload | null;
      if (!saveRes.ok) {
        setError(apiErrorMessage(savePayload ?? {}, 'Failed to save onboarding summary.'));
        return;
      }

      const res = await fetch('/api/onboarding/submit/customer', { method: 'POST', headers });
      const data = (await res.json().catch(() => null)) as ApiErrorPayload | null;
      if (!res.ok || !data?.application) {
        setError(apiErrorMessage(data ?? {}, 'Failed to complete onboarding.'));
        return;
      }
      setApplication(data.application);
      setMessage('Customer onboarding complete. Redirecting to your workspace…');
      window.setTimeout(() => router.replace('/customer'), 500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to complete onboarding.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main style={{ padding: '2rem' }}>Loading onboarding…</main>;

  if (!application) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Onboarding unavailable</h1>
        <p role="alert">{error || 'No onboarding application found.'}</p>
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
      onSignOut={() => void signOut()}
      submitDisabled={classifyOnboardingLifecycleStatus(application.status) !== 'editable'}
    >
      <section>
        <h2>Customer Details</h2>
        <p style={{ color: '#4B5563' }}>Fields marked with * are required before submission.</p>
        <Field required error={fieldErrors.full_name} label="Full Name" value={formData.full_name} onChange={(value) => updateField('full_name', value)} autoComplete="name" />
        <Field required error={fieldErrors.contact_email} label="Email" type="email" value={formData.contact_email} onChange={(value) => updateField('contact_email', value)} autoComplete="email" />
        <Field label="Phone" value={formData.contact_phone} onChange={(value) => updateField('contact_phone', value)} autoComplete="tel" />
        <Field label="Company Name" value={formData.company_name} onChange={(value) => updateField('company_name', value)} autoComplete="organization" />
        <Field label="Billing Address" value={formData.billing_address} onChange={(value) => updateField('billing_address', value)} autoComplete="billing street-address" />
      </section>
    </PageLayout>
  );
}
