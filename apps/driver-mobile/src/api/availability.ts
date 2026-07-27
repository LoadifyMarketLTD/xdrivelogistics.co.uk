import { apiRequest } from './client';

export type AvailabilityStatus = 'available' | 'busy' | 'offline';

export type AvailabilitySlot = {
  day_of_week: number; // 0 = Monday, 6 = Sunday
  slot: 'AM' | 'PM' | 'EVENING';
  available: boolean;
};

export type DriverAvailability = {
  availability_status: AvailabilityStatus;
  slots: AvailabilitySlot[];
};

export async function fetchAvailability(token: string): Promise<DriverAvailability> {
  return apiRequest<DriverAvailability>('/api/driver/mobile/availability', { token });
}

export async function updateAvailability(
  token: string,
  patch: { availability_status?: AvailabilityStatus; slots?: AvailabilitySlot[] },
): Promise<DriverAvailability> {
  return apiRequest<DriverAvailability>('/api/driver/mobile/availability', {
    token,
    method: 'PUT',
    body: patch,
  });
}
