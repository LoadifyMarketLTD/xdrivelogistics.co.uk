const KEY = 'xdrive-driver-session-handoff';
const MAX_AGE_MS = 60_000;

export function stageDriverSession(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}) {
  if (!session.access_token || !session.refresh_token || !session.expires_at) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      token: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at * 1000,
      issuedAt: Date.now(),
    }));
  } catch {
    // Browsers that block tab storage can use the direct PWA login.
  }
}

export function readDriverSessionHandoff() {
  if (new URLSearchParams(location.search).get('live') !== '1') return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (!value || typeof value.issuedAt !== 'number') return null;
    const age = Date.now() - value.issuedAt;
    if (age < 0 || age > MAX_AGE_MS) return null;
    const { token, refreshToken, expiresAt } = value;
    if (typeof token !== 'string' || !token || typeof refreshToken !== 'string' || !refreshToken ||
        typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;
    return { token, refreshToken, expiresAt };
  } catch {
    return null;
  }
}

export function clearDriverSessionHandoff() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Tab storage is unavailable.
  }
}
