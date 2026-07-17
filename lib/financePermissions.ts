const PAYMENT_RECORDING_ROLE_VALUES = [
  'owner',
  'admin',
  'dispatcher',
  'finance',
] as const;

export type PaymentRecordingRole = (typeof PAYMENT_RECORDING_ROLE_VALUES)[number];

export const PAYMENT_RECORDING_ROLES = new Set<PaymentRecordingRole>(PAYMENT_RECORDING_ROLE_VALUES);

export const canRecordInvoicePayments = (role: string | null | undefined) =>
  Boolean(role && PAYMENT_RECORDING_ROLES.has(role as PaymentRecordingRole));
