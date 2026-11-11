export type InvoiceDraft = {
  invoiceNumber: string
  jobId: string
  issuerName: string
  customerName: string
  issuedOn: string
  netPence: number
  vatRate: 0 | 10 | 20
  paymentTerms: string
}

export function invoiceTotals(draft: InvoiceDraft) {
  if (!Number.isSafeInteger(draft.netPence) || draft.netPence < 0) throw new Error('Invalid invoice net amount')
  if (![0, 10, 20].includes(draft.vatRate)) throw new Error('Invalid VAT rate')
  const vatPence = Math.round(draft.netPence * draft.vatRate / 100)
  return { netPence: draft.netPence, vatPence, grossPence: draft.netPence + vatPence }
}

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
}

export function validateInvoice(draft: InvoiceDraft): string | null {
  if (!draft.invoiceNumber.trim() || !draft.jobId.trim()) return 'Invoice number and job reference are required'
  if (!draft.issuerName.trim() || !draft.customerName.trim()) return 'Issuer and customer are required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.issuedOn) || Number.isNaN(Date.parse(draft.issuedOn))) return 'Valid issue date is required'
  if (!draft.paymentTerms.trim()) return 'Payment terms are required'
  try { invoiceTotals(draft) } catch { return 'Invalid amount or VAT rate' }
  return null
}
