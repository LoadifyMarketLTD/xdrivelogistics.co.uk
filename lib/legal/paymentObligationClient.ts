import { BOOKING_PAYMENT_OBLIGATION_ACKNOWLEDGEMENT_TEXT } from './paymentObligation';

export function confirmBookingPaymentObligation(): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(`${BOOKING_PAYMENT_OBLIGATION_ACKNOWLEDGEMENT_TEXT}\n\nSelect OK to acknowledge and continue with the award.`);
}

export const bookingPaymentObligationRequestBody = JSON.stringify({
  paymentObligationAcknowledged: true,
});
