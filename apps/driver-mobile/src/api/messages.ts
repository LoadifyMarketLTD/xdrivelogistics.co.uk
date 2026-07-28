import { apiRequest } from './client';

export type DriverMessage = {
  id: string;
  event_type: string;
  entity_id: string | null;
  text: string | null;
  job_id: string | null;
  job_ref: string | null;
  status: string;
  created_at: string;
  read: boolean;
};

export type MessagesResponse = {
  messages: DriverMessage[];
  unread_count: number;
};

export type MarkReadResponse = {
  ok: boolean;
  /** Updated row for mark-one; null for mark-all. */
  message: { id: string; read: boolean } | null;
  /** Authoritative total unread count after the update. */
  unread_count: number;
};

export type FetchMessagesOptions = {
  /** ISO timestamp of the last row on the previous page. Used alone for the first cursor field. */
  before?: string;
  /** UUID of the last row on the previous page. Must be combined with `before` for lossless pagination. */
  beforeId?: string;
  /** Page size (1–200). Server clamps the value; defaults to 50. */
  limit?: number;
};

/**
 * Fetches dispatcher messages via the authenticated server API.
 *
 * Uses the two-field (created_at, id) exclusive cursor when both `before` and
 * `beforeId` are supplied, ensuring lossless pagination even when multiple rows
 * share the same `created_at` timestamp.
 */
export async function fetchMessages(token: string, options: FetchMessagesOptions = {}): Promise<MessagesResponse> {
  const { before, beforeId, limit } = options;
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (beforeId) params.set('before_id', beforeId);
  if (limit != null) params.set('limit', String(limit));
  const query = params.toString();
  const path = query ? `/api/driver/mobile/messages?${query}` : '/api/driver/mobile/messages';
  return apiRequest<MessagesResponse>(path, { token });
}

/**
 * Marks one or all messages as read via the server API.
 * Returns the authoritative server result including the new unread_count.
 * The caller must apply the returned unread_count, not compute it locally.
 */
export async function markMessagesRead(token: string, id?: string): Promise<MarkReadResponse> {
  return apiRequest<MarkReadResponse>('/api/driver/mobile/messages', {
    token,
    method: 'POST',
    body: id ? { id } : {},
  });
}
