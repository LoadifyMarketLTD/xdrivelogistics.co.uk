'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { classifyOnboardingLifecycleStatus } from '../../../lib/accessLifecycle';
import { supabase } from '../../../lib/supabaseClient';

type StoredAccountType = 'customer_shipper' | 'broker_shipper' | 'fleet_courier' | 'owner_driver';

type Application = {
  id: string;
  user_id: string;
  account_type: StoredAccountType;
  status: string;
  current_step: string;
  completion_percentage: number;
  payload: Record<string, unknown>;
};

type FieldDefinition = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'email' | 'date';
};

const ACCOUNT_LABELS: Record<StoredAccountType, string> = {
  customer_shipper: 'Customer / Shipper',
  broker_shipper: 'Transport Broker',
  fleet_courier: 'Fleet Operator',
  owner_driver: 'Owner Driver',
};

const WORKSPACE_ROUTES: Record<StoredAccountType, string> = {
  customer_shipper: '/customer',
  broker_shipper: '/broker',
  fleet_courier: '/admin',
  owner_driver: '/driver',
};

const DOCUMENTS: Partial<Record<StoredAccountType, readonly string[]>> = {
  broker_shipper: ['company_registration', 'public_liability', 'vat_registration'],
  fleet_courier: [
    'operator_licence',
    'public_liability',
    'goods_in_transit',
    'vehicle_insurance',
    'company_registration',
    'vat_registration',
  ],
  owner_driver: [
    'driving_licence',
    'cpc',
    'proof_of_address',
    'insurance',
    'right_to_work',
    'visa_document',
  ],
};

const FIELDS: Record<StoredAccountType, FieldDefinition[]> = {
  customer_shipper: [
    { key: 'full_name', label: 'Full name', required: true },
    { key: 'contact_email', label: 'Email', required: true, type: 'email' },
    { key: 'contact_phone', label: 'Phone' },
    { key: 'company_name', label: 'Company name' },
    { key: 'billing_address', label: 'Billing address' },
  ],
  broker_shipper: [
    { key: 'company_name', label: 'Legal company name', required: true },
    { key: 'trading_name', label: 'Trading name', required: true },
    { key: 'company_number', label: 'Company number', required: true },
    { key: 'vat_number', label: 'VAT number', required: true },
    { key: 'billing_address', label: 'Registered / billing address', required: true },
    { key: 'trading_address', label: 'Trading address', required: true },
    { key: 'contact_person', label: 'Primary contact', required: true },
    { key: 'finance_contact', label: 'Finance contact', required: true },
    { key: 'contact_email', label: 'Contact email', required: true, type: 'email' },
    { key: 'contact_phone', label: 'Contact phone', required: true },
  ],
  fleet_courier: [
    { key: 'legal_company_name', label: 'Legal company name', required: true },
    { key: 'trading_name', label: 'Trading name', required: true },
    { key: 'company_number', label: 'Company number', required: true },
    { key: 'vat_number', label: 'VAT number', required: true },
    { key: 'registered_address', label: 'Registered address', required: true },
    { key: 'trading_address', label: 'Trading address', required: true },
    { key: 'contact_person', label: 'Primary contact', required: true },
    { key: 'compliance_contact', label: 'Compliance contact', required: true },
    { key: 'transport_contact', label: 'Transport / operations contact', required: true },
  ],
  owner_driver: [
    { key: 'full_name', label: 'Full name', required: true },
    { key: 'date_of_birth', label: 'Date of birth', required: true, type: 'date' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'address', label: 'Residential address', required: true },
    { key: 'contact_phone', label: 'Phone', required: true },
    { key: 'contact_email', label: 'Email', required: true, type: 'email' },
    { key: 'national_insurance_number', label: 'National Insurance number', required: true },
    { key: 'right_to_work_status', label: 'Right to work status', required: true },
    { key: 'licence_number', label: 'Driving licence number', required: true },
    { key: 'licence_expiry', label: 'Driving licence expiry', required: true, type: 'date' },
    { key: 'visa_type', label: 'Visa type' },
    { key: 'visa_expiry', label: 'Visa expiry', type: 'date' },
    { key: 'share_code', label: 'Right to work share code' },
    { key: 'settled_status', label: 'Settled status (true / false)' },
    { key: 'pre_settled_status', label: 'Pre-settled status (true / false)' },
    { key: 'registration', label: 'Vehicle registration', required: true },
    { key: 'make', label: 'Vehicle make', required: true },
    { key: 'model', label: 'Vehicle model', required: true },
    { key: 'payload', label: 'Vehicle payload / capacity', required: true },
    { key: 'dimensions', label: 'Vehicle load-space dimensions', required: true },
    { key: 'tail_lift', label: 'Tail lift details' },
    { key: 'insurance_details', label: 'Insurance details' },
  ],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDITABLE_STATES = new Set(['editable']);

const toBoolean = (value: string | undefined) =>
  ['true', '1', 'yes'].includes((value ?? '').trim().toLowerCase());

const stringValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return '';
};

const hydrateFormData = (application: Application): Record<string, string> => {
  const payload = application.payload ?? {};
  const form: Record<string, string> = {};
  Object.entries(payload).forEach(([key, value]) => {
    const converted = stringValue(value);
    if (converted || key.startsWith('doc_')) form[key] = converted;
  });

  if (application.account_type === 'owner_driver') {
    form.date_of_birth = form.date_of_birth || form.dob || '';
    form.contact_phone = form.contact_phone || form.phone || '';
    form.contact_email = form.contact_email || form.email || '';
    form.registration = form.registration || form.vehicle_registration || '';
    form.make = form.make || form.vehicle_make || '';
    form.model = form.model || form.vehicle_model || '';
    form.payload = form.payload || form.vehicle_payload || '';
    form.dimensions = form.dimensions || form.vehicle_dimensions || '';
  }

  return form;
};

const normalizePayload = (
  accountType: StoredAccountType,
  formData: Record<string, string>
): Record<string, unknown> => {
  const trimmed = Object.fromEntries(
    Object.entries(formData).map(([key, value]) => [key, value.trim()])
  );

  if (accountType !== 'owner_driver') return trimmed;

  const {
    dob: _dob,
    phone: _phone,
    email: _email,
    vehicle_registration: _vehicleRegistration,
    vehicle_make: _vehicleMake,
    vehicle_model: _vehicleModel,
    vehicle_payload: _vehiclePayload,
    vehicle_dimensions: _vehicleDimensions,
    ...canonical
  } = trimmed;

  return {
    ...canonical,
    date_of_birth: canonical.date_of_birth ?? '',
    contact_phone: canonical.contact_phone ?? '',
    contact_email: canonical.contact_email ?? '',
    settled_status: toBoolean(canonical.settled_status),
    pre_settled_status: toBoolean(canonical.pre_settled_status),
  };
};

export default function OnboardingTokenPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params?.token ?? 'resume');
  const router = useRouter();

  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const accountType = application?.account_type ?? null;
  const requiredDocs = useMemo(
    () => accountType ? DOCUMENTS[accountType] ?? [] : [],
    [accountType]
  );

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const routeForStatus = useCallback((app: Application): boolean => {
    const lifecycle = classifyOnboardingLifecycleStatus(app.status);
    if (lifecycle === 'approved') {
      router.replace(WORKSPACE_ROUTES[app.account_type]);
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

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        router.replace(`/login?next=${encodeURIComponent('/onboarding/resume')}`);
        return;
      }

      const query = token !== 'resume' ? `?token=${encodeURIComponent(token)}` : '';
      const response = await fetch(`/api/onboarding/session${query}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null) as { error?: string; application?: Application } | null;
      if (!response.ok || !data?.application) {
        setError(data?.error ?? 'Failed to load onboarding session.');
        return;
      }

      if (routeForStatus(data.application)) return;
      setApplication(data.application);
      setFormData(hydrateFormData(data.application));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load onboarding session.');
    } finally {
      setLoading(false);
    }
  }, [routeForStatus, router, token]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const updateField = (key: string, value: string) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setError('');
  };

  const sessionEndpoint = (type: StoredAccountType) => {
    if (type === 'customer_shipper') return '/api/onboarding/customer/session';
    if (type === 'broker_shipper') return '/api/onboarding/broker/session';
    if (type === 'fleet_courier') return '/api/onboarding/fleet/session';
    return '/api/onboarding/owner-driver/session';
  };

  const submitEndpoint = (type: StoredAccountType) => {
    if (type === 'customer_shipper') return '/api/onboarding/submit/customer';
    if (type === 'broker_shipper') return '/api/onboarding/submit/broker';
    if (type === 'fleet_courier') return '/api/onboarding/submit/fleet';
    return '/api/onboarding/submit/owner-driver';
  };

  const validate = (type: StoredAccountType): boolean => {
    const errors: Record<string, string> = {};
    for (const field of FIELDS[type]) {
      const value = formData[field.key]?.trim() ?? '';
      if (field.required && !value) errors[field.key] = `${field.label} is required.`;
      if (field.type === 'email' && value && !EMAIL_PATTERN.test(value)) {
        errors[field.key] = 'Enter a valid email address.';
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please correct the highlighted fields before submitting.');
      return false;
    }
    return true;
  };

  const saveProgress = async () => {
    if (!application) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        router.replace('/login?next=/onboarding/resume');
        return;
      }
      const response = await fetch(sessionEndpoint(application.account_type), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          currentStep: application.current_step || 'details',
          completionPercentage: Math.max(Number(application.completion_percentage ?? 0), 60),
          status: 'in_progress',
          payload: normalizePayload(application.account_type, formData),
        }),
      });
      const data = await response.json().catch(() => null) as { error?: string; application?: Application } | null;
      if (!response.ok || !data?.application) {
        setError(data?.error ?? 'Failed to save onboarding progress.');
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

  const submitOnboarding = async () => {
    if (!application || !validate(application.account_type)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        router.replace('/login?next=/onboarding/resume');
        return;
      }
      const payload = normalizePayload(application.account_type, formData);
      const saveResponse = await fetch(sessionEndpoint(application.account_type), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          currentStep: 'review_summary',
          completionPercentage: 100,
          status: 'in_progress',
          payload,
        }),
      });
      const saved = await saveResponse.json().catch(() => null) as { error?: string } | null;
      if (!saveResponse.ok) {
        setError(saved?.error ?? 'Failed to save onboarding summary.');
        return;
      }

      const response = await fetch(submitEndpoint(application.account_type), {
        method: 'POST',
        headers,
      });
      const data = await response.json().catch(() => null) as { error?: string; details?: unknown; application?: Application } | null;
      if (!response.ok || !data?.application) {
        const details = typeof data?.details === 'string' ? ` ${data.details}` : '';
        setError(`${data?.error ?? 'Failed to submit onboarding.'}${details}`.trim());
        return;
      }

      setApplication(data.application);
      if (routeForStatus(data.application)) return;
      setMessage('Onboarding saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to submit onboarding.');
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (docType: string, file: File) => {
    if (!application) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        router.replace('/login?next=/onboarding/resume');
        return;
      }
      const body = new FormData();
      body.set('docType', docType);
      body.set('file', file);
      const response = await fetch('/api/onboarding/documents', {
        method: 'POST',
        headers,
        body,
      });
      const data = await response.json().catch(() => null) as { error?: string; path?: string; payload?: Record<string, unknown> } | null;
      if (!response.ok || !data?.path) {
        setError(data?.error ?? 'Document upload failed.');
        return;
      }
      setFormData((previous) => ({
        ...previous,
        [`doc_${docType}`]: data.path ?? 'uploaded',
      }));
      setMessage(`${docType.replace(/_/g, ' ')} uploaded.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document upload failed.');
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

  if (loading) return <main style={{ padding: '2rem' }}>Loading onboarding…</main>;
  if (!application || !accountType) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Onboarding unavailable</h1>
        <p role="alert">{error || 'No onboarding application found.'}</p>
      </main>
    );
  }

  const lifecycle = classifyOnboardingLifecycleStatus(application.status);
  const editable = EDITABLE_STATES.has(lifecycle);
  const progress = Number(application.completion_percentage ?? 0);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1>{ACCOUNT_LABELS[accountType]} onboarding</h1>
      <p>Complete the details below. Saving does not activate workspace access.</p>
      <p>Status: <strong>{application.status}</strong></p>
      {application.status === 'request_changes' && (
        <p style={{ color: '#92400e', background: '#fffbeb', padding: '0.75rem', borderRadius: 8 }}>
          Changes were requested. Update the application and submit it again.
        </p>
      )}

      <div style={{ background: '#e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, progress))}%`, height: 10, background: '#2563eb' }} />
      </div>
      <p style={{ marginTop: 0 }}>{progress.toFixed(0)}% complete</p>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        {FIELDS[accountType].map((field) => (
          <Field
            key={field.key}
            label={field.label}
            required={field.required}
            type={field.type}
            value={formData[field.key] ?? ''}
            error={fieldErrors[field.key]}
            disabled={!editable || saving}
            onChange={(value) => updateField(field.key, value)}
          />
        ))}
      </section>

      {requiredDocs.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2>Documents</h2>
          <p>Uploaded documents remain pending until review. A document upload never activates the account.</p>
          {requiredDocs.map((docType) => {
            const uploaded = Boolean(formData[`doc_${docType}`]);
            return (
              <div key={docType} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                <span>{docType.replace(/_/g, ' ')} {uploaded ? '✓' : ''}</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={!editable || saving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadDocument(docType, file);
                  }}
                />
              </div>
            );
          })}
        </section>
      )}

      {error && <p role="alert" style={{ color: '#b91c1c', background: '#fef2f2', padding: '0.75rem', borderRadius: 8 }}>{error}</p>}
      {message && <p style={{ color: '#166534', background: '#f0fdf4', padding: '0.75rem', borderRadius: 8 }}>{message}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void saveProgress()} disabled={!editable || saving} style={{ padding: '0.75rem 1rem' }}>
          Save and continue later
        </button>
        <button type="button" onClick={() => void submitOnboarding()} disabled={!editable || saving} style={{ padding: '0.75rem 1rem', background: '#1d4ed8', color: '#fff', border: 0, borderRadius: 6 }}>
          {accountType === 'customer_shipper' ? 'Complete onboarding' : 'Submit for review'}
        </button>
        <button type="button" onClick={() => void signOut()} disabled={saving} style={{ padding: '0.75rem 1rem' }}>
          Sign out
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  error,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: 'text' | 'email' | 'date';
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
        {label}{required ? ' *' : ''}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: '100%', border: error ? '1px solid #dc2626' : '1px solid #d1d5db', borderRadius: 6, padding: '0.65rem 0.75rem', boxSizing: 'border-box' }}
      />
      {error && <span style={{ display: 'block', color: '#b91c1c', marginTop: '0.25rem' }}>{error}</span>}
    </label>
  );
}
