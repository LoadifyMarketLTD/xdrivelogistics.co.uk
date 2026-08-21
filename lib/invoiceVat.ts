export const INVOICE_VAT_TREATMENTS = [
  'standard',
  'reduced',
  'zero_rated',
  'reverse_charge',
  'not_registered',
] as const;

export type InvoiceVatTreatment = typeof INVOICE_VAT_TREATMENTS[number];

export const normalizeInvoiceVatTreatment = (
  value: unknown,
): InvoiceVatTreatment | null => {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';

  if (normalized === 'standard' || normalized === 'standard_rate') return 'standard';
  if (normalized === 'reduced' || normalized === 'reduced_rate') return 'reduced';
  if (normalized === 'zero' || normalized === 'zero_rate' || normalized === 'zero_rated') return 'zero_rated';
  if (normalized === 'reverse_charge' || normalized === 'reversecharge') return 'reverse_charge';
  if (
    normalized === 'not_registered'
    || normalized === 'not_vat_registered'
    || normalized === 'non_vat_registered'
  ) return 'not_registered';

  return null;
};

export const expectedVatRateForTreatment = (
  treatment: InvoiceVatTreatment,
  reverseChargeRate: number | null = null,
): 0 | 5 | 20 | null => {
  if (treatment === 'standard') return 20;
  if (treatment === 'reduced') return 5;
  if (treatment === 'zero_rated' || treatment === 'not_registered') return 0;
  return reverseChargeRate === 5 || reverseChargeRate === 20 ? reverseChargeRate : null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export type InvoiceVatTotals = {
  treatment: InvoiceVatTreatment;
  netAmount: number;
  vatRate: 0 | 5 | 20;
  vatAmount: number;
  totalAmount: number;
};

export const calculateInvoiceVatTotals = ({
  netAmount,
  treatment,
  reverseChargeRate,
}: {
  netAmount: number;
  treatment: InvoiceVatTreatment;
  reverseChargeRate?: 5 | 20 | null;
}): InvoiceVatTotals => {
  if (!Number.isFinite(netAmount) || netAmount <= 0) {
    throw new Error('Invoice net amount must be positive.');
  }

  const vatRate = expectedVatRateForTreatment(treatment, reverseChargeRate ?? null);
  if (vatRate === null) throw new Error('Reverse charge requires an underlying VAT rate of 5% or 20%.');

  const vatAmount = roundMoney(netAmount * (vatRate / 100));
  const totalAmount = treatment === 'reverse_charge'
    ? roundMoney(netAmount)
    : roundMoney(netAmount + vatAmount);

  return {
    treatment,
    netAmount: roundMoney(netAmount),
    vatRate,
    vatAmount,
    totalAmount,
  };
};

export const validateInvoiceVatTotals = ({
  netAmount,
  vatAmount,
  vatRate,
  totalAmount,
  treatment,
}: {
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  totalAmount: number;
  treatment: InvoiceVatTreatment;
}) => {
  if (!Number.isFinite(netAmount) || netAmount <= 0) return false;
  if (!Number.isFinite(vatAmount) || vatAmount < 0) return false;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return false;
  if (![0, 5, 20].includes(vatRate)) return false;

  const expectedRate = expectedVatRateForTreatment(
    treatment,
    treatment === 'reverse_charge' && (vatRate === 5 || vatRate === 20) ? vatRate : null,
  );
  if (expectedRate === null || vatRate !== expectedRate) return false;

  const expectedVat = roundMoney(netAmount * (vatRate / 100));
  if (Math.abs(vatAmount - expectedVat) > 0.01) return false;

  const expectedTotal = treatment === 'reverse_charge'
    ? roundMoney(netAmount)
    : roundMoney(netAmount + expectedVat);

  return Math.abs(totalAmount - expectedTotal) <= 0.01;
};

export const vatTreatmentLabel = (treatment: InvoiceVatTreatment) => {
  if (treatment === 'standard') return 'Standard rate';
  if (treatment === 'reduced') return 'Reduced rate';
  if (treatment === 'zero_rated') return 'Zero-rated';
  if (treatment === 'reverse_charge') return 'Reverse charge';
  return 'Not VAT registered';
};
