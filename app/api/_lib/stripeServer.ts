import crypto from 'node:crypto';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export const isStripeServerConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());

const requireSecret = () => {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return secret;
};

const encode = (value: Record<string, string | number | boolean | null | undefined>) => {
  const body = new URLSearchParams();
  Object.entries(value).forEach(([key, item]) => {
    if (item === null || item === undefined) return;
    body.set(key, String(item));
  });
  return body;
};

export async function stripeRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    params?: Record<string, string | number | boolean | null | undefined>;
    connectedAccount?: string | null;
    idempotencyKey?: string | null;
  } = {},
): Promise<T> {
  const method = options.method ?? 'POST';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireSecret()}`,
  };
  if (options.connectedAccount) headers['Stripe-Account'] = options.connectedAccount;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let url = `${STRIPE_API_BASE}${path}`;
  let body: URLSearchParams | undefined;
  if (options.params) {
    const encoded = encode(options.params);
    if (method === 'GET') url += `?${encoded.toString()}`;
    else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = encoded;
    }
  }

  const response = await fetch(url, { method, headers, body, cache: 'no-store' });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } };
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Stripe request failed (${response.status}).`);
    Object.assign(error, { stripeCode: payload.error?.code, status: response.status });
    throw error;
  }
  return payload;
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader || !secret) return false;
  const fields = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = fields.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = fields.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const toleranceSeconds = 300;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  return signatures.some((candidate) => {
    try {
      const a = Buffer.from(candidate, 'hex');
      const b = Buffer.from(expected, 'hex');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}
