'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LegalDocumentChecklist from './LegalDocumentChecklist';
import { legalDraftKey, readLegalDraft } from '../../../lib/legal/legalAcceptanceDraft';
import { supabase } from '../../../lib/supabaseClient';
import { LEGAL_LANGUAGE_LABELS, LEGAL_LANGUAGES, type LegalLanguage } from '../../../lib/legal/controlledLegalDocuments';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type AgreementDefinition = {
  code: string;
  label: string;
  href: string;
  version: string;
  required: true;
  materialChangeRequiresReacceptance: boolean;
};

type AcceptanceHistoryRow = {
  id: string;
  registrationRole: string;
  legalVersion: string;
  agreements: Array<{ code: string; version: string; language?: string; translationVersion?: string; documentHash?: string }>;
  privacyVersion: string;
  acceptanceLanguage: string;
  privacyDocumentHash: string | null;
  acceptedAt: string;
  source: string;
  evidenceHash: string;
  signerFullName: string | null;
  signatureMethod: string | null;
  signaturePayloadHash: string | null;
  signedPdfAvailable: boolean;
  signedPdfHash: string | null;
  signedPdfCreatedAt: string | null;
  createdAt: string;
  status: 'current' | 'superseded';
};

type LegalReadModel = {
  context?: { userId: string; companyId: string | null; onboardingApplicationId: string | null };
  currentRequirement: {
    registrationRole: string;
    legalVersion: string;
    privacyVersion: string;
    acceptanceLanguage: LegalLanguage;
    privacyDocumentHash: string;
    agreements: AgreementDefinition[];
    acceptanceStatement: string;
    authorityStatement: string;
    roleStatement: string;
    privacyStatement: string;
    requirementFingerprint: string;
  };
  requiresReacceptance: boolean;
  reacceptanceReasons: string[];
  history: AcceptanceHistoryRow[];
};

type LegalAgreementsPageProps = {
  eyebrow?: string;
  description?: string;
  embedded?: boolean;
  onboardingApplicationId?: string;
  expectedRegistrationRole?: string;
  onReadinessChange?: (ready: boolean) => void;
};

const ROLE_LABELS: Record<string, string> = {
  customer_shipper: 'Customer / Shipper',
  transport_broker: 'Transport Broker',
  owner_operator: 'Owner Driver / Owner-Operator',
  fleet_operator: 'Carrier / Fleet',
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
};

const reasonLabel = (reason: string) => {
  if (reason === 'missing_acceptance') return 'Initial legal acceptance evidence is missing.';
  if (reason === 'registration_role_changed') return 'Your contractual role has changed.';
  if (reason === 'legal_version_changed') return 'The legal gate version has changed.';
  if (reason.startsWith('material_agreement_changed:')) {
    return `A material agreement changed: ${reason.split(':')[1].replace(/_/g, ' ')}.`;
  }
  return reason.replace(/_/g, ' ');
};

export default function LegalAgreementsPage({
  eyebrow = 'Account governance',
  embedded = false, onboardingApplicationId, expectedRegistrationRole, onReadinessChange,
  description = 'Review the contractual package accepted for this account, its exact versions and immutable evidence history.',
}: LegalAgreementsPageProps) {
  const userIdRef = useRef<string | null>(null);
  const draftKeyRef = useRef<string | null>(null);
  const [acceptedDocumentCodes, setAcceptedDocumentCodes] = useState<string[]>([]);
  const [signatureReview, setSignatureReview] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const Frame = embedded ? 'div' : PageFrame;
  const [model, setModel] = useState<LegalReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [agreementsAccepted, setAgreementsAccepted] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [roleDeclarationConfirmed, setRoleDeclarationConfirmed] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [initialEvidenceRemediationConfirmed, setInitialEvidenceRemediationConfirmed] = useState(false);
  const [legalLanguage, setLegalLanguage] = useState<LegalLanguage>('en');
  const [signerFullName, setSignerFullName] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const resetConfirmations = () => {
    setAcceptedDocumentCodes([]);
    setSignatureReview(false);
    setSignerFullName('');
    setDraftRestored(false);
    setAgreementsAccepted(false);
    setAuthorityConfirmed(false);
    setRoleDeclarationConfirmed(false);
    setPrivacyAcknowledged(false);
    setInitialEvidenceRemediationConfirmed(false);
  };

  const getAccessToken = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    userIdRef.current = data.session?.user?.id ?? null;
    const token = data.session?.access_token;
    if (!token) throw new Error('Your XDrive session is not available. Please sign in again.');
    return token;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/account/legal-agreements?language=${legalLanguage}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as LegalReadModel & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Legal agreement history could not be loaded.');
      if (onboardingApplicationId && payload.context?.onboardingApplicationId !== onboardingApplicationId) {
        throw new Error('The legal package does not match this onboarding application. Contact support; no agreement has been accepted.');
      }
      if (expectedRegistrationRole && payload.currentRequirement.registrationRole !== expectedRegistrationRole) {
        throw new Error('The contractual role does not match this application. Contact support before signing.');
      }
      setModel(payload);
      resetConfirmations();
      const userId = payload.context?.userId ?? userIdRef.current;
      draftKeyRef.current = userId ? legalDraftKey(userId, payload.context?.companyId ?? null, payload.currentRequirement.requirementFingerprint) : null;
      if (draftKeyRef.current) {
        try {
          const draft = payload.requiresReacceptance ? readLegalDraft(sessionStorage.getItem(draftKeyRef.current), payload.currentRequirement.agreements.map(item => item.code)) : null;
          if (draft) {
            setAcceptedDocumentCodes(draft.acceptedDocumentCodes); setSignerFullName(draft.signerFullName);
            setAgreementsAccepted(draft.agreementsAccepted); setAuthorityConfirmed(draft.authorityConfirmed);
            setRoleDeclarationConfirmed(draft.roleDeclarationConfirmed); setPrivacyAcknowledged(draft.privacyAcknowledged);
            setInitialEvidenceRemediationConfirmed(draft.initialEvidenceRemediationConfirmed); setDraftRestored(true);
          }
          if (!payload.requiresReacceptance) sessionStorage.removeItem(draftKeyRef.current);
        } catch { /* Browser storage restrictions never authorize acceptance. */ }
      }
    } catch (loadError) {
      setModel(null);
      setError(loadError instanceof Error ? loadError.message : 'Legal agreement history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [legalLanguage, onboardingApplicationId, expectedRegistrationRole]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onReadinessChange?.(Boolean(!loading && model && !model.requiresReacceptance));
  }, [loading, model, onReadinessChange]);

  useEffect(() => {
    if (loading || !model?.requiresReacceptance || !draftKeyRef.current) return;
    try {
      sessionStorage.setItem(draftKeyRef.current, JSON.stringify({ savedAt: Date.now(), signerFullName,
        acceptedDocumentCodes, agreementsAccepted, authorityConfirmed, roleDeclarationConfirmed,
        privacyAcknowledged, initialEvidenceRemediationConfirmed }));
    } catch { /* The form remains usable when storage is unavailable. */ }
  }, [loading, model, signerFullName, acceptedDocumentCodes, agreementsAccepted, authorityConfirmed,
    roleDeclarationConfirmed, privacyAcknowledged, initialEvidenceRemediationConfirmed]);

  const agreementLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    model?.currentRequirement.agreements.forEach((agreement) => map.set(agreement.code, agreement.label));
    return map;
  }, [model]);

  const isInitialRemediation = Boolean(model?.requiresReacceptance && model.history.length === 0);

  const canAccept = Boolean(
    model?.requiresReacceptance && signatureReview &&
      model.currentRequirement.agreements.every(item => acceptedDocumentCodes.includes(item.code)) &&
      agreementsAccepted &&
      authorityConfirmed &&
      roleDeclarationConfirmed &&
      privacyAcknowledged &&
      signerFullName.trim().length >= 2 &&
      (!isInitialRemediation || initialEvidenceRemediationConfirmed),
  );

  const downloadSignedAgreement = async (record: AcceptanceHistoryRow) => {
    if (!record.signedPdfAvailable) return;
    setDownloadingId(record.id);
    setError('');
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/account/legal-agreements/${record.id}/signed-document`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Signed agreement could not be downloaded.');
      window.location.assign(payload.url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Signed agreement could not be downloaded.');
    } finally {
      setDownloadingId(null);
    }
  };

  const submitAcceptance = async () => {
    if (!model || !canAccept) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/account/legal-agreements', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requirementFingerprint: model.currentRequirement.requirementFingerprint,
          acceptedAgreementCodes: acceptedDocumentCodes,
          agreementsAccepted: true,
          authorityConfirmed: true,
          roleDeclarationConfirmed: true,
          privacyAcknowledged: true,
          initialEvidenceRemediationConfirmed: isInitialRemediation ? true : undefined,
          language: legalLanguage,
          signerFullName: signerFullName.trim(),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string; acceptanceMode?: string };
      if (!response.ok) {
        if (
          payload.code === 'legal_requirement_stale' ||
          payload.code === 'legal_reacceptance_already_recorded' ||
          payload.code === 'initial_legal_remediation_already_recorded'
        ) {
          await load();
        }
        throw new Error(payload.error || 'Legal acceptance could not be recorded.');
      }
      if (draftKeyRef.current) { try { sessionStorage.removeItem(draftKeyRef.current); } catch { /* optional storage */ } }
      window.dispatchEvent(new Event('xdrive:workspace-readiness-changed'));
      setMessage(
        payload.acceptanceMode === 'initial_remediation'
          ? 'Your current XDrive contractual package has been accepted now and recorded as an immutable initial-remediation event. No historical registration acceptance has been recreated or backdated.'
          : 'Your current XDrive contractual package has been accepted and a new immutable evidence record has been created.',
      );
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Legal acceptance could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Frame>
      <PageHeader
        eyebrow={eyebrow}
        title="Legal & Agreements"
        description={description}
        actions={<ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>Refresh</ActionButton>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}

      {loading ? (
        <Panel><EmptyState compact title="Loading Legal & Agreements…" /></Panel>
      ) : !model ? (
        <Panel><EmptyState title="Legal history unavailable" description="XDrive could not resolve the contractual record for this account." /></Panel>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <Panel
            title="Current contractual requirement"
            description="This is the server-defined contractual package for your current XDrive registration role."
          >
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <StatusBadge value={model.requiresReacceptance ? 'action required' : 'current'} />
                <strong style={{ fontSize: 12, color: '#0f172a' }}>{ROLE_LABELS[model.currentRequirement.registrationRole] ?? model.currentRequirement.registrationRole}</strong>
                <span style={{ fontSize: 11, color: '#64748b' }}>Legal gate {model.currentRequirement.legalVersion}</span>
              </div>

              <label style={{ display: 'grid', gap: 4, maxWidth: 280, fontSize: 10, color: '#64748b' }}>
                <strong style={{ color: '#0f172a' }}>Legal document language</strong>
                <select value={legalLanguage} onChange={(event) => { setLegalLanguage(event.target.value as LegalLanguage); resetConfirmations(); }} style={{ border: '1px solid #dbe3ee', borderRadius: 4, padding: '7px 8px', background: '#fff', color: '#0f172a', fontWeight: 700 }}>
                  {LEGAL_LANGUAGES.map((item) => <option key={item} value={item}>{LEGAL_LANGUAGE_LABELS[item]}</option>)}
                </select>
              </label>

              <LegalDocumentChecklist agreements={model.currentRequirement.agreements} language={legalLanguage}
                selected={acceptedDocumentCodes} onChange={codes => { setAcceptedDocumentCodes(codes); setSignatureReview(false); }} editable={model.requiresReacceptance} />
              {model.requiresReacceptance && <>
                {draftRestored && <p role="status">Your unsigned selections and name were restored in this tab. Review them before signing; no acceptance has been submitted automatically.</p>}
                <ActionButton disabled={!model.currentRequirement.agreements.every(item => acceptedDocumentCodes.includes(item.code))}
                  onClick={() => { setSignatureReview(true); requestAnimationFrame(() => document.getElementById('legal-signature-review')?.scrollIntoView({ block: 'start' })); }}>
                  Review selected documents &amp; continue to signature
                </ActionButton>
              </>}

            </div>
          </Panel>

          {model.requiresReacceptance && signatureReview && (
            <Panel
              title={isInitialRemediation ? 'Initial legal evidence requires remediation' : 'Re-acceptance required'}
              description={isInitialRemediation
                ? 'No immutable initial acceptance record exists for this legacy account. You may explicitly accept the current contractual package now. XDrive records the event at the current time and does not recreate or backdate the original registration acceptance.'
                : 'A material contractual change requires a new explicit acceptance. Your earlier evidence remains unchanged in history.'}
            >
              <div id="legal-signature-review" style={{ display: 'grid', gap: 8 }}>
                <h3>Final review and electronic signature</h3>
                <p>Your signature below covers all selected documents, in {legalLanguage.toUpperCase()}:</p>
                <ul>{model.currentRequirement.agreements.filter(item => acceptedDocumentCodes.includes(item.code)).map(item =>
                  <li key={item.code}>{item.label} - v{item.version}</li>)}</ul>
                {model.reacceptanceReasons.length > 0 && (
                  <div style={{ display: 'grid', gap: 3, color: '#7c2d12', fontSize: 11, lineHeight: '15px' }}>
                    {model.reacceptanceReasons.map((reason) => <span key={reason}>• {reasonLabel(reason)}</span>)}
                  </div>
                )}

                <label style={{ display: 'grid', gap: 4, maxWidth: 420, fontSize: 11, color: '#334155' }}>


                  <strong style={{ color: '#0f172a' }}>Full legal name of signer</strong>


                  <input type="text" value={signerFullName} onChange={(event) => setSignerFullName(event.target.value)} maxLength={120} autoComplete="name" placeholder="Enter your full legal name" style={{ border: '1px solid #dbe3ee', borderRadius: 4, padding: '8px 9px', background: '#fff', color: '#0f172a', fontWeight: 700 }} />


                  <span style={{ color: '#64748b', fontSize: 10 }}>Typing your full name and completing the confirmations below forms your electronic signature.</span>


                </label>



                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: '#334155' }}>


                  <input type="checkbox" checked={agreementsAccepted} onChange={(event) => setAgreementsAccepted(event.target.checked)} />
                  <span>{model.currentRequirement.acceptanceStatement}</span>
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: '#334155' }}>
                  <input type="checkbox" checked={authorityConfirmed} onChange={(event) => setAuthorityConfirmed(event.target.checked)} />
                  <span>{model.currentRequirement.authorityStatement}</span>
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: '#334155' }}>
                  <input type="checkbox" checked={roleDeclarationConfirmed} onChange={(event) => setRoleDeclarationConfirmed(event.target.checked)} />
                  <span>{model.currentRequirement.roleStatement}</span>
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: '#334155' }}>
                  <input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} />
                  <span>{model.currentRequirement.privacyStatement} Privacy acknowledgement remains separate from contractual acceptance.</span>
                </label>

                {isInitialRemediation && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={initialEvidenceRemediationConfirmed}
                      onChange={(event) => setInitialEvidenceRemediationConfirmed(event.target.checked)}
                    />
                    <span>I understand that this acceptance is recorded now and does not recreate or backdate my original registration acceptance.</span>
                  </label>
                )}

                <div>
                  <ActionButton tone="primary" disabled={!canAccept || submitting} onClick={() => void submitAcceptance()}>
                    {submitting
                      ? 'Recording acceptance…'
                      : isInitialRemediation
                        ? 'Record current acceptance'
                        : 'Accept current agreements'}
                  </ActionButton>
                </div>
              </div>
            </Panel>
          )}

          <Panel
            title="Acceptance history"
            description="Immutable evidence records are shown newest first. Earlier rows are never rewritten when terms change."
          >
            {model.history.length === 0 ? (
              <EmptyState
                compact
                title="No legal acceptance evidence recorded"
                description="No historical acceptance evidence is available. Complete the explicit current-date remediation above to establish a forward-looking immutable evidence record."
              />
            ) : (
              <div style={{ display: 'grid', gap: 7 }}>
                {model.history.map((record) => (
                  <article key={record.id} style={{ border: '1px solid #dbe3ee', borderRadius: 4, background: '#fff', padding: 10, display: 'grid', gap: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: 12, color: '#0f172a' }}>{ROLE_LABELS[record.registrationRole] ?? record.registrationRole}</strong>
                        <span style={{ color: '#64748b', fontSize: 10 }}>{formatDateTime(record.acceptedAt)}</span>
                      </div>
                      <StatusBadge value={record.status} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 5 }}>
                      {record.agreements.map((agreement) => (
                        <div key={`${record.id}-${agreement.code}`} style={{ fontSize: 10, color: '#475569' }}>
                          <strong style={{ color: '#0f172a' }}>{agreementLabelByCode.get(agreement.code) ?? agreement.code.replace(/_/g, ' ')}</strong>
                          <span> · v{agreement.version}{agreement.language ? ` · ${agreement.language}` : ''}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 5, paddingTop: 5, borderTop: '1px solid #edf1f6', color: '#64748b', fontSize: 10 }}>
                      <span>Event: <strong style={{ color: '#334155' }}>{record.source.replace(/_/g, ' ')}</strong></span>
                      <span>Legal gate: <strong style={{ color: '#334155' }}>{record.legalVersion}</strong></span>
                      <span>Privacy: <strong style={{ color: '#334155' }}>{record.privacyVersion}</strong></span>
                      <span>Language: <strong style={{ color: '#334155' }}>{record.acceptanceLanguage}</strong></span>
                      <span>Evidence ID: <code style={{ color: '#334155' }}>{record.id}</code></span>
                      <span>Evidence hash: <code style={{ color: '#334155' }}>{record.evidenceHash.slice(0, 16)}…</code></span>
                      {record.signerFullName ? <span>Signed by: <strong style={{ color: '#334155' }}>{record.signerFullName}</strong></span> : null}
                      {record.signedPdfHash ? <span>PDF hash: <code style={{ color: '#334155' }}>{record.signedPdfHash.slice(0, 16)}…</code></span> : null}
                    </div>
                    {record.signedPdfAvailable ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <ActionButton tone="secondary" disabled={downloadingId === record.id} onClick={() => void downloadSignedAgreement(record)}>
                          {downloadingId === record.id ? 'Preparing PDF…' : 'Download signed PDF'}
                        </ActionButton>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </Frame>
  );
}
