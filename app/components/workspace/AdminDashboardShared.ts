import { ALLOCATED_JOB_STATUSES, IN_PROGRESS_JOB_STATUSES } from '../../../lib/jobs/workspaceJobStage';
import { getWorkspaceMetricPresentationStatus, type WorkspaceDataState } from './useCompanyWorkspaceData';
import type { WorkspaceCardTone } from './WorkspaceUI';

// Compatibility export for dashboard code that still consumes a raw-status Set.
// Membership is derived from the canonical workspace lifecycle definitions so
// this module cannot independently redefine which statuses are active.
export const activeStatuses = new Set([
  ...ALLOCATED_JOB_STATUSES,
  ...IN_PROGRESS_JOB_STATUSES,
]);

export const terminalStatuses = new Set(['delivered', 'completed', 'cancelled', 'paid']);

export const exceptionStatuses = new Set([
  'cancelled', 'failed', 'exception', 'disputed', 'collection_failed',
  'delivery_failed', 'damaged', 'breakdown',
]);

export const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

export const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

export const datasetStatus = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
) => getWorkspaceMetricPresentationStatus(keys.map((key) => data.datasets[key]));

export const unavailable = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
) => {
  const status = datasetStatus(data, keys);
  return status === 'partial' || status === 'unavailable' || status === 'omitted';
};

export const metricValue = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  compute: () => number | string,
) => {
  const status = datasetStatus(data, keys);
  if (status === 'partial') return 'Partial';
  if (status === 'unavailable' || status === 'omitted') return '—';
  return compute();
};

export const metricDetail = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  detail: string,
) => {
  const status = datasetStatus(data, keys);
  if (status === 'partial') return 'Partial data unavailable';
  if (status === 'unavailable' || status === 'omitted') return 'Unavailable';
  return detail;
};

export const metricTone = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  tone: WorkspaceCardTone,
): WorkspaceCardTone => (unavailable(data, keys) ? 'navy' : tone);
