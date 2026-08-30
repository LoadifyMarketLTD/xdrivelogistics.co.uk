'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type IdentityDocument = {
  id: string;
  doc_type: string;
  file_path: string | null;
  upload_status: string;
  verification_status: string;
  issued_date: string | null;
  expiry_date: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

type LegacyDocument = {
  id: string;
  doc_type: string;
  status: string;
  file_path: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  canonical_doc_type: string | null;
  reconcile_eligible: boolean;
};

type Vehicle = {
  id: string;
  registration: string | null;
  status: string | null;
  type: string | null;
  make: string | null;
  model: string | null;
};

type VehicleDocument = {
  id: string;
  vehicle_id: string;
  doc_type: string | null;
  status: string | null;
  file_path: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type RemediationPayload = {
  driver?: {
    id: string;
    companyId: string;
    driverType: 'owner_driver' | 'company_driver';
    appAccess: boolean;
    canCommercialBid: boolean;
  };
  application?: {
    id: string;
    account_type: string;
    status: string;
    current_step: string | null;
    risk_status: string;
  } | null;
  identityDocuments?: IdentityDocument[];
  requiredIdentityDocs?: string[];
  missingRequiredIdentityDocs?: string[];
  legacyDocuments?: LegacyDocument[];
  vehicles?: Vehicle[];
  vehicleDocuments?: VehicleDocument[];
  operational?: {
    eligible: boolean;
    canonicalVehicleId: string | null;
    blockers: string[];
    checks: Record<string, boolean> | null;
  };
  error?: string;
};

const IDENTITY_LABELS: Record<string, string> = {
  driving_licence: 'Driving Licence',
  proof_of_address: 'Proof of Address',
  right_to_work: 'Right to Work',
  insurance: 'Personal / Driver Insurance',
  cpc: 'CPC Card',
  visa_document: 'Visa Document',
};

const BLOCKER_LABELS: Record<string, string> = {
  driver_account_not_active: 'Driver account is not active.',
  driver_app_access_disabled: 'Driver app access is still pending.',
  commercial_bidding_not_permitted: 'Commercial bidding is not enabled.',
  verified_driver_identity_missing: 'Platform identity approval is still pending.',
  driver_onboarding_not_approved: 'Canonical onboarding remediation is awaiting approval.',
  driver_personal_compliance_not_current: 'Required personal compliance documents are missing, unverified or expired.',
  driver_company_not_active: 'Driver company is not active.',
  driver_company_membership_not_active: 'Active company membership is required.',
  canonical_vehicle_missing: 'Assign one active vehicle to the Driver profile.',
  canonical_vehicle_ambiguous: 'More than one active vehicle is assigned to the Driver profile.',
  canonical_vehicle_company_mismatch: 'The canonical vehicle company does not match the Driver company.',
  operational_eligibility_unavailable: 'Operational eligibility is temporarily unavailable.',
};

const MIME_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
}

function humanBlocker(value: string) {
  if (value.startsWith('vehicle_document_missing_or_invalid:')) {
    const type = value.split(':')[1];
    return type === 'mot'
      ? 'A current approved MOT is required for the canonical vehicle.'
      : 'Current approved Vehicle Insurance is required for the canonical vehicle.';
  }
  return BLOCKER_LABELS[value] ?? value.replace(/_/g, ' ');
}

function documentTone(status: string | null | undefined): 'green' | 'orange' | 'red' | 'grey' {
  const normalized = String(status ?? '').toLowerCase();
  if (['approved', 'verified'].includes(normalized)) return 'green';
  if (['rejected', 'expired'].includes(normalized)) return 'red';
  if (['pending', 'under_review', 'unverified', 'uploaded'].includes(normalized)) return 'orange';
  return 'grey';
}

function isCurrentVerifiedIdentityDocument(document: IdentityDocument) {
  const currentDate = new Date().toISOString().slice(0, 10);
  return document.verification_status === 'verified'
    && Boolean(document.file_path)
    && (!document.expiry_date || document.expiry_date >= currentDate);
}

export default function DriverDocumentsPage() {
  const { user } = useAuth();
  const identityFileRef = useRef<HTMLInputElement>(null);
  const vehicleFileRef = useRef<HTMLInputElement>(null);
  const [snapshot, setSnapshot] = useState<RemediationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showIdentityUpload, setShowIdentityUpload] = useState(false);
  const [identityDocType, setIdentityDocType] = useState('driving_licence');
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [showVehicleUpload, setShowVehicleUpload] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleDocType, setVehicleDocType] = useState<'mot' | 'insurance'>('mot');
  const [vehicleIssuedDate, setVehicleIssuedDate] = useState('');
  const [vehicleExpiryDate, setVehicleExpiryDate] = useState('');
  const [vehicleFile, setVehicleFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    return token ? `Bearer ${token}` : null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const authorization = await authHeader();
    if (!authorization) {
      setSnapshot(null);
      setError('Your session has expired. Sign in again to manage compliance.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/driver/compliance/remediation', {
      headers: { Authorization: authorization },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as RemediationPayload;
    if (!response.ok) {
      setSnapshot(null);
      setError(payload.error || 'Compliance remediation could not be loaded.');
    } else {
      setSnapshot(payload);
      const firstVehicle = payload.vehicles?.[0]?.id ?? '';
      setVehicleId((current) => current || firstVehicle);
      const firstMissing = payload.missingRequiredIdentityDocs?.[0];
      if (firstMissing) setIdentityDocType(firstMissing);
    }
    setLoading(false);
  }, [authHeader]);

  useEffect(() => {
    if (user) void load();
  }, [load, user]);

  const requiredIdentityDocs = snapshot?.requiredIdentityDocs ?? [];
  const identityDocuments = snapshot?.identityDocuments ?? [];
  const legacyDocuments = snapshot?.legacyDocuments ?? [];
  const vehicles = snapshot?.vehicles ?? [];
  const vehicleDocuments = snapshot?.vehicleDocuments ?? [];
  const blockers = snapshot?.operational?.blockers ?? [];
  const eligible = snapshot?.operational?.eligible === true;

  const canonicalVerifiedIdentityTypes = useMemo(
    () => new Set(
      identityDocuments
        .filter(isCurrentVerifiedIdentityDocument)
        .map((document) => document.doc_type),
    ),
    [identityDocuments],
  );

  const verifiedIdentityCount = useMemo(
    () => requiredIdentityDocs.filter((docType) =>
      canonicalVerifiedIdentityTypes.has(docType)
      || (docType === 'proof_of_address' && canonicalVerifiedIdentityTypes.has('driving_licence')),
    ).length,
    [canonicalVerifiedIdentityTypes, requiredIdentityDocs],
  );

  const approvedVehicleDocCount = useMemo(
    () => vehicleDocuments.filter((document) => document.status === 'approved').length,
    [vehicleDocuments],
  );

  const legacyNeedsReconciliation = useCallback((document: LegacyDocument) => Boolean(
    document.reconcile_eligible
    && document.canonical_doc_type
    && !canonicalVerifiedIdentityTypes.has(document.canonical_doc_type)
  ), [canonicalVerifiedIdentityTypes]);

  const reconcileCount = useMemo(
    () => legacyDocuments.filter(legacyNeedsReconciliation).length,
    [legacyDocuments, legacyNeedsReconciliation],
  );

  const reconcileLegacy = async () => {
    setSaving(true); setError(''); setNotice('');
    const authorization = await authHeader();
    if (!authorization) {
      setSaving(false); setError('Your session has expired.'); return;
    }
    const response = await fetch('/api/driver/compliance/remediation', {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reconcile_legacy_identity_documents' }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; reconciled?: string[] };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || 'Approved legacy documents could not be reconciled safely.');
      return;
    }
    const labels = (payload.reconciled ?? []).map((type) => IDENTITY_LABELS[type] ?? type);
    setNotice(labels.length
      ? `Approved legacy evidence reconciled: ${labels.join(', ')}.`
      : 'No additional approved legacy evidence required reconciliation.');
    await load();
  };

  const uploadIdentityDocument = async () => {
    if (!identityFile) { setError('Choose a personal compliance document.'); return; }
    setSaving(true); setError(''); setNotice('');
    const authorization = await authHeader();
    if (!authorization) { setSaving(false); setError('Your session has expired.'); return; }

    const formData = new FormData();
    formData.append('file', identityFile);
    formData.append('docType', identityDocType);
    const response = await fetch('/api/onboarding/documents', {
      method: 'POST',
      headers: { Authorization: authorization },
      body: formData,
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || 'Personal compliance document could not be submitted.');
      return;
    }
    setNotice(`${IDENTITY_LABELS[identityDocType] ?? identityDocType} submitted for Platform review.`);
    setIdentityFile(null);
    setShowIdentityUpload(false);
    if (identityFileRef.current) identityFileRef.current.value = '';
    await load();
  };

  const uploadVehicleDocument = async () => {
    if (!vehicleId) { setError('No active assigned vehicle is available.'); return; }
    if (!vehicleFile) { setError('Choose a vehicle compliance document.'); return; }
    if (!vehicleExpiryDate) { setError('Enter the document expiry date.'); return; }
    setSaving(true); setError(''); setNotice('');
    const authorization = await authHeader();
    if (!authorization) { setSaving(false); setError('Your session has expired.'); return; }

    const formData = new FormData();
    formData.append('file', vehicleFile);
    formData.append('vehicleId', vehicleId);
    formData.append('docType', vehicleDocType);
    formData.append('issuedDate', vehicleIssuedDate);
    formData.append('expiryDate', vehicleExpiryDate);
    const response = await fetch('/api/driver/compliance/vehicle-documents', {
      method: 'POST',
      headers: { Authorization: authorization },
      body: formData,
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || 'Vehicle compliance document could not be submitted.');
      return;
    }
    setNotice(`${vehicleDocType === 'mot' ? 'MOT' : 'Vehicle Insurance'} submitted for Platform review.`);
    setVehicleFile(null);
    setVehicleIssuedDate('');
    setVehicleExpiryDate('');
    setShowVehicleUpload(false);
    if (vehicleFileRef.current) vehicleFileRef.current.value = '';
    await load();
  };

  const complianceRail = (
    <aside className="driver-filter-rail" aria-label="Canonical compliance summary">
      <div className="driver-filter-rail__header">Compliance Status</div>
      <div className="driver-filter-rail__body">
        <div className="driver-detail-item"><span>Operational eligibility</span><strong>{eligible ? 'Eligible' : 'Blocked'}</strong></div>
        <div className="driver-detail-item"><span>Onboarding</span><strong>{snapshot?.application?.status ?? 'Missing'}</strong></div>
        <div className="driver-detail-item"><span>Identity verified</span><strong>{verifiedIdentityCount}/{requiredIdentityDocs.length}</strong></div>
        <div className="driver-detail-item"><span>Vehicle approvals</span><strong>{approvedVehicleDocCount}/2 required</strong></div>
        <div className="driver-detail-item"><span>Canonical vehicle</span><strong>{snapshot?.operational?.canonicalVehicleId ? 'Assigned' : 'Missing'}</strong></div>
        <ActionButton tone="primary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Canonical Driver identity, personal compliance and vehicle evidence used by operational eligibility."
        headerActions={<ActionButton tone="primary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
        {!loading && snapshot && !eligible && (
          <AlertBanner tone="warning">
            <strong>Operational eligibility is not complete.</strong>{' '}
            Finish the items below and wait for required Platform review before quoting.
          </AlertBanner>
        )}

        <div className="driver-board-layout driver-documents-board">
          {complianceRail}
          <main className="driver-board-main">
            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading canonical compliance…" /></div>
            ) : !snapshot ? (
              <div className="driver-load-row"><EmptyState compact title="Compliance status unavailable" /></div>
            ) : (
              <>
                <section className="driver-row-details">
                  <div className="driver-detail-tabs"><strong>Why quoting is {eligible ? 'available' : 'blocked'}</strong></div>
                  {eligible ? (
                    <AlertBanner tone="success">Driver identity, personal compliance and canonical vehicle checks are currently satisfied.</AlertBanner>
                  ) : blockers.length ? (
                    <div className="driver-detail-grid">
                      {blockers.map((blocker) => (
                        <div className="driver-detail-item" key={blocker}>
                          <span>Required action</span>
                          <strong>{humanBlocker(blocker)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState compact title="Eligibility is blocked" description="Refresh the page to load the latest compliance reasons." />}
                </section>

                <div className="driver-board-summary">
                  <span><strong>Personal identity & compliance</strong> · {verifiedIdentityCount}/{requiredIdentityDocs.length} required verified</span>
                  <ActionButton tone="success" onClick={() => setShowIdentityUpload(true)}>+ Upload required document</ActionButton>
                </div>

                {showIdentityUpload && (
                  <section className="driver-row-details">
                    <div className="driver-detail-grid">
                      <label className="driver-filter-field">Document type
                        <select value={identityDocType} onChange={(event) => setIdentityDocType(event.target.value)}>
                          {Array.from(new Set([...requiredIdentityDocs, 'cpc', 'visa_document'])).map((type) => (
                            <option key={type} value={type}>{IDENTITY_LABELS[type] ?? type}</option>
                          ))}
                        </select>
                      </label>
                      <label className="driver-filter-field">File
                        <input ref={identityFileRef} type="file" accept={MIME_ACCEPT} onChange={(event) => setIdentityFile(event.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    <div className="driver-row-actions" style={{ marginTop: 5 }}>
                      <ActionButton tone="secondary" onClick={() => setShowIdentityUpload(false)}>Cancel</ActionButton>
                      <ActionButton tone="success" onClick={() => void uploadIdentityDocument()} disabled={saving || !identityFile}>{saving ? 'Submitting…' : 'Submit for review'}</ActionButton>
                    </div>
                  </section>
                )}

                <div className="driver-load-list">
                  {requiredIdentityDocs.map((docType) => {
                    const matches = identityDocuments.filter((document) => document.doc_type === docType);
                    const verifiedDirect = matches.find(isCurrentVerifiedIdentityDocument) ?? null;
                    const verifiedLicence = docType === 'proof_of_address'
                      ? identityDocuments.find((document) => document.doc_type === 'driving_licence' && isCurrentVerifiedIdentityDocument(document)) ?? null
                      : null;
                    const satisfiedByLicence = !verifiedDirect && Boolean(verifiedLicence);
                    const preferred = verifiedDirect ?? verifiedLicence ?? matches[0] ?? null;
                    const effectiveStatus = satisfiedByLicence ? 'verified' : (preferred?.verification_status ?? 'missing');
                    return (
                      <article className="driver-load-row" key={docType} data-state={effectiveStatus}>
                        <div className="driver-load-row__top">
                          <div className="driver-load-cell"><span className="driver-cell-label">Required document</span><strong className="driver-cell-primary">{IDENTITY_LABELS[docType] ?? docType}</strong><span className="driver-cell-secondary">{satisfiedByLicence ? 'Verified Driving Licence accepted as address evidence' : 'Canonical onboarding evidence'}</span></div>
                          <div className="driver-load-cell"><span className="driver-cell-label">Upload</span><strong className="driver-cell-primary">{satisfiedByLicence ? 'accepted' : (preferred?.upload_status ?? 'missing')}</strong><span className="driver-cell-secondary">{satisfiedByLicence ? 'Verified Driving Licence already on file' : (preferred?.file_path ? 'Secure file recorded' : 'No canonical file yet')}</span></div>
                          <div className="driver-load-cell"><span className="driver-cell-label">Review</span><strong className="driver-cell-primary">{effectiveStatus}</strong><span className="driver-cell-secondary">{satisfiedByLicence ? 'Driving Licence satisfies Proof of Address' : (preferred?.review_notes ?? 'Platform verification required')}</span></div>
                          <div className="driver-load-cell"><span className="driver-cell-label">Expiry</span><strong className="driver-cell-primary">{fmtDate(preferred?.expiry_date)}</strong><span className="driver-cell-secondary"><StatusBadge value={effectiveStatus} tone={documentTone(effectiveStatus)} /></span></div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {legacyDocuments.length > 0 && (
                  <section className="driver-row-details">
                    <div className="driver-detail-tabs"><strong>Approved legacy evidence</strong></div>
                    <p style={{ margin: '6px 0', fontSize: 12, color: '#475569' }}>
                      Older approved Driver documents are preserved. Only unambiguous, currently valid evidence with an existing review can be copied into the canonical onboarding registry; nothing is silently re-approved.
                    </p>
                    <div className="driver-detail-grid">
                      {legacyDocuments.map((document) => {
                        const needsReconciliation = legacyNeedsReconciliation(document);
                        const alreadyCanonical = Boolean(
                          document.canonical_doc_type
                          && canonicalVerifiedIdentityTypes.has(document.canonical_doc_type)
                        );
                        return (
                          <div className="driver-detail-item" key={document.id}>
                            <span>{document.doc_type}</span>
                            <strong>{document.status}</strong>
                            <small>{needsReconciliation
                              ? 'Eligible for canonical reconciliation'
                              : alreadyCanonical
                                ? 'Already represented in canonical onboarding'
                                : `Preserved legacy record · expiry ${fmtDate(document.expiry_date)}`}</small>
                          </div>
                        );
                      })}
                    </div>
                    {reconcileCount > 0 && (
                      <div className="driver-row-actions" style={{ marginTop: 6 }}>
                        <ActionButton tone="primary" onClick={() => void reconcileLegacy()} disabled={saving}>{saving ? 'Reconciling…' : `Reconcile ${reconcileCount} approved legacy record${reconcileCount === 1 ? '' : 's'}`}</ActionButton>
                      </div>
                    )}
                  </section>
                )}

                <div className="driver-board-summary">
                  <span><strong>Canonical vehicle compliance</strong> · MOT + Vehicle Insurance must both be approved and current</span>
                  {vehicles.length > 0 && <ActionButton tone="success" onClick={() => setShowVehicleUpload(true)}>+ Upload vehicle document</ActionButton>}
                </div>

                {showVehicleUpload && vehicles.length > 0 && (
                  <section className="driver-row-details">
                    <div className="driver-detail-grid">
                      <label className="driver-filter-field">Vehicle
                        <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
                          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration ?? vehicle.id.slice(0, 8)}</option>)}
                        </select>
                      </label>
                      <label className="driver-filter-field">Document type
                        <select value={vehicleDocType} onChange={(event) => setVehicleDocType(event.target.value as 'mot' | 'insurance')}>
                          <option value="mot">MOT</option>
                          <option value="insurance">Vehicle Insurance</option>
                        </select>
                      </label>
                      <label className="driver-filter-field">Issue date<input type="date" value={vehicleIssuedDate} onChange={(event) => setVehicleIssuedDate(event.target.value)} /></label>
                      <label className="driver-filter-field">Expiry date<input type="date" value={vehicleExpiryDate} onChange={(event) => setVehicleExpiryDate(event.target.value)} /></label>
                      <label className="driver-filter-field">File<input ref={vehicleFileRef} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setVehicleFile(event.target.files?.[0] ?? null)} /></label>
                    </div>
                    <div className="driver-row-actions" style={{ marginTop: 5 }}>
                      <ActionButton tone="secondary" onClick={() => setShowVehicleUpload(false)}>Cancel</ActionButton>
                      <ActionButton tone="success" onClick={() => void uploadVehicleDocument()} disabled={saving || !vehicleFile || !vehicleExpiryDate}>{saving ? 'Submitting…' : 'Submit for review'}</ActionButton>
                    </div>
                  </section>
                )}

                {vehicles.length === 0 ? (
                  <div className="driver-load-row"><EmptyState compact title="No active vehicle assigned" description="Assign exactly one active vehicle from Vehicle before submitting vehicle compliance evidence." /></div>
                ) : (
                  <div className="driver-load-list">
                    {vehicles.map((vehicle) => {
                      const docs = vehicleDocuments.filter((document) => document.vehicle_id === vehicle.id);
                      return ['mot', 'insurance'].map((docType) => {
                        const matches = docs.filter((document) => String(document.doc_type ?? '').toLowerCase() === docType);
                        const preferred = matches.find((document) => document.status === 'approved') ?? matches[0] ?? null;
                        return (
                          <article className="driver-load-row" key={`${vehicle.id}-${docType}`} data-state={preferred?.status ?? 'missing'}>
                            <div className="driver-load-row__top">
                              <div className="driver-load-cell"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{vehicle.registration ?? 'Vehicle'}</strong><span className="driver-cell-secondary">{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.type || 'Assigned vehicle'}</span></div>
                              <div className="driver-load-cell"><span className="driver-cell-label">Required evidence</span><strong className="driver-cell-primary">{docType === 'mot' ? 'MOT' : 'Vehicle Insurance'}</strong><span className="driver-cell-secondary">Canonical vehicle compliance</span></div>
                              <div className="driver-load-cell"><span className="driver-cell-label">Review</span><strong className="driver-cell-primary">{preferred?.status ?? 'missing'}</strong><span className="driver-cell-secondary">{preferred?.rejection_reason ?? 'Platform approval required'}</span></div>
                              <div className="driver-load-cell"><span className="driver-cell-label">Expiry</span><strong className="driver-cell-primary">{fmtDate(preferred?.expiry_date)}</strong><span className="driver-cell-secondary"><StatusBadge value={preferred?.status ?? 'missing'} tone={documentTone(preferred?.status)} /></span></div>
                            </div>
                          </article>
                        );
                      });
                    })}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
