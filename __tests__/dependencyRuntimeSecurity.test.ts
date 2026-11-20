import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Webhook } from 'svix';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../app/api/_lib/supabaseAdmin', () => ({ supabaseAdmin: { rpc } }));
import { POST } from '../app/api/payments/webhooks/email/route';

describe('dependency runtime security (XD-AUD-0016)', () => {
  const secret = 'whsec_' + Buffer.from('synthetic-test-only-webhook-secret-32bytes').toString('base64');
  const webhook = new Webhook(secret);
  const body = JSON.stringify({
    type: 'email.delivered', created_at: '2026-11-20T10:00:00.000Z',
    data: { email_id: 'synthetic_email', to: ['receiver@example.invalid'], tags: { xdrive_invoice: 'synthetic_invoice' } },
  });
  const id = 'msg_synthetic';
  const headers = (date: Date, payload = body) => ({
    'svix-id': id,
    'svix-timestamp': String(Math.floor(date.getTime() / 1000)),
    'svix-signature': webhook.sign(id, date, payload),
  });
  const request = (payload: string, h: Record<string, string>) =>
    new NextRequest('https://example.invalid/api/payments/webhooks/email', { method: 'POST', body: payload, headers: h });

  beforeEach(() => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', secret);
    rpc.mockReset().mockResolvedValue({ data: { received: true }, error: null });
  });

  it('verifies and processes a genuine signed event with the installed Svix implementation', async () => {
    const response = await POST(request(body, headers(new Date())));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('apply_invoice_email_event', {
      p_id: id, p_message: 'synthetic_email', p_type: 'email.delivered',
      p_created: '2026-11-20T10:00:00.000Z', p_recipient: 'receiver@example.invalid',
    });
  });
  it('rejects tampered payloads without touching finance', async () => {
    const response = await POST(request(body.replace('delivered', 'failed'), headers(new Date())));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects expired signed timestamps without touching finance', async () => {
    const response = await POST(request(body, headers(new Date(Date.now() - 600_000))));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects authenticated invalid JSON without touching finance', async () => {
    const raw = 'synthetic-invalid-json';
    const response = await POST(request(raw, headers(new Date(), raw)));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('keeps build runtime configuration aligned with Svix minimum engine', () => {
    const major = Number(readFileSync('.nvmrc', 'utf8').trim().split('.')[0]);
    expect(major).toBeGreaterThanOrEqual(22);
    expect(readFileSync('netlify.toml', 'utf8')).toContain('NODE_VERSION = "' + major + '"');
  });
});
