'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../components/AuthContext';
import { getPostLoginRoute, roleCanAccessPath } from '../../../lib/authSession';
import { supabase } from '../../../lib/supabaseClient';

// Recovery re-reads authority; it never changes roles or grants approval.
// Full navigation discards a stale in-memory Router/Auth context.
export default function RecoverWorkspaceAccessPage() {
  const { isLoading, refreshUserContext } = useAuth();
  const started = useRef(false);
  const running = useRef(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('Checking your current account and workspace permissions...');

  const recover = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setChecking(true);
    setMessage('Checking your current account and workspace permissions...');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const verified = await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Account verification timed out. Please try again.')), 20000);
        }),
      ]).finally(() => { if (timer) clearTimeout(timer); });
      if (verified.error || !verified.data.user) {
        throw new Error('Your session is not available in this browser. Sign in with your existing account.');
      }
      const result = await refreshUserContext();
      if (!result.success || !result.user || result.user.id !== verified.data.user.id) {
        throw new Error(result.error ?? 'Your account is awaiting review or does not have an active workspace.');
      }
      const destination = getPostLoginRoute(result.user);
      if (!destination.startsWith('/') || destination.startsWith('//') || !roleCanAccessPath(result.user, destination)) {
        throw new Error('Your account does not currently have permission to open its workspace. Please contact XDrive support.');
      }
      setMessage('Access verified. Opening your authorised workspace...');
      window.location.replace(destination);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Access could not be rechecked. Please try again.');
      setChecking(false);
    } finally {
      running.current = false;
    }
  }, [refreshUserContext]);

  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    void recover();
  }, [isLoading, recover]);

  return (
    <main style={{ maxWidth: 580, margin: '40px auto', padding: 24, fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }}>
      <h1>Re-check workspace access</h1>
      <p role={checking ? 'status' : 'alert'}>{message}</p>
      <p>This checks your existing permissions. It does not approve an account or change your company, documents or payment setup.</p>
      {!checking && <button type="button" onClick={() => void recover()} style={{ padding: '12px 18px', minHeight: 44 }}>Try access check again</button>}
      <p><a href="/login">Sign in with my existing account</a></p>
      <p><a href="/pending-approval">Application review status</a></p>
    </main>
  );
}
