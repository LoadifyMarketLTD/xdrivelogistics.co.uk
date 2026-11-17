export type DriverRecord = Record<string, unknown>

export const asRecord = (value: unknown): DriverRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as DriverRecord : {}

export const asRows = (value: unknown): DriverRecord[] =>
  Array.isArray(value) ? value.filter((item): item is DriverRecord =>
    Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []

export const textValue = (value: unknown, fallback = 'Not provided'): string =>
  typeof value === 'string' && value.trim() ? value.trim() :
    typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback

export const positiveNumber = (value: unknown, fallback: number): number => {
  const valueNumber = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(valueNumber) && valueNumber > 0 ? valueNumber : fallback
}

const lookup: Record<string, string> = {
  certificate_of_insurance: 'Insurance certificate',
  goods_in_transit_insurance: 'Goods in Transit insurance',
  goods_in_transit: 'Goods in Transit insurance',
  public_liability_insurance: 'Public liability insurance',
  driving_licence: 'Driving licence',
  driver_licence: 'Driving licence',
  vehicle_insurance: 'Vehicle insurance',
  mot_certificate: 'MOT certificate',
  mot: 'MOT certificate',
  proof_of_address: 'Proof of address',
  operator_licence: 'Operator licence',
  job_assigned: 'Job assigned',
  exception_pod_alert: 'POD requires attention',
  exception_finance_alert: 'Invoice requires attention',
  unread: 'Unread',
  approved: 'Approved',
  rejected: 'Rejected',
  pending: 'Pending review',
  expired: 'Expired',
  available: 'Available',
  offline: 'Unavailable',
  busy: 'Busy',
}
export function readableLabel(value: unknown, fallback = 'Other'): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const key = value.trim().replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase()
  return lookup[key] ?? key.split('_').filter(Boolean).map(word => word[0].toUpperCase()+word.slice(1)).join(' ')
}

export function dateLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Not provided'
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value+'T12:00:00Z') : new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not provided' : parsed.toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric'})
}
export function dateTimeLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Not provided'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not provided' : parsed.toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
}
export function expiryLabel(expiry: unknown, now = Date.now()): 'Expired' | 'Expiring soon' | 'Valid' | 'No expiry recorded' {
  if (typeof expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return 'No expiry recorded'
  const date = Date.parse(expiry+'T23:59:59Z')
  if (!Number.isFinite(date)) return 'No expiry recorded'
  if (date < now) return 'Expired'
  return date - now < 30*86400_000 ? 'Expiring soon' : 'Valid'
}
export const yesNo = (v: unknown) => v === true ? 'Yes' : v === false ? 'No' : 'Not provided'
export const moneyLabel = (value: unknown, currency: unknown = 'GBP') => {
  if (value == null || value === '') return 'Not provided'
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Not provided'
  return new Intl.NumberFormat('en-GB',{style:'currency',currency: typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'GBP'}).format(n)
}
