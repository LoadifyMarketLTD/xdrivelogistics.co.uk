'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { resolveWorkspaceRole, type WorkspaceRole } from '../../../lib/workspaceRole';
import { isSafeRecoveryHref, WORKSPACE_READINESS_CHANGED, type ReadinessOperation, type WorkspaceBlocker } from '../../../lib/workspaceReadiness';
import { useAuth } from '../AuthContext';
import StripeSetupAction from './StripeSetupAction';

type Props = { role?: WorkspaceRole; operation?: ReadinessOperation; companyId?: string | null; inline?: boolean };
export default function WorkspaceRestrictionBanner({ role: suppliedRole, operation, companyId: suppliedCompanyId, inline = false }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const role = suppliedRole ?? resolveWorkspaceRole(user);
  const companyId = suppliedCompanyId === undefined ? user?.companyId : suppliedCompanyId;
  const isRecoveryPage = pathname === '/customer/account/legal-agreements'
    || pathname === '/broker/account/legal-agreements'
    || pathname === '/admin/settings/legal-agreements'
    || pathname === '/driver/account/legal-agreements';
  const contextKey = [user?.id, companyId, role].join(':');
  const [snapshot, setSnapshot] = useState<{ key: string; blockers: WorkspaceBlocker[]; error: string; unauthorized: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const pendingKey = useRef<string | null>(null);
  const lastFinishedAt = useRef(0);
  const lastFinishedKey = useRef<string | null>(null);
  const timeoutTriggered = useRef(false);
  const CHECK_TIMEOUT_MS = 45000;
  const FOCUS_REFRESH_INTERVAL_MS = 60000;
  const refresh = useCallback(async (force = false) => {
    if (!user?.id || role === 'platform_owner' || isRecoveryPage) {
      pending.current?.abort();
      pending.current = null;
      pendingKey.current = null;
      ++sequence.current;
      setSnapshot(null);
      setLoading(false);
      return;
    }
    // Focus and visibility are frequently emitted together. Neither should
    // abort and restart an in-flight advisory readiness verification.
    if (!force && pending.current && pendingKey.current === contextKey) return;
    if (!force && lastFinishedKey.current === contextKey &&
        Date.now() - lastFinishedAt.current < FOCUS_REFRESH_INTERVAL_MS) return;
    const current = ++sequence.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    pendingKey.current = contextKey;
    timeoutTriggered.current = false;
    // Cold starts, token refresh and multiple checks can exceed 20 seconds.
    // Never treat an unverified response as proof that restrictions were lifted.
    const timeout = window.setTimeout(() => {
      timeoutTriggered.current = true;
      controller.abort();
    }, CHECK_TIMEOUT_MS);
    setLoading(true);
    let unauthorized = false;
    try {
      const { data } = await supabase.auth.getSession();
      let token = data.session?.access_token;
      if (!token) {
        const refreshed = await supabase.auth.refreshSession();
        token = refreshed.data.session?.access_token;
      }
      if (!token) { unauthorized = true; throw new Error('Your session has expired. Sign in again to check your requirements.'); }
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      const requestReadiness = (accessToken: string) => fetch('/api/workspace/readiness?' + params.toString(), {
        cache: 'no-store', signal: controller.signal, headers: { Authorization: 'Bearer ' + accessToken },
      });
      let response = await requestReadiness(token);
      if (response.status === 401) {
        const refreshed = await supabase.auth.refreshSession();
        const refreshedToken = refreshed.data.session?.access_token;
        if (refreshedToken) response = await requestReadiness(refreshedToken);
      }
      const payload = await response.json().catch(() => null) as { blockers?: WorkspaceBlocker[]; ready?: boolean; error?: string } | null;
      unauthorized = response.status === 401;
      if (!response.ok) throw new Error(payload?.error || 'Your account requirements could not be checked. Retry the check.');
      if (!payload || !Array.isArray(payload.blockers) || typeof payload.ready !== 'boolean') throw new Error('The requirements service returned an incomplete result. Please retry.');
      if (payload.ready === false && payload.blockers.length === 0) throw new Error('Account readiness is not confirmed. Retry or contact support.');
      if (controller.signal.aborted) throw new Error('The requirements check was interrupted.');
      if (current === sequence.current) setSnapshot({ key: contextKey, blockers: payload.blockers, error: '', unauthorized: false });
    } catch (reason) {
      if (current === sequence.current) setSnapshot((previous) => ({
        key: contextKey, blockers: previous?.key === contextKey ? previous.blockers : [], unauthorized,
        error: timeoutTriggered.current ? 'The requirements check timed out. Please retry.' : reason instanceof Error ? reason.message : 'Your requirements could not be verified. Please retry.',
      }));
    } finally {
      window.clearTimeout(timeout);
      if (current === sequence.current) {
        pending.current = null;
        pendingKey.current = null;
        lastFinishedAt.current = Date.now();
        lastFinishedKey.current = contextKey;
        setLoading(false);
      }
    }
  }, [companyId, contextKey, isRecoveryPage, role, user?.id]);

  const cancelPending = useCallback(() => {
    ++sequence.current;
    pending.current?.abort();
    pending.current = null;
    pendingKey.current = null;
  }, []);

  useEffect(() => {
    void refresh(true);
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    const onReadinessChanged = () => { if (document.visibilityState === 'visible') void refresh(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener(WORKSPACE_READINESS_CHANGED, onReadinessChanged);
    return () => {
      cancelPending();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener(WORKSPACE_READINESS_CHANGED, onReadinessChanged);
    };
  }, [refresh, cancelPending]);

  if (!user?.id || role === 'platform_owner' || isRecoveryPage) return null;
  const current = snapshot?.key === contextKey ? snapshot : null;
  const blockers = (current?.blockers ?? []).filter((blocker) => !operation || blocker.operation === operation || blocker.operation === 'commercial');
  const error = current?.error ?? '';
  if (loading && !current) return null;
  if (!error && blockers.length === 0 && current) return null;
  const root = role === 'driver' || role === 'owner_driver' ? '/driver' : role === 'customer' ? '/customer' : role === 'broker' ? '/broker' : '/admin';
  const buttonStyle = { border: 0, borderRadius: 6, padding: '8px 12px', background: '#0b2f6b', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'normal' as const };
  return (
    <section aria-label="Workspace restrictions" aria-busy={loading} style={{ margin: inline ? '10px 0' : '10px 12px 0', border: '1px solid #f5b8b1', borderRadius: 8, background: '#fff6f5', color: '#7a271a', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ padding: '10px 12px', fontWeight: 800 }}>{loading && !current ? 'Checking account requirements...' : 'Account requirements and restrictions'}</div>
      {error && <div role="alert" style={{ padding: '0 12px 10px' }}>
        <p style={{ margin: '0 0 8px' }}>{error} A failed check does not remove existing restrictions.</p>
        <button type="button" style={buttonStyle} onClick={() => router.push(current?.unauthorized ? '/login' : root + '/support?reason=readiness-check')}>
          {current?.unauthorized ? 'Sign in again' : 'Contact support'}
        </button>
      </div>}
      <div style={{ display: 'grid', gap: 8, padding: 10 }}>
        {blockers.map((blocker) => <div key={blocker.code} data-restriction-code={blocker.code} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '9px 10px', borderRadius: 6, background: '#fff', border: '1px solid #f4d4d0', minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: '1 1 260px', overflowWrap: 'anywhere' }}>
            <strong style={{ display: 'block', fontSize: 13 }}>{blocker.title}</strong>
            <span style={{ display: 'block', marginTop: 2, fontSize: 12 }}>{blocker.message}</span>
          </div>
          {blocker.actionType === 'stripe_setup' && blocker.companyId ? <StripeSetupAction
            companyId={blocker.companyId} context={operation ?? 'commercial'}
            getAccessToken={async () => { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? null; }}
          /> : blocker.actionType === 'retry' ? <button type="button" style={buttonStyle} disabled={loading} onClick={() => void refresh(true)}>{blocker.actionLabel}</button>
            : isSafeRecoveryHref(blocker.actionHref) ? <a href={blocker.actionHref} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, textDecoration: 'none' }}>{blocker.actionLabel}</a>
              : <button type="button" style={buttonStyle} onClick={() => router.push(root + '/support?reason=' + encodeURIComponent(blocker.code))}>Contact support</button>}
        </div>)}
        {(current || error) && <><div style={{ fontSize: 12 }}>Recovery opens separately so your current form stays intact. Return here to re-check; nothing is posted or quoted automatically.</div>
          <button type="button" disabled={loading} onClick={() => void refresh(true)} style={{ ...buttonStyle, justifySelf: 'start' }}>{loading ? 'Checking...' : 'Re-check requirements'}</button></>}
      </div>
    </section>
  );
}
