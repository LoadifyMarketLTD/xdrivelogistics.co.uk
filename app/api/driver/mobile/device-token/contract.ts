export type ParsedDeviceTokenRegisterBody = {
  token: string;
  platform: 'android';
  appPackage: string | null;
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseToken(value: unknown): string | null {
  const token = normalizeString(value);
  if (!token) return null;
  if (token.length < 20 || token.length > 4096) return null;
  return token;
}

export function parseDeviceTokenRegisterBody(body: unknown):
  | { ok: true; value: ParsedDeviceTokenRegisterBody }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }

  const payload = body as Record<string, unknown>;
  const keys = Object.keys(payload);
  const allowed = new Set(['token', 'platform', 'app_package']);
  if (keys.some((k) => !allowed.has(k))) {
    return { ok: false, error: 'Unknown request fields are not allowed.' };
  }

  const token = parseToken(payload.token);
  if (!token) {
    return { ok: false, error: 'token must be a non-empty string between 20 and 4096 chars.' };
  }

  const platformRaw = normalizeString(payload.platform || 'android').toLowerCase();
  if (platformRaw !== 'android') {
    return { ok: false, error: 'platform must be android.' };
  }

  const appPackageRaw = payload.app_package;
  let appPackage: string | null = null;
  if (appPackageRaw != null) {
    if (typeof appPackageRaw !== 'string') {
      return { ok: false, error: 'app_package must be a string when provided.' };
    }
    const trimmed = appPackageRaw.trim();
    if (!trimmed || trimmed.length > 255) {
      return { ok: false, error: 'app_package must be non-empty and <= 255 chars.' };
    }
    appPackage = trimmed;
  }

  return {
    ok: true,
    value: {
      token,
      platform: 'android',
      appPackage,
    },
  };
}

export function parseDeviceTokenUnregisterBody(body: unknown):
  | { ok: true; token: string }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const payload = body as Record<string, unknown>;
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'token') {
    return { ok: false, error: 'Only token is allowed for unregister requests.' };
  }
  const token = parseToken(payload.token);
  if (!token) {
    return { ok: false, error: 'token must be a non-empty string between 20 and 4096 chars.' };
  }
  return { ok: true, token };
}
