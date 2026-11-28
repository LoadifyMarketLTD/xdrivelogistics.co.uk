/** Invoice descriptions are customer-facing. Structured load data stays on the job. */
export function invoiceDescriptionText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.startsWith('{') || text.startsWith('[') ? '' : text;
}
