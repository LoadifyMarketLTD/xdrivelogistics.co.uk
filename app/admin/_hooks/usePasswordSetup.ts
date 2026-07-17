'use client';

import { useState } from 'react';
import { getAccessToken } from '../_lib/getAccessToken';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';

const PASSWORD_SETUP_RESEND_COOLDOWN_MS = 60_000;

export type PasswordSetupStatus = 'idle' | 'sending' | 'sent' | 'error';

export type PasswordSetupState = {
  status: PasswordSetupStatus;
  message: string;
};

export type CreatedMemberCredentials = {
  displayName: string;
  email: string;
  onboardingOutcome: 'invite_sent' | 'password_setup_required' | 'temporary_password_created';
  temporaryPassword: string | null;
  inviteFallbackReason: string | null;
};

type UsePasswordSetupOptions = {
  /** API endpoint for the PATCH resend action, e.g. '/api/admin/drivers' */
  endpoint: string;
  companyId: string | null;
  membershipId: string | null | undefined;
};

/**
 * Encapsulates the "resend password setup email" flow shared by the
 * Drivers and Dispatchers admin pages.
 *
 * Handles cooldown enforcement, rate-limit detection, and clipboard copy.
 */
export function usePasswordSetup({ endpoint, companyId, membershipId }: UsePasswordSetupOptions) {
  const [credentials, setCredentials] = useState<CreatedMemberCredentials | null>(null);
  const [copiedTemporaryPassword, setCopiedTemporaryPassword] = useState(false);
  const [passwordSetupState, setPasswordSetupState] = useState<PasswordSetupState>({
    status: 'idle',
    message: '',
  });
  const [passwordSetupCooldownUntil, setPasswordSetupCooldownUntil] = useState(0);

  const resetSetupState = () => {
    setCredentials(null);
    setCopiedTemporaryPassword(false);
    setPasswordSetupState({ status: 'idle', message: '' });
    setPasswordSetupCooldownUntil(0);
  };

  const handleCopyTemporaryPassword = async () => {
    if (!credentials?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(credentials.temporaryPassword);
      setCopiedTemporaryPassword(true);
    } catch {
      setCopiedTemporaryPassword(false);
      setPasswordSetupState({
        status: 'error',
        message: 'Failed to copy the temporary password. Copy it manually before closing this modal.',
      });
    }
  };

  const handleSendPasswordSetup = async () => {
    if (!companyId || !credentials || !isSupabaseConfigured) return;

    const cooldownRemainingMs = passwordSetupCooldownUntil - Date.now();
    if (cooldownRemainingMs > 0) {
      const waitSeconds = Math.ceil(cooldownRemainingMs / 1000);
      setPasswordSetupState({
        status: 'error',
        message: `Please wait ${waitSeconds}s before requesting another password setup email.`,
      });
      return;
    }

    const { accessToken, error: accessTokenError } = await getAccessToken();
    if (accessTokenError || !accessToken) {
      setPasswordSetupState({
        status: 'error',
        message: accessTokenError ?? 'Session expired. Please sign in again.',
      });
      return;
    }

    setPasswordSetupState({ status: 'sending', message: '' });

    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify({
          companyId,
          membershipId: membershipId ?? null,
          email: credentials.email,
        }),
      });

      const body = await response.json().catch(() => ({} as { error?: string }));

      if (!response.ok) {
        const rawMessage = (body as { error?: string }).error || 'Failed to send password setup email.';
        const lowered = rawMessage.toLowerCase();
        if (
          lowered.includes('rate limit') ||
          lowered.includes('security purposes') ||
          lowered.includes('too many')
        ) {
          setPasswordSetupCooldownUntil(Date.now() + PASSWORD_SETUP_RESEND_COOLDOWN_MS);
          setPasswordSetupState({
            status: 'error',
            message: 'Please wait before resending. This action is temporarily rate-limited.',
          });
          return;
        }
        setPasswordSetupState({ status: 'error', message: rawMessage });
        return;
      }

      setPasswordSetupCooldownUntil(Date.now() + PASSWORD_SETUP_RESEND_COOLDOWN_MS);
      setPasswordSetupState({
        status: 'sent',
        message: 'Password setup email sent successfully. Please wait before resending.',
      });
    } catch (requestError) {
      setPasswordSetupState({
        status: 'error',
        message: requestError instanceof Error ? requestError.message : 'Failed to send password setup email.',
      });
    }
  };

  return {
    credentials,
    setCredentials,
    copiedTemporaryPassword,
    setCopiedTemporaryPassword,
    passwordSetupState,
    setPasswordSetupState,
    passwordSetupCooldownUntil,
    resetSetupState,
    handleCopyTemporaryPassword,
    handleSendPasswordSetup,
  };
}
