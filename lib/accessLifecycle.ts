export type AccessLifecycleState = 'active' | 'pending' | 'blocked' | 'unknown';
export type OnboardingLifecycleState = 'editable' | 'review' | 'approved' | 'rejected' | 'unknown';

const ACTIVE_ACCESS_STATUSES = new Set(['active', 'approved']);

const EDITABLE_ONBOARDING_STATUSES = new Set([
  'invited',
  'draft',
  'in_progress',
  'request_changes',
]);

const REVIEW_ONBOARDING_STATUSES = new Set([
  'submitted',
  'under_review',
  'compliance_review',
  'admin_approval',
]);

const PENDING_ACCESS_STATUSES = new Set([
  'pending',
  'pending_approval',
  ...EDITABLE_ONBOARDING_STATUSES,
  ...REVIEW_ONBOARDING_STATUSES,
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

export const classifyOnboardingLifecycleStatus = (raw: unknown): OnboardingLifecycleState => {
  const status = normalizeAccessStatus(raw);
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (EDITABLE_ONBOARDING_STATUSES.has(status)) return 'editable';
  if (REVIEW_ONBOARDING_STATUSES.has(status)) return 'review';
  return 'unknown';
};

export const getOnboardingLifecycleRoute = (raw: unknown): string | null => {
  const state = classifyOnboardingLifecycleStatus(raw);
  if (state === 'editable') return '/onboarding/resume';
  if (state === 'review') return '/pending-approval';
  if (state === 'rejected') return '/forbidden?reason=onboarding-rejected';
  return null;
};
