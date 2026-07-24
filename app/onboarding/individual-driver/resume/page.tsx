'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

const REQUIRED_DOCUMENTS = ['driving_licence', 'proof_of_address', 'right_to_work', 'visa_document'] as const;

type Application = {
  id: string;
  status: string;
  current_step: string;
  completion_percentage: number;
  payload: Record<string, unknown>;
};

export default function IndividualDriverOnboardingPage() {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        router.replace('/login?next=/onboarding/individual-driver/resume');
        return;
      }

      const response = await fetch('/api/onboarding/individual-driver/session', { headers });
      const payload = await response.json().catch(() => null) as { application?: Application; error?: string } | null;
      if (cancelled) return;

      if (!response.ok || !payload?.application) {
        setError(payload?.error ?? 'Unable to load individual driver onboarding.');
        setLoading(false);
        return;
      }

      setApplication(payload.application);
      const next: Record<string, string> = {};
      Object.entries(payload.application.payload ?? {}).forEach(([key, value]) => {
        if (typeof value === 'string') next[key] = value;
      });
      setFormData(next);
      setLoading(false);
    };

    void load().catch((reason: unknown) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : 'Unable to load onboarding.');
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [router]);

  const updateField = (key: string, value: string) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const save = async (submit: boolean) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const saveResponse = await fetch('/api/onboarding/individual-driver/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          currentStep: submit ? 'review_summary' : 'driver_identity',
          completionPercentage: submit ? 100 : 70,
          status: 'in_progress',
          payload: formData,
        }),
      });
      const savePayload = await saveResponse.json().catch(() => null) as { application?: Application; error?: string } | null;
      if (!saveResponse.ok) {
        setError(savePayload?.error ?? 'Failed to save onboarding.');
        return;
      }

      if (!submit) {
        if (savePayload?.application) setApplication(savePayload.application);
        setMessage('Progress saved.');
        return;
      }

      const submitResponse = await fetch('/api/onboarding/submit/individual-driver', {
        method: 'POST',
        headers,
      });
      const submitPayload = await submitResponse.json().catch(() => null) as { application?: Application; error?: string } | null;
      if (!submitResponse.ok) {
        setError(submitPayload?.error ?? 'Failed to submit onboarding.');
        return;
      }

      if (submitPayload?.application) setApplication(submitPayload.application);
      router.replace('/pending-approval');
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (docType: string, file: File) => {
    setSaving(true);
    setError('');
    try {
      const headers = await authHeaders();
      const body = new FormData();
      body.set('docType', docType);
      body.set('file', file);
      body.set('model', 'driver_identity');

      const response = await fetch('/api/onboarding/documents', { method: 'POST', headers, body });
      const payload = await response.json().catch(() => null) as { path?: string; error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? 'Document upload failed.');
        return;
      }
      updateField(`doc_${docType}`, payload?.path ?? 'uploaded');
      setMessage(`${docType.replace(/_/g, ' ')} uploaded.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main style={{ padding: '2rem' }}>Loading onboarding...</main>;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem' }}>
      <h1>Individual Driver Onboarding</h1>
      <p>This account is for drivers working for a fleet or transport company. It does not create a carrier business workspace.</p>
      {application && <p>Status: <strong>{application.status}</strong></p>}

      <Field label="Full name" value={formData.full_name ?? ''} onChange={(value) => updateField('full_name', value)} />
      <Field label="Date of birth" value={formData.dob ?? ''} onChange={(value) => updateField('dob', value)} />
      <Field label="Address" value={formData.address ?? ''} onChange={(value) => updateField('address', value)} />
      <Field label="Phone" value={formData.phone ?? ''} onChange={(value) => updateField('phone', value)} />
      <Field label="Email" value={formData.email ?? ''} onChange={(value) => updateField('email', value)} />
      <Field label="Right to work status" value={formData.right_to_work_status ?? ''} onChange={(value) => updateField('right_to_work_status', value)} />
      <Field label="Visa expiry (when applicable)" value={formData.visa_expiry ?? ''} onChange={(value) => updateField('visa_expiry', value)} />
      <Field label="Share code (when applicable)" value={formData.share_code ?? ''} onChange={(value) => updateField('share_code', value)} />

      <section style={{ marginTop: '2rem' }}>
        <h2>Documents</h2>
        {REQUIRED_DOCUMENTS.map((documentType) => (
          <label key={documentType} style={{ display: 'block', marginBottom: '1rem' }}>
            <span style={{ display: 'block', marginBottom: '0.35rem' }}>{documentType.replace(/_/g, ' ')}</span>
            <input type="file" disabled={saving} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadDocument(documentType, file);
            }} />
          </label>
        ))}
      </section>

      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {message && <p style={{ color: '#166534' }}>{message}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button disabled={saving} onClick={() => void save(false)}>Save progress</button>
        <button disabled={saving || application?.status === 'approved'} onClick={() => void save(true)}>Submit for review</button>
      </div>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.85rem' }}>
      <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: 6 }} />
    </label>
  );
}
