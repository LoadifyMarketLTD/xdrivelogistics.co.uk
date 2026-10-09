export type FeedbackBooking = {
  company_id?: string | null;
  awarded_carrier_company_id?: string | null;
  assigned_company_id?: string | null;
  current_status?: string | null;
  status?: string | null;
};

export type CanonicalFeedbackState = 'unavailable' | 'awaiting_feedback' | 'feedback_left';

const TERMINAL_FEEDBACK_STATUSES = new Set(['delivered', 'completed', 'cancelled']);

export function feedbackStatus(job: FeedbackBooking) {
  return String(job.current_status ?? job.status ?? '').trim().toLowerCase();
}

export function resolveFeedbackCounterpartyCompanyId(
  job: FeedbackBooking,
  reviewerCompanyId: string | null | undefined,
) {
  const reviewer = String(reviewerCompanyId ?? '').trim();
  if (!reviewer) return null;

  const ownerCompanyId = String(job.company_id ?? '').trim();
  const carrierCompanyId = String(job.awarded_carrier_company_id ?? job.assigned_company_id ?? '').trim();

  if (reviewer === ownerCompanyId && carrierCompanyId && carrierCompanyId !== reviewer) return carrierCompanyId;
  if (reviewer === carrierCompanyId && ownerCompanyId && ownerCompanyId !== reviewer) return ownerCompanyId;
  return null;
}

export function canLeaveCompanyFeedback(
  job: FeedbackBooking,
  reviewerCompanyId: string | null | undefined,
) {
  return TERMINAL_FEEDBACK_STATUSES.has(feedbackStatus(job))
    && Boolean(resolveFeedbackCounterpartyCompanyId(job, reviewerCompanyId));
}

export function canonicalFeedbackState(
  job: FeedbackBooking,
  reviewerCompanyId: string | null | undefined,
  hasFeedback: boolean,
): CanonicalFeedbackState {
  if (!canLeaveCompanyFeedback(job, reviewerCompanyId)) return 'unavailable';
  return hasFeedback ? 'feedback_left' : 'awaiting_feedback';
}

export function feedbackStateLabel(state: CanonicalFeedbackState) {
  if (state === 'awaiting_feedback') return 'Awaiting feedback';
  if (state === 'feedback_left') return 'Feedback left';
  return 'Feedback unavailable';
}
