/**
 * Recover the date/time of an already-confirmed delivery for an older POD
 * draft, without inventing a timestamp or replacing an explicit saved value.
 */
export type DeliveredEvent = { status: string; at: string };

const isTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function recoverDeliveredTime(
  stored: unknown,
  previous: unknown,
  statusHistory: readonly DeliveredEvent[],
  deliveredOn: unknown,
): string {
  if (isTime(stored)) return stored;
  if (isTime(previous)) return previous;
  if (typeof deliveredOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deliveredOn)) return '';
  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });
  const delivered = statusHistory
    .filter(event => /^delivered$/i.test(String(event.status).trim()))
    .map(event => new Date(event.at))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  for (const when of delivered) {
    const parts = dateFmt.formatToParts(when);
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;
    if (`${year}-${month}-${day}` !== deliveredOn) continue;
    const hm = timeFmt.format(when);
    if (isTime(hm)) return hm;
  }
  return '';
}
