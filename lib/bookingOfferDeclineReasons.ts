export const BOOKING_DECLINE_REASONS = {
  already_committed: 'Already committed to another job',
  no_longer_available: 'No longer available',
  schedule_conflict: 'Collection or delivery time conflict',
  unsuitable_vehicle: 'Vehicle or equipment unsuitable',
  other: 'Other operational reason',
} as const;

export type BookingDeclineReasonCode = keyof typeof BOOKING_DECLINE_REASONS;

export function bookingDeclineReasonText(code: BookingDeclineReasonCode, detail?: string | null): string {
  const label = BOOKING_DECLINE_REASONS[code];
  const cleaned = (detail ?? '').trim();
  return cleaned ? `${label} — ${cleaned}` : label;
}
