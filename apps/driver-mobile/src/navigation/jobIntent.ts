const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validJobId(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

export function jobIdFromUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const segments = url.pathname.split('/').filter(Boolean);

    // xdrivedriver://job/<uuid> parses "job" as the host.
    if (url.protocol === 'xdrivedriver:' && url.hostname.toLowerCase() === 'job') {
      return validJobId(segments[0]);
    }

    const jobSegment = segments.findIndex((segment) => segment.toLowerCase() === 'jobs' || segment.toLowerCase() === 'job');
    if (jobSegment >= 0) return validJobId(segments[jobSegment + 1]);
    return validJobId(url.searchParams.get('job_id')) || validJobId(url.searchParams.get('jobId'));
  } catch {
    return null;
  }
}

export function jobIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;

  const direct = validJobId(payload.job_id) || validJobId(payload.jobId);
  if (direct) return direct;

  if (String(payload.entity_type ?? '').trim().toLowerCase() === 'job') {
    const entity = validJobId(payload.entity_id);
    if (entity) return entity;
  }

  return jobIdFromUrl(payload.url) || jobIdFromUrl(payload.deep_link) || jobIdFromUrl(payload.deepLink);
}
