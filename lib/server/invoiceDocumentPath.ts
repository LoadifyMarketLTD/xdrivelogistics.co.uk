/** Private invoice documents always belong to the issuing company. */
export function isInvoiceDocumentPath(value: unknown, companyId: string, invoiceId?: string) {
  if (typeof value !== 'string' || value !== value.trim() || value.length > 1024) return false;
  if (/[\\\\?#%\s]/.test(value) || value.includes('..') || value.includes('://')) return false;
  const parts = value.split('/');
  return parts.length >= 3 && parts.every(Boolean) && parts[0] === companyId
    && (!invoiceId || parts[1] === invoiceId);
}
