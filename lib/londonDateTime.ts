const LONDON_TIME_ZONE = 'Europe/London';

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const londonParts = (instantMs: number): DateTimeParts => {
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(instantMs))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
};

const partsAsUtcMs = (parts: DateTimeParts) =>
  Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

export function londonLocalDateTimeToIso(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const target: DateTimeParts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: 0,
  };

  if (
    target.month < 1 || target.month > 12 ||
    target.day < 1 || target.day > 31 ||
    target.hour < 0 || target.hour > 23 ||
    target.minute < 0 || target.minute > 59
  ) return null;

  const targetWallMs = partsAsUtcMs(target);
  let instantMs = targetWallMs;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = londonParts(instantMs);
    const offsetMs = partsAsUtcMs(observed) - instantMs;
    const next = targetWallMs - offsetMs;
    if (next === instantMs) break;
    instantMs = next;
  }

  const verified = londonParts(instantMs);
  if (
    verified.year !== target.year ||
    verified.month !== target.month ||
    verified.day !== target.day ||
    verified.hour !== target.hour ||
    verified.minute !== target.minute
  ) return null;

  return new Date(instantMs).toISOString();
}

export { LONDON_TIME_ZONE };
