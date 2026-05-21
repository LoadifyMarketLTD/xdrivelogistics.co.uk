export const AUTH_CALLBACK_PATH = '/auth/callback';
export const RESET_PASSWORD_PATH = '/reset-password';
export const PRODUCTION_AUTH_SITE_URL = 'https://xdrivelogistics.co.uk';
export const RECOVERY_SESSION_STORAGE_KEY = 'xdrive:recovery-session';

type AuthFlowType = 'recovery' | 'signup' | 'invite';

export const buildAuthCallbackUrl = (type?: AuthFlowType) => {
  const url = new URL(AUTH_CALLBACK_PATH, PRODUCTION_AUTH_SITE_URL);
  if (type) {
    url.searchParams.set('type', type);
  }
  return url.toString();
};

export const markRecoverySession = (source: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      RECOVERY_SESSION_STORAGE_KEY,
      JSON.stringify({
        source,
        detectedAt: Date.now(),
      })
    );
  } catch {
    // no-op
  }
};

export const clearRecoverySession = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RECOVERY_SESSION_STORAGE_KEY);
  } catch {
    // no-op
  }
};

export const hasRecoverySessionMarker = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.sessionStorage.getItem(RECOVERY_SESSION_STORAGE_KEY));
  } catch {
    return false;
  }
};
