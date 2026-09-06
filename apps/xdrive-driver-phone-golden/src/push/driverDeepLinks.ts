export type DriverDeepLinkTarget =
  | { kind: 'job'; id: string }
  | { kind: 'load'; id: string };

function cleanEntityId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 160 || /[\s/?#]/.test(id)) return null;
  return id;
}

export function parseDriverDeepLink(rawUrl: unknown): DriverDeepLinkTarget | null {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;

  try {
    const url = new URL(rawUrl.trim());
    const scheme = url.protocol.replace(':', '').toLowerCase();
    const isXDriveScheme = ['xdrivedriver', 'xdrivedriver-preview', 'xdrive'].includes(scheme);
    const isTrustedWeb = url.protocol === 'https:' && (
      url.hostname === 'xdrivelogistics.co.uk' || url.hostname.endsWith('.xdrivelogistics.co.uk')
    );
    if (!isXDriveScheme && !isTrustedWeb) return null;

    const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));

    if (isXDriveScheme) {
      const route = url.hostname.toLowerCase();
      const id = cleanEntityId(segments[0]);
      if (!id) return null;
      if (route === 'jobs' || route === 'job' || route === 'bookings' || route === 'booking') return { kind: 'job', id };
      if (route === 'loads' || route === 'load') return { kind: 'load', id };
      return null;
    }

    const driverIndex = segments.findIndex((segment) => segment.toLowerCase() === 'driver');
    if (driverIndex < 0) return null;
    const route = String(segments[driverIndex + 1] ?? '').toLowerCase();
    const id = cleanEntityId(segments[driverIndex + 2]);
    if (!id) return null;
    if (route === 'jobs' || route === 'job' || route === 'bookings' || route === 'booking') return { kind: 'job', id };
    if (route === 'loads' || route === 'load') return { kind: 'load', id };
    return null;
  } catch {
    return null;
  }
}

export function targetFromNotificationData(data: unknown): DriverDeepLinkTarget | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;

  for (const key of ['deep_link', 'deepLink', 'url']) {
    const parsed = parseDriverDeepLink(record[key]);
    if (parsed) return parsed;
  }

  const jobId = cleanEntityId(record.job_id ?? record.jobId);
  if (jobId) return { kind: 'job', id: jobId };

  const loadId = cleanEntityId(record.load_id ?? record.loadId);
  if (loadId) return { kind: 'load', id: loadId };

  return null;
}
