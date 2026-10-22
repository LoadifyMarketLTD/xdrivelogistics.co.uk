import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  verified: null as unknown,
  verify: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('svix', () => ({
  Webhook: class {
    verify(payload: string, headers: Record<string, string>) {
      return state.verify(payload, headers);
    }
  },
}));

vi.mock('../app/api/_lib/supabaseAdmin', () => ({
  supabaseAdmin: { rpc: state.rpc },
}));

import { POST } from '../app/api/payments/webhooks/email/route';

const headers = {
  'svix-id': 'msg_test_event',
  'svix-timestamp': '1761000000',
  'svix-signature': 'v1,test',
};

function request(body: unknown, customHeaders: Record<string, string> = headers) {
  return new NextRequest('https://www.xdrivelogistics.co.uk/api/payments/webhooks/email', {
    method: 'POST',
    headers: customHeaders,
    body: JSON.stringify(body),
  });
}

describe('invoice email webhook', () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
    state.verify.mockReset();
    state.rpc.mockReset();
    state.verify.mockImplementation((payload: string) => JSON.parse(payload));
    state.rpc.mockResolvedValue({ data: { received: true }, error: null });
  });

  it('rejects missing signature headers before processing the body', async () => {
    const response = await POST(request({}, { 'svix-id': 'event' }));
    expect(response.status).toBe(400);
    expect(state.verify).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('rejects an invalid Svix signature', async () => {
    state.verify.mockImplementation(() => { throw new Error('bad signature'); });
    const response = await POST(request({ type: 'email.delivered' }));
    expect(response.status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('ignores unrelated Resend events', async () => {
    const response = await POST(request({
      type: 'email.opened',
      created_at: '2026-10-20T23:00:00.000Z',
      data: { email_id: 'email_1', to: ['customer@example.com'], tags: { xdrive_invoice: 'invoice_1' } },
    }));
    expect(response.status).toBe(200);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('ignores non-invoice emails even when the delivery event is tracked', async () => {
    const response = await POST(request({
      type: 'email.delivered',
      created_at: '2026-10-20T23:00:00.000Z',
      data: { email_id: 'email_1', to: ['customer@example.com'], tags: { category: 'other' } },
    }));
    expect(response.status).toBe(200);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('records a verified invoice delivery event using the provider message id and recipient', async () => {
    const response = await POST(request({
      type: 'email.delivered',
      created_at: '2026-10-20T23:00:00.000Z',
      data: { email_id: 'email_1', to: ['customer@example.com'], tags: { xdrive_invoice: 'invoice_1' } },
    }));
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith('apply_invoice_email_event', {
      p_id: 'msg_test_event',
      p_message: 'email_1',
      p_type: 'email.delivered',
      p_created: '2026-10-20T23:00:00.000Z',
      p_recipient: 'customer@example.com',
    });
  });

  it('returns 503 so Resend retries when finance reconciliation cannot be applied', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: 'retry' } });
    const response = await POST(request({
      type: 'email.bounced',
      created_at: '2026-10-20T23:00:00.000Z',
      data: { email_id: 'email_1', to: ['customer@example.com'], tags: { xdrive_invoice: 'invoice_1' } },
    }));
    expect(response.status).toBe(503);
  });
});
