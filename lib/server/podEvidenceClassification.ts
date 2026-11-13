/** Previous XDrive invoices accidentally uploaded as POD evidence are not delivery evidence. */
export function isUnrelatedXDriveInvoicePdf(storagePath: string): boolean {
  const fileName=storagePath.split('/').pop()?.toLowerCase()??'';
  return fileName.endsWith('.pdf') && /(?:^|[-_])xdrive[-_]?(?:invoice|inv)(?:[-_]|\.)/.test(fileName);
}
