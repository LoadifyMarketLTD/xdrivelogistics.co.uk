import { getWorkspaceMetricPresentationStatus, type WorkspaceDataState } from './useCompanyWorkspaceData';

export const activeStatuses = new Set([
  'awarded',
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
]);

export const terminalStatuses = new Set(['delivered', 'completed', 'cancelled', 'paid']);

export const exceptionStatuses = new Set([
  'cancelled',
  'failed',
  'exception',
  'disputed',
  'collection_failed',
  'delivery_failed',
  'damaged',
  'breakdown',
]);

export const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

export const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

export const datasetStatus = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
) => getWorkspaceMetricPresentationStatus(keys.map((key) => data.datasets[key]));

export const datasetUnavailable = (
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
  unavailable = 'Unavailable',
) => {
  const status = datasetStatus(data, keys);
  if (status === 'partial') return 'Partial data unavailable';
  if (status === 'unavailable' || status === 'omitted') return unavailable;
  return detail;
};

export const metricTone = (
  data: WorkspaceDataState,
  keys: Array<keyof WorkspaceDataState['datasets']>,
  tone: 'navy' | 'green' | 'orange' | 'purple' | 'red' | 'blue',
) => (datasetUnavailable(data, keys) ? 'navy' : tone);
