import { COMPANY_CONFIG, type PaymentTerm } from '../app/config/company';

export type PaymentExtensionDays = 0 | 15;

export const XDRIVE_PAYMENT_TERMS = COMPANY_CONFIG.payment.terms;
export const XDRIVE_SPECIAL_EXTENSION_DAYS = COMPANY_CONFIG.payment.specialExtensionDays;

export const normalizeXDrivePaymentTerm = (
  value: string | null | undefined,
): PaymentTerm | null => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized === 'pay now' ||
    normalized === 'immediate' ||
    normalized === 'due on receipt'
  ) {
    return 'Pay now';
  }

  if (normalized === '14 days' || normalized === '14 day' || normalized === 'net 14') {
    return '14 days';
  }

  if (normalized === '30 days' || normalized === '30 day' || normalized === 'net 30') {
    return '30 days';
  }

  return null;
};

export const paymentTermDays = (paymentTerm: PaymentTerm): 0 | 14 | 30 => {
  if (paymentTerm === 'Pay now') return 0;
  return paymentTerm === '14 days' ? 14 : 30;
};

export const computeInvoiceDueDate = (
  invoiceDate: string,
  paymentTerm: PaymentTerm,
  extensionDays: PaymentExtensionDays = 0,
) => {
  if (extensionDays !== 0 && extensionDays !== XDRIVE_SPECIAL_EXTENSION_DAYS) {
    throw new Error('XDrive payment extensions may only be 15 days.');
  }

  const base = new Date(`${invoiceDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) throw new Error('Invoice date is invalid.');

  base.setUTCDate(base.getUTCDate() + paymentTermDays(paymentTerm) + extensionDays);
  return base.toISOString().slice(0, 10);
};
