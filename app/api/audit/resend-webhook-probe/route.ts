import { NextResponse } from 'next/server';

export async function POST() {

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'Resend is not configured.' }, { status: 503 });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'pr680-resend-webhook-probe-v1',
    },
    body: JSON.stringify({
      from: 'no-reply@xdrivelogistics.co.uk',
      to: ['dannyelbill447@gmail.com'],
      subject: 'PR680 Resend webhook probe',
      text: 'Temporary deploy-preview-only webhook certification probe for PR #680.',
      tags: [{ name: 'xdrive_audit', value: 'pr680' }],
    }),
  });

  const payload = await response.json().catch(() => null) as { id?: string; message?: string } | null;
  return NextResponse.json(
    { ok: response.ok, providerStatus: response.status, providerMessageId: payload?.id ?? null, providerMessage: payload?.message ?? null },
    { status: response.ok ? 200 : 502 },
  );
}
