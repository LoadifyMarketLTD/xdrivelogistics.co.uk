'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { classifyOnboardingLifecycleStatus } from '../../../lib/accessLifecycle';
import { supabase } from '../../../lib/supabaseClient';

type AccountType = 'fleet_courier' | 'owner_driver';

type Application = {
  id: string;
  user_id: string;
  account_type: AccountType;
  status: string;
  current_step: string;
  completion_percentage: number;
  payload: Record<string, unknown>;
};

type FieldErrors = Record<string, string>;

type ApiPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  application?: Application;
  path?: string;
};

const fleetDocs = [
  'operator_licence',
  'public_liability',
  'goods_in_transit',
  'vehicle_insurance',
  'company_registration',
  'vat_registration',
] as const;

const ownerDriverDocs = [
  'driving_licence',
  'cpc',
  'proof_of_address',
  'insurance',
  'right_to_work',
  'visa_document',
] as const;

const FLEET_REQUIRED_FIELDS = {
  legal_company_name: 'Legal Company Name',
  trading_name: 'Trading Name',
  company_number: 'Company Number',
  vat_number: 'VAT Number',
  registered_address: 'Registered Address',
  trading_address: 'Trading Address',
  contact_person: 'Contact Person',
  compliance_contact: 'Compliance Contact',
  transport_contact: 'Transport Contact',
} as const;

const OWNER_DRIVER_REQUIRED_FIELDS = {
  full_name: 'Full Name',
  date_of_birth: 'Date of Birth',
  address: 'Address',
  contact_phone: 'Phone',
  contact_email: 'Email',
  national_insurance_number: 'National Insurance Number',
  right_to_work_status: 'Right to Work Status',
  licence_number: 'Driving Licence Number',
  licence_expiry: 'Driving Licence Expiry',
  registration: 'Vehicle Registration',
  make: 'Vehicle Make',
  model: 'Vehicle Model',
  payload: 'Vehicle Payload',
  dimensions: 'Vehicle Dimensions',
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toBoolean = (value: string | undefined) => {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const apiErrorMessage = (payload: ApiPayload, fallback: string): string => {
  const firstFieldError = Object.entries(payload.details?.fieldErrors ?? {})
    .find(([, messages]) => messages?.[0]);
  if (firstFieldError) return `${firstFieldError[0].replace(/_/g, ' ')}: ${firstFieldError[1]?.[0]}`;
  return payload.error ?? payload.details?.formErrors?.[0] ?? fallback;
};

export default function OnboardingTokenPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params?.token ?? '');
  const router = useRouter();

  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const accountType = application?.account_type;
  const requiredDocs = useMemo(
    () => accountType === 'fleet_courier' ? fleetDocs : ownerDriverDocs,
    [accountType]
  );

  const authHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const routeForStatus = useCallback((status: string, resolvedAccountType: AccountType) => {
    const lifecycle = classifyOnboardingLifecycleStatus(status);
    if (lifecycle === 'review') {
      router.replace('/pending-approval');
      return true;
    }
    if (lifecycle === 'approved') {
      router.replace(resolvedAccountType === 'fleet_courier' ? '/admin' : '/driver');
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
        router.replace('/login?next=/onboarding/resume');
        return;
      }

      const query = token && token !== 'resume' ? `?token=${encodeURIComponent(token)}` : '';
      const res = await fetch(`/api/onboarding/session${query}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => null)) as ApiPayload | null;
      if (!res.ok || !data?.application) {
        setError(apiErrorMessage(data ?? {}, 'Failed to load onboarding session.'));
        return;
      }

      if (data.application.account_type !== 'fleet_courier' && data.application.account_type !== 'owner_driver') {
        setError('This onboarding route does not match your account type.');
        return;
      }

      if (routeForStatus(data.application.status, data.application.account_type)) return;

      setApplication(data.application);
      const payload = data.application.payload ?? {};
      const nextFormData: Record<string, string> = {};
      Object.entries(payload).forEach(([key, value]) => {
        if (typeof value === 'string') nextFormData[key] = value;
        if (typeof value === 'boolean') nextFormData[key] = value ? 'true' : 'false';
      });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (data.application.account_type === 'owner_driver' && user?.email && !nextFormData.contact_email) {
        nextFormData.contact_email = user.email;
      }
      setFormData(nextFormData);
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

  const requiredFieldMap = accountType === 'fleet_courier'
    ? FLEET_REQUIRED_FIELDS
    : OWNER_DRIVER_REQUIRED_FIELDS;

  const normalizedPayload = () => {
    const trimmed = Object.fromEntries(
      Object.entries(formData).map(([key, value]) => [key, value.trim()])
    );

    if (accountType === 'owner_driver') {
      return {
        ...trimmed,
        contact_email: (trimmed.contact_email ?? '').toLowerCase(),
        settled_status: toBoolean(trimmed.settled_status),
        pre_settled_status: toBoolean(trimmed.pre_settled_status),
      };
    }

    return trimmed;
  };

  const validateSubmission = (): FieldErrors => {
    const errors: FieldErrors = {};
    for (const [field, label] of Object.entries(requiredFieldMap)) {
      if (!(formData[field] ?? '').trim()) errors[field] = `${label} is required.`;
    }

    if (accountType === 'owner_driver') {
      const email = (formData.contact_email ?? '').trim();
      if (email && !EMAIL_PATTERN.test(email)) errors.contact_email = 'Enter a valid email address.';

      for (const field of ['date_of_birth', 'licence_expiry']) {
        const value = (formData[field] ?? '').trim();
        if (value && !DATE_PATTERN.test(value)) {
          errors[field] = 'Use the date format YYYY-MM-DD.';
        }
      }
    }

    return errors;
  };

  const accountRouteSegment = accountType === 'owner_driver' ? 'owner-driver' : 'fleet';
  const sessionEndpoint = `/api/onboarding/${accountRouteSegment}/session`;
  const submitEndpoint = `/api/onboarding/submit/${accountRouteSegment}`;

  const saveProgress = async (currentStep: string, completionPercentage: number) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const res = await fetch(sessionEndpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          currentStep,
          completionPercentage,
          status: 'in_progress',
          payload: normalizedPayload(),
        }),
      });
      const data = (await res.json().catch(() => null)) as ApiPayload | null;
      if (!res.ok || !data?.application) {
        setError(apiErrorMessage(data ?? {}, 'Failed to save onboarding progress.'));
        return false;
      }
      setApplication(data.application);
      setMessage('Progress saved. You can sign out and continue later.');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save onboarding progress.');
      return false;
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
    const validationErrors = validateSubmission();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setMessage('');
      setError('Please correct the highlighted fields before submitting.');
      return;
    }

    setFieldErrors({});
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const saveRes = await fetch(sessionEndpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          currentStep: 'review_summary',
          completionPercentage: 100,
          payload: normalizedPayload(),
        }),
      });
      const savePayload = (await saveRes.json().catch(() => null)) as ApiPayload | null;
      if (!saveRes.ok) {
        setError(apiErrorMessage(savePayload ?? {}, 'Failed to save onboarding summary.'));
        return;
      }

      const res = await fetch(submitEndpoint, { method: 'POST', headers });
      const data = (await res.json().catch(() => null)) as ApiPayload | null;
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

  const uploadDocument = async (docType: string, file: File) => {
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

      const data = (await res.json().catch(() => null)) as ApiPayload | null;
      if (!res.ok) {
        setError(apiErrorMessage(data ?? {}, 'Document upload failed.'));
        return;
      }

      updateField(`doc_${docType}`, data?.path ?? 'uploaded');
      setMessage(`Uploaded ${docType.replace(/_/g, ' ')}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document upload failed.');
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
  const isEditable = classifyOnboardingLifecycleStatus(application.status) === 'editable';

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1>{accountType === 'fleet_courier' ? 'Fleet Operator Onboarding' : 'Owner Driver Onboarding'}</h1>
      <p>Status: <strong>{application.status}</strong></p>
      <p>Current step: <strong>{application.current_step}</strong></p>

      <div style={{ background: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ width: `${progress}%`, height: 10, background: '#2563EB' }} />
      </div>
      <p style={{ marginTop: 0 }}>{progress.toFixed(0)}% complete</p>
      <p style={{ color: '#4B5563' }}>Fields marked with * are required before submission.</p>

      {accountType === 'fleet_courier' ? (
        <section>
          <h2>Fleet Company Details</h2>
          <Field required error={fieldErrors.legal_company_name} label="Legal Company Name" value={formData.legal_company_name ?? ''} onChange={(value) => updateField('legal_company_name', value)} />
          <Field required error={fieldErrors.trading_name} label="Trading Name" value={formData.trading_name ?? ''} onChange={(value) => updateField('trading_name', value)} />
          <Field required error={fieldErrors.company_number} label="Company Number" value={formData.company_number ?? ''} onChange={(value) => updateField('company_number', value)} />
          <Field required error={fieldErrors.vat_number} label="VAT Number" value={formData.vat_number ?? ''} onChange={(value) => updateField('vat_number', value)} />
          <Field required error={fieldErrors.registered_address} label="Registered Address" value={formData.registered_address ?? ''} onChange={(value) => updateField('registered_address', value)} />
          <Field required error={fieldErrors.trading_address} label="Trading Address" value={formData.trading_address ?? ''} onChange={(value) => updateField('trading_address', value)} />
          <Field required error={fieldErrors.contact_person} label="Contact Person" value={formData.contact_person ?? ''} onChange={(value) => updateField('contact_person', value)} />
          <Field required error={fieldErrors.compliance_contact} label="Compliance Contact" value={formData.compliance_contact ?? ''} onChange={(value) => updateField('compliance_contact', value)} />
          <Field required error={fieldErrors.transport_contact} label="Transport Contact" value={formData.transport_contact ?? ''} onChange={(value) => updateField('transport_contact', value)} />
        </section>
      ) : (
        <section>
          <h2>Owner Driver Details</h2>
          <Field required error={fieldErrors.full_name} label="Full Name" value={formData.full_name ?? ''} onChange={(value) => updateField('full_name', value)} />
          <Field required error={fieldErrors.date_of_birth} label="Date of Birth" type="date" value={formData.date_of_birth ?? ''} onChange={(value) => updateField('date_of_birth', value)} />
          <Field required error={fieldErrors.address} label="Home Address" value={formData.address ?? ''} onChange={(value) => updateField('address', value)} />
          <Field required error={fieldErrors.contact_phone} label="Phone" value={formData.contact_phone ?? ''} onChange={(value) => updateField('contact_phone', value)} />
          <Field required error={fieldErrors.contact_email} label="Email" type="email" value={formData.contact_email ?? ''} onChange={(value) => updateField('contact_email', value)} />
          <Field required error={fieldErrors.national_insurance_number} label="National Insurance Number" value={formData.national_insurance_number ?? ''} onChange={(value) => updateField('national_insurance_number', value)} />
          <Field required error={fieldErrors.right_to_work_status} label="Right to Work Status" value={formData.right_to_work_status ?? ''} onChange={(value) => updateField('right_to_work_status', value)} />
          <Field required error={fieldErrors.licence_number} label="Driving Licence Number" value={formData.licence_number ?? ''} onChange={(value) => updateField('licence_number', value)} />
          <Field required error={fieldErrors.licence_expiry} label="Driving Licence Expiry" type="date" value={formData.licence_expiry ?? ''} onChange={(value) => updateField('licence_expiry', value)} />
          <Field label="Visa Expiry" type="date" value={formData.visa_expiry ?? ''} onChange={(value) => updateField('visa_expiry', value)} />
          <Field label="Visa Type" value={formData.visa_type ?? ''} onChange={(value) => updateField('visa_type', value)} />
          <Field label="Share Code" value={formData.share_code ?? ''} onChange={(value) => updateField('share_code', value)} />
          <Field label="Settled Status (yes/no)" value={formData.settled_status ?? ''} onChange={(value) => updateField('settled_status', value)} />
          <Field label="Pre-Settled Status (yes/no)" value={formData.pre_settled_status ?? ''} onChange={(value) => updateField('pre_settled_status', value)} />

          <h2>Vehicle Details</h2>
          <Field required error={fieldErrors.registration} label="Vehicle Registration" value={formData.registration ?? ''} onChange={(value) => updateField('registration', value)} />
          <Field required error={fieldErrors.make} label="Vehicle Make" value={formData.make ?? ''} onChange={(value) => updateField('make', value)} />
          <Field required error={fieldErrors.model} label="Vehicle Model" value={formData.model ?? ''} onChange={(value) => updateField('model', value)} />
          <Field required error={fieldErrors.payload} label="Vehicle Payload" value={formData.payload ?? ''} onChange={(value) => updateField('payload', value)} />
          <Field required error={fieldErrors.dimensions} label="Vehicle Dimensions" value={formData.dimensions ?? ''} onChange={(value) => updateField('dimensions', value)} />
          <Field label="Tail Lift" value={formData.tail_lift ?? ''} onChange={(value) => updateField('tail_lift', value)} />
          <Field label="Insurance Details" value={formData.insurance_details ?? ''} onChange={(value) => updateField('insurance_details', value)} />
        </section>
      )}

      <section style={{ marginTop: '2rem' }}>
        <h2>Documents</h2>
        <p style={{ color: '#4B5563' }}>Upload the documents that apply to your business and right-to-work position. PDF, JPG, PNG or WebP, maximum 10MB each.</p>
        {requiredDocs.map((doc) => {
          const uploaded = Boolean(formData[`doc_${doc}`]);
          return (
            <div key={doc} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
              <span>{doc.replace(/_/g, ' ')} {uploaded ? '✓' : ''}</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadDocument(doc, file);
                }}
              />
            </div>
          );
        })}
      </section>

      {error && <p role="alert" style={{ color: '#B91C1C' }}>{error}</p>}
      {message && <p style={{ color: '#166534' }}>{message}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void saveProgress(application.current_step || 'company_details', Math.max(progress, 60))}
          disabled={saving}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: saving ? 'wait' : 'pointer' }}
        >
          Save and continue later
        </button>
        <button
          type="button"
          onClick={() => void submitOnboarding()}
          disabled={saving || !isEditable}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: 'none', background: '#1D4ED8', color: '#fff', cursor: saving || !isEditable ? 'not-allowed' : 'pointer' }}
        >
          Submit for review
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={saving}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: saving ? 'wait' : 'pointer' }}
        >
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
  type = 'text',
  required = false,
  error = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'date';
  required?: boolean;
  error?: string;
}) {
  const errorId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-error`;
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem' }}>
      <div style={{ marginBottom: '0.35rem', fontWeight: 500 }}>
        {label}{required ? <span aria-hidden="true" style={{ color: '#B91C1C' }}> *</span> : null}
      </div>
      <input
        type={type}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: '100%', border: `1px solid ${error ? '#DC2626' : '#D1D5DB'}`, borderRadius: 6, padding: '0.6rem 0.75rem' }}
      />
      {error ? <div id={errorId} role="alert" style={{ color: '#B91C1C', marginTop: '0.3rem' }}>{error}</div> : null}
    </label>
  );
}
