'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

type AccountType = 'broker_shipper' | 'fleet_courier' | 'owner_driver';

type Application = {
  id: string;
  user_id: string;
  account_type: AccountType;
  status: string;
  current_step: string;
  completion_percentage: number;
  payload: Record<string, unknown>;
};

const brokerDocs = ['company_registration', 'vat_evidence_optional', 'business_verification_documents'] as const;
const fleetDocs = ['operator_licence', 'public_liability', 'goods_in_transit', 'motor_fleet_insurance', 'company_registration', 'vat_registration'] as const;
const ownerDriverDocs = ['driving_licence', 'cpc', 'proof_of_address', 'right_to_work', 'visa_document', 'insurance'] as const;

export default function OnboardingTokenPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params?.token ?? '');
  const router = useRouter();

  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const accountType = application?.account_type;

  const requiredDocs = useMemo(() => {
    if (accountType === 'fleet_courier') return fleetDocs;
    if (accountType === 'owner_driver') return ownerDriverDocs;
    return brokerDocs;
  }, [accountType]);

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
      const res = await fetch(`/api/onboarding/session${query}`, {
        method: 'GET',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load onboarding session.');
        return;
      }

      setApplication(data.application);
      const payload = (data.application?.payload ?? {}) as Record<string, unknown>;
      const nextFormData: Record<string, string> = {};
      Object.entries(payload).forEach(([k, v]) => {
        if (typeof v === 'string') nextFormData[k] = v;
      });
      setFormData(nextFormData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load onboarding session.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const saveProgress = async (currentStep: string, completionPercentage: number) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const res = await fetch('/api/onboarding/session', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
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
      const saveRes = await fetch('/api/onboarding/session', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
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

      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers,
      });
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

  const uploadDocument = async (docType: string, file: File) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const form = new FormData();
      form.set('docType', docType);
      form.set('file', file);
      form.set('model', accountType === 'owner_driver' ? 'driver_identity' : 'company');

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

      updateField(`doc_${docType}`, data.path ?? 'uploaded');
      setMessage(`Uploaded ${docType.replace(/_/g, ' ')}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const renderBrokerShipper = () => (
    <section>
      <h2>Broker / Shipper Details</h2>
      <Field label="Company Name" value={formData.company_name ?? ''} onChange={(v) => updateField('company_name', v)} />
      <Field label="Trading Name" value={formData.trading_name ?? ''} onChange={(v) => updateField('trading_name', v)} />
      <Field label="Company Number" value={formData.company_number ?? ''} onChange={(v) => updateField('company_number', v)} />
      <Field label="VAT Number" value={formData.vat_number ?? ''} onChange={(v) => updateField('vat_number', v)} />
      <Field label="Billing Address" value={formData.billing_address ?? ''} onChange={(v) => updateField('billing_address', v)} />
      <Field label="Trading Address" value={formData.trading_address ?? ''} onChange={(v) => updateField('trading_address', v)} />
      <Field label="Contact Person" value={formData.contact_person ?? ''} onChange={(v) => updateField('contact_person', v)} />
      <Field label="Finance Contact" value={formData.finance_contact ?? ''} onChange={(v) => updateField('finance_contact', v)} />
      <Field label="Email" value={formData.contact_email ?? ''} onChange={(v) => updateField('contact_email', v)} />
      <Field label="Phone" value={formData.contact_phone ?? ''} onChange={(v) => updateField('contact_phone', v)} />
    </section>
  );

  const renderFleetCourier = () => (
    <section>
      <h2>Fleet / Courier Company Details</h2>
      <Field label="Legal Company Name" value={formData.legal_company_name ?? ''} onChange={(v) => updateField('legal_company_name', v)} />
      <Field label="Trading Name" value={formData.trading_name ?? ''} onChange={(v) => updateField('trading_name', v)} />
      <Field label="Company Number" value={formData.company_number ?? ''} onChange={(v) => updateField('company_number', v)} />
      <Field label="VAT Number" value={formData.vat_number ?? ''} onChange={(v) => updateField('vat_number', v)} />
      <Field label="Registered Address" value={formData.registered_address ?? ''} onChange={(v) => updateField('registered_address', v)} />
      <Field label="Trading Address" value={formData.trading_address ?? ''} onChange={(v) => updateField('trading_address', v)} />
      <Field label="Contact Person" value={formData.contact_person ?? ''} onChange={(v) => updateField('contact_person', v)} />
      <Field label="Compliance Contact" value={formData.compliance_contact ?? ''} onChange={(v) => updateField('compliance_contact', v)} />
      <Field label="Transport Manager" value={formData.transport_manager ?? ''} onChange={(v) => updateField('transport_manager', v)} />
    </section>
  );

  const renderOwnerDriver = () => (
    <section>
      <h2>Owner Driver / Sole Trader Details</h2>
      <Field label="Full Name" value={formData.full_name ?? ''} onChange={(v) => updateField('full_name', v)} />
      <Field label="Date of Birth" value={formData.dob ?? ''} onChange={(v) => updateField('dob', v)} />
      <Field label="Nationality" value={formData.nationality ?? ''} onChange={(v) => updateField('nationality', v)} />
      <Field label="Address" value={formData.address ?? ''} onChange={(v) => updateField('address', v)} />
      <Field label="Phone" value={formData.phone ?? ''} onChange={(v) => updateField('phone', v)} />
      <Field label="Email" value={formData.email ?? ''} onChange={(v) => updateField('email', v)} />
      <Field label="Immigration Status" value={formData.immigration_status ?? ''} onChange={(v) => updateField('immigration_status', v)} />
      <Field label="Visa Type" value={formData.visa_type ?? ''} onChange={(v) => updateField('visa_type', v)} />
      <Field label="Share Code" value={formData.share_code ?? ''} onChange={(v) => updateField('share_code', v)} />
      <Field label="Settled Status" value={formData.settled_status ?? ''} onChange={(v) => updateField('settled_status', v)} />
      <Field label="Pre-Settled Status" value={formData.pre_settled_status ?? ''} onChange={(v) => updateField('pre_settled_status', v)} />
      <Field label="Vehicle Registration" value={formData.vehicle_registration ?? ''} onChange={(v) => updateField('vehicle_registration', v)} />
      <Field label="Vehicle Make" value={formData.vehicle_make ?? ''} onChange={(v) => updateField('vehicle_make', v)} />
      <Field label="Vehicle Model" value={formData.vehicle_model ?? ''} onChange={(v) => updateField('vehicle_model', v)} />
      <Field label="Payload" value={formData.vehicle_payload ?? ''} onChange={(v) => updateField('vehicle_payload', v)} />
      <Field label="Dimensions" value={formData.vehicle_dimensions ?? ''} onChange={(v) => updateField('vehicle_dimensions', v)} />
      <Field label="Tail Lift" value={formData.vehicle_tail_lift ?? ''} onChange={(v) => updateField('vehicle_tail_lift', v)} />
      <Field label="Insurance Details" value={formData.vehicle_insurance_details ?? ''} onChange={(v) => updateField('vehicle_insurance_details', v)} />
    </section>
  );

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
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1>XDrive Onboarding</h1>
      <p>
        Status: <strong>{application.status}</strong>
      </p>
      <p>
        Current step: <strong>{application.current_step}</strong>
      </p>

      <div style={{ background: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ width: `${progress}%`, height: 10, background: '#2563EB' }} />
      </div>
      <p style={{ marginTop: 0 }}>{progress.toFixed(0)}% complete</p>

      {application.account_type === 'broker_shipper' && renderBrokerShipper()}
      {application.account_type === 'fleet_courier' && renderFleetCourier()}
      {application.account_type === 'owner_driver' && renderOwnerDriver()}

      <section style={{ marginTop: '2rem' }}>
        <h2>Document Upload</h2>
        {requiredDocs.map((doc) => (
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

      <section style={{ marginTop: '2rem' }}>
        <h2>Review Summary</h2>
        <pre style={{ background: '#F3F4F6', padding: '1rem', borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
          {JSON.stringify(formData, null, 2)}
        </pre>
      </section>

      {error && <p style={{ color: '#B91C1C' }}>{error}</p>}
      {message && <p style={{ color: '#166534' }}>{message}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => void saveProgress(application.current_step || 'document_upload', Math.max(progress, 60))}
          disabled={saving}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: 'pointer' }}
        >
          Save and continue later
        </button>
        <button
          onClick={() => void submitOnboarding()}
          disabled={saving || application.status === 'approved'}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 6,
            border: 'none',
            background: '#1D4ED8',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Submit for review
        </button>
        <button
          onClick={() => router.push('/login')}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: 'pointer' }}
        >
          Back to login
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'block', marginBottom: '0.75rem' }}>
      <div style={{ marginBottom: '0.35rem', fontWeight: 500 }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 6, padding: '0.6rem 0.75rem' }}
      />
    </label>
  );
}
