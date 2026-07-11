'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { COMPANY_CONFIG } from '../config/company';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import {
  isMissingColumnError,
  loadInvoicesWithSchemaCompat,
  resolveInvoiceClientName,
  selectWithMissingColumnFallback,
} from '../../lib/supabaseSchemaCompat';
import { toCanonicalInvoiceDisplayStatus } from '../../lib/invoiceStatus';
import { getNavSectionsForRole } from './workflowUi';
import { mapAppRole, type AppUserRole } from '../../lib/authRole';

type DashboardOverview = {
  activeJobs: number;
  pendingQuotes: number;
  activeDrivers: number;
  completedToday: number;
};

type JobsByStatus = {
  posted: number;
  allocated: number;
  inTransit: number;
  delivered: number;
};

type FinanceSnapshot = {
  outstandingInvoices: number;
  overdueInvoices: number;
  outstandingRevenue: number;
};

type ComplianceSnapshot = {
  pendingDocs: number;
  expiringSoon: number;
  attentionRequired: number;
};

type MarketSnapshot = {
  incomingBids: number;
  acceptedQuotes: number;
  recentInvoiceValue: number;
  deliveryBacklog: number;
};

type ResourceSnapshot = {
  fleetUnits: number;
  pendingQuoteApprovals: number;
  driverCoverageGap: number;
};

type ActivityItem = {
  id: string;
  icon: string;
  title: string;
  meta: string;
  date: string;
  href: string;
};

type DashboardState = {
  overview: DashboardOverview;
  jobsByStatus: JobsByStatus;
  finance: FinanceSnapshot;
  compliance: ComplianceSnapshot;
  market: MarketSnapshot;
  resources: ResourceSnapshot;
  activity: ActivityItem[];
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  payment_status: string | null;
  due_date: string;
  amount: number | null;
  client_name: string | null;
  created_at: string;
};

type QuoteRow = {
  id: string;
  status: string;
  customer_name: string | null;
  amount: number | null;
  created_at: string;
};

type BidRow = {
  id: string;
  status: string;
  amount: number | null;
  bid_price_gbp: number | null;
  created_at: string;
};

type JobRow = {
  id: string;
  status: string;
  pickup_location: string | null;
  delivery_location: string | null;
  created_at: string;
  updated_at: string;
};

type DocRow = {
  id: string;
  status: string;
  expiry_date: string | null;
};

type ExpiryAlertRow = {
  id: string;
  doc_type: string;
  expiry_date: string;
  status: string;
  entity_name: string;
  entity_kind: 'driver' | 'vehicle';
};

type DriverAvailRow = {
  id: string;
  display_name: string | null;
  availability_status: string | null;
  status: string | null;
};

type PostedJobDispatch = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  created_at: string;
};

const DEFAULT_DASHBOARD: DashboardState = {
  overview: {
    activeJobs: 0,
    pendingQuotes: 0,
    activeDrivers: 0,
    completedToday: 0,
  },
  jobsByStatus: {
    posted: 0,
    allocated: 0,
    inTransit: 0,
    delivered: 0,
  },
  finance: {
    outstandingInvoices: 0,
    overdueInvoices: 0,
    outstandingRevenue: 0,
  },
  compliance: {
    pendingDocs: 0,
    expiringSoon: 0,
    attentionRequired: 0,
  },
  market: {
    incomingBids: 0,
    acceptedQuotes: 0,
    recentInvoiceValue: 0,
    deliveryBacklog: 0,
  },
  resources: {
    fleetUnits: 0,
    pendingQuoteApprovals: 0,
    driverCoverageGap: 0,
  },
  activity: [],
};

const ENTERPRISE_THEME = {
  pageBg: '#eef2f6',
  shellBg: '#f8fafc',
  shellBorder: '#d7e0ea',
  shellMuted: '#64748b',
  shellText: '#0f172a',
  cardBg: '#ffffff',
  cardBorder: '#d7e0ea',
  cardShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
  radius: '10px',
  spacing: {
    xxs: '0.35rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
  },
  colors: {
    success: '#15803d',
    warning: '#c2410c',
    danger: '#b91c1c',
    live: '#1d4ed8',
    driverQuote: '#7c3aed',
    text: '#0f172a',
    muted: '#475569',
  },
};

const countQuery = async (promise: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
  const { count, error } = await promise;
  if (error) throw new Error(error.message);
  return count ?? 0;
};

const rowsQuery = async <T,>(promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data ?? [];
};

const loadDriverAvailabilityWithCompat = async (companyId: string): Promise<DriverAvailRow[]> => {
  const result = await supabase
    .from('drivers')
    .select('id, display_name, availability_status, status')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .limit(20);

  if (!result.error) {
    return result.data ?? [];
  }

  if (isMissingColumnError(result.error, 'drivers', 'availability_status')) {
    const fallback = await supabase
      .from('drivers')
      .select('id, display_name, status')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .limit(20);

    if (fallback.error) throw new Error(fallback.error.message);

    return (fallback.data ?? []).map((driver) => ({
      id: driver.id,
      display_name: driver.display_name,
      availability_status: null,
      status: driver.status,
    }));
  }

  throw new Error(result.error.message);
};

const loadInvoicesWithCompat = async (companyId: string): Promise<InvoiceRow[]> => {
  const { rows, missingColumns, error } = await loadInvoicesWithSchemaCompat(supabase, companyId, [
    'id',
    'invoice_number',
    'status',
    'payment_status',
    'due_date',
    'amount',
    'client_name',
    'created_at',
  ]);
  if (error) {
    throw new Error(error.message ?? 'Failed to load invoices.');
  }

  return rows.map((row, index) => ({
    id: String(row.id ?? `invoice-${index}`),
    invoice_number: missingColumns.has('invoice_number') ? 'Invoice' : String(row.invoice_number ?? 'Invoice'),
    status: toCanonicalInvoiceDisplayStatus(
      missingColumns.has('status') ? null : String(row.status ?? null),
      missingColumns.has('due_date') ? String(row.created_at ?? new Date().toISOString()) : String(row.due_date ?? row.created_at ?? new Date().toISOString()),
      missingColumns.has('payment_status') ? null : String(row.payment_status ?? null)
    ),
    payment_status: missingColumns.has('payment_status') ? null : String(row.payment_status ?? null),
    due_date: missingColumns.has('due_date')
      ? String(row.created_at ?? new Date().toISOString())
      : String(row.due_date ?? row.created_at ?? new Date().toISOString()),
    amount: missingColumns.has('amount')
      ? null
      : typeof row.amount === 'number'
        ? row.amount
        : row.amount == null
          ? null
          : Number(row.amount),
    client_name: resolveInvoiceClientName(row),
    created_at: String(row.created_at ?? new Date().toISOString()),
  }));
};

const loadVehicleDocumentsWithCompat = async (companyId: string): Promise<DocRow[]> => {
  const vehiclesRes = await supabase.from('vehicles').select('id').eq('company_id', companyId);
  if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);

  const vehicleIds = (vehiclesRes.data ?? []).map((vehicle) => vehicle.id).filter(Boolean);
  if (vehicleIds.length === 0) return [];
  const { rows, missingColumns, error } = await selectWithMissingColumnFallback<Record<string, unknown>>({
    table: 'vehicle_documents',
    columns: ['id', 'status', 'expiry_date', 'vehicle_id'],
    execute: async (activeColumns) => {
      const result = await supabase
        .from('vehicle_documents')
        .select(activeColumns.join(', '))
        .in('vehicle_id', vehicleIds);
      return {
        data: ((result.data ?? []) as unknown) as Record<string, unknown>[],
        error: result.error,
      };
    },
  });
  if (error) {
    throw new Error(error.message ?? 'Failed to load vehicle documents.');
  }

  return rows.map((row, index) => ({
    id: String(row.id ?? `vehicle-doc-${index}`),
    status: missingColumns.has('status') ? 'pending' : String(row.status ?? 'pending'),
    expiry_date: missingColumns.has('expiry_date') ? null : (row.expiry_date == null ? null : String(row.expiry_date)),
  }));
};

const getInvoiceStatus = (_dueDate: string, currentStatus: string) => currentStatus;

const isExpiringSoon = (expiryDate: string | null, days: number) => {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diff = expiry.getTime() - today.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const resolveBidAmountGbp = (bid: Pick<BidRow, 'bid_price_gbp' | 'amount'>): number | null => {
  if (typeof bid.bid_price_gbp === 'number') return bid.bid_price_gbp;
  if (typeof bid.amount === 'number') return bid.amount;
  return null;
};

const formatTimestamp = (value: string) => new Date(value).toLocaleString('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default function AdminPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  const [companyResolved, setCompanyResolved] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardState>(DEFAULT_DASHBOARD);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [driverAvailability, setDriverAvailability] = useState<DriverAvailRow[]>([]);
  const [postedJobsForDispatch, setPostedJobsForDispatch] = useState<PostedJobDispatch[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlertRow[]>([]);

  const activeRole = mapAppRole(user?.role ?? null);
  const navSections = getNavSectionsForRole(activeRole, {
    membershipRole: user?.membershipRole ?? null,
    financeAccess: user?.financeAccess ?? null,
    ownerDriverWorkspace: user?.ownerDriverWorkspace === true,
  });

  const roleLabel: Record<string, string> = {
    owner: 'Owner',
    broker: 'Broker',
    company_admin: 'Company Admin',
    company_staff: 'Dispatcher',
    driver: 'Driver',
    customer: 'Customer',
  };
  const activeRoleLabel = user?.ownerDriverWorkspace ? 'Owner Operator' : activeRole ? (roleLabel[activeRole] ?? activeRole) : 'Platform';
  const companyLabel = COMPANY_CONFIG.legalName;

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth <= 1024);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setResolvedCompanyId(null);
      setCompanyResolved(false);
      return;
    }

    if (user.companyId) {
      setResolvedCompanyId(user.companyId);
      setCompanyResolved(true);
      return;
    }

    setCompanyResolved(false);
    resolveActiveCompanyId({
      userId: user.id,
      fallbackCompanyId: user.companyId ?? null,
    }).then((companyId) => {
      if (cancelled) return;
      setResolvedCompanyId(companyId);
      setCompanyResolved(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (!companyResolved) {
        return;
      }

      setDashboardLoading(true);

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setDashboard(DEFAULT_DASHBOARD);
          setDashboardError('Supabase is not configured. Dashboard insights are unavailable.');
          setDashboardLoading(false);
        }
        return;
      }

      if (!resolvedCompanyId) {
        if (!cancelled) {
          setDashboard(DEFAULT_DASHBOARD);
          setDashboardError('Company profile not available. Dashboard insights are hidden until company access resolves.');
          setDashboardLoading(false);
        }
        return;
      }

      const todayUtc = new Date().toISOString().slice(0, 10);
      // Six separate job-count queries (indices 0,1,4,5,6,7) were replaced with
      // a single status fetch (index 0); counts are computed client-side.
      // Quotes count query (index 3) was removed; count is derived from the list.
      // 14 → 9 parallel Supabase queries on dashboard load.
      const dashboardModules = [
        {
          label: 'job statuses',
          run: rowsQuery<{ status: string; updated_at: string }>(
          supabase
            .from('jobs')
            .select('status, updated_at')
            .eq('company_id', resolvedCompanyId)
          ),
        },
        {
          label: 'drivers count',
          run: countQuery(
          supabase
            .from('drivers')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .eq('status', 'active')
          ),
        },
        {
          label: 'recent jobs',
          run: rowsQuery<JobRow>(
          supabase
            .from('jobs')
            .select('id, status, pickup_location, delivery_location, created_at, updated_at')
            .eq('company_id', resolvedCompanyId)
            .order('updated_at', { ascending: false })
            .limit(5)
          ),
        },
        {
          label: 'quotes list',
          run: rowsQuery<QuoteRow>(
          supabase
            .from('quotes')
            .select('id, status, customer_name, amount, created_at')
            .eq('company_id', resolvedCompanyId)
            .order('created_at', { ascending: false })
          ),
        },
        {
          label: 'invoices list',
          run: loadInvoicesWithCompat(resolvedCompanyId),
        },
        {
          label: 'job bids list',
          run: rowsQuery<BidRow>(
          supabase
            .from('job_bids')
            .select('id, status, amount, bid_price_gbp, created_at, jobs!inner(company_id)')
            .eq('jobs.company_id', resolvedCompanyId)
            .order('created_at', { ascending: false })
          ),
        },
        {
          label: 'driver documents list',
          run: rowsQuery<DocRow>(
          supabase
            .from('driver_documents')
            .select('id, status, expiry_date, drivers!inner(company_id)')
            .eq('drivers.company_id', resolvedCompanyId)
          ),
        },
        {
          label: 'vehicle documents list',
          run: loadVehicleDocumentsWithCompat(resolvedCompanyId),
        },
        {
          label: 'fleet units count',
          run: countQuery(
          supabase
            .from('vehicles')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
          ),
        },
        {
          label: 'driver availability',
          run: loadDriverAvailabilityWithCompat(resolvedCompanyId),
        },
        {
          label: 'posted jobs for dispatch',
          run: rowsQuery<PostedJobDispatch>(
          supabase
            .from('jobs')
            .select('id, pickup_location, delivery_location, created_at')
            .eq('company_id', resolvedCompanyId)
            .eq('status', 'posted')
            .order('created_at', { ascending: true })
            .limit(5)
          ),
        },
      ];
      const results = await Promise.allSettled(dashboardModules.map((module) => module.run));

      if (cancelled) return;

      const getValue = <T,>(index: number, fallback: T): T => {
        const result = results[index];
        return result.status === 'fulfilled' ? result.value as T : fallback;
      };

      const failedModules = results
        .map((result, index) => (result.status === 'rejected' ? dashboardModules[index].label : null))
        .filter((value): value is string => Boolean(value));
      // Derive job counts client-side from the single job-statuses query (index 0).
      const jobStatuses = getValue<{ status: string; updated_at: string }[]>(0, []);
      const activeJobs = jobStatuses.filter((j) => ['posted', 'allocated', 'in_transit'].includes(j.status)).length;
      const completedToday = jobStatuses.filter((j) => j.status === 'delivered' && (j.updated_at ?? '').slice(0, 10) >= todayUtc).length;
      const postedCount = jobStatuses.filter((j) => j.status === 'posted').length;
      const allocatedCount = jobStatuses.filter((j) => j.status === 'allocated').length;
      const inTransitCount = jobStatuses.filter((j) => j.status === 'in_transit').length;
      const deliveredCount = jobStatuses.filter((j) => j.status === 'delivered').length;
      const recentJobs = getValue<JobRow[]>(2, []);
      const quotes = getValue<QuoteRow[]>(3, []);
      const invoices = getValue<InvoiceRow[]>(4, []);
      const bids = getValue<BidRow[]>(5, []);
      const driverDocs = getValue<DocRow[]>(6, []);
      const vehicleDocs = getValue<DocRow[]>(7, []);
      const fleetUnits = getValue<number>(8, 0);
      const driverAvailData = getValue<DriverAvailRow[]>(9, []);
      const postedDispatchData = getValue<PostedJobDispatch[]>(10, []);
      setDriverAvailability(driverAvailData);
      setPostedJobsForDispatch(postedDispatchData);
      // Derive quotes count from list (no separate count query needed).
      const pendingQuotes = quotes.filter((q) => ['draft', 'sent'].includes(q.status)).length;
      const documentRows = [...driverDocs, ...vehicleDocs];
      const openInvoices = invoices.filter((invoice) => {
        const status = getInvoiceStatus(invoice.due_date, invoice.status);
        return status !== 'Paid';
      });
      const overdueInvoices = invoices.filter((invoice) => getInvoiceStatus(invoice.due_date, invoice.status) === 'Overdue');
      const attentionDocs = documentRows.filter((doc) => doc.status === 'expired' || doc.status === 'rejected');
      const expiringDocs = documentRows.filter((doc) => doc.status !== 'expired' && isExpiringSoon(doc.expiry_date, 30));
      const activity = [
        ...recentJobs.map((job) => ({
          id: `job-${job.id}`,
          icon: '📦',
          title: `Job ${job.status.replace(/_/g, ' ')}`,
          meta: `${job.pickup_location || 'Pickup TBD'} → ${job.delivery_location || 'Delivery TBD'}`,
          date: job.updated_at || job.created_at,
          href: '/admin/jobs',
        })),
        ...quotes.slice(0, 4).map((quote) => ({
          id: `quote-${quote.id}`,
          icon: '💬',
          title: `${quote.status === 'accepted' ? 'Accepted' : quote.status === 'sent' ? 'Sent' : 'Quote draft'} quote`,
          meta: `${quote.customer_name || 'Customer pending'}${typeof quote.amount === 'number' ? ` • ${formatCurrency(quote.amount)}` : ''}`,
          date: quote.created_at,
          href: '/admin/quotes',
        })),
        ...invoices.slice(0, 4).map((invoice) => ({
          id: `invoice-${invoice.id}`,
          icon: '💰',
          title: `${getInvoiceStatus(invoice.due_date, invoice.status)} invoice ${invoice.invoice_number}`,
          meta: `${invoice.client_name || 'Client pending'}${typeof invoice.amount === 'number' ? ` • ${formatCurrency(invoice.amount)}` : ''}`,
          date: invoice.created_at,
          href: '/admin/invoices',
        })),
        ...bids.slice(0, 4).map((bid) => ({
          id: `bid-${bid.id}`,
          icon: '💼',
          title: `${bid.status === 'submitted' ? 'Incoming' : bid.status} bid`,
          meta: (() => {
            const bidAmount = resolveBidAmountGbp(bid);
            return typeof bidAmount === 'number' ? formatCurrency(bidAmount) : 'Bid amount pending';
          })(),
          date: bid.created_at,
          href: '/admin/bids',
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8);

      setDashboard({
        overview: {
          activeJobs: activeJobs,
          completedToday: completedToday,
          activeDrivers: getValue<number>(1, 0),
          pendingQuotes: pendingQuotes,
        },
        jobsByStatus: {
          posted: postedCount,
          allocated: allocatedCount,
          inTransit: inTransitCount,
          delivered: deliveredCount,
        },
        finance: {
          outstandingInvoices: openInvoices.length,
          overdueInvoices: overdueInvoices.length,
          outstandingRevenue: openInvoices.reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0),
        },
        compliance: {
          pendingDocs: documentRows.filter((doc) => doc.status === 'pending').length,
          expiringSoon: expiringDocs.length,
          attentionRequired: attentionDocs.length,
        },
        market: {
          incomingBids: bids.filter((bid) => bid.status === 'submitted').length,
          acceptedQuotes: quotes.filter((quote) => quote.status === 'accepted').length,
          recentInvoiceValue: invoices.slice(0, 5).reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0),
          deliveryBacklog: activeJobs + pendingQuotes,
        },
        resources: {
          fleetUnits,
          pendingQuoteApprovals: quotes.filter((quote) => quote.status === 'sent').length,
          driverCoverageGap: Math.max(activeJobs - getValue<number>(1, 0), 0),
        },
        activity,
      });
      setDashboardError(
        failedModules.length > 0
          ? `Some dashboard modules could not be loaded. Failed: ${failedModules.join(', ')}.`
          : ''
      );
      setDashboardLoading(false);
    };

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [companyResolved, resolvedCompanyId]);

  // ── Compliance expiry alerts (detailed) ────────────────────────────────────
  useEffect(() => {
    if (!resolvedCompanyId || !isSupabaseConfigured) return;
    let active = true;

    const loadExpiry = async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const cutoff = thirtyDaysFromNow.toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const [ddRes, vdRes] = await Promise.all([
        supabase
          .from('driver_documents')
          .select('id, doc_type, expiry_date, status, drivers!inner(company_id, display_name)')
          .eq('drivers.company_id', resolvedCompanyId)
          .gte('expiry_date', today)
          .lte('expiry_date', cutoff)
          .neq('status', 'expired')
          .order('expiry_date', { ascending: true })
          .limit(10),
        supabase
          .from('vehicle_documents')
          .select('id, doc_type, expiry_date, status, vehicles!inner(company_id, reg_plate)')
          .eq('vehicles.company_id', resolvedCompanyId)
          .gte('expiry_date', today)
          .lte('expiry_date', cutoff)
          .neq('status', 'expired')
          .order('expiry_date', { ascending: true })
          .limit(10),
      ]);

      if (!active) return;

      type RawDriverDoc = { id: string; doc_type: string; expiry_date: string; status: string; drivers: { display_name: string | null } | Array<{ display_name: string | null }> | null };
      type RawVehicleDoc = { id: string; doc_type: string; expiry_date: string; status: string; vehicles: { reg_plate: string | null } | Array<{ reg_plate: string | null }> | null };

      const driverAlerts: ExpiryAlertRow[] = ((ddRes.data ?? []) as unknown as RawDriverDoc[]).map((d) => ({
        id: d.id,
        doc_type: d.doc_type,
        expiry_date: d.expiry_date,
        status: d.status,
        entity_name: (Array.isArray(d.drivers) ? d.drivers[0]?.display_name : d.drivers?.display_name) ?? 'Unknown driver',
        entity_kind: 'driver' as const,
      }));
      const vehicleAlerts: ExpiryAlertRow[] = ((vdRes.data ?? []) as unknown as RawVehicleDoc[]).map((v) => ({
        id: v.id,
        doc_type: v.doc_type,
        expiry_date: v.expiry_date,
        status: v.status,
        entity_name: (Array.isArray(v.vehicles) ? v.vehicles[0]?.reg_plate : v.vehicles?.reg_plate) ?? 'Unknown vehicle',
        entity_kind: 'vehicle' as const,
      }));

      const combined = [...driverAlerts, ...vehicleAlerts]
        .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
        .slice(0, 10);
      setExpiryAlerts(combined);
    };

    void loadExpiry();
    return () => { active = false; };
  }, [resolvedCompanyId]);

  const sectionCardStyle: CSSProperties = {
    backgroundColor: ENTERPRISE_THEME.cardBg,
    padding: ENTERPRISE_THEME.spacing.lg,
    borderRadius: ENTERPRISE_THEME.radius,
    border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
    boxShadow: ENTERPRISE_THEME.cardShadow,
  };

  const availableDrivers = driverAvailability.filter((driver) => (driver.availability_status ?? driver.status ?? 'unknown') === 'available');
  const visibleDriverCards = (availableDrivers.length > 0 ? availableDrivers : driverAvailability).slice(0, 6);
  const currentModuleLabel = 'Platform Home';
  const nextPriority = dashboard.jobsByStatus.posted > 0
    ? `${dashboard.jobsByStatus.posted} load${dashboard.jobsByStatus.posted !== 1 ? 's' : ''} need allocation`
    : dashboard.finance.overdueInvoices > 0
      ? `${dashboard.finance.overdueInvoices} overdue invoice${dashboard.finance.overdueInvoices !== 1 ? 's' : ''}`
      : dashboard.compliance.attentionRequired > 0
        ? `${dashboard.compliance.attentionRequired} compliance alert${dashboard.compliance.attentionRequired !== 1 ? 's' : ''}`
        : 'Review module activity';

  const contextCards = [
    {
      label: 'Who is the user?',
      value: user?.email ?? 'Signed-in user',
      description: activeRoleLabel,
    },
    {
      label: 'What module are they in?',
      value: currentModuleLabel,
      description: 'Module-first platform shell',
    },
    {
      label: 'Which company context?',
      value: resolvedCompanyId ? companyLabel : 'Company pending',
      description: resolvedCompanyId ? 'Company workspace resolved' : 'Resolve company access to continue',
    },
    {
      label: 'What action is next?',
      value: nextPriority,
      description: 'Open the linked module to continue',
    },
  ];

  const moduleCards: Array<{
    id: string;
    label: string;
    icon: string;
    href: string;
    summary: string;
    metric: string | number;
    metricLabel: string;
    detail: string;
    accent: string;
    secondaryHref?: string;
    secondaryLabel?: string;
    roles?: AppUserRole[];
  }> = [
    {
      id: 'marketplace',
      label: 'Marketplace / Loads',
      icon: '🏪',
      href: '/admin/marketplace',
      summary: 'Find loads, post work, and manage load-board visibility.',
      metric: dashboard.jobsByStatus.posted,
      metricLabel: 'Published loads',
      detail: dashboard.jobsByStatus.posted > 0 ? 'Published loads are waiting for diary allocation.' : 'No published loads are waiting for allocation.',
      accent: '#0f766e',
    },
    {
      id: 'quotes-bids',
      label: 'Quotes & Bids',
      icon: '💬',
      href: '/admin/quotes',
      summary: 'Handle inbound quotes, outbound pricing, and bid outcomes.',
      metric: dashboard.overview.pendingQuotes + dashboard.market.incomingBids,
      metricLabel: 'Commercial actions',
      detail: `${dashboard.overview.pendingQuotes} quotes pending • ${dashboard.market.incomingBids} bids received`,
      accent: '#c2410c',
      secondaryHref: '/admin/bids',
      secondaryLabel: 'Open bids',
    },
    {
      id: 'diary',
      label: 'Diary / Operations',
      icon: '🗓️',
      href: '/admin/diary',
      summary: 'Allocate loads, follow progress, and close operational work.',
      metric: dashboard.overview.activeJobs,
      metricLabel: 'Live jobs',
      detail: `${dashboard.jobsByStatus.posted} awaiting allocation • ${dashboard.jobsByStatus.inTransit} in transit`,
      accent: '#1d4ed8',
      secondaryHref: '/admin/jobs',
      secondaryLabel: 'Open jobs',
    },
    {
      id: 'fleet',
      label: 'Fleet',
      icon: '🧭',
      href: '/admin/fleet',
      summary: 'Monitor available capacity, live positions, and future coverage.',
      metric: dashboard.resources.fleetUnits,
      metricLabel: 'Fleet units',
      detail: `${dashboard.resources.driverCoverageGap} coverage gap • ${dashboard.jobsByStatus.inTransit} moving now`,
      accent: '#4338ca',
    },
    {
      id: 'drivers',
      label: 'Drivers',
      icon: '👤',
      href: '/admin/drivers',
      summary: 'Manage driver roster, app access, and readiness to operate.',
      metric: dashboard.overview.activeDrivers,
      metricLabel: 'Active drivers',
      detail: `${availableDrivers.length} available right now`,
      accent: '#15803d',
    },
    {
      id: 'vehicles',
      label: 'Vehicles',
      icon: '🚛',
      href: '/admin/vehicles',
      summary: 'Maintain vehicle records, capability data, and assignments.',
      metric: dashboard.resources.fleetUnits,
      metricLabel: 'Vehicle records',
      detail: 'Keep vehicle capacity and capability data up to date.',
      accent: '#0f766e',
    },
    {
      id: 'compliance',
      label: 'Compliance / Documents',
      icon: '📄',
      href: '/admin/documents',
      summary: 'Track document verification, expiry, and operating readiness.',
      metric: dashboard.compliance.attentionRequired,
      metricLabel: 'Alerts',
      detail: `${dashboard.compliance.pendingDocs} pending • ${dashboard.compliance.expiringSoon} expiring soon`,
      accent: '#7c3aed',
    },
    {
      id: 'finance',
      label: 'Finance / Invoices',
      icon: '💰',
      href: '/admin/invoices',
      summary: 'Issue invoices, monitor receivables, and follow payment status.',
      metric: dashboard.finance.outstandingInvoices,
      metricLabel: 'Open invoices',
      detail: `${dashboard.finance.overdueInvoices} overdue • ${formatCurrency(dashboard.finance.outstandingRevenue)} outstanding`,
      accent: '#047857',
      secondaryHref: '/admin/invoices/new',
      secondaryLabel: 'Create invoice',
    },
    {
      id: 'network',
      label: 'Network / Companies',
      icon: '🏢',
      href: '/admin/companies',
      summary: 'Manage companies, memberships, and trading relationships.',
      metric: resolvedCompanyId ? 'Active' : 'Pending',
      metricLabel: 'Company context',
      detail: resolvedCompanyId ? `${companyLabel} is ready in the network workspace.` : 'Resolve company context before trading.',
      accent: '#0f172a',
    },
    {
      id: 'administration',
      label: 'Administration',
      icon: '⚙️',
      href: '/admin/settings',
      summary: 'Govern settings, memberships, defaults, and security.',
      metric: activeRoleLabel,
      metricLabel: 'Current role',
      detail: 'Use settings and memberships to manage company governance.',
      accent: '#334155',
      secondaryHref: '/admin/dispatchers',
      secondaryLabel: 'Open memberships',
      roles: ['owner', 'company_admin'],
    },
  ];

  const visibleModuleCards = moduleCards.filter((card) => !card.roles || (activeRole ? card.roles.includes(activeRole) : false));

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: ENTERPRISE_THEME.pageBg }}>
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.5)', zIndex: 30 }}
          />
        )}
        <aside
          style={{
            width: isMobile ? '270px' : '228px',
            backgroundColor: ENTERPRISE_THEME.shellBg,
            color: ENTERPRISE_THEME.shellText,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${ENTERPRISE_THEME.shellBorder}`,
            position: isMobile ? 'fixed' : 'relative',
            inset: isMobile ? '0 auto 0 0' : undefined,
            zIndex: isMobile ? 40 : undefined,
            transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
            transition: 'transform 0.2s ease',
          }}
        >
          <div style={{ padding: '1.1rem 1rem', borderBottom: `1px solid ${ENTERPRISE_THEME.shellBorder}` }}>
            <h1 style={{ fontSize: '1.02rem', fontWeight: '700', margin: 0, color: ENTERPRISE_THEME.shellText, lineHeight: 1.35 }}>{companyLabel}</h1>
            <p style={{ fontSize: '0.72rem', margin: '0.3rem 0 0 0', color: ENTERPRISE_THEME.shellMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              XDrive platform
            </p>
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ENTERPRISE_THEME.shellMuted }}>Role</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
                  {activeRoleLabel}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ENTERPRISE_THEME.shellMuted }}>Module</span>
                <span style={{ fontSize: '0.72rem', color: ENTERPRISE_THEME.shellMuted }}>{currentModuleLabel}</span>
              </div>
            </div>
          </div>

          <nav style={{ flex: 1, padding: '0.6rem', overflowY: 'auto' }}>
            {navSections.map((section) => (
              <div key={section.id} style={{ marginBottom: '0.7rem' }}>
                <div
                  style={{
                    fontSize: '0.67rem',
                    color: ENTERPRISE_THEME.shellMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                    margin: '0.35rem 0.5rem',
                  }}
                >
                  {section.label}
                </div>
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <button
                      className="nav-item"
                      key={item.id}
                      onClick={() => {
                        router.push(item.href);
                        if (isMobile) setSidebarOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.58rem 0.72rem',
                        backgroundColor: isActive ? '#eff6ff' : 'transparent',
                        color: ENTERPRISE_THEME.shellText,
                        borderTop: 'none',
                        borderRight: 'none',
                        borderBottom: 'none',
                        borderLeft: isActive ? `3px solid ${ENTERPRISE_THEME.colors.live}` : '3px solid transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        fontSize: '0.82rem',
                        fontWeight: isActive ? '600' : '500',
                        borderRadius: '8px',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '0.88rem',
                          backgroundColor: isActive ? '#dbeafe' : '#e2e8f0',
                        }}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div style={{ padding: '0.9rem', borderTop: `1px solid ${ENTERPRISE_THEME.shellBorder}` }}>
            <div style={{ fontSize: '0.74rem', color: ENTERPRISE_THEME.shellMuted, marginBottom: '0.35rem', wordBreak: 'break-word' }}>
              {user?.email}
            </div>
            <button
              className="panel-button"
              onClick={() => router.push('/admin/settings')}
              style={{
                width: '100%',
                padding: '0.52rem',
                backgroundColor: '#ffffff',
                color: ENTERPRISE_THEME.shellText,
                border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '0.45rem',
              }}
            >
              Open settings
            </button>
            <button
              className="panel-button"
              onClick={logout}
              style={{
                width: '100%',
                padding: '0.52rem',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, padding: isMobile ? '0.9rem' : '1.2rem', marginLeft: isMobile ? 0 : undefined }}>
          {isMobile && (
            <button
              className="panel-button"
              onClick={() => setSidebarOpen(true)}
              style={{
                padding: '0.5rem 0.72rem',
                borderRadius: '8px',
                border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
                backgroundColor: 'white',
                color: ENTERPRISE_THEME.colors.text,
                fontWeight: '700',
                marginBottom: '0.85rem',
                cursor: 'pointer',
                fontSize: '0.83rem',
              }}
            >
              ☰ Modules
            </button>
          )}

          <section style={{ ...sectionCardStyle, marginBottom: '0.9rem', padding: isMobile ? '1rem' : '1.15rem 1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ maxWidth: '760px' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  XDrive Logistics Ltd
                </div>
                <h2 style={{ fontSize: '1.55rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: '0 0 0.25rem 0' }}>Platform Home</h2>
                <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: 0, fontSize: '0.9rem', lineHeight: 1.55 }}>
                  Start from the right module for the role, company context, and next transport action. Marketplace, commercial work, operations, fleet, compliance, finance, network, and administration stay clearly separated.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button
                  className="panel-button"
                  onClick={() => router.push('/admin/marketplace')}
                  style={{
                    padding: '0.58rem 0.95rem',
                    backgroundColor: ENTERPRISE_THEME.colors.live,
                    border: `1px solid ${ENTERPRISE_THEME.colors.live}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.83rem',
                    fontWeight: '600',
                    color: 'white',
                  }}
                >
                  Open marketplace
                </button>
                <button
                  className="panel-button"
                  onClick={() => router.push('/admin/diary')}
                  style={{
                    padding: '0.58rem 0.95rem',
                    backgroundColor: '#ffffff',
                    border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.83rem',
                    fontWeight: '600',
                    color: ENTERPRISE_THEME.colors.text,
                  }}
                >
                  Open diary
                </button>
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
            {contextCards.map((card) => (
              <section key={card.label} style={{ ...sectionCardStyle, padding: '0.85rem 0.95rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '0.96rem', fontWeight: 700, color: ENTERPRISE_THEME.colors.text, marginBottom: '0.18rem', wordBreak: 'break-word' }}>
                  {dashboardLoading && card.label === 'What action is next?' ? 'Loading…' : card.value}
                </div>
                <div style={{ fontSize: '0.76rem', color: ENTERPRISE_THEME.colors.muted }}>{card.description}</div>
              </section>
            ))}
          </div>

          {dashboardError && (
            <div
              style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '0.75rem 0.9rem',
                marginBottom: '0.9rem',
                color: '#92400e',
                fontWeight: '600',
                fontSize: '0.83rem',
              }}
            >
              {dashboardError}
            </div>
          )}

          {(dashboard.jobsByStatus.posted > 0 || dashboard.finance.overdueInvoices > 0 || dashboard.compliance.attentionRequired > 0) && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                backgroundColor: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem',
                marginBottom: '0.9rem',
              }}
              data-testid="admin-needs-attention-bar"
            >
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#9a3412', marginRight: '0.25rem' }}>Needs attention</span>
              {dashboard.jobsByStatus.posted > 0 && (
                <button
                  className="panel-button"
                  onClick={() => router.push('/admin/diary')}
                  style={{ backgroundColor: '#fbbf24', color: '#78350f', border: 'none', borderRadius: '999px', padding: '0.28rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Diary / Operations: {dashboard.jobsByStatus.posted} awaiting allocation
                </button>
              )}
              {dashboard.finance.overdueInvoices > 0 && (
                <button
                  className="panel-button"
                  onClick={() => router.push('/admin/invoices')}
                  style={{ backgroundColor: '#f87171', color: '#7f1d1d', border: 'none', borderRadius: '999px', padding: '0.28rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Finance / Invoices: {dashboard.finance.overdueInvoices} overdue
                </button>
              )}
              {dashboard.compliance.attentionRequired > 0 && (
                <button
                  className="panel-button"
                  onClick={() => router.push('/admin/documents')}
                  style={{ backgroundColor: '#a78bfa', color: '#2e1065', border: 'none', borderRadius: '999px', padding: '0.28rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Compliance / Documents: {dashboard.compliance.attentionRequired} alert{dashboard.compliance.attentionRequired !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          <section style={{ marginBottom: '0.9rem' }}>
            <div style={{ marginBottom: '0.65rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Platform modules</h3>
              <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
                Open the correct workspace by business module, not from a single command-centre board.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {visibleModuleCards.map((card) => (
                <section key={card.id} className="module-card" style={{ ...sectionCardStyle, padding: '0.95rem', borderTop: `3px solid ${card.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: ENTERPRISE_THEME.colors.muted, lineHeight: 1.45 }}>{card.summary}</div>
                    </div>
                    <span style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'grid', placeItems: 'center', backgroundColor: '#f8fafc', fontSize: '1rem' }}>
                      {card.icon}
                    </span>
                  </div>
                  <div style={{ marginBottom: '0.55rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.18rem' }}>
                      {card.metricLabel}
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: card.accent }}>
                      {dashboardLoading ? '…' : card.metric}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: ENTERPRISE_THEME.colors.muted, lineHeight: 1.45, marginBottom: '0.75rem' }}>
                    {dashboardLoading ? 'Loading module summary…' : card.detail}
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      className="panel-button"
                      onClick={() => router.push(card.href)}
                      style={{
                        padding: '0.46rem 0.72rem',
                        borderRadius: '7px',
                        border: 'none',
                        backgroundColor: card.accent,
                        color: 'white',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.76rem',
                      }}
                    >
                      Open module
                    </button>
                    {card.secondaryHref && card.secondaryLabel && (
                      <button
                        className="panel-button"
                        onClick={() => router.push(card.secondaryHref!)}
                        style={{
                          padding: '0.46rem 0.72rem',
                          borderRadius: '7px',
                          border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
                          backgroundColor: '#ffffff',
                          color: ENTERPRISE_THEME.colors.text,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.76rem',
                        }}
                      >
                        {card.secondaryLabel}
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
            <section style={sectionCardStyle} data-testid="admin-operations-watchlist">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.68rem', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Diary / Operations</h3>
                  <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>
                    Jobs currently waiting for allocation into the operations diary.
                  </p>
                </div>
                <button
                  className="panel-button"
                  onClick={() => router.push('/admin/diary')}
                  style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: ENTERPRISE_THEME.colors.live, cursor: 'pointer', fontWeight: '600' }}
                >
                  Open diary →
                </button>
              </div>
              {dashboardLoading ? (
                <div style={{ color: ENTERPRISE_THEME.colors.muted, fontSize: '0.82rem' }}>Loading…</div>
              ) : postedJobsForDispatch.length === 0 ? (
                <div style={{ color: ENTERPRISE_THEME.colors.muted, fontSize: '0.82rem', padding: '0.4rem 0' }}>No jobs are currently awaiting allocation.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {postedJobsForDispatch.map((job) => (
                    <button
                      key={job.id}
                      className="activity-row"
                      onClick={() => router.push('/admin/diary')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        width: '100%',
                        padding: '0.58rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#fffbeb',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      data-testid={`admin-dispatch-job-${job.id}`}
                    >
                      <span style={{ fontSize: '1rem', width: '24px', display: 'grid', placeItems: 'center' }}>📦</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', color: ENTERPRISE_THEME.colors.text, marginBottom: '0.15rem', fontSize: '0.82rem' }}>
                          #{job.id.slice(0, 8).toUpperCase()}
                        </div>
                        <div style={{ color: ENTERPRISE_THEME.colors.muted, fontSize: '0.76rem' }}>
                          {job.pickup_location ?? 'Pickup TBC'} → {job.delivery_location ?? 'Delivery TBC'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section style={sectionCardStyle} data-testid="admin-driver-availability-board">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.68rem', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Drivers</h3>
                  <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>
                    Driver readiness summary for the current company context.
                  </p>
                </div>
                <button
                  className="panel-button"
                  onClick={() => router.push('/admin/drivers')}
                  style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: ENTERPRISE_THEME.colors.live, cursor: 'pointer', fontWeight: '600' }}
                >
                  Manage drivers →
                </button>
              </div>
              {dashboardLoading ? (
                <div style={{ color: ENTERPRISE_THEME.colors.muted, fontSize: '0.82rem' }}>Loading…</div>
              ) : visibleDriverCards.length === 0 ? (
                <div style={{ color: ENTERPRISE_THEME.colors.muted, fontSize: '0.82rem', padding: '0.4rem 0' }}>No active drivers found.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {visibleDriverCards.map((driver) => {
                    const availability = driver.availability_status ?? driver.status ?? 'unknown';
                    const availabilityLabel = availability === 'available'
                      ? 'Available'
                      : availability === 'busy'
                        ? 'On a job'
                        : availability === 'offline'
                          ? 'Offline'
                          : availability;

                    return (
                      <div
                        key={driver.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.6rem',
                          backgroundColor: availability === 'available' ? '#f0fdf4' : '#f8fafc',
                          border: `1px solid ${availability === 'available' ? '#bbf7d0' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          padding: '0.55rem 0.7rem',
                        }}
                        data-testid={`admin-driver-avail-${driver.id}`}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.82rem', color: ENTERPRISE_THEME.colors.text, marginBottom: '0.1rem' }}>
                            {driver.display_name ?? 'Driver'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: ENTERPRISE_THEME.colors.muted }}>{availabilityLabel}</div>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: availability === 'available' ? '#15803d' : '#475569' }}>
                          {availability === 'available' ? 'Ready now' : 'Monitor'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Compliance Expiry Alerts widget ──────────────────────── */}
            <section style={{ ...sectionCardStyle, borderTop: '3px solid #a78bfa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.68rem', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Compliance Expiry Alerts</h3>
                  <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>
                    Documents expiring within the next 30 days.
                  </p>
                </div>
                <button
                  className="panel-button"
                  onClick={() => router.push('/admin/documents')}
                  style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: ENTERPRISE_THEME.colors.live, cursor: 'pointer', fontWeight: '600' }}
                >
                  View all →
                </button>
              </div>
              {dashboardLoading ? (
                <div style={{ color: ENTERPRISE_THEME.colors.muted, fontSize: '0.82rem' }}>Loading…</div>
              ) : expiryAlerts.length === 0 ? (
                <div style={{ color: '#15803d', fontSize: '0.82rem', padding: '0.4rem 0', fontWeight: 600 }}>✓ No documents expiring in the next 30 days.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {expiryAlerts.map((alert) => {
                    const daysLeft = Math.ceil((new Date(alert.expiry_date).getTime() - Date.now()) / 86_400_000);
                    const urgent = daysLeft <= 7;
                    return (
                      <div
                        key={alert.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.6rem',
                          backgroundColor: urgent ? '#fef3c7' : '#f8fafc',
                          border: `1px solid ${urgent ? '#fcd34d' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          padding: '0.55rem 0.7rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.82rem', color: ENTERPRISE_THEME.colors.text, marginBottom: '0.1rem' }}>
                            {alert.doc_type.replace(/_/g, ' ')} — {alert.entity_name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: ENTERPRISE_THEME.colors.muted }}>
                            {alert.entity_kind === 'driver' ? '👤 Driver' : '🚛 Vehicle'} · Expires {new Date(alert.expiry_date).toLocaleDateString('en-GB')}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: urgent ? '#92400e' : '#475569',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {daysLeft}d left
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.68rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Platform activity</h3>
                  <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Recent confirmed activity across jobs, quotes, bids, and invoices.</p>
                </div>
              </div>
              {dashboard.activity.length === 0 ? (
                <div style={{ padding: '0.6rem 0', color: ENTERPRISE_THEME.colors.muted, fontSize: '0.8rem' }}>No recent activity yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {dashboard.activity.map((item) => (
                    <button
                      className="activity-row"
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.6rem',
                        width: '100%',
                        padding: '0.58rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '1rem', width: '24px', display: 'grid', placeItems: 'center' }}>{item.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', color: ENTERPRISE_THEME.colors.text, marginBottom: '0.15rem', fontSize: '0.82rem' }}>{item.title}</div>
                        <div style={{ color: ENTERPRISE_THEME.colors.muted, fontSize: '0.76rem' }}>{item.meta}</div>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{formatTimestamp(item.date)}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <style jsx>{`
            .nav-item:hover {
              background-color: #f1f5f9;
            }
            .panel-button:hover {
              filter: brightness(0.98);
            }
            .activity-row:hover,
            .module-card:hover {
              background-color: #f8fafc;
            }
          `}</style>
        </main>
      </div>
    </ProtectedRoute>
  );
}
