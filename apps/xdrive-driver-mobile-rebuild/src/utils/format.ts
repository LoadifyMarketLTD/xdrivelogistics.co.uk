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
