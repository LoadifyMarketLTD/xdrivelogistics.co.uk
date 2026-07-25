export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type ExpoPushTicketResult = {
  ok: boolean;
  retryable: boolean;
  invalidTokens: string[];
  error: string | null;
};

export const isExpoPushToken = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9+\-_=:/]+\]$/.test(value.trim());

export const buildExpoPushMessage = (to: string, payload: PushNotificationPayload) => ({
  to,
  sound: 'default',
  title: payload.title,
  body: payload.body,
  data: payload.data ?? {},
});

export function parseExpoPushResponse(
  body: unknown,
  tokens: string[]
): ExpoPushTicketResult {
  const rows = Array.isArray((body as { data?: unknown })?.data)
    ? ((body as { data: unknown[] }).data)
    : [];

  const invalidTokens: string[] = [];
  let retryable = false;
  const errors: string[] = [];

  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      retryable = true;
      errors.push('Malformed Expo push response.');
      return;
    }

    const ticket = row as {
      status?: unknown;
      message?: unknown;
      details?: { error?: unknown } | null;
    };

    if (ticket.status === 'ok') return;

    const token = tokens[index];
    const detailError = typeof ticket.details?.error === 'string' ? ticket.details.error : null;
    const message = typeof ticket.message === 'string' ? ticket.message : null;
    errors.push(detailError ?? message ?? 'Expo push rejected the notification.');

    if (detailError === 'DeviceNotRegistered' && token) {
      invalidTokens.push(token);
      return;
    }

    retryable = true;
  });

  return {
    ok: errors.length === 0,
    retryable,
    invalidTokens,
    error: errors.length > 0 ? errors.join(' | ') : null,
  };
}
