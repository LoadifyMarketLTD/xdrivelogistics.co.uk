export function formatPaymentTermsLabel(value: string | null | undefined) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  const normalized = raw.toLowerCase().replace(/\s+/g, ' ');
  if (normalized === 'pay now' || normalized === 'immediate' || normalized === 'due on receipt') return 'Pay Now';

  const daysMatch = normalized.match(/^(\d+)\s*days?(?:\s*\(?(?:from\s+)?invoice(?:\s+date)?\)?)?$/i);
  if (daysMatch) {
    const days = Number(daysMatch[1]);
    if (Number.isFinite(days) && days > 0) return `${days} Days (From Invoice)`;
  }

  return raw;
}
