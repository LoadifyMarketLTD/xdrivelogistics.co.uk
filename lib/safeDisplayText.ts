/**
 * Safe display formatter for customer-visible text fields.
 *
 * Rules:
 * - string  → trimmed value, or fallback if empty
 * - finite number → String(value)
 * - null / undefined / '' → fallback
 * - object / array / boolean / NaN / Infinity → fallback
 *   (prevents raw JSON or "[object Object]" leaking into customer UI)
 */
export function safeDisplayText(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  return fallback;
}
