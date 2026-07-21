export type AccessLifecycleState = 'active' | 'pending' | 'blocked' | 'unknown';

const ACTIVE_ACCESS_STATUSES = new Set(['active', 'approved']);

const PENDING_ACCESS_STATUSES = new Set([
  'pending',
  'pending_approval',
  'invited',
  'draft',
  'in_progress',
  'request_changes',
  'submitted',
  'under_review',
  'compliance_review',
  'admin_approval',
]);

const BLOCKED_ACCESS_STATUSES = new Set([
  'blocked',
  'suspended',
  'inactive',
  'disabled',
  'rejected',
]);

export const normalizeAccessStatus = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().toLowerCase() : '';

export const classifyAccessLifecycleStatus = (raw: unknown): AccessLifecycleState => {
  const status = normalizeAccessStatus(raw);
  if (ACTIVE_ACCESS_STATUSES.has(status)) return 'active';
  if (PENDING_ACCESS_STATUSES.has(status)) return 'pending';
  if (BLOCKED_ACCESS_STATUSES.has(status)) return 'blocked';
  return 'unknown';
};
