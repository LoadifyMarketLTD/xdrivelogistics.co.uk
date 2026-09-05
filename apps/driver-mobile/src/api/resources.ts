import { apiRequest } from './client';

export type DriverAlert = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

export type DriverResources = {
  name: string;
  email: string;
  phone: string;
  driver: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  vehicle: Record<string, unknown> | null;
  quotes: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  alerts: DriverAlert[];
};

export async function fetchDriverResources(token: string) {
  return apiRequest<{ resources: DriverResources }>('/api/driver/mobile/resources', { token });
}

export async function markDriverNotificationRead(notificationId: string, token: string) {
  const id = notificationId.trim();
  if (!id) return;
  await apiRequest<{ ok: boolean }>('/api/driver/mobile/resources', {
    method: 'POST',
    token,
    body: {
      action: 'mark_notification_read',
      notificationId: id,
    },
  });
}
