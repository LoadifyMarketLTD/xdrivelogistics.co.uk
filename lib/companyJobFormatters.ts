/**
 * Canonical shared formatters for the company workspace.
 *
 * All admin/company pages must use these instead of local ad-hoc formatters,
 * `.replace(/_/g, ' ')` calls or duplicated date/currency logic.
 */

import { VEHICLE_TYPE_LABELS } from './vehicleTypes';

// ── Safe primitives ───────────────────────────────────────────────────────────

/**
 * Returns a trimmed string from any value.
 * Objects, arrays and other non-strings always produce ''.
 */
export function safeStr(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return '';
}

/**
 * Returns a display-safe string, falling back to `fallback` (default '—').
 */
export function displayText(value: unknown, fallback = '—'): string {
  const s = safeStr(value);
  return s.length > 0 ? s : fallback;
}

// ── Location / route ──────────────────────────────────────────────────────────

/**
 * Formats a location for compact display.  Extracts the first significant
 * segment (town / city) from a full address string so rows stay compact.
 *
 * e.g. "Unit 5, Trafford Park, Manchester, M17 1QE" → "Manchester"
 */
export function formatLocationSummary(location: unknown): string {
  const s = safeStr(location);
  if (!s) return '—';
  // Split on commas, return the last non-postcode, non-empty segment
  const parts = s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return '—';
  // Walk from the end, skip obvious postcodes (UK pattern: letters + numbers)
  const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!postcodePattern.test(parts[i])) return parts[i];
  }
  return parts[0];
}

/**
 * Formats a postcode to uppercase and trims whitespace.
 */
export function formatPostcode(postcode: unknown): string {
  return safeStr(postcode).toUpperCase() || '—';
}

/**
 * Formats a route as "FROM → TO" using location summaries.
 */
export function formatRoute(from: unknown, to: unknown): string {
  const f = formatLocationSummary(from);
  const t = formatLocationSummary(to);
  if (f === '—' && t === '—') return '—';
  return `${f} → ${t}`;
}

/**
 * Formats pickup/delivery postcodes as "PC1 → PC2".
 */
export function formatPostcodeRoute(fromPostcode: unknown, toPostcode: unknown): string {
  const f = formatPostcode(fromPostcode);
  const t = formatPostcode(toPostcode);
  if (f === '—' && t === '—') return '—';
  return `${f} → ${t}`;
}

// ── Date / time ───────────────────────────────────────────────────────────────

/**
 * Formats an ISO-8601 datetime string to "DD Mon YYYY" (e.g. "14 Jan 2025").
 */
export function formatDate(iso: unknown): string {
  const s = safeStr(iso);
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Formats an ISO-8601 datetime string to "DD Mon YY, HH:mm" (compact).
 */
export function formatDatetime(iso: unknown): string {
  const s = safeStr(iso);
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart}, ${timePart}`;
}

/**
 * Formats a date to "DD Mon" — useful for compact columns where the year is
 * implied by context.
 */
export function formatDateShort(iso: unknown): string {
  const s = safeStr(iso);
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Returns ISO-8601 time as "HH:mm" or '—'.
 */
export function formatTime(iso: unknown): string {
  const s = safeStr(iso);
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── Currency ──────────────────────────────────────────────────────────────────

/**
 * Formats a numeric amount as GBP (e.g. "£1,250.00").
 * Null / undefined / NaN → '—'.
 */
export function formatCurrency(amount: number | null | undefined, currency = 'GBP'): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Vehicle ───────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable vehicle label from a slug.
 * Falls back to title-casing the slug (replacing underscores/hyphens with spaces).
 */
export function formatVehicleLabel(key: unknown): string {
  const k = safeStr(key);
  if (!k) return '—';
  if (VEHICLE_TYPE_LABELS[k]) return VEHICLE_TYPE_LABELS[k];
  // Safe fallback: title-case slug
  return k
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Distance ─────────────────────────────────────────────────────────────────

/**
 * Formats miles to "X mi" or '—'.
 */
export function formatDistance(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles) || miles < 0) return '—';
  return `${Math.round(miles)} mi`;
}

// ── Dimensions / weight ───────────────────────────────────────────────────────

/**
 * Formats L×W×H dimensions in cm, or '—' if all are null.
 */
export function formatDimensions(
  lengthCm: number | null | undefined,
  widthCm: number | null | undefined,
  heightCm: number | null | undefined,
): string {
  const parts = [lengthCm, widthCm, heightCm];
  if (parts.every((p) => p == null)) return '—';
  return parts.map((p) => (p == null ? '?' : String(p))).join(' × ') + ' cm';
}

/**
 * Formats weight in kg to "X kg" or '—'.
 */
export function formatWeight(kg: number | null | undefined): string {
  if (kg == null || !Number.isFinite(kg)) return '—';
  return `${kg.toLocaleString('en-GB')} kg`;
}

// ── Job reference ─────────────────────────────────────────────────────────────

/**
 * Generates a compact job reference from an id, e.g. "JOB-A1B2C3".
 */
export function formatJobRef(id: string | null | undefined, existingRef?: string | null): string {
  const existing = safeStr(existingRef);
  if (existing) return existing;
  const safeId = safeStr(id);
  if (!safeId) return 'N/A';
  return `JOB-${safeId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}
