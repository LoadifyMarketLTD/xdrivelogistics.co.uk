type AuditSourceRow = {
  status_history?: unknown;
  pod_generated_at?: string | null;
};

type CanonicalMobileStatus =
  | 'awarded'
  | 'on_my_way_pickup'
  | 'arrived_pickup'
  | 'loaded'
  | 'on_my_way_delivery'
  | 'arrived_delivery'
  | 'delivered'
  | 'pod_completed'
  | 'invoice_generated'
  | 'completed';

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validTimestamp(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mobileAuditStatus(value: unknown): CanonicalMobileStatus | null {
  const status = text(value)?.toLowerCase() ?? '';
  if (['awarded', 'allocated', 'assigned', 'accepted'].includes(status)) return 'awarded';
  if (status === 'on_my_way' || status === 'on_my_way_pickup') return 'on_my_way_pickup';
  if (status === 'on_site_pickup' || status === 'arrived_pickup') return 'arrived_pickup';
  if (status === 'loaded' || status === 'collected') return 'loaded';
  if (['in_transit', 'on_my_way_delivery', 'on_my_way_to_delivery', 'on_route_delivery'].includes(status)) return 'on_my_way_delivery';
  if (status === 'on_site_delivery' || status === 'arrived_delivery') return 'arrived_delivery';
  if (status === 'delivered') return 'delivered';
  if (status === 'pod_completed') return 'pod_completed';
  if (status === 'invoiced' || status === 'invoice_generated') return 'invoice_generated';
  if (status === 'completed') return 'completed';
  return null;
}

function historyRows(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

export function buildJobAuditTrail(row: AuditSourceRow) {
  const audit: Array<Record<string, unknown>> = [];

  for (const [index, entry] of historyRows(row.status_history).entries()) {
    const status = mobileAuditStatus(entry.status);
    const timestamp = validTimestamp(entry.timestamp ?? entry.created_at ?? entry.event_time);
    if (!status || !timestamp) continue;

    const source = text(entry.source)?.toLowerCase() ?? '';
    const driverSource = source === 'driver_atomic_rpc' || source === 'driver_mobile';
    audit.push({
      id: `history:${index}:${status}:${timestamp}`,
      status,
      user: driverSource ? 'Driver app' : 'Platform',
      role: driverSource ? 'driver' : (text(entry.role) ?? 'system'),
      timestamp,
      notes: text(entry.notes ?? entry.note ?? entry.message) ?? undefined,
    });
  }

  const podTimestamp = validTimestamp(row.pod_generated_at);
  if (podTimestamp && !audit.some((entry) => entry.status === 'pod_completed')) {
    audit.push({
      id: `pod:${podTimestamp}`,
      status: 'pod_completed',
      user: 'Driver app',
      role: 'driver',
      timestamp: podTimestamp,
    });
  }

  return audit.sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));
}
