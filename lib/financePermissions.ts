export const PAYMENT_RECORDING_ROLES = new Set([
  'owner',
  'admin',
  'dispatcher',
  'finance',
] as const);

export const canRecordInvoicePayments = (role: string | null | undefined) =>
  Boolean(role && PAYMENT_RECORDING_ROLES.has(role as (typeof PAYMENT_RECORDING_ROLES extends Set<infer T> ? T : never)));
