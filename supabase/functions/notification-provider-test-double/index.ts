const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const stableId = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `mock_${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const authorization = request.headers.get('authorization') ?? '';
  if (authorization !== 'Bearer staging-notification-provider-key') {
    return json(401, { error: 'Invalid provider credential.' });
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
  if (!idempotencyKey || idempotencyKey.length > 256) {
    return json(400, { error: 'A valid Idempotency-Key header is required.' });
  }

  const body = await request.json().catch(() => null) as {
    to?: unknown;
    subject?: unknown;
    html?: unknown;
  } | null;
  const recipients = Array.isArray(body?.to) ? body?.to : [body?.to];
  const email = recipients.find((value): value is string => typeof value === 'string') ?? '';

  if (!email || typeof body?.subject !== 'string' || typeof body?.html !== 'string') {
    return json(400, { error: 'Invalid provider payload.' });
  }

  if (email.includes('retry-fail')) {
    return json(503, { error: 'Deterministic staging provider failure.' });
  }

  return json(200, {
    id: stableId(idempotencyKey),
    accepted: true,
    idempotency_key: idempotencyKey,
  });
});
