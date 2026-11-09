/** Billing PDFs are not proof-of-delivery documents. Keep their source records
 * unchanged for audit, but never embed a prior XDrive invoice inside a new one. */
export const isUnrelatedXDriveInvoicePdf = (storagePath: string): boolean => {
  const name = storagePath.split('/').pop()?.toLowerCase() ?? '';
  return name.endsWith('.pdf') && /(?:^|[-_])xdrive[-_]?(?:invoice|inv)(?:[-_]|\.)/.test(name);
};
