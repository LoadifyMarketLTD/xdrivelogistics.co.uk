import { classifyWorkspaceJobStage, type WorkspaceStageJob } from '../jobs/workspaceJobStage';

export type CanonicalDiaryBucket =
  | 'all'
  | 'open'
  | 'awaiting_award'
  | 'awarded'
  | 'unallocated'
  | 'allocated'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'awaiting_feedback'
  | 'recent_feedback'
  | 'evidence';

export type CanonicalDiaryRole =
  | 'customer'
  | 'broker'
  | 'carrier'
  | 'fleet_manager'
  | 'dispatcher'
  | 'owner_driver'
  | 'driver';

export type CanonicalDiaryJob = WorkspaceStageJob & {
  pod_generated?: boolean | null;
};

export type CanonicalDiaryContext = {
  hasSubmittedQuote?: boolean;
  hasFeedback?: boolean;
  feedbackEligible?: boolean;
  hasEvidence?: boolean;
};

export type CanonicalDiaryTab = {
  id: CanonicalDiaryBucket;
  label: string;
};

const BASE_OPERATIONAL_TABS: CanonicalDiaryTab[] = [
  { id: 'all', label: 'All' },
  { id: 'unallocated', label: 'Unallocated' },
  { id: 'allocated', label: 'Allocated' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' },
  { id: 'awaiting_feedback', label: 'Awaiting Feedback' },
  { id: 'recent_feedback', label: 'Recent Feedback' },
  { id: 'evidence', label: 'POD / Evidence' },
];

export const CANONICAL_DIARY_TABS_BY_ROLE: Record<CanonicalDiaryRole, CanonicalDiaryTab[]> = {
  customer: [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'awaiting_award', label: 'Awaiting Award' },
    { id: 'awarded', label: 'Awarded' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'expired', label: 'Expired' },
    { id: 'awaiting_feedback', label: 'Awaiting Feedback' },
    { id: 'recent_feedback', label: 'Recent Feedback' },
    { id: 'evidence', label: 'POD / Evidence' },
  ],
  broker: BASE_OPERATIONAL_TABS,
  carrier: BASE_OPERATIONAL_TABS,
  fleet_manager: BASE_OPERATIONAL_TABS,
  dispatcher: [
    { id: 'all', label: 'All' },
    { id: 'unallocated', label: 'Unallocated' },
    { id: 'allocated', label: 'Allocated' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'evidence', label: 'POD / Evidence' },
  ],
  owner_driver: BASE_OPERATIONAL_TABS,
  driver: [
    { id: 'all', label: 'All' },
    { id: 'allocated', label: 'Accepted' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ],
};

export function getCanonicalDiaryTabs(role: CanonicalDiaryRole) {
  return CANONICAL_DIARY_TABS_BY_ROLE[role];
}

export function matchesCanonicalDiaryBucket(
  job: CanonicalDiaryJob,
  bucket: CanonicalDiaryBucket,
  context: CanonicalDiaryContext = {},
) {
  if (bucket === 'all') return true;

  const stage = classifyWorkspaceJobStage(job);
  const hasFeedback = context.hasFeedback === true;
  const feedbackEligible = context.feedbackEligible !== false;
  const hasEvidence = context.hasEvidence === true || job.pod_generated === true;

  if (bucket === 'open') return stage === 'open' && context.hasSubmittedQuote !== true;
  if (bucket === 'awaiting_award') return stage === 'open' && context.hasSubmittedQuote === true;
  if (bucket === 'awarded') return stage === 'awarded' || stage === 'allocated';
  if (bucket === 'unallocated') return (stage === 'awarded' || stage === 'allocated') && !job.assigned_driver_id;
  if (bucket === 'allocated') return (stage === 'awarded' || stage === 'allocated') && Boolean(job.assigned_driver_id);
  if (bucket === 'in_progress') return stage === 'in_progress';
  if (bucket === 'completed') return stage === 'completed';
  if (bucket === 'cancelled') return stage === 'cancelled' || stage === 'disputed';
  if (bucket === 'expired') return stage === 'expired';
  if (bucket === 'awaiting_feedback') return stage === 'completed' && feedbackEligible && !hasFeedback;
  if (bucket === 'recent_feedback') return hasFeedback;
  return stage === 'completed' && hasEvidence;
}
