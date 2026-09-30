'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { Field, PageLayout } from './BaseUi';
import { getOnboardingContract } from '../../../lib/onboardingContract';
import { assessOnboardingRecovery, calculateOnboardingProgress } from '../../../lib/onboardingProgress';

type Application = {
  id: string;
  account_type: 'broker_shipper';
  status: string;
  current_step: string;
  completion_percentage: number;
  company_id?: string | null;
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

export function BrokerOnboarding({ token }: { token: string }) {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<BrokerPayload>(defaultPayload);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verifyingCompany, setVerifyingCompany] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<Set<string>>(new Set());
  const onboardingContract = getOnboardingContract('broker_shipper');
  const documentRequirements = onboardingContract?.documents ?? [];
  const requiredDocumentTypes = documentRequirements.filter((doc) => doc.requirement === 'required').map((doc) => doc.type);

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
      const payload = (data.application?.payload ?? {}) as Partial<BrokerPayload> & Record<string, unknown>;
      setFormData({ ...defaultPayload, ...payload });
      setUploadedDocuments(new Set(
        Object.keys(payload)
          .filter((key) => key.startsWith('doc_') && Boolean(payload[key]))
          .map((key) => key.slice(4)),
      ));
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

  const verifyCompany = async () => {
    setVerifyingCompany(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const res = await fetch('/api/onboarding/company-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ companyNumber: formData.company_number }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Company verification failed.');
        return;
      }

      setApplication((previous) => previous ? { ...previous, company_id: data.companyId } : previous);
      setFormData((previous) => ({
        ...previous,
        company_number: data.companyNumber ?? previous.company_number,
        company_name: data.registeredName ?? previous.company_name,
      }));
      setMessage(`Companies House verified: ${data.registeredName}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Company verification failed.');
    } finally {
      setVerifyingCompany(false);
    }
  };

  const uploadDocument = async (docType: string, file: File) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const upload = new FormData();
      upload.set('docType', docType);
      upload.set('file', file);

      const res = await fetch('/api/onboarding/documents', {
        method: 'POST',
        headers,
        body: upload,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Document upload failed.');
        return;
      }

      const markerKey = `doc_${docType}`;
      const nextPayload = { ...formData, [markerKey]: data.path ?? 'uploaded' };
      const persist = await fetch('/api/onboarding/broker/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          currentStep: 'document_upload',
          completionPercentage: Math.max(Number(application?.completion_percentage ?? 0), 80),
          status: 'in_progress',
          payload: nextPayload,
        }),
      });
      const persisted = await persist.json();
      if (!persist.ok) {
        setError(persisted.error ?? 'Document uploaded but onboarding progress could not be saved.');
        return;
      }

      setApplication(persisted.application);
      setUploadedDocuments((previous) => new Set(previous).add(docType));
      setMessage(`Uploaded ${docType.replace(/_/g, ' ')}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document upload failed.');
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
          completionPercentage: 95,
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

  const progressPayload: Record<string, unknown> = { ...formData };
  uploadedDocuments.forEach((docType) => { progressPayload[`doc_${docType}`] = true; });
  const recoveryAssessment = assessOnboardingRecovery('broker_shipper', progressPayload, { companyId: application.company_id });
  const calculatedProgress = calculateOnboardingProgress('broker_shipper', progressPayload, { companyId: application.company_id });
  const progress = application.status === 'under_review' || application.status === 'approved'
    ? 100
    : calculatedProgress;

  return (
    <PageLayout
      applicationId={application.id} accountType={application.account_type}
      title="Broker / Shipper Onboarding"
      status={application.status}
      currentStep={application.current_step}
      progress={progress}
      error={error}
      message={message}
      saving={saving}
      onSave={() => void saveProgress(application.current_step || 'document_upload', calculatedProgress)}
      onSubmit={() => void submitOnboarding()}
      backToLogin={() => router.push('/login')}
      submitDisabled={
        application.status === 'approved' ||
        !application.company_id ||
        recoveryAssessment.missingFields.length > 0 ||
        requiredDocumentTypes.some((docType) => !uploadedDocuments.has(docType))
      }
    >
      {!recoveryAssessment.complete && application.status !== 'approved' && (
        <section style={{ marginBottom: '1.25rem', padding: '1rem', border: '1px solid #F5A300', borderRadius: 10, background: '#FFF9E8' }}>
          <h2 style={{ margin: '0 0 0.5rem', color: '#0B2F6B', fontSize: '1.05rem' }}>Complete your XDrive onboarding</h2>
          <p style={{ margin: '0 0 0.75rem', color: '#4B5563' }}>
            Your previous progress has been saved. Complete only the information and documents that are still required under the current onboarding rules.
          </p>
          {recoveryAssessment.missingFields.length > 0 && (
            <div><strong>Information still required:</strong> {recoveryAssessment.missingFields.map((item) => item.label).join(', ')}.</div>
          )}
          {recoveryAssessment.missingDocuments.length > 0 && (
            <div style={{ marginTop: '0.45rem' }}><strong>Documents still required:</strong> {recoveryAssessment.missingDocuments.map((item) => item.label).join(', ')}.</div>
          )}
        </section>
      )}

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

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Company Verification</h2>
        <p style={{ color: '#4B5563' }}>
          Verify the Companies House record before uploading company compliance documents.
        </p>
        {application.company_id ? (
          <p style={{ color: '#166534', fontWeight: 600 }}>Companies House company verified.</p>
        ) : (
          <button
            type="button"
            onClick={() => void verifyCompany()}
            disabled={verifyingCompany || !formData.company_number.trim()}
            style={{ padding: '0.7rem 1rem', borderRadius: 6, border: '1px solid #CBD5E1', cursor: 'pointer' }}
          >
            {verifyingCompany ? 'Verifying...' : 'Verify Company'}
          </button>
        )}
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Company Documents</h2>
        {!application.company_id ? (
          <p style={{ color: '#92400E' }}>Verify the company before uploading documents.</p>
        ) : (
          documentRequirements.map((doc) => (
            <div key={doc.type} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center', marginBottom: '0.9rem' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{doc.label}</div>
                <div style={{ fontSize: '0.82rem', color: doc.requirement === 'required' ? '#B91C1C' : '#64748B' }}>
                  {uploadedDocuments.has(doc.type) ? 'Uploaded' : doc.requirement === 'required' ? 'Required' : 'Conditional'}
                  {!uploadedDocuments.has(doc.type) && doc.condition ? ` — ${doc.condition}` : ''}
                </div>
              </div>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadDocument(doc.type, file);
                }}
              />
            </div>
          ))
        )}
      </section>

    </PageLayout>
  );
}
