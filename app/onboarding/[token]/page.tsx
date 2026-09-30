'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import {
  getOnboardingContract,
  normalizeCanonicalOnboardingAccountType,
  type PersistedOnboardingAccountType,
} from '../../../lib/onboardingContract';
import { assessOnboardingRecovery, calculateOnboardingProgress } from '../../../lib/onboardingProgress';

type Application = {
  id: string;
  user_id: string;
  account_type: PersistedOnboardingAccountType;
  status: string;
  current_step: string;
  completion_percentage: number;
  company_id?: string | null;
  payload: Record<string, unknown>;
};

export default function OnboardingTokenPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params?.token ?? '');
  const router = useRouter();

  const [application, setApplication] = useState<Application | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingCompany, setVerifyingCompany] = useState(false);
  const [message, setMessage] = useState('');
  const [requestedDocument, setRequestedDocument] = useState('');

  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('document') ?? '';
    setRequestedDocument(/^[a-z0-9_]+$/i.test(target) ? target : '');
  }, []);
  useEffect(() => {
    if (loading || !application || !requestedDocument) return;
    const frame = window.requestAnimationFrame(() => {
      const row = document.getElementById('onboarding-document-' + requestedDocument);
      row?.scrollIntoView({ block: 'center' });
      document.getElementById('onboarding-file-' + requestedDocument)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [application, loading, requestedDocument]);
  const [error, setError] = useState('');

  const accountType = application?.account_type;
  const canonicalAccountType = normalizeCanonicalOnboardingAccountType(accountType);
  const contract = getOnboardingContract(accountType);
  const onboardingDocuments = useMemo(() => contract?.documents ?? [], [contract]);

  const toBoolean = (value: string | undefined) => {
    const normalized = (value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  };

  const normalizedPayload = (source: Record<string, string> = formData) => {
    const common = canonicalAccountType
      ? { ...source, canonical_account_type: canonicalAccountType }
      : { ...source };

    if (canonicalAccountType === 'fleet_courier') {
      return {
        ...common,
        transport_contact: source.transport_contact ?? source.transport_manager ?? '',
      };
    }

    if (canonicalAccountType === 'owner_driver') {
      return {
        ...common,
        right_to_work_status: source.right_to_work_status ?? '',
        registration: source.registration ?? source.vehicle_registration ?? '',
        make: source.make ?? source.vehicle_make ?? '',
        model: source.model ?? source.vehicle_model ?? '',
        payload: source.payload ?? source.vehicle_payload ?? '',
        dimensions: source.dimensions ?? source.vehicle_dimensions ?? '',
        settled_status: toBoolean(source.settled_status),
        pre_settled_status: toBoolean(source.pre_settled_status),
      };
    }

    if (canonicalAccountType === 'company_driver') {
      return {
        ...common,
        right_to_work_status: source.right_to_work_status ?? '',
        settled_status: toBoolean(source.settled_status),
        pre_settled_status: toBoolean(source.pre_settled_status),
      };
    }

    return common;
  };

  const authHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
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
      Object.entries(payload).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          nextFormData[key] = String(value);
        }
      });
      setFormData(nextFormData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load onboarding session.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const updateField = (key: string, value: string) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const sessionEndpoint = () => `/api/onboarding/${contract?.routeSegment ?? 'customer'}/session`;
  const submitEndpoint = () => `/api/onboarding/submit/${contract?.routeSegment ?? 'customer'}`;

  const saveProgress = async (currentStep: string, completionPercentage: number) => {
    if (!contract) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const res = await fetch(sessionEndpoint(), {
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save onboarding progress.');
        return;
      }
      setApplication(data.application);
      setMessage('Progress saved. You can continue later from this step.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save onboarding progress.');
    } finally {
      setSaving(false);
    }
  };

  const verifyCompany = async () => {
    if (canonicalAccountType !== 'broker_shipper' && canonicalAccountType !== 'fleet_courier') return;
    setVerifyingCompany(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const res = await fetch('/api/onboarding/company-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ companyNumber: formData.company_number ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Company verification failed.');
        return;
      }

      setApplication((previous) => previous ? { ...previous, company_id: data.companyId } : previous);
      const verifiedPayload =
        data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
          ? data.payload as Record<string, unknown>
          : {};
      setFormData((previous) => {
        const next = { ...previous };
        Object.entries(verifiedPayload).forEach(([key, value]) => {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            next[key] = String(value);
          }
        });
        return next;
      });
      setMessage(`Companies House verified: ${data.registeredName}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Company verification failed.');
    } finally {
      setVerifyingCompany(false);
    }
  };

  const submitOnboarding = async () => {
    if (!contract) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const headers = await authHeaders();
      const saveRes = await fetch(sessionEndpoint(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          currentStep: 'review_summary',
          completionPercentage: 95,
          payload: normalizedPayload(),
        }),
      });
      if (!saveRes.ok) {
        const payload = await saveRes.json();
        setError(payload.error ?? 'Failed to save onboarding summary.');
        return;
      }

      const res = await fetch(submitEndpoint(), {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit onboarding.');
        return;
      }
      setApplication(data.application);
      setMessage(
        canonicalAccountType === 'customer_shipper'
          ? 'Customer onboarding complete.'
          : 'Onboarding submitted successfully. Your account remains restricted until Platform Compliance approves it.',
      );
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

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Document upload failed.');
        return;
      }

      const markerKey = `doc_${docType}`;
      const nextFormData = { ...formData, [markerKey]: data.path ?? 'uploaded' };
      setFormData(nextFormData);

      const persist = await fetch(sessionEndpoint(), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          currentStep: 'document_upload',
          completionPercentage: calculateOnboardingProgress(canonicalAccountType, normalizedPayload(nextFormData)),
          status: 'in_progress',
          payload: normalizedPayload(nextFormData),
        }),
      });
      const persisted = await persist.json();
      if (!persist.ok) {
        setError(persisted.error ?? 'Document uploaded but onboarding progress could not be saved.');
        return;
      }

      setApplication(persisted.application);
      setMessage(`Uploaded ${docType.replace(/_/g, ' ')}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Document upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const renderCustomerShipper = () => (
    <section>
      <h2>Customer / Shipper Details</h2>
      <Field label="Full Name" value={formData.full_name ?? ''} onChange={(value) => updateField('full_name', value)} />
      <Field label="Email" value={formData.contact_email ?? ''} onChange={(value) => updateField('contact_email', value)} />
      <Field label="Phone" value={formData.contact_phone ?? ''} onChange={(value) => updateField('contact_phone', value)} />
      <Field label="Company Name" value={formData.company_name ?? ''} onChange={(value) => updateField('company_name', value)} />
      <Field label="Billing Address" value={formData.billing_address ?? ''} onChange={(value) => updateField('billing_address', value)} />
    </section>
  );

  const renderBrokerShipper = () => (
    <section>
      <h2>Broker / Shipper Details</h2>
      <Field label="Company Name" value={formData.company_name ?? ''} onChange={(value) => updateField('company_name', value)} />
      <Field label="Trading Name" value={formData.trading_name ?? ''} onChange={(value) => updateField('trading_name', value)} />
      <Field label="Company Number" value={formData.company_number ?? ''} onChange={(value) => updateField('company_number', value)} />
      <Field label="VAT Number (when VAT registered)" value={formData.vat_number ?? ''} onChange={(value) => updateField('vat_number', value)} />
      <Field label="Billing Address" value={formData.billing_address ?? ''} onChange={(value) => updateField('billing_address', value)} />
      <Field label="Trading Address" value={formData.trading_address ?? ''} onChange={(value) => updateField('trading_address', value)} />
      <Field label="Contact Person" value={formData.contact_person ?? ''} onChange={(value) => updateField('contact_person', value)} />
      <Field label="Finance Contact" value={formData.finance_contact ?? ''} onChange={(value) => updateField('finance_contact', value)} />
      <Field label="Email" value={formData.contact_email ?? ''} onChange={(value) => updateField('contact_email', value)} />
      <Field label="Phone" value={formData.contact_phone ?? ''} onChange={(value) => updateField('contact_phone', value)} />
    </section>
  );

  const renderFleetCourier = () => (
    <section>
      <h2>Fleet / Courier Company Details</h2>
      <Field label="Legal Company Name" value={formData.legal_company_name ?? ''} onChange={(value) => updateField('legal_company_name', value)} />
      <Field label="Trading Name" value={formData.trading_name ?? ''} onChange={(value) => updateField('trading_name', value)} />
      <Field label="Company Number" value={formData.company_number ?? ''} onChange={(value) => updateField('company_number', value)} />
      <Field label="VAT Number (when VAT registered)" value={formData.vat_number ?? ''} onChange={(value) => updateField('vat_number', value)} />
      <Field label="Registered Address" value={formData.registered_address ?? ''} onChange={(value) => updateField('registered_address', value)} />
      <Field label="Trading Address" value={formData.trading_address ?? ''} onChange={(value) => updateField('trading_address', value)} />
      <Field label="Contact Person" value={formData.contact_person ?? ''} onChange={(value) => updateField('contact_person', value)} />
      <Field label="Compliance Contact" value={formData.compliance_contact ?? ''} onChange={(value) => updateField('compliance_contact', value)} />
      <Field label="Transport Contact" value={formData.transport_contact ?? formData.transport_manager ?? ''} onChange={(value) => updateField('transport_contact', value)} />
    </section>
  );

  const renderOwnerDriver = () => (
    <section>
      <h2>Owner Operator Details</h2>
      <Field label="Full Name" value={formData.full_name ?? ''} onChange={(value) => updateField('full_name', value)} />
      <Field label="Date of Birth" value={formData.dob ?? ''} onChange={(value) => updateField('dob', value)} />
      <Field label="Nationality" value={formData.nationality ?? ''} onChange={(value) => updateField('nationality', value)} />
      <Field label="Address" value={formData.address ?? ''} onChange={(value) => updateField('address', value)} />
      <Field label="Phone" value={formData.phone ?? ''} onChange={(value) => updateField('phone', value)} />
      <Field label="Email" value={formData.email ?? ''} onChange={(value) => updateField('email', value)} />
      <Field label="Right to Work Status" value={formData.right_to_work_status ?? ''} onChange={(value) => updateField('right_to_work_status', value)} />
      <Field label="Visa Expiry (when applicable)" value={formData.visa_expiry ?? ''} onChange={(value) => updateField('visa_expiry', value)} />
      <Field label="Visa Type (when applicable)" value={formData.visa_type ?? ''} onChange={(value) => updateField('visa_type', value)} />
      <Field label="Share Code (when applicable)" value={formData.share_code ?? ''} onChange={(value) => updateField('share_code', value)} />
      <Field label="Settled Status (true/false)" value={formData.settled_status ?? ''} onChange={(value) => updateField('settled_status', value)} />
      <Field label="Pre-Settled Status (true/false)" value={formData.pre_settled_status ?? ''} onChange={(value) => updateField('pre_settled_status', value)} />
      <Field label="Vehicle Registration" value={formData.registration ?? formData.vehicle_registration ?? ''} onChange={(value) => updateField('registration', value)} />
      <Field label="Vehicle Make" value={formData.make ?? formData.vehicle_make ?? ''} onChange={(value) => updateField('make', value)} />
      <Field label="Vehicle Model" value={formData.model ?? formData.vehicle_model ?? ''} onChange={(value) => updateField('model', value)} />
      <Field label="Payload" value={formData.payload ?? formData.vehicle_payload ?? ''} onChange={(value) => updateField('payload', value)} />
      <Field label="Dimensions" value={formData.dimensions ?? formData.vehicle_dimensions ?? ''} onChange={(value) => updateField('dimensions', value)} />
      <Field label="Tail Lift" value={formData.tail_lift ?? ''} onChange={(value) => updateField('tail_lift', value)} />
      <Field label="Insurance Details" value={formData.insurance_details ?? ''} onChange={(value) => updateField('insurance_details', value)} />
    </section>
  );

  const renderCompanyDriver = () => (
    <section>
      <h2>Company Driver Details</h2>
      <p style={{ color: '#6B7280', marginTop: 0 }}>
        This account is linked exclusively to the fleet company that sent the invitation. It does not create another company or Owner Operator identity.
      </p>
      <Field label="Full Name" value={formData.full_name ?? ''} onChange={(value) => updateField('full_name', value)} />
      <Field label="Date of Birth" value={formData.dob ?? ''} onChange={(value) => updateField('dob', value)} />
      <Field label="Address" value={formData.address ?? ''} onChange={(value) => updateField('address', value)} />
      <Field label="Phone" value={formData.phone ?? ''} onChange={(value) => updateField('phone', value)} />
      <Field label="Email" value={formData.email ?? ''} onChange={(value) => updateField('email', value)} />
      <Field label="Right to Work Status" value={formData.right_to_work_status ?? ''} onChange={(value) => updateField('right_to_work_status', value)} />
      <Field label="Visa Expiry (when applicable)" value={formData.visa_expiry ?? ''} onChange={(value) => updateField('visa_expiry', value)} />
      <Field label="Share Code (when applicable)" value={formData.share_code ?? ''} onChange={(value) => updateField('share_code', value)} />
      <Field label="Settled Status (true/false)" value={formData.settled_status ?? ''} onChange={(value) => updateField('settled_status', value)} />
      <Field label="Pre-Settled Status (true/false)" value={formData.pre_settled_status ?? ''} onChange={(value) => updateField('pre_settled_status', value)} />
    </section>
  );

  if (loading) return <main style={{ padding: '2rem' }}>Loading onboarding...</main>;

  if (!application || !contract || !canonicalAccountType) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Onboarding unavailable</h1>
        <p>{error || 'No supported onboarding application was found.'}</p>
      </main>
    );
  }

  const normalizedCurrentPayload = normalizedPayload();
  const recoveryAssessment = assessOnboardingRecovery(canonicalAccountType, normalizedCurrentPayload, { companyId: application.company_id });
  const calculatedProgress = calculateOnboardingProgress(canonicalAccountType, normalizedCurrentPayload, { companyId: application.company_id });
  const progress = application.status === 'under_review' || application.status === 'approved'
    ? 100
    : calculatedProgress;
  const requiresVerifiedCompany = canonicalAccountType === 'broker_shipper' || canonicalAccountType === 'fleet_courier';
  const missingRequiredDocuments = onboardingDocuments.filter(
    (doc) => doc.requirement === 'required' && !formData[`doc_${doc.type}`],
  );
  const isRecoveryResume = token === 'resume';
  const visibleDocuments = isRecoveryResume
    ? onboardingDocuments.filter((doc) => doc.type === requestedDocument || recoveryAssessment.missingDocuments.some((item) => item.type === doc.type))
    : onboardingDocuments;

  const renderRecoveryMissingFields = () => (
    <section>
      <h2>Information still required</h2>
      {recoveryAssessment.missingFields.length === 0 ? (
        <p style={{ color: '#166534', fontWeight: 600 }}>No required profile information is missing.</p>
      ) : recoveryAssessment.missingFields.map((item) => (
        <Field
          key={item.key}
          label={item.label}
          value={formData[item.key] ?? ''}
          onChange={(value) => updateField(item.key, value)}
        />
      ))}
    </section>
  );

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1>XDrive Onboarding — {contract.label}</h1>
      <p style={{ color: '#4B5563' }}>{contract.description}</p>
      <p>Status: <strong>{application.status}</strong></p>
      <p>Current step: <strong>{application.current_step}</strong></p>

      {!recoveryAssessment.complete && application.status !== 'approved' && (
        <section style={{ margin: '1rem 0 1.25rem', padding: '1rem', border: '1px solid #F5A300', borderRadius: 10, background: '#FFF9E8' }}>
          <h2 style={{ margin: '0 0 0.5rem', color: '#0B2F6B', fontSize: '1.05rem' }}>Complete your XDrive onboarding</h2>
          <p style={{ margin: '0 0 0.75rem', color: '#4B5563' }}>
            Your previous progress has been saved. XDrive now checks the current onboarding requirements and only asks you to complete the items that are still missing.
          </p>
          {recoveryAssessment.missingFields.length > 0 && (
            <div style={{ marginBottom: '0.65rem' }}>
              <strong>Information still required:</strong>{' '}
              {recoveryAssessment.missingFields.map((item) => item.label).join(', ')}.
            </div>
          )}
          {recoveryAssessment.missingDocuments.length > 0 && (
            <div>
              <strong>Documents still required:</strong>{' '}
              {recoveryAssessment.missingDocuments.map((item) => item.label).join(', ')}.
            </div>
          )}
          {recoveryAssessment.blockingReasons.length > 0 && (
            <div style={{ marginTop: '0.65rem' }}>
              <strong>Blocking reasons:</strong> {recoveryAssessment.blockingReasons.join(' ')}
            </div>
          )}
        </section>
      )}

      <div style={{ background: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ width: `${progress}%`, height: 10, background: '#2563EB' }} />
      </div>
      <p style={{ marginTop: 0 }}>{progress.toFixed(0)}% complete</p>

      {isRecoveryResume ? renderRecoveryMissingFields() : (
        <>
          {canonicalAccountType === 'customer_shipper' && renderCustomerShipper()}
          {canonicalAccountType === 'broker_shipper' && renderBrokerShipper()}
          {canonicalAccountType === 'fleet_courier' && renderFleetCourier()}
          {canonicalAccountType === 'owner_driver' && renderOwnerDriver()}
          {canonicalAccountType === 'company_driver' && renderCompanyDriver()}
        </>
      )}

      {requiresVerifiedCompany && (!isRecoveryResume || !application.company_id) && (
        <section style={{ marginTop: '2rem' }}>
          <h2>Company Verification</h2>
          {application.company_id ? (
            <p style={{ color: '#166534', fontWeight: 600 }}>Companies House company verified.</p>
          ) : (
            <>
              <p style={{ color: '#4B5563' }}>Verify the Companies House company before uploading company compliance documents.</p>
              <button
                type="button"
                onClick={() => void verifyCompany()}
                disabled={verifyingCompany || !formData.company_number?.trim()}
                style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: 'pointer' }}
              >
                {verifyingCompany ? 'Verifying...' : 'Verify Company'}
              </button>
            </>
          )}
        </section>
      )}

      {visibleDocuments.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2>Document Upload</h2>
          <p style={{ color: '#4B5563' }}>
            Required documents block activation until approved. Conditional documents are requested only when they apply to the person, vehicle or business.
          </p>
          {visibleDocuments.map((doc) => (
            <div key={doc.type} id={'onboarding-document-' + doc.type} data-recovery-document={doc.type === requestedDocument || undefined} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.9rem', alignItems: 'center', ...(doc.type === requestedDocument ? { padding: '0.75rem', borderRadius: 8, outline: '2px solid #1D57D8', background: '#EFF6FF' } : {}) }}>
              <div>
                <div style={{ fontWeight: 600 }}>{doc.label}</div>
                {doc.type === requestedDocument && <p role="status" style={{ margin: '4px 0', color: '#7a271a' }}>This evidence requires attention. Review its current validity before uploading a replacement. Uploading does not mean it has been approved.</p>}
                <div style={{ fontSize: '0.8rem', color: doc.requirement === 'required' ? '#B91C1C' : '#6B7280' }}>
                  {formData[`doc_${doc.type}`] ? 'Uploaded' : doc.requirement === 'required' ? 'Required' : 'Conditional'}
                  {!formData[`doc_${doc.type}`] && doc.condition ? ` — ${doc.condition}` : ''}
                </div>
              </div>
              <input
                type="file"
                id={'onboarding-file-' + doc.type}
                aria-label={'Upload ' + doc.label}
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={saving || (requiresVerifiedCompany && !application.company_id)}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadDocument(doc.type, file);
                }}
              />
            </div>
          ))}
        </section>
      )}

      {!isRecoveryResume && (
        <section style={{ marginTop: '2rem' }}>
          <h2>Review Summary</h2>
          <pre style={{ background: '#F3F4F6', padding: '1rem', borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
            {JSON.stringify(formData, null, 2)}
          </pre>
        </section>
      )}

      <section style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #D7E0EA', borderRadius: 10, background: '#F8FAFC' }} aria-label="Legal documents">
        <strong style={{ display: 'block', marginBottom: '0.55rem', color: '#0B2F6B' }}>Legal & policy documents</strong>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem', fontWeight: 700 }}>
          <Link href="/legal">Legal Centre</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/subscription-terms">Membership Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/acceptable-use">Acceptable Use</Link>
          <Link href="/complaints">Complaints</Link>
        </div>
      </section>

      {error && <p style={{ color: '#B91C1C' }}>{error}</p>}
      {message && <p style={{ color: '#166534' }}>{message}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => void saveProgress(application.current_step || 'document_upload', calculatedProgress)}
          disabled={saving}
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: '1px solid #D1D5DB', cursor: 'pointer' }}
        >
          Save and continue later
        </button>
        <button
          onClick={() => void submitOnboarding()}
          disabled={
            saving ||
            application.status === 'approved' ||
            (requiresVerifiedCompany && !application.company_id) ||
            recoveryAssessment.missingFields.length > 0 ||
            missingRequiredDocuments.length > 0
          }
          style={{ padding: '0.75rem 1rem', borderRadius: 6, border: 'none', background: '#1D4ED8', color: '#fff', cursor: 'pointer' }}
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
        onChange={(event) => onChange(event.target.value)}
        style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 6, padding: '0.6rem 0.75rem' }}
      />
    </label>
  );
}
