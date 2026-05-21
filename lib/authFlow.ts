export type AuthCallbackFlowType = 'signup' | 'invite' | 'email_change' | 'magiclink';

export const AUTH_APP_ORIGIN = 'https://xdrivelogistics.co.uk';

export const getAuthCallbackUrl = (type?: AuthCallbackFlowType) => {
  if (!type) return `${AUTH_APP_ORIGIN}/auth/callback`;
  return `${AUTH_APP_ORIGIN}/auth/callback?type=${encodeURIComponent(type)}`;
};

export const getResetPasswordUrl = (type: 'recovery' | 'invite' = 'recovery') =>
  `${AUTH_APP_ORIGIN}/reset-password?type=${encodeURIComponent(type)}`;

export const isPasswordSetupFlowType = (value: string | null | undefined) =>
  value === 'recovery' || value === 'invite';
