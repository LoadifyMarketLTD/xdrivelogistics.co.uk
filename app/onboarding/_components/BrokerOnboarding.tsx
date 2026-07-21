'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classifyOnboardingLifecycleStatus } from '../../../lib/accessLifecycle';
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

type BrokerField = keyof BrokerPayload;
type BrokerFieldErrors = Partial<Record<BrokerField, string>>;

type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  application?: Application;
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

const FIELD_LABELS: Record<BrokerField, string> = {
  company_name: 'Company Name',
  trading_name: 'Trading Name',
  company_number: 'Company Number',
  vat_number: 'VAT Number',
  billing_address: 'Billing Address',
  trading_address: 'Trading Address',
  contact_person: 'Contact Person',
  finance_contact: 'Finance Contact',
  contact_email: 'Email',
  contact_phone: 'Phone',
};

const REQUIRED_FIELDS = Object.keys(FIELD_LABELS) as BrokerField[];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizePayload = (payload: BrokerPayload): BrokerPayload => ({
  company_name: payload.company_name.trim(),
  trading_name: payload.trading_name.trim(),
  company_number: payload.company_number.trim(),
  vat_number: payload.vat_number.trim(),
  billing_address: payload.billing_address.trim(),
  trading_address: payload.trading_address.trim(),
  contact_person: payload.contact_person.trim(),
  finance_contact: payload.finance_contact.trim(),
  contact_email: payload.contact_email.trim().toLowerCase(),
  contact_phone: payload.contact_phone.trim(),
});

const validateForSubmission = (payload: BrokerPayload): BrokerFieldErrors => {
  const errors: BrokerFieldErrors = {};

  for (const field of REQUIRED_FIELDS) {
    if (!payload[field]) errors[field] = `${FIELD_LABELS[field]} is required.`;
  }

  if (payload.contact_email && !EMAIL_PATTERN.test(payload.contact_email)) {
    errors.contact_email = 'Enter a valid email address, for example name@company.co.uk.';
  }

  return errors;
};

const apiErrorMessage = (payload: ApiErrorPayload, fallback: string): string => {
  const fieldErrors = payload.details?.fieldErrors;
  if (fieldErrors) {
    for (const field of REQUIRED_FIELDS) {
      const message = fieldErrors[field]?.[0];
      if (message) return `${FIELD_LABELS[field]}: ${message}`;
    }
  }

  return payload.error ?? payload.details?.formErrors?.[0] ?? fallback;
};

export function BrokerOnboarding({ token }: { token: string }) {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<BrokerPayload>(defaultPayload);
  const [fieldErrors, setFieldErrors] = useState<BrokerFieldErrors>({});
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
    if (lifecycle === 'review') {
      router.replace('/pending-approval');
      return true;
    }
    if (lifecycle === 'approved') {
      router.replace('/broker');
      return true;
    }
    if (lifecycle === 'rejected') {
      router.replace('/forbidden?reason=onboarding-rejected');
      return true;
    }
    return false;
  }, [router]);

  const updateField = (field: BrokerField, value: string) => {
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
        router.replace('/login?next=/onboarding/broker/resume');
        return;
      }
      const query = token && token !== 'resume' ? `?token=${encodeURIComponent(token)}` : '';
      const res = await fetch(`/api/onboarding/broker/session${query}`, { method: 'GET', headers, cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as ApiErrorPayload | null;
      if (!res.ok || !data?.application) {
        setError(apiErrorMessage(data ?? {}, 'Failed to load onboarding session.'));
        return;
      }

      if (routeForStatus(data.application.status)) return;
      setApplication(data.application);
      const payload = (data.application.payload ?? {}) as Partial<BrokerPayload>;
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
      const data = (await res.json().catch(() => null)) as ApiErrorPayload | null;
      if (!res.ok || !data?.application) {
        setError(apiErrorMessage(data ?? {}, 'Failed to save onboarding progress.'));
        return;
      }
      setApplication(data.application);
      setMessage('Progress saved. You can sign out and continue later from this step.');
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
    const normalizedPayload = normalizePayload(formData);
    const validationErrors = validateForSubmission(normalizedPayload);

    if (Object.keys(validationErrors).length > 0) {
      setFormData(normalizedPayload);
      setFieldErrors(validationErrors);
      setMessage('');
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
      const saveRes = await fetch('/api/onboarding/broker/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          currentStep: 'review_summary',
          completionPercentage: 100,
          payload: normalizedPayload,
        }),
      });
      const savePayload = (await saveRes.json().catch(() => null)) as ApiErrorPayload | null;
      if (!saveRes.ok) {
        setError(apiErrorMessage(savePayload ?? {}, 'Failed to save onboarding summary.'));
        return;
      }

      const res = await fetch('/api/onboarding/submit/broker', { method: 'POST', headers });
      const data = (await res.json().catch(() => null)) as ApiErrorPayload | null;
      if (!res.ok || !data?.application) {
        setError(apiErrorMessage(data ?? {}, 'Failed to submit onboarding.'));
        return;
      }
      setApplication(data.application);
      setMessage('Onboarding submitted successfully. Opening Pending Approval…');
      window.setTimeout(() => router.replace('/pending-approval'), 500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to submit onboarding.');
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
      title="Broker / Shipper Onboarding"
      status={application.status}
      currentStep={application.current_step}
      progress={progress}
      error={error}
      message={message}
      saving={saving}
      onSave={() => void saveProgress(application.current_step || 'company_details', Math.max(progress, 60))}
      onSubmit={() => void submitOnboarding()}
      onSignOut={() => void signOut()}
      submitDisabled={classifyOnboardingLifecycleStatus(application.status) !== 'editable'}
    >
      <section>
        <h2>Broker / Shipper Details</h2>
        <p style={{ color: '#4B5563' }}>Fields marked with * are required before submission.</p>
        <Field required error={fieldErrors.company_name} label="Company Name" value={formData.company_name} onChange={(value) => updateField('company_name', value)} autoComplete="organization" />
        <Field required error={fieldErrors.trading_name} label="Trading Name" value={formData.trading_name} onChange={(value) => updateField('trading_name', value)} autoComplete="organization" />
        <Field required error={fieldErrors.company_number} label="Company Number" value={formData.company_number} onChange={(value) => updateField('company_number', value)} />
        <Field required error={fieldErrors.vat_number} label="VAT Number" value={formData.vat_number} onChange={(value) => updateField('vat_number', value)} />
        <Field required error={fieldErrors.billing_address} label="Billing Address" value={formData.billing_address} onChange={(value) => updateField('billing_address', value)} autoComplete="billing street-address" />
        <Field required error={fieldErrors.trading_address} label="Trading Address" value={formData.trading_address} onChange={(value) => updateField('trading_address', value)} autoComplete="street-address" />
        <Field required error={fieldErrors.contact_person} label="Contact Person" value={formData.contact_person} onChange={(value) => updateField('contact_person', value)} autoComplete="name" />
        <Field required error={fieldErrors.finance_contact} label="Finance Contact" value={formData.finance_contact} onChange={(value) => updateField('finance_contact', value)} />
        <Field required error={fieldErrors.contact_email} label="Email" type="email" value={formData.contact_email} onChange={(value) => updateField('contact_email', value)} autoComplete="email" />
        <Field required error={fieldErrors.contact_phone} label="Phone" value={formData.contact_phone} onChange={(value) => updateField('contact_phone', value)} autoComplete="tel" />
      </section>
    </PageLayout>
  );
}
