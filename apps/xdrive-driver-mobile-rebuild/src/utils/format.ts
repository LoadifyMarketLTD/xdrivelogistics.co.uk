export function formatDeliveryDate(value?: string) {
  if (!value) return 'Date TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace(',', ' •');
  } catch {
    return value;
  }
}

export function formatRouteTime(value?: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'TBC';
  if (raw.toUpperCase() === 'ASAP') return 'ASAP';
  const clock = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) {
    const hour = clock[1] ?? '';
    const minute = clock[2] ?? '';
    return hour.padStart(2, '0') + ':' + minute;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  } catch {
    return raw;
  }
}
