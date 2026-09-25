'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, Panel, StatusBadge } from './WorkspaceUI';

type TotpFactor = {
  id: string;
  friendly_name?: string;
  status?: string;
  factor_type?: string;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export default function MfaSecurityPanel() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [nextLevel, setNextLevel] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [factorResult, aalResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factorResult.error) {
      setError(factorResult.error.message || 'Two-factor authentication status could not be loaded.');
      setLoading(false);
      return;
    }
    setFactors((factorResult.data?.totp ?? []) as TotpFactor[]);
    if (!aalResult.error) {
      setCurrentLevel(aalResult.data?.currentLevel ?? null);
      setNextLevel(aalResult.data?.nextLevel ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const verifiedFactor = useMemo(() => factors.find((factor) => factor.status === 'verified') ?? null, [factors]);
  const hasVerifiedMfa = Boolean(verifiedFactor);

  const beginEnrollment = async () => {
    setWorking(true); setError(''); setNotice(''); setCode('');
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'XDrive Authenticator' });
    setWorking(false);
    if (enrollError || !data?.totp) {
      setError(enrollError?.message || 'Authenticator setup could not be started.');
      return;
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
  };

  const verifyEnrollment = async () => {
    if (!enrollment) return;
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    if (normalizedCode.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setWorking(true); setError(''); setNotice('');
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: normalizedCode });
    setWorking(false);
    if (verifyError) { setError(verifyError.message || 'The authenticator code could not be verified.'); return; }
    setEnrollment(null); setCode(''); setNotice('Two-factor authentication is now enabled.');
    await load();
  };

  const stepUp = async () => {
    if (!verifiedFactor) return;
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    if (normalizedCode.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setWorking(true); setError(''); setNotice('');
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: verifiedFactor.id, code: normalizedCode });
    setWorking(false);
    if (verifyError) { setError(verifyError.message || 'The authenticator code could not be verified.'); return; }
    setCode(''); setNotice('Two-factor verification completed for this session.');
    await load();
  };

  const disableMfa = async () => {
    if (!verifiedFactor) return;
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
    if (currentLevel !== 'aal2') {
      if (normalizedCode.length !== 6) { setError('Verify the 6-digit authenticator code before disabling two-factor authentication.'); return; }
      setWorking(true); setError(''); setNotice('');
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: verifiedFactor.id, code: normalizedCode });
      if (verifyError) { setWorking(false); setError(verifyError.message || 'The authenticator code could not be verified.'); return; }
    } else {
      setWorking(true); setError(''); setNotice('');
    }
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    setWorking(false);
    if (unenrollError) { setError(unenrollError.message || 'Two-factor authentication could not be disabled.'); return; }
    setCode(''); setNotice('Two-factor authentication has been disabled.');
    await load();
  };

  if (loading) return <Panel><EmptyState compact title="Loading two-factor authentication…" /></Panel>;

  return <Panel title="Two-Factor Authentication" description="Protect this XDrive account with a time-based one-time password (TOTP) from an authenticator app.">
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    {notice && <AlertBanner tone="success">{notice}</AlertBanner>}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
      <StatusBadge value={hasVerifiedMfa ? '2FA enabled' : '2FA not enabled'} tone={hasVerifiedMfa ? 'green' : 'orange'} />
      <span style={{ color: '#64748b', fontSize: 11 }}>Session assurance: {currentLevel ?? 'unknown'}{nextLevel && nextLevel !== currentLevel ? ` → ${nextLevel} available` : ''}</span>
    </div>

    {!hasVerifiedMfa && !enrollment && <ActionButton tone="primary" disabled={working} onClick={() => void beginEnrollment()}>{working ? 'Starting…' : 'Set up authenticator'}</ActionButton>}

    {enrollment && <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 12, alignItems: 'center' }}>
        <img src={enrollment.qrCode} alt="XDrive two-factor authentication QR code" width={160} height={160} style={{ border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', padding: 6 }} />
        <div style={{ minWidth: 0 }}><strong style={{ display: 'block', marginBottom: 4 }}>Scan with your authenticator app</strong><span style={{ color: '#64748b', fontSize: 11 }}>If scanning is unavailable, enter this secret manually:</span><code style={{ display: 'block', marginTop: 5, overflowWrap: 'anywhere', fontSize: 11 }}>{enrollment.secret}</code></div>
      </div>
      <label style={{ display: 'grid', gap: 4, maxWidth: 240, fontSize: 11, fontWeight: 800 }}>6-DIGIT CODE<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><ActionButton tone="primary" disabled={working} onClick={() => void verifyEnrollment()}>{working ? 'Verifying…' : 'Verify and enable 2FA'}</ActionButton><ActionButton tone="secondary" disabled={working} onClick={() => { setEnrollment(null); setCode(''); }}>Cancel</ActionButton></div>
    </div>}

    {hasVerifiedMfa && <div style={{ display: 'grid', gap: 10 }}>
      <label style={{ display: 'grid', gap: 4, maxWidth: 240, fontSize: 11, fontWeight: 800 }}>AUTHENTICATOR CODE<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {currentLevel !== 'aal2' && <ActionButton tone="primary" disabled={working} onClick={() => void stepUp()}>{working ? 'Verifying…' : 'Verify this session'}</ActionButton>}
        <ActionButton tone="danger" disabled={working} onClick={() => void disableMfa()}>{working ? 'Updating…' : 'Disable 2FA'}</ActionButton>
      </div>
      <div style={{ color: '#64748b', fontSize: 11 }}>Disabling a verified factor requires a recent AAL2 verification; XDrive performs that verification first when required.</div>
    </div>}
  </Panel>;
}
