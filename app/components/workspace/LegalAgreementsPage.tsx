'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  recoveryHref?: '/onboarding/resume';
  supportHref?: string;
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
  recoveryHref,
  supportHref,
  description = 'Review the contractual package accepted for this account, its exact versions and immutable evidence history.',
}: LegalAgreementsPageProps) {
  const [model, setModel] = useState<LegalReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [contractualRoleMissing, setContractualRoleMissing] = useState(false);
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
    setAgreementsAccepted(false);
    setAuthorityConfirmed(false);
    setRoleDeclarationConfirmed(false);
    setPrivacyAcknowledged(false);
    setInitialEvidenceRemediationConfirmed(false);
  };

  const getAccessToken = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    const token = data.session?.access_token;
    if (!token) throw new Error('Your XDrive session is not available. Please sign in again.');
    return token;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setContractualRoleMissing(false);
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/account/legal-agreements?language=${legalLanguage}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as LegalReadModel & { error?: string; code?: string };
      if (!response.ok) {
        setContractualRoleMissing(payload.code === 'legal_contractual_role_unavailable');
        throw new Error(payload.error || 'Legal agreement history could not be loaded.');
      }
      setModel(payload);
      resetConfirmations();
    } catch (loadError) {
      setModel(null);
      setError(loadError instanceof Error ? loadError.message : 'Legal agreement history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [legalLanguage]);

  useEffect(() => {
    void load();
  }, [load]);

  const agreementLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    model?.currentRequirement.agreements.forEach((agreement) => map.set(agreement.code, agreement.label));
    return map;
  }, [model]);

  const isInitialRemediation = Boolean(model?.requiresReacceptance && model.history.length === 0);

  const canAccept = Boolean(
    model?.requiresReacceptance &&
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
    <PageFrame>
      <PageHeader
        eyebrow={eyebrow}
        title="Legal & Agreements"
        description={description}
        actions={<ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>Refresh</ActionButton>}
      />

      {error && !(contractualRoleMissing && recoveryHref) && <AlertBanner tone="danger">{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}

      {loading ? (
        <Panel><EmptyState compact title="Loading Legal & Agreements…" /></Panel>
      ) : !model && contractualRoleMissing && recoveryHref ? (
        <Panel title="Account setup required before legal review" description="Your contractual role has not been established yet. Complete or recover account onboarding before reviewing the correct agreement package.">
          <p style={{ margin: '0 0 8px', fontSize: 12 }}>Company drivers must ask their company administrator to manage company agreements. No agreement is accepted automatically and no previous acceptance is recreated.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link href={recoveryHref} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 32, padding: '0 12px', border: '1px solid #D8DEE8', borderRadius: 4, color: '#1D57D8' }}>Complete / recover account setup</Link>
            {supportHref && <Link href={supportHref} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 32, padding: '0 12px', border: '1px solid #D8DEE8', borderRadius: 4, color: '#1D57D8' }}>Get workspace support</Link>}
          </div>
        </Panel>
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

              <div style={{ display: 'grid', gap: 6 }}>
                {model.currentRequirement.agreements.map((agreement) => (
                  <div key={agreement.code} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, padding: '8px 10px', border: '1px solid #dbe3ee', borderRadius: 4, background: '#fff' }}>
                    <div style={{ minWidth: 0 }}>
                      <a href={`${agreement.href}?lang=${legalLanguage}`} target="_blank" rel="noreferrer" style={{ color: '#0b3f9c', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>{agreement.label}</a>
                      <div style={{ color: '#64748b', fontSize: 10, lineHeight: '14px', marginTop: 2 }}>{agreement.code.replace(/_/g, ' ')}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 10, color: '#475569' }}>
                      <strong style={{ display: 'block', color: '#0f172a' }}>v{agreement.version}</strong>
                      {agreement.materialChangeRequiresReacceptance ? 'Material-change gated' : 'No re-accept on version change'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {model.requiresReacceptance && (
            <Panel
              title={isInitialRemediation ? 'Initial legal evidence requires remediation' : 'Re-acceptance required'}
              description={isInitialRemediation
                ? 'No immutable initial acceptance record exists for this legacy account. You may explicitly accept the current contractual package now. XDrive records the event at the current time and does not recreate or backdate the original registration acceptance.'
                : 'A material contractual change requires a new explicit acceptance. Your earlier evidence remains unchanged in history.'}
            >
              <div style={{ display: 'grid', gap: 8 }}>
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
    </PageFrame>
  );
}
