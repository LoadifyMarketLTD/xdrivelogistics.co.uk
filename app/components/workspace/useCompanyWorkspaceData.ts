'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import {
  resolveWorkspaceRole,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';

export type WorkspaceJob = {
  id: string;
  company_id: string;
  status: string;
  current_status?: string | null;
  pickup_location: string | null;
  pickup_postcode?: string | null;
  delivery_location: string | null;
  delivery_postcode?: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  assigned_driver_id?: string | null;
  vehicle_id?: string | null;
  awarded_carrier_company_id?: string | null;
  budget_amount?: number | null;
  delivery_photos?: string[] | null;
  booking_reference?: string | null;
  customer_reference?: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
};

export type WorkspaceBid = {
  id: string;
  job_id: string;
  company_id: string | null;
  status: string;
  amount: number | null;
  bid_price_gbp: number | null;
  currency?: string | null;
  bidder_driver_id?: string | null;
  bidder_user_id?: string | null;
  created_at: string;
  message?: string | null;
  companies?: { name?: string | null } | null;
};

export type WorkspaceInvoice = {
  id: string;
  company_id?: string | null;
  buyer_company_id?: string | null;
  supplier_company_id?: string | null;
  commercial_agreement_id?: string | null;
  job_id?: string | null;
  invoice_number?: string | null;
  status: string;
  payment_status?: string | null;
  delivery_state?: string | null;
  amount: number | null;
  net_amount?: number | null;
  vat_amount?: number | null;
  vat_rate?: number | null;
  currency?: string | null;
  due_date?: string | null;
  invoice_date?: string | null;
  created_at: string;
  client_name?: string | null;
};

export const WORKSPACE_INVOICE_SELECT_POLICY_CONTRACT = [
  {
    name: 'invoices_select_non_driver',
    operation: 'SELECT',
    roles: ['public'],
    using: 'public.is_company_non_driver(company_id)',
    helpers: ['public.is_company_non_driver(company_id)', 'public.company_memberships', 'public.companies', 'public.profiles'],
    sourceMigrations: [
      'supabase/migrations/038_runtime_operational_rls_backstop.sql',
      'supabase/migrations/20260724152500_canonical_company_membership_authorization.sql',
    ],
  },
  {
    name: 'invoices_job_owner_read',
    operation: 'SELECT',
    roles: ['authenticated'],
    using: "job_id IS NOT NULL AND lower(status::text) NOT IN ('pending', 'draft', 'cancelled') AND COALESCE(amount, 0) > 0 AND COALESCE(net_amount, 0) > 0 AND NULLIF(btrim(COALESCE(client_name, '')), '') IS NOT NULL AND (lower(status::text) = 'paid' OR lower(payment_status::text) = 'paid' OR (delivery_state = 'sent' AND NULLIF(btrim(COALESCE(delivery_provider, '')), '') IS NOT NULL AND NULLIF(btrim(COALESCE(delivery_message_id, '')), '') IS NOT NULL AND NULLIF(btrim(COALESCE(delivery_recipient_email, '')), '') IS NOT NULL)) AND EXISTS (SELECT 1 FROM public.jobs job WHERE job.id = invoices.job_id AND public.is_company_member(job.company_id))",
    helpers: ['public.jobs', 'public.is_company_member(job.company_id)'],
    sourceMigrations: [
      'supabase/migrations/20260723111500_invoice_snapshot_integrity.sql',
      'supabase/migrations/20260724152500_canonical_company_membership_authorization.sql',
    ],
  },
] as const;

export const DRIVER_WORKSPACE_INVOICE_BACKEND_BLOCKER =
  'Invoice data unavailable: the verified invoices SELECT policies only cover non-driver invoice-company members and authenticated job-owner companies on customer-ready invoices. There is no driver or owner-driver invoice SELECT policy, and job assignment alone is not an invoice visibility grant.';

export type WorkspaceDriver = {
  id: string;
  display_name: string | null;
  email?: string | null;
  phone?: string | null;
  status: string | null;
  availability_status: string | null;
  user_id?: string | null;
};

export type WorkspaceVehicle = {
  id: string;
  reg_plate: string | null;
  type: string | null;
  make?: string | null;
  model?: string | null;
  assigned_driver_id?: string | null;
};

export type WorkspaceDocument = {
  id: string;
  status: string | null;
  expiry_date: string | null;
  doc_type?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
};

export type WorkspaceLocation = {
  id: string;
  driver_id: string;
  job_id?: string | null;
  lat: number;
  lng: number;
  recorded_at?: string | null;
  updated_at?: string | null;
};

export type WorkspaceDatasetKey =
  | 'jobs'
  | 'bids'
  | 'invoices'
  | 'drivers'
  | 'vehicles'
  | 'driverDocuments'
  | 'vehicleDocuments'
  | 'locations';

export type WorkspaceDataSurface =
  | 'carrier_operations'
  | 'fleet'
  | 'dispatcher'
  | 'finance'
  | 'compliance'
  | 'viewer'
  | 'customer'
  | 'broker'
  | 'driver'
  | 'blocked';

export type WorkspaceDatasetAvailability = 'available' | 'unavailable' | 'omitted';

export type WorkspaceQueryError = {
  dataset: WorkspaceDatasetKey;
  message: string;
};

export type WorkspaceDatasetState<T> = {
  data: T[];
  availability: WorkspaceDatasetAvailability;
  queryErrors: string[];
  partialData: boolean;
  limitedData: boolean;
  successfulEmpty: boolean;
  requested: boolean;
};

export type WorkspaceDataDatasets = {
  jobs: WorkspaceDatasetState<WorkspaceJob>;
  bids: WorkspaceDatasetState<WorkspaceBid>;
  invoices: WorkspaceDatasetState<WorkspaceInvoice>;
  drivers: WorkspaceDatasetState<WorkspaceDriver>;
  vehicles: WorkspaceDatasetState<WorkspaceVehicle>;
  driverDocuments: WorkspaceDatasetState<WorkspaceDocument>;
  vehicleDocuments: WorkspaceDatasetState<WorkspaceDocument>;
  locations: WorkspaceDatasetState<WorkspaceLocation>;
};

export type WorkspaceDataState = {
  companyId: string | null;
  loading: boolean;
  error: string;
  partialData: boolean;
  queryErrors: WorkspaceQueryError[];
  surface: WorkspaceDataSurface;
  datasets: WorkspaceDataDatasets;
  jobs: WorkspaceJob[];
  bids: WorkspaceBid[];
  invoices: WorkspaceInvoice[];
  drivers: WorkspaceDriver[];
  vehicles: WorkspaceVehicle[];
  driverDocuments: WorkspaceDocument[];
  vehicleDocuments: WorkspaceDocument[];
  locations: WorkspaceLocation[];
  refresh: () => Promise<void>;
};

export type WorkspaceDataQueryPlan = {
  surface: WorkspaceDataSurface;
  datasets: readonly WorkspaceDatasetKey[];
  blocker: string | null;
};

type QueryResult<T> = { data: T[] | null; error: { message?: string | null } | null };

type PartialDatasetInput<T> = {
  requested: boolean;
  data?: readonly T[] | null;
  queryErrors?: readonly string[];
  limitedData?: boolean;
};

const CARRIER_DASHBOARD_DATASET_KEYS: readonly WorkspaceDatasetKey[] = [
  'jobs',
  'bids',
  'invoices',
  'drivers',
  'vehicles',
  'driverDocuments',
  'vehicleDocuments',
];

const CARRIER_TRACKING_DATASET_KEYS: readonly WorkspaceDatasetKey[] = [
  'jobs',
  'drivers',
  'vehicles',
  'locations',
];

const normalizePathname = (pathname: string) => pathname.split('?')[0]?.split('#')[0] || '/';

const matchesPrefixes = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const uniqueById = <T extends { id: string }>(rows: T[]): T[] => {
  const byId = new Map<string, T>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
};

const CARRIER_DASHBOARD_JOB_SELECT =
  'id, company_id, status, current_status, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, vehicle_type, assigned_driver_id, awarded_carrier_company_id, budget_amount, delivery_photos, created_at, updated_at, client_name';

const EXECUTION_JOB_SELECT =
  'id, company_id, status, current_status, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, vehicle_type, assigned_driver_id, vehicle_id, awarded_carrier_company_id, budget_amount, delivery_photos, booking_reference, customer_reference, created_at, updated_at, client_name';

export const getWorkspaceJobSelect = (surface: WorkspaceDataSurface) =>
  surface === 'carrier_operations' ? CARRIER_DASHBOARD_JOB_SELECT : EXECUTION_JOB_SELECT;

export const isCustomerVisibleWorkspaceInvoice = (
  invoice: WorkspaceInvoice,
  customerCompanyId: string | null,
) => {
  if (!customerCompanyId || invoice.buyer_company_id !== customerCompanyId) return false;
  const status = String(invoice.status ?? '').toLowerCase();
  const paymentStatus = String(invoice.payment_status ?? '').toLowerCase();
  const deliveryState = String(invoice.delivery_state ?? '').toLowerCase();
  return !['pending', 'draft', 'cancelled'].includes(status)
    && Number(invoice.amount ?? 0) > 0
    && Boolean(invoice.client_name?.trim())
    && (deliveryState === 'sent' || status === 'paid' || paymentStatus === 'paid');
};

export function createWorkspaceDatasetState<T>({
  requested,
  data = [],
  queryErrors = [],
  limitedData = false,
}: PartialDatasetInput<T>): WorkspaceDatasetState<T> {
  const rows = [...(data ?? [])];
  const errors = [...queryErrors].filter((message) => message.trim().length > 0);
  if (!requested) {
    return {
      data: [],
      availability: 'omitted',
      queryErrors: [],
      partialData: false,
      limitedData: false,
      successfulEmpty: false,
      requested: false,
    };
  }

  return {
    data: rows,
    availability: errors.length > 0 && rows.length === 0 ? 'unavailable' : 'available',
    queryErrors: errors,
    partialData: errors.length > 0 || limitedData,
    limitedData,
    successfulEmpty: errors.length === 0 && rows.length === 0,
    requested: true,
  };
}

export type WorkspaceMetricPresentationStatus =
    | 'complete'
    | 'empty'
    | 'partial'
    | 'unavailable'
    | 'omitted';

type MetricResolver<T> = T | (() => T);

const resolveMetric = <T>(value: MetricResolver<T>): T =>
    typeof value === 'function' ? (value as () => T)() : value;

export const WORKSPACE_PARTIAL_METRIC_VALUE = 'Partial';

const getMetricFallbackValue = (status: WorkspaceMetricPresentationStatus) =>
  status === 'partial' ? WORKSPACE_PARTIAL_METRIC_VALUE : '—';

export function getWorkspaceMetricPresentationStatus(
    datasets: readonly WorkspaceDatasetState<unknown>[],
): WorkspaceMetricPresentationStatus {
    if (datasets.some((dataset) => dataset.availability === 'omitted')) return 'omitted';
    if (datasets.some((dataset) => dataset.availability === 'unavailable')) return 'unavailable';
    if (datasets.some((dataset) => dataset.partialData)) return 'partial';
    if (datasets.length > 0 && datasets.every((dataset) => dataset.successfulEmpty)) return 'empty';
    return 'complete';
}

export type WorkspaceMetricPresentation<TTone extends string> = {
    status: WorkspaceMetricPresentationStatus;
    value: number | string;
    detail: string;
    tone: TTone | 'navy';
};

export function getWorkspaceMetricPresentation<TTone extends string>({
    datasets,
    completeValue,
    completeDetail,
    completeTone,
    partialDetail = 'Partial data unavailable',
    unavailableDetail = 'Unavailable',
    omittedDetail = 'Unavailable',
    degradedTone = 'navy',
}: {
    datasets: readonly WorkspaceDatasetState<unknown>[];
    completeValue: MetricResolver<number | string>;
    completeDetail: MetricResolver<string>;
    completeTone: MetricResolver<TTone>;
    partialDetail?: string;
    unavailableDetail?: string;
    omittedDetail?: string;
    degradedTone?: TTone | 'navy';
}): WorkspaceMetricPresentation<TTone> {
    const status = getWorkspaceMetricPresentationStatus(datasets);
    if (status === 'partial') {
     return { status, value: getMetricFallbackValue(status), detail: partialDetail, tone: degradedTone };
    }
    if (status === 'unavailable') {
     return { status, value: getMetricFallbackValue(status), detail: unavailableDetail, tone: degradedTone };
    }
    if (status === 'omitted') {
     return { status, value: getMetricFallbackValue(status), detail: omittedDetail, tone: degradedTone };
    }
    return {
      status,
      value: resolveMetric(completeValue),
      detail: resolveMetric(completeDetail),
      tone: resolveMetric(completeTone),
    };
}

const createDatasetMap = (
  requestedDatasets: readonly WorkspaceDatasetKey[],
): WorkspaceDataDatasets => {
  const requested = new Set(requestedDatasets);
  return {
    jobs: createWorkspaceDatasetState<WorkspaceJob>({ requested: requested.has('jobs') }),
    bids: createWorkspaceDatasetState<WorkspaceBid>({ requested: requested.has('bids') }),
    invoices: createWorkspaceDatasetState<WorkspaceInvoice>({ requested: requested.has('invoices') }),
    drivers: createWorkspaceDatasetState<WorkspaceDriver>({ requested: requested.has('drivers') }),
    vehicles: createWorkspaceDatasetState<WorkspaceVehicle>({ requested: requested.has('vehicles') }),
    driverDocuments: createWorkspaceDatasetState<WorkspaceDocument>({ requested: requested.has('driverDocuments') }),
    vehicleDocuments: createWorkspaceDatasetState<WorkspaceDocument>({ requested: requested.has('vehicleDocuments') }),
    locations: createWorkspaceDatasetState<WorkspaceLocation>({ requested: requested.has('locations') }),
  };
};

const toErrorMessage = (dataset: WorkspaceDatasetKey, message: string): WorkspaceQueryError => ({
  dataset,
  message,
});

const getFirstError = (result: QueryResult<unknown>): string | null => {
  const message = result.error?.message ?? null;
  return typeof message === 'string' && message.trim().length > 0 ? message : null;
};

const getApprovedAdminHomeBlocker = (role: WorkspaceRole | null | undefined): string => {
  if (!role) {
    return 'Workspace role context is unavailable, so the /admin dashboard surface cannot be resolved safely.';
  }

  switch (role) {
    case 'platform_owner':
      return 'platform_owner resolves to /super-admin, so no approved /admin dashboard exists for this role.';
    case 'broker':
    case 'customer':
    case 'driver':
    case 'owner_driver':
      return `${role} resolves outside the carrier /admin workspace, so the admin dashboard remains blocked for this role.`;
    default:
      return `No approved /admin dashboard resolver exists for workspace role ${role}.`;
  }
};

export function resolveWorkspaceDataQueryPlan(input: {
  pathname: string;
  workspaceRole: WorkspaceRole | null | undefined;
}): WorkspaceDataQueryPlan {
  const pathname = normalizePathname(input.pathname);
  const role = input.workspaceRole ?? null;

  if (pathname === '/customer' || pathname.startsWith('/customer/')) {
    return { surface: 'customer', datasets: ['jobs', 'bids', 'invoices'], blocker: null };
  }

  if (pathname === '/broker' || pathname.startsWith('/broker/')) {
    return { surface: 'broker', datasets: ['jobs', 'bids', 'invoices'], blocker: null };
  }

  if (pathname === '/driver' || pathname.startsWith('/driver/')) {
    return { surface: 'driver', datasets: ['jobs', 'bids', 'driverDocuments'], blocker: null };
  }

  if (matchesPrefixes(pathname, ['/admin/invoices', '/admin/finance'])) {
    return { surface: 'finance', datasets: ['jobs', 'invoices'], blocker: null };
  }

  if (matchesPrefixes(pathname, ['/admin/fleet', '/admin/drivers', '/admin/vehicles', '/admin/driver-availability'])) {
    return {
      surface: 'fleet',
      datasets: ['jobs', 'bids', 'drivers', 'vehicles', 'locations', 'driverDocuments', 'vehicleDocuments'],
      blocker: null,
    };
  }

  if (matchesPrefixes(pathname, ['/admin/documents', '/admin/incidents'])) {
    return {
      surface: 'compliance',
      datasets: ['jobs', 'drivers', 'vehicles', 'driverDocuments', 'vehicleDocuments'],
      blocker: null,
    };
  }

  if (matchesPrefixes(pathname, ['/admin/diary', '/admin/jobs'])) {
    return {
      surface: 'dispatcher',
      datasets: ['jobs', 'drivers', 'vehicles', 'locations'],
      blocker: null,
    };
  }

  if (matchesPrefixes(pathname, ['/admin/freight-vision', '/admin/live-availability'])) {
    return {
      surface: 'carrier_operations',
      datasets: CARRIER_TRACKING_DATASET_KEYS,
      blocker: null,
    };
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    switch (role) {
      case 'company_owner':
      case 'company_admin':
      case 'carrier_admin':
        return {
          surface: 'carrier_operations',
          datasets: CARRIER_DASHBOARD_DATASET_KEYS,
          blocker: null,
        };
      case 'fleet_manager':
        return {
          surface: 'fleet',
          datasets: ['jobs', 'bids', 'drivers', 'vehicles', 'locations', 'driverDocuments', 'vehicleDocuments'],
          blocker: null,
        };
      case 'dispatcher':
        return {
          surface: 'dispatcher',
          datasets: ['jobs', 'drivers', 'vehicles', 'locations'],
          blocker: null,
        };
      case 'finance':
        return { surface: 'finance', datasets: ['jobs', 'invoices'], blocker: null };
      case 'compliance':
        return {
          surface: 'compliance',
          datasets: ['jobs', 'drivers', 'vehicles', 'driverDocuments', 'vehicleDocuments'],
          blocker: null,
        };
      case 'viewer':
        return { surface: 'viewer', datasets: ['jobs'], blocker: null };
      default:
        return { surface: 'blocked', datasets: [], blocker: getApprovedAdminHomeBlocker(role) };
    }
  }

  return {
    surface: 'blocked',
    datasets: [],
    blocker: `No workspace data query plan is defined for pathname ${pathname}.`,
  };
}

export function getWorkspaceDatasetMetricValue<T>(
  dataset: WorkspaceDatasetState<T>,
  compute: (rows: T[]) => number | string,
): number | string {
  const status = getWorkspaceMetricPresentationStatus([dataset as WorkspaceDatasetState<unknown>]);
  if (status === 'partial' || status === 'unavailable' || status === 'omitted') return getMetricFallbackValue(status);
  return compute(dataset.data);
}

const queryReachedLimit = (rows: { length: number } | null | undefined, limit: number, error: string | null) =>
  !error && limit > 0 && (rows?.length ?? 0) >= limit;

const buildWorkspaceError = (
  blocker: string | null,
  queryErrors: WorkspaceQueryError[],
): string => {
  if (blocker) return blocker;
  if (!queryErrors.length) return '';
  return `Some workspace data is unavailable: ${queryErrors.map(({ dataset, message }) => `${dataset}: ${message}`).join('; ')}`;
};

export function useCompanyWorkspaceData(): WorkspaceDataState {
  const pathname = usePathname() ?? '/';
  const { user } = useAuth();
  const workspaceRole = user?.workspaceRole ?? resolveWorkspaceRole(user);
  const plan = useMemo(
    () => resolveWorkspaceDataQueryPlan({ pathname, workspaceRole }),
    [pathname, workspaceRole],
  );
  const [companyId, setCompanyId] = useState<string | null>(user?.companyId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partialData, setPartialData] = useState(false);
  const [queryErrors, setQueryErrors] = useState<WorkspaceQueryError[]>([]);
  const [datasets, setDatasets] = useState<WorkspaceDataDatasets>(() => createDatasetMap(plan.datasets));

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!user?.id) return;
      const resolved = await resolveActiveCompanyId({
        userId: user.id,
        fallbackCompanyId: user.companyId ?? null,
      });
      if (!cancelled) setCompanyId(resolved ?? null);
    };
    void resolve();
    return () => { cancelled = true; };
  }, [user?.id, user?.companyId]);

  const refresh = useCallback(async () => {
    const nextDatasets = createDatasetMap(plan.datasets);
    const nextQueryErrors: WorkspaceQueryError[] = [];
    const requested = new Set(plan.datasets);
    const driverSurface = plan.surface === 'driver';

    const setDataset = <T,>(
      key: WorkspaceDatasetKey,
      rows: T[],
      errors: string[] = [],
      limitedData = false,
    ) => {
      const dataset = createWorkspaceDatasetState<T>({
        requested: requested.has(key),
        data: rows,
        queryErrors: errors,
        limitedData,
      });
      (nextDatasets as Record<WorkspaceDatasetKey, WorkspaceDatasetState<T>>)[key] = dataset;
      errors.forEach((message) => nextQueryErrors.push(toErrorMessage(key, message)));
    };

    const dependencyUnavailable = <T,>(key: WorkspaceDatasetKey, message: string) => {
      setDataset<T>(key, [], [message]);
    };

    if (plan.blocker) {
      setDatasets(nextDatasets);
      setQueryErrors([]);
      setPartialData(false);
      setError(plan.blocker);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      const message = 'Supabase is not configured for this workspace.';
      plan.datasets.forEach((key) => setDataset(key, [], [message]));
      setDatasets(nextDatasets);
      setQueryErrors(nextQueryErrors);
      setPartialData(false);
      setError(buildWorkspaceError(plan.blocker, nextQueryErrors));
      setLoading(false);
      return;
    }

    if (!driverSurface && !companyId) {
      const message = 'This workspace requires an active company context, but no company could be resolved for the current user.';
      plan.datasets.forEach((key) => setDataset(key, [], [message]));
      setDatasets(nextDatasets);
      setQueryErrors(nextQueryErrors);
      setPartialData(false);
      setError(buildWorkspaceError(plan.blocker, nextQueryErrors));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    if (requested.has('jobs')) {
      if (driverSurface) {
        if (!user?.driverId) {
          dependencyUnavailable<WorkspaceJob>('jobs', 'driver context unavailable; assigned job query was not run.');
        } else {
          const jobsRes = await supabase
            .from('jobs')
            .select(getWorkspaceJobSelect(plan.surface))
            .eq('assigned_driver_id', user.driverId)
            .order('updated_at', { ascending: false })
            .limit(500);
          const jobsError = getFirstError(jobsRes as QueryResult<WorkspaceJob>);
          setDataset<WorkspaceJob>(
            'jobs',
            (jobsRes.data ?? []) as WorkspaceJob[],
            jobsError ? [jobsError] : [],
            queryReachedLimit(jobsRes.data, 500, jobsError),
          );
        }
      } else {
        const jobsRes = await supabase
          .from('jobs')
          .select(getWorkspaceJobSelect(plan.surface))
          .or(
            plan.surface === 'customer' || plan.surface === 'broker'
              ? `company_id.eq.${companyId}`
              : `company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`,
          )
          .order('updated_at', { ascending: false })
          .limit(500);
        const jobsError = getFirstError(jobsRes as QueryResult<WorkspaceJob>);
        setDataset<WorkspaceJob>(
          'jobs',
          (jobsRes.data ?? []) as WorkspaceJob[],
          jobsError ? [jobsError] : [],
          queryReachedLimit(jobsRes.data, 500, jobsError),
        );
      }
    }

    const jobDataset = nextDatasets.jobs;
    const jobIds = jobDataset.data.map((job) => job.id);

    if (requested.has('bids')) {
      switch (plan.surface) {
        case 'customer':
        case 'broker': {
          if (requested.has('jobs') && jobDataset.availability === 'unavailable') {
            dependencyUnavailable<WorkspaceBid>('bids', 'jobs dataset unavailable; quote query was not run.');
            break;
          }
          if (!jobIds.length) {
            setDataset<WorkspaceBid>('bids', []);
            break;
          }
          const bidsRes = await supabase
            .from('job_bids')
            .select('id, job_id, company_id, status, amount, bid_price_gbp, created_at, message, companies:companies!job_bids_company_id_fkey(name)')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false })
            .limit(1000);
          const bidsError = getFirstError(bidsRes as QueryResult<WorkspaceBid>);
          setDataset<WorkspaceBid>(
            'bids',
            (bidsRes.data ?? []) as WorkspaceBid[],
            bidsError ? [bidsError] : [],
            queryReachedLimit(bidsRes.data, 1000, bidsError),
          );
          break;
        }
        case 'driver': {
          if (!user?.id) {
            dependencyUnavailable<WorkspaceBid>('bids', 'user context unavailable; bid query was not run.');
            break;
          }
          const ownBidsRes = await supabase
            .from('job_bids')
            .select('id, job_id, company_id, status, amount, bid_price_gbp, created_at, message, companies:companies!job_bids_company_id_fkey(name)')
            .eq('bidder_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(500);
          const ownBidsError = getFirstError(ownBidsRes as QueryResult<WorkspaceBid>);
          setDataset<WorkspaceBid>(
            'bids',
            (ownBidsRes.data ?? []) as WorkspaceBid[],
            ownBidsError ? [ownBidsError] : [],
            queryReachedLimit(ownBidsRes.data, 500, ownBidsError),
          );
          break;
        }
        case 'fleet': {
          if (requested.has('jobs') && jobDataset.availability === 'unavailable') {
            dependencyUnavailable<WorkspaceBid>('bids', 'jobs dataset unavailable; accepted Fleet bid query was not run.');
            break;
          }
          const wonJobIds = jobDataset.data
            .filter((job) => job.awarded_carrier_company_id === companyId)
            .map((job) => job.id);
          if (!wonJobIds.length) {
            setDataset<WorkspaceBid>('bids', []);
            break;
          }
          const acceptedFleetBidsRes = await supabase
            .from('job_bids')
            .select('id, job_id, company_id, status, amount, bid_price_gbp, currency, bidder_driver_id, bidder_user_id, created_at, message, companies:companies!job_bids_company_id_fkey(name)')
            .eq('company_id', companyId)
            .eq('status', 'accepted')
            .in('job_id', wonJobIds)
            .order('created_at', { ascending: false })
            .limit(500);
          const fleetBidError = getFirstError(acceptedFleetBidsRes as QueryResult<WorkspaceBid>);
          setDataset<WorkspaceBid>(
            'bids',
            (acceptedFleetBidsRes.data ?? []) as WorkspaceBid[],
            fleetBidError ? [fleetBidError] : [],
            queryReachedLimit(acceptedFleetBidsRes.data, 500, fleetBidError),
          );
          break;
        }
        default: {
          const ownBidsRes = await supabase
            .from('job_bids')
            .select('id, job_id, company_id, status, amount, bid_price_gbp, created_at, message, companies:companies!job_bids_company_id_fkey(name)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(500);

          const receivedBidsRes = requested.has('jobs') && jobDataset.availability === 'unavailable'
            ? null
            : jobIds.length > 0
              ? await supabase
                .from('job_bids')
                .select('id, job_id, company_id, status, amount, bid_price_gbp, created_at, message, companies:companies!job_bids_company_id_fkey(name)')
                .in('job_id', jobIds)
                .order('created_at', { ascending: false })
                .limit(1000)
              : ({ data: [] as WorkspaceBid[], error: null } as QueryResult<WorkspaceBid>);

          const bidErrors = [
            getFirstError(ownBidsRes as QueryResult<WorkspaceBid>),
            requested.has('jobs') && jobDataset.availability === 'unavailable'
              ? 'jobs dataset unavailable; received-quote query was not run.'
              : getFirstError((receivedBidsRes ?? { data: [], error: null }) as QueryResult<WorkspaceBid>),
          ].filter((message): message is string => Boolean(message));

          const combined = uniqueById([
            ...((ownBidsRes.data ?? []) as WorkspaceBid[]),
            ...(((receivedBidsRes?.data ?? []) as WorkspaceBid[])),
          ]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          const ownBidLimitReached = queryReachedLimit(ownBidsRes.data, 500, getFirstError(ownBidsRes as QueryResult<WorkspaceBid>));
          const receivedBidLimitReached = queryReachedLimit(receivedBidsRes?.data ?? [], 1000, getFirstError((receivedBidsRes ?? { data: [], error: null }) as QueryResult<WorkspaceBid>));
          setDataset<WorkspaceBid>('bids', combined, bidErrors, ownBidLimitReached || receivedBidLimitReached);
          break;
        }
      }
    }

    if (requested.has('invoices')) {
      switch (plan.surface) {
        case 'customer': {
          const buyerInvoicesRes = await supabase
            .from('invoices')
            .select('id, company_id, buyer_company_id, supplier_company_id, commercial_agreement_id, job_id, invoice_number, status, payment_status, delivery_state, amount, net_amount, vat_amount, vat_rate, currency, due_date, invoice_date, created_at, client_name')
            .eq('buyer_company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(500);
          const invoiceError = getFirstError(buyerInvoicesRes as QueryResult<WorkspaceInvoice>);
          const invoiceRows = ((buyerInvoicesRes.data ?? []) as WorkspaceInvoice[])
            .filter((invoice) => isCustomerVisibleWorkspaceInvoice(invoice, companyId));
          setDataset<WorkspaceInvoice>(
            'invoices',
            invoiceRows,
            invoiceError ? [invoiceError] : [],
            queryReachedLimit(buyerInvoicesRes.data, 500, invoiceError),
          );
          break;
        }
        case 'driver': {
          if (!user?.driverId) {
            dependencyUnavailable<WorkspaceInvoice>('invoices', 'driver context unavailable; driver invoice query was not run.');
            break;
          }
          dependencyUnavailable<WorkspaceInvoice>('invoices', DRIVER_WORKSPACE_INVOICE_BACKEND_BLOCKER);
          break;
        }
        default: {
          const invoicesRes = await supabase
            .from('invoices')
            .select('id, company_id, buyer_company_id, supplier_company_id, commercial_agreement_id, job_id, invoice_number, status, payment_status, delivery_state, amount, net_amount, vat_amount, vat_rate, currency, due_date, invoice_date, created_at, client_name')
            .or(`company_id.eq.${companyId},buyer_company_id.eq.${companyId}`)
            .order('created_at', { ascending: false })
            .limit(500);
          const invoiceError = getFirstError(invoicesRes as QueryResult<WorkspaceInvoice>);
          setDataset<WorkspaceInvoice>(
            'invoices',
            (invoicesRes.data ?? []) as WorkspaceInvoice[],
            invoiceError ? [invoiceError] : [],
            queryReachedLimit(invoicesRes.data, 500, invoiceError),
          );
          break;
        }
      }
    }

    if (requested.has('drivers')) {
      const driversRes = await supabase
        .from('drivers')
        .select('id, display_name, email, phone, status, availability_status, user_id')
        .eq('company_id', companyId)
        .order('display_name', { ascending: true })
        .limit(500);
      const driversError = getFirstError(driversRes as QueryResult<WorkspaceDriver>);
      setDataset<WorkspaceDriver>(
        'drivers',
        (driversRes.data ?? []) as WorkspaceDriver[],
        driversError ? [driversError] : [],
        queryReachedLimit(driversRes.data, 500, driversError),
      );
    }

    if (requested.has('vehicles')) {
      const vehiclesRes = await supabase
        .from('vehicles')
        .select('id, reg_plate, type, make, model, assigned_driver_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500);
      const vehiclesError = getFirstError(vehiclesRes as QueryResult<WorkspaceVehicle>);
      setDataset<WorkspaceVehicle>(
        'vehicles',
        (vehiclesRes.data ?? []) as WorkspaceVehicle[],
        vehiclesError ? [vehiclesError] : [],
        queryReachedLimit(vehiclesRes.data, 500, vehiclesError),
      );
    }

    if (requested.has('locations')) {
      const locationsRes = await supabase
        .from('driver_locations')
        .select('id, driver_id, lat, lng, recorded_at, updated_at')
        .eq('company_id', companyId)
        .order('recorded_at', { ascending: false })
        .limit(500);
      const locationsError = getFirstError(locationsRes as QueryResult<WorkspaceLocation>);
      setDataset<WorkspaceLocation>(
        'locations',
        (locationsRes.data ?? []) as WorkspaceLocation[],
        locationsError ? [locationsError] : [],
        queryReachedLimit(locationsRes.data, 500, locationsError),
      );
    }

    if (requested.has('driverDocuments')) {
      if (plan.surface === 'driver') {
        if (!user?.driverId) {
          dependencyUnavailable<WorkspaceDocument>('driverDocuments', 'driver context unavailable; driver document query was not run.');
        } else {
          const driverDocsRes = await supabase
            .from('driver_documents')
            .select('id, driver_id, doc_type, status, expiry_date')
            .eq('driver_id', user.driverId)
            .order('expiry_date', { ascending: true })
            .limit(1000);
          const driverDocsError = getFirstError(driverDocsRes as QueryResult<WorkspaceDocument>);
          setDataset<WorkspaceDocument>(
            'driverDocuments',
            (driverDocsRes.data ?? []) as WorkspaceDocument[],
            driverDocsError ? [driverDocsError] : [],
            queryReachedLimit(driverDocsRes.data, 1000, driverDocsError),
          );
        }
      } else {
        const driversDataset = nextDatasets.drivers;
        if (requested.has('drivers') && driversDataset.availability === 'unavailable') {
          dependencyUnavailable<WorkspaceDocument>('driverDocuments', 'drivers dataset unavailable; driver document query was not run.');
        } else {
          const driverIds = driversDataset.data.map((driver) => driver.id);
          if (!driverIds.length) {
            setDataset<WorkspaceDocument>('driverDocuments', []);
          } else {
            const driverDocsRes = await supabase
              .from('driver_documents')
              .select('id, driver_id, doc_type, status, expiry_date')
              .in('driver_id', driverIds)
              .order('expiry_date', { ascending: true })
              .limit(1000);
            const driverDocsError = getFirstError(driverDocsRes as QueryResult<WorkspaceDocument>);
            setDataset<WorkspaceDocument>(
              'driverDocuments',
              (driverDocsRes.data ?? []) as WorkspaceDocument[],
              driverDocsError ? [driverDocsError] : [],
              queryReachedLimit(driverDocsRes.data, 1000, driverDocsError),
            );
          }
        }
      }
    }

    if (requested.has('vehicleDocuments')) {
      const vehiclesDataset = nextDatasets.vehicles;
      if (requested.has('vehicles') && vehiclesDataset.availability === 'unavailable') {
        dependencyUnavailable<WorkspaceDocument>('vehicleDocuments', 'vehicles dataset unavailable; vehicle document query was not run.');
      } else {
        const vehicleIds = vehiclesDataset.data.map((vehicle) => vehicle.id);
        if (!vehicleIds.length) {
          setDataset<WorkspaceDocument>('vehicleDocuments', []);
        } else {
          const vehicleDocsRes = await supabase
            .from('vehicle_documents')
            .select('id, vehicle_id, doc_type, status, expiry_date')
            .in('vehicle_id', vehicleIds)
            .order('expiry_date', { ascending: true })
            .limit(1000);
          const vehicleDocsError = getFirstError(vehicleDocsRes as QueryResult<WorkspaceDocument>);
          setDataset<WorkspaceDocument>(
            'vehicleDocuments',
            (vehicleDocsRes.data ?? []) as WorkspaceDocument[],
            vehicleDocsError ? [vehicleDocsError] : [],
            queryReachedLimit(vehicleDocsRes.data, 1000, vehicleDocsError),
          );
        }
      }
    }

    setDatasets(nextDatasets);
    setQueryErrors(nextQueryErrors);
    setPartialData(Object.values(nextDatasets).some((dataset) => dataset.partialData));
    setError(buildWorkspaceError(plan.blocker, nextQueryErrors));
    setLoading(false);
  }, [companyId, plan, user?.driverId, user?.id]);

  useEffect(() => {
    setDatasets(createDatasetMap(plan.datasets));
  }, [plan.datasets]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    companyId,
    loading,
    error,
    partialData,
    queryErrors,
    surface: plan.surface,
    datasets,
    jobs: datasets.jobs.data,
    bids: datasets.bids.data,
    invoices: datasets.invoices.data,
    drivers: datasets.drivers.data,
    vehicles: datasets.vehicles.data,
    driverDocuments: datasets.driverDocuments.data,
    vehicleDocuments: datasets.vehicleDocuments.data,
    locations: datasets.locations.data,
    refresh,
  };
}
