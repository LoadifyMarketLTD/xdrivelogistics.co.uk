const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidISOTimestamp(s: string): boolean {
  return ISO_TIMESTAMP_RE.test(s) && !isNaN(new Date(s).getTime());
}

function isValidUUID(s: string): boolean {
  return UUID_RE.test(s);
}

export function parseMessagesCursorParams(searchParams: URLSearchParams):
  | { ok: true; before: string | null; beforeId: string | null; limit: number }
  | { ok: false; error: string } {
  const before = searchParams.get('before');
  const beforeId = searchParams.get('before_id');
  const limitParam = searchParams.get('limit');

  if ((before === null) !== (beforeId === null)) {
    return { ok: false, error: 'Invalid cursor: before and before_id must be provided together.' };
  }
  if (before !== null && !isValidISOTimestamp(before)) {
    return { ok: false, error: 'Invalid cursor: before must be a valid ISO 8601 timestamp.' };
  }
  if (beforeId !== null && !isValidUUID(beforeId)) {
    return { ok: false, error: 'Invalid cursor: before_id must be a valid UUID.' };
  }

  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return { ok: false, error: 'Invalid limit: must be a finite integer.' };
    }
    if (parsed < 1 || parsed > 200) {
      return { ok: false, error: 'Invalid limit: must be between 1 and 200.' };
    }
  }

  return {
    ok: true,
    before,
    beforeId,
    limit: limitParam !== null ? Number(limitParam) : 50,
  };
}

export function buildMessagesCursorPredicate(before: string, beforeId: string): string {
  return `created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`;
}

export function parseMessagesMarkReadBody(body: unknown):
  | { ok: true; markAll: true; id: null }
  | { ok: true; markAll: false; id: string }
  | { ok: false; error: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const payload = body as Record<string, unknown>;
  const keys = Object.keys(payload);
  if (keys.some((k) => k !== 'id')) {
    return { ok: false, error: 'Unknown request fields are not allowed.' };
  }
  if (!('id' in payload)) return { ok: true, markAll: true, id: null };
  if (typeof payload.id !== 'string') {
    return { ok: false, error: 'Invalid message id: must be a string UUID.' };
  }
  const trimmed = payload.id.trim();
  if (!trimmed) {
    return { ok: false, error: 'Invalid message id: must not be blank.' };
  }
  if (!isValidUUID(trimmed)) {
    return { ok: false, error: 'Invalid message id: must be a valid UUID.' };
  }
  return { ok: true, markAll: false, id: trimmed };
}
