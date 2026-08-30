export const PRE_EXECUTION_JOB_STATUSES = new Set(['draft', 'received', 'posted']);

export const TERMINAL_JOB_STATUSES = new Set([
  'delivered',
  'pod_completed',
  'invoice_generated',
  'completed',
  'cancelled',
  'canceled',
  'failed',
  'rejected',
]);

type LifecycleJob = {
  status?: unknown;
  current_status?: unknown;
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

export function jobLifecycleStatuses(job: LifecycleJob): string[] {
  return [normalize(job.current_status), normalize(job.status)]
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
}

export function hasOnlyPreExecutionJobStatuses(job: LifecycleJob): boolean {
  const statuses = jobLifecycleStatuses(job);
  return statuses.length > 0 && statuses.every((status) => PRE_EXECUTION_JOB_STATUSES.has(status));
}

export function terminalJobStatus(job: LifecycleJob): string | null {
  return jobLifecycleStatuses(job).find((status) => TERMINAL_JOB_STATUSES.has(status)) ?? null;
}

export function preferredJobLifecycleStatus(job: LifecycleJob): string {
  const statuses = jobLifecycleStatuses(job);
  const terminal = statuses.find((status) => TERMINAL_JOB_STATUSES.has(status));
  if (terminal) return terminal;
  const nonPreExecution = statuses.find((status) => !PRE_EXECUTION_JOB_STATUSES.has(status));
  return nonPreExecution ?? statuses[0] ?? '';
}
