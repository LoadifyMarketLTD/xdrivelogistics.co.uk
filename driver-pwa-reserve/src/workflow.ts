export const JOB_FLOW = ['ALLOCATED','ON_WAY_TO_PICKUP','ON_SITE_PICKUP','LOADED','ON_WAY_TO_DELIVERY','ON_SITE_DELIVERY','POD_SUBMITTED','DELIVERED'] as const
export type JobStatus = 'OPEN' | typeof JOB_FLOW[number]
export type DriverRole = 'Owner Driver' | 'Company Driver'
export type TransitionContext = { customerReference?: string; recipientName?: string; hasPodEvidence?: boolean }

export function nextJobStatus(status: JobStatus): JobStatus | undefined {
  if (status === 'OPEN' || status === 'DELIVERED') return undefined
  return JOB_FLOW[JOB_FLOW.indexOf(status) + 1]
}

export function validateTransition(current: JobStatus, next: JobStatus, context: TransitionContext): string | null {
  if (nextJobStatus(current) !== next) return 'Invalid job status transition'
  if (next === 'LOADED' && !context.customerReference?.trim()) return 'Collection reference is required'
  if (next === 'POD_SUBMITTED' && !context.recipientName?.trim()) return 'Recipient name is required'
  if (next === 'POD_SUBMITTED' && !context.hasPodEvidence) return 'POD evidence is required'
  return null
}

export function validateQuote(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a positive quote amount'
  if (Math.round(amount * 100) !== amount * 100 && Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7) return 'Use at most two decimal places'
  return null
}
