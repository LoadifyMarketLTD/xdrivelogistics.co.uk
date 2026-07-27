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

export async function fetchMessages(token: string, before?: string): Promise<MessagesResponse> {
  const path = before
    ? `/api/driver/mobile/messages?before=${encodeURIComponent(before)}`
    : '/api/driver/mobile/messages';
  return apiRequest<MessagesResponse>(path, { token });
}

export async function markMessagesRead(token: string, id?: string): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/driver/mobile/messages', {
    token,
    method: 'POST',
    body: id ? { id } : {},
  });
}
