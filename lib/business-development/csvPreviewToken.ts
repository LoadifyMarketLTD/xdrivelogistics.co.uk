import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_PREVIEW_AGE_SECONDS = 15 * 60;
const FUTURE_CLOCK_SKEW_SECONDS = 60;
const HEX_256 = /^[a-f0-9]{64}$/;

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Signed proof of a successful owner-only CSV preview. No server storage or
 * production writes. Never issue without a verified Platform Owner session.
 */
export function issueCrmCsvPreviewToken(
  sha256: string,
  ownerId: string,
  secret: string | undefined,
  atSeconds: number = Math.floor(Date.now() / 1000),
): string | null {
  if (!secret || secret.length < 32 || !HEX_256.test(sha256) ||
      !/^[0-9a-f-]{36}$/i.test(ownerId) || !Number.isSafeInteger(atSeconds)) return null;
  const body = ['v1', String(atSeconds), ownerId.toLowerCase(), sha256].join('.');
  return body + '.' + signature(body, secret);
}

export function verifyCrmCsvPreviewToken(
  token: unknown,
  sha256: string,
  ownerId: string,
  secret: string | undefined,
  atSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (typeof token !== 'string' || token.length > 250 || !secret ||
      secret.length < 32 || !HEX_256.test(sha256) ||
      !/^[0-9a-f-]{36}$/i.test(ownerId)) return false;
  const parts = token.split('.');
  if (parts.length !== 5) return false;
  const [version, stamp, signedOwner, signedDigest, providedMac] = parts;
  const issued = Number(stamp);
  if (version !== 'v1' || !/^\d{10}$/.test(stamp) ||
      !Number.isSafeInteger(issued) || !Number.isSafeInteger(atSeconds) ||
      issued > atSeconds + FUTURE_CLOCK_SKEW_SECONDS ||
      atSeconds - issued > MAX_PREVIEW_AGE_SECONDS ||
      signedOwner !== ownerId.toLowerCase() || signedDigest !== sha256 ||
      !HEX_256.test(providedMac)) return false;
  const payload = parts.slice(0, 4).join('.');
  const expected = Buffer.from(signature(payload, secret), 'hex');
  const received = Buffer.from(providedMac, 'hex');
  return timingSafeEqual(expected, received);
}
