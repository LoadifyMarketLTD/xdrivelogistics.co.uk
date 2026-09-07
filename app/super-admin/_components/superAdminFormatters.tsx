'use client';

import {
  SuperAdminStatusBadge,
  type EnterpriseTone,
} from './SuperAdminEnterprisePrimitives';

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function routeSummary(
  pickupLocation: string | null | undefined,
  pickupPostcode: string | null | undefined,
  deliveryLocation: string | null | undefined,
  deliveryPostcode: string | null | undefined,
): string {  const pickup = [pickupLocation, pickupPostcode].filter(Boolean).join(' · ') || '—';
  const delivery = [deliveryLocation, deliveryPostcode].filter(Boolean).join(' · ') || '—';
  return `${pickup} → ${delivery}`;
}

const STATUS_TONES: Record<string, EnterpriseTone> = {
  draft: 'neutral',
  posted: 'info',
  allocated: 'info',
  in_transit: 'info',
  delivered: 'success',
  cancelled: 'danger',
  disputed: 'danger',
  active: 'success',
  available: 'success',
  ready: 'success',
  suspended: 'danger',
  critical: 'danger',
  rejected: 'danger',
  pending: 'warning',
  pending_approval: 'warning',
  attention: 'warning',
  paid: 'success',
  offline: 'neutral',
  fresh: 'success',
  aging: 'info',
  stale: 'warning',
  review: 'warning',
  clear: 'success',
  verified: 'success',
  blocked: 'danger',
  unavailable: 'unavailable',
  awaiting_assignment: 'neutral',
  not_assigned: 'neutral',
};

type StatusAllowlist = ReadonlySet<string> | readonly string[];

function normalizeAllowlist(values: StatusAllowlist): Set<string> {
  return new Set(Array.from(values, (value) => value.toLowerCase()));
}
export function StatusChip({
  value,
  allowedValues,
}: {
  value: string | null | undefined;
  allowedValues?: StatusAllowlist;
}) {
  const rawValue = (value ?? 'unknown').toString();
  const normalized = rawValue.toLowerCase();

  if (allowedValues && !normalizeAllowlist(allowedValues).has(normalized)) {
    return <span aria-label="Status unavailable">—</span>;
  }

  return (
    <SuperAdminStatusBadge
      label={rawValue.replaceAll('_', ' ')}
      tone={STATUS_TONES[normalized] ?? 'unavailable'}
    />
  );
}
