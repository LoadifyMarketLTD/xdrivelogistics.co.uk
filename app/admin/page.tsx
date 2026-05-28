'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { COMPANY_CONFIG } from '../config/company';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import {
  getMissingColumnFromError,
  isMissingColumnError,
  isMissingRelationshipError,
} from '../../lib/supabaseSchemaCompat';

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

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/admin' },
  { id: 'invoices', label: 'Invoices', icon: '💰', href: '/admin/invoices' },
  { id: 'jobs', label: 'Jobs', icon: '📦', href: '/admin/jobs' },
  { id: 'companies', label: 'Companies', icon: '🏢', href: '/admin/companies' },
  { id: 'drivers', label: 'Drivers', icon: '🚚', href: '/admin/drivers' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚛', href: '/admin/vehicles' },
  { id: 'documents', label: 'Documents', icon: '📄', href: '/admin/documents' },
  { id: 'bids', label: 'Bids', icon: '💼', href: '/admin/bids' },
  { id: 'quotes', label: 'Quotes', icon: '💬', href: '/admin/quotes' },
  { id: 'settings', label: 'Settings', icon: '⚙️', href: '/admin/settings' },
];

const quickActionTiles = [
  {
    title: 'Post a new job',
    description: 'Create new delivery work and allocate it faster.',
    href: '/admin/jobs',
    icon: '📦',
    background: '#1F7A3D',
    color: 'white',
    border: '#1F7A3D',
  },
  {
    title: 'Review incoming bids',
    description: 'Compare subcontractor prices and award the best fit.',
    href: '/admin/bids',
    icon: '💼',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '#bfdbfe',
  },
  {
    title: 'Chase pending quotes',
    description: 'Follow up open pricing requests before they go stale.',
    href: '/admin/quotes',
    icon: '💬',
    background: '#fff7ed',
    color: '#c2410c',
    border: '#fed7aa',
  },
  {
    title: 'Protect compliance',
    description: 'Check driver and vehicle documents needing attention.',
    href: '/admin/documents',
    icon: '📄',
    background: '#fdf2f8',
    color: '#be185d',
    border: '#fbcfe8',
  },
  {
    title: 'Collect faster',
    description: 'See invoices and act on overdue payments.',
    href: '/admin/invoices',
    icon: '💰',
    background: '#ecfdf5',
    color: '#047857',
    border: '#a7f3d0',
  },
  {
    title: 'Manage fleet',
    description: 'Review drivers, vehicles, and resource coverage.',
    href: '/admin/vehicles',
    icon: '🚛',
    background: '#eef2ff',
    color: '#4338ca',
    border: '#c7d2fe',
  },
];

const ENTERPRISE_THEME = {
  pageBg: '#eef2f6',
  shellBg: '#0b1c2f',
  shellMuted: '#9fb4cb',
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

const readInvoiceClientName = (row: Record<string, unknown>): string | null => {
  if (typeof row.client_name === 'string' && row.client_name.trim().length > 0) return row.client_name;
  const related = row.clients;
  if (related && typeof related === 'object' && !Array.isArray(related)) {
    const relationName = (related as { name?: unknown }).name;
    if (typeof relationName === 'string' && relationName.trim().length > 0) return relationName;
  }
  if (Array.isArray(related)) {
    const first = related[0];
    const relationName = first && typeof first === 'object' ? (first as { name?: unknown }).name : null;
    if (typeof relationName === 'string' && relationName.trim().length > 0) return relationName;
  }
  return null;
};

const loadInvoicesWithCompat = async (companyId: string): Promise<InvoiceRow[]> => {
  const activeColumns = ['id', 'invoice_number', 'status', 'due_date', 'amount', 'client_name', 'created_at'];
  const missingColumns = new Set<string>();
  let useClientsRelation = false;
  let clientsRelationDisabled = false;
  const seenStates = new Set<string>();
  const maxAttempts = Math.max(12, activeColumns.length * 3);
  let attempts = 0;

  while (activeColumns.length > 0 && attempts < maxAttempts) {
    attempts += 1;
    const stateKey = `${useClientsRelation ? 'clients' : 'direct'}::${activeColumns.join(',')}`;
    if (seenStates.has(stateKey)) {
      throw new Error('Invoice compatibility fallback loop detected and stopped.');
    }
    seenStates.add(stateKey);

    const selectColumns = useClientsRelation
      ? [...activeColumns.filter((column) => column !== 'client_name'), 'clients(name)']
      : activeColumns;

    const result = await supabase
      .from('invoices')
      .select(selectColumns.join(', '))
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!result.error) {
      const rows = ((result.data ?? []) as unknown) as Array<Record<string, unknown>>;
      return rows.map((row, index) => ({
        id: String(row.id ?? `invoice-${index}`),
        invoice_number: missingColumns.has('invoice_number') ? 'Invoice' : String(row.invoice_number ?? 'Invoice'),
        status: missingColumns.has('status') ? 'Pending' : String(row.status ?? 'Pending'),
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
        client_name: missingColumns.has('client_name') && !useClientsRelation ? null : readInvoiceClientName(row),
        created_at: String(row.created_at ?? new Date().toISOString()),
      }));
    }

    if (
      !useClientsRelation &&
      isMissingColumnError(result.error, 'invoices', 'client_name')
    ) {
      missingColumns.add('client_name');
      if (activeColumns.includes('client_name')) {
        activeColumns.splice(activeColumns.indexOf('client_name'), 1);
      }
      useClientsRelation = !clientsRelationDisabled;
      continue;
    }

    if (
      useClientsRelation &&
      isMissingRelationshipError(result.error, 'invoices', 'clients')
    ) {
      clientsRelationDisabled = true;
      useClientsRelation = false;
      continue;
    }

    const missingColumn = getMissingColumnFromError(result.error, 'invoices');
    if (missingColumn && activeColumns.includes(missingColumn)) {
      missingColumns.add(missingColumn);
      activeColumns.splice(activeColumns.indexOf(missingColumn), 1);
      continue;
    }

    throw new Error(result.error.message);
  }

  if (attempts >= maxAttempts) {
    throw new Error('Invoice compatibility retry limit reached.');
  }

  return [];
};

const loadVehicleDocumentsWithCompat = async (companyId: string): Promise<DocRow[]> => {
  const vehiclesRes = await supabase.from('vehicles').select('id').eq('company_id', companyId);
  if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);

  const vehicleIds = (vehiclesRes.data ?? []).map((vehicle) => vehicle.id).filter(Boolean);
  if (vehicleIds.length === 0) return [];

  const activeColumns = ['id', 'status', 'expiry_date', 'vehicle_id'];
  const missingColumns = new Set<string>();

  while (activeColumns.length > 0) {
    const result = await supabase
      .from('vehicle_documents')
      .select(activeColumns.join(', '))
      .in('vehicle_id', vehicleIds);

    if (!result.error) {
      const rows = ((result.data ?? []) as unknown) as Array<Record<string, unknown>>;
      return rows.map((row, index) => ({
        id: String(row.id ?? `vehicle-doc-${index}`),
        status: missingColumns.has('status') ? 'pending' : String(row.status ?? 'pending'),
        expiry_date: missingColumns.has('expiry_date') ? null : (row.expiry_date == null ? null : String(row.expiry_date)),
      }));
    }

    const missingColumn = getMissingColumnFromError(result.error, 'vehicle_documents');
    if (missingColumn && activeColumns.includes(missingColumn)) {
      missingColumns.add(missingColumn);
      activeColumns.splice(activeColumns.indexOf(missingColumn), 1);
      continue;
    }

    throw new Error(result.error.message);
  }

  return [];
};

const getInvoiceStatus = (dueDate: string, currentStatus: string) => {
  if (currentStatus === 'Paid') return 'Paid';
  return new Date() > new Date(dueDate) ? 'Overdue' : 'Pending';
};

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
            .select('id, status, amount, created_at, jobs!inner(company_id)')
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
          meta: typeof bid.amount === 'number' ? formatCurrency(bid.amount) : 'Bid amount pending',
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

  const reportRows = useMemo(() => {
    const now = new Date();
    return [
      [`${COMPANY_CONFIG.legalName} — Company Dashboard Report`],
      [`Date: ${now.toLocaleDateString('en-GB')}`, `Time: ${now.toLocaleTimeString('en-GB')}`],
      [''],
      ['OVERVIEW'],
      ['Metric', 'Value'],
      ['Active Jobs', String(dashboard.overview.activeJobs)],
      ['Pending Quotes', String(dashboard.overview.pendingQuotes)],
      ['Active Drivers', String(dashboard.overview.activeDrivers)],
      ['Completed Today', String(dashboard.overview.completedToday)],
      [''],
      ['OPERATIONS'],
      ['Posted', String(dashboard.jobsByStatus.posted)],
      ['Allocated', String(dashboard.jobsByStatus.allocated)],
      ['In Transit', String(dashboard.jobsByStatus.inTransit)],
      ['Delivered', String(dashboard.jobsByStatus.delivered)],
      [''],
      ['FINANCE'],
      ['Outstanding Invoices', String(dashboard.finance.outstandingInvoices)],
      ['Overdue Invoices', String(dashboard.finance.overdueInvoices)],
      ['Outstanding Revenue', formatCurrency(dashboard.finance.outstandingRevenue)],
      [''],
      ['COMPLIANCE'],
      ['Pending Verification', String(dashboard.compliance.pendingDocs)],
      ['Expiring in 30 Days', String(dashboard.compliance.expiringSoon)],
      ['Attention Required', String(dashboard.compliance.attentionRequired)],
    ];
  }, [dashboard]);

  const generateReport = () => {
    const csv = reportRows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xdrive-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const overviewCards = [
    {
      label: 'Active Jobs',
      value: dashboard.overview.activeJobs,
      icon: '🚚',
      color: ENTERPRISE_THEME.colors.live,
      subtitle: 'Live jobs in posted, allocated and in-transit states',
    },
    {
      label: 'Pending Quotes',
      value: dashboard.overview.pendingQuotes,
      icon: '💬',
      color: ENTERPRISE_THEME.colors.driverQuote,
      subtitle: 'Pricing requests waiting for conversion',
    },
    {
      label: 'Active Drivers',
      value: dashboard.overview.activeDrivers,
      icon: '👤',
      color: ENTERPRISE_THEME.colors.success,
      subtitle: 'Drivers currently available for dispatch',
    },
    {
      label: 'Completed Today',
      value: dashboard.overview.completedToday,
      icon: '✅',
      color: ENTERPRISE_THEME.colors.success,
      subtitle: 'Delivery confirmations closed today',
    },
  ];

  const sectionCardStyle: CSSProperties = {
    backgroundColor: ENTERPRISE_THEME.cardBg,
    padding: ENTERPRISE_THEME.spacing.lg,
    borderRadius: ENTERPRISE_THEME.radius,
    border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
    boxShadow: ENTERPRISE_THEME.cardShadow,
  };

  const invoicePressureLevel =
    dashboard.finance.overdueInvoices >= 5
      ? { label: 'Critical', color: ENTERPRISE_THEME.colors.danger, bg: '#fef2f2' }
      : dashboard.finance.overdueInvoices >= 2
        ? { label: 'Monitor', color: ENTERPRISE_THEME.colors.warning, bg: '#fff7ed' }
        : { label: 'Stable', color: ENTERPRISE_THEME.colors.success, bg: '#ecfdf5' };

  const quotePressureLevel =
    dashboard.overview.pendingQuotes >= 8
      ? { label: 'High queue', color: ENTERPRISE_THEME.colors.warning, bg: '#fff7ed' }
      : dashboard.overview.pendingQuotes >= 3
        ? { label: 'Normal queue', color: ENTERPRISE_THEME.colors.live, bg: '#eff6ff' }
        : { label: 'Low queue', color: ENTERPRISE_THEME.colors.success, bg: '#ecfdf5' };

  const operationalAlerts = [
    {
      id: 'alert-overdue',
      title: 'Overdue invoices',
      state: dashboard.finance.overdueInvoices > 0 ? 'Attention required' : 'No overdue debt',
      color: dashboard.finance.overdueInvoices > 0 ? ENTERPRISE_THEME.colors.danger : ENTERPRISE_THEME.colors.success,
    },
    {
      id: 'alert-compliance',
      title: 'Compliance watchlist',
      state: dashboard.compliance.attentionRequired > 0 ? 'Documents blocked/expired' : 'No blocked docs',
      color: dashboard.compliance.attentionRequired > 0 ? ENTERPRISE_THEME.colors.warning : ENTERPRISE_THEME.colors.success,
    },
    {
      id: 'alert-coverage',
      title: 'Driver coverage',
      state: dashboard.resources.driverCoverageGap > 0 ? `${dashboard.resources.driverCoverageGap} jobs above active driver pool` : 'Coverage balanced',
      color: dashboard.resources.driverCoverageGap > 0 ? ENTERPRISE_THEME.colors.driverQuote : ENTERPRISE_THEME.colors.success,
    },
  ];

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
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '2px 0 14px rgba(2, 6, 23, 0.24)',
            position: isMobile ? 'fixed' : 'relative',
            inset: isMobile ? '0 auto 0 0' : undefined,
            zIndex: isMobile ? 40 : undefined,
            transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
            transition: 'transform 0.2s ease',
          }}
        >
          <div style={{ padding: '1.1rem 1rem', borderBottom: '1px solid rgba(159, 180, 203, 0.22)' }}>
            <h1 style={{ fontSize: '1.02rem', fontWeight: '700', margin: 0, color: 'white', lineHeight: 1.35 }}>{COMPANY_CONFIG.legalName}</h1>
            <p style={{ fontSize: '0.74rem', margin: '0.3rem 0 0 0', color: ENTERPRISE_THEME.shellMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Operations Console
            </p>
          </div>

          <nav style={{ flex: 1, padding: '0.6rem' }}>
            {menuItems.map((item) => {
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
                    backgroundColor: isActive ? 'rgba(63, 131, 248, 0.18)' : 'transparent',
                    color: 'white',
                    border: 'none',
                    borderLeft: isActive ? `3px solid ${ENTERPRISE_THEME.colors.live}` : '3px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    fontSize: '0.84rem',
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
                      backgroundColor: 'rgba(159, 180, 203, 0.2)',
                    }}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div style={{ padding: '0.9rem', borderTop: '1px solid rgba(159, 180, 203, 0.22)' }}>
            <div style={{ fontSize: '0.74rem', color: ENTERPRISE_THEME.shellMuted, marginBottom: '0.6rem', wordBreak: 'break-word' }}>
              {user?.email}
            </div>
            <button
              className="panel-button"
              onClick={logout}
              style={{
                width: '100%',
                padding: '0.52rem',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                color: 'white',
                border: 'none',
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
              ☰ Menu
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: '0 0 0.2rem 0' }}>Operations Control Centre</h2>
              <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: 0, maxWidth: '760px', fontSize: '0.86rem' }}>
                Live dispatch, finance and compliance command board aligned to courier exchange workflows.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button
                className="panel-button"
                onClick={() => router.push('/admin/jobs')}
                style={{
                  padding: '0.58rem 0.95rem',
                  backgroundColor: ENTERPRISE_THEME.colors.success,
                  border: `1px solid ${ENTERPRISE_THEME.colors.success}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.83rem',
                  fontWeight: '600',
                  color: 'white',
                }}
              >
                📦 Open Dispatch Board
              </button>
              <button
                className="panel-button"
                onClick={generateReport}
                style={{
                  padding: '0.58rem 0.95rem',
                  backgroundColor: '#e0f2fe',
                  border: '1px solid #7dd3fc',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.83rem',
                  fontWeight: '600',
                  color: '#075985',
                }}
              >
                📊 Export Ops Report
              </button>
            </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {overviewCards.map((stat) => (
              <div
                key={stat.label}
                style={{
                  backgroundColor: ENTERPRISE_THEME.cardBg,
                  padding: '0.75rem',
                  borderRadius: ENTERPRISE_THEME.radius,
                  border: `1px solid ${ENTERPRISE_THEME.cardBorder}`,
                  boxShadow: ENTERPRISE_THEME.cardShadow,
                  borderLeft: `3px solid ${stat.color}`,
                  minHeight: '110px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.45rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: ENTERPRISE_THEME.colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{stat.label}</div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.12rem', lineHeight: 1.4 }}>{stat.subtitle}</div>
                  </div>
                  <span style={{ fontSize: '1.1rem', width: '26px', height: '26px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'grid', placeItems: 'center' }}>{stat.icon}</span>
                </div>
                <div style={{ fontSize: '1.52rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text }}>{dashboardLoading ? '…' : stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Operations board</h3>
                  <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Dispatch state by live status lane.</p>
                </div>
                <button className="link-button" onClick={() => router.push('/admin/jobs')} style={{ background: 'none', border: 'none', color: ENTERPRISE_THEME.colors.live, fontWeight: '700', cursor: 'pointer', fontSize: '0.78rem' }}>View jobs</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem', marginBottom: '0.7rem' }}>
                {[
                  { label: 'Posted', value: dashboard.jobsByStatus.posted, color: ENTERPRISE_THEME.colors.live },
                  { label: 'Allocated', value: dashboard.jobsByStatus.allocated, color: ENTERPRISE_THEME.colors.driverQuote },
                  { label: 'In transit', value: dashboard.jobsByStatus.inTransit, color: ENTERPRISE_THEME.colors.warning },
                  { label: 'Delivered', value: dashboard.jobsByStatus.delivered, color: ENTERPRISE_THEME.colors.success },
                ].map((item) => (
                  <div key={item.label} style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '0.58rem', minHeight: '69px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '0.18rem' }}>{item.label}</div>
                    <div style={{ fontSize: '1.16rem', fontWeight: '700', color: item.color }}>{dashboardLoading ? '…' : item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.6rem', display: 'grid', gap: '0.45rem' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: ENTERPRISE_THEME.colors.text }}>Driver / vehicle quick states</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.45rem' }}>
                  <div style={{ backgroundColor: '#eff6ff', borderRadius: '8px', padding: '0.45rem' }}>
                    <div style={{ fontSize: '0.68rem', color: ENTERPRISE_THEME.colors.live }}>Active drivers</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: ENTERPRISE_THEME.colors.live }}>{dashboardLoading ? '…' : dashboard.overview.activeDrivers}</div>
                  </div>
                  <div style={{ backgroundColor: '#eef2ff', borderRadius: '8px', padding: '0.45rem' }}>
                    <div style={{ fontSize: '0.68rem', color: ENTERPRISE_THEME.colors.driverQuote }}>Fleet units</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: ENTERPRISE_THEME.colors.driverQuote }}>{dashboardLoading ? '…' : dashboard.resources.fleetUnits}</div>
                  </div>
                  <div style={{ backgroundColor: '#fff7ed', borderRadius: '8px', padding: '0.45rem' }}>
                    <div style={{ fontSize: '0.68rem', color: ENTERPRISE_THEME.colors.warning }}>Coverage gap</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: ENTERPRISE_THEME.colors.warning }}>{dashboardLoading ? '…' : dashboard.resources.driverCoverageGap}</div>
                  </div>
                </div>
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Finance overview</h3>
                  <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Cashflow exposure and billing pressure.</p>
                </div>
                <button className="link-button" onClick={() => router.push('/admin/invoices')} style={{ background: 'none', border: 'none', color: ENTERPRISE_THEME.colors.live, fontWeight: '700', cursor: 'pointer', fontSize: '0.78rem' }}>View invoices</button>
              </div>
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                <div style={{ backgroundColor: '#ecfdf5', borderRadius: '8px', padding: '0.62rem', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.73rem', color: '#047857' }}>Outstanding revenue</div>
                  <div style={{ fontSize: '1.24rem', fontWeight: '700', color: '#065f46', marginTop: '0.12rem' }}>{dashboardLoading ? '…' : formatCurrency(dashboard.finance.outstandingRevenue)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem' }}>
                  <div style={{ backgroundColor: '#fff7ed', borderRadius: '8px', padding: '0.62rem', border: '1px solid #fed7aa' }}>
                    <div style={{ fontSize: '0.73rem', color: '#c2410c' }}>Outstanding invoices</div>
                    <div style={{ fontSize: '1.08rem', fontWeight: '700', color: '#9a3412', marginTop: '0.1rem' }}>{dashboardLoading ? '…' : dashboard.finance.outstandingInvoices}</div>
                  </div>
                  <div style={{ backgroundColor: '#fef2f2', borderRadius: '8px', padding: '0.62rem', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '0.73rem', color: '#b91c1c' }}>Overdue invoices</div>
                    <div style={{ fontSize: '1.08rem', fontWeight: '700', color: '#991b1b', marginTop: '0.1rem' }}>{dashboardLoading ? '…' : dashboard.finance.overdueInvoices}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem' }}>
                  <div style={{ borderRadius: '8px', backgroundColor: invoicePressureLevel.bg, padding: '0.62rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', color: ENTERPRISE_THEME.colors.muted }}>Invoice pressure</div>
                    <div style={{ marginTop: '0.12rem', fontWeight: 700, color: invoicePressureLevel.color, fontSize: '0.95rem' }}>{invoicePressureLevel.label}</div>
                  </div>
                  <div style={{ borderRadius: '8px', backgroundColor: quotePressureLevel.bg, padding: '0.62rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', color: ENTERPRISE_THEME.colors.muted }}>Quote pressure</div>
                    <div style={{ marginTop: '0.12rem', fontWeight: 700, color: quotePressureLevel.color, fontSize: '0.95rem' }}>{quotePressureLevel.label}</div>
                  </div>
                </div>
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Compliance watchlist</h3>
                  <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Audit readiness and expiry signals.</p>
                </div>
                <button className="link-button" onClick={() => router.push('/admin/documents')} style={{ background: 'none', border: 'none', color: ENTERPRISE_THEME.colors.live, fontWeight: '700', cursor: 'pointer', fontSize: '0.78rem' }}>View documents</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.55rem', marginBottom: '0.65rem' }}>
                {[
                  { label: 'Pending', value: dashboard.compliance.pendingDocs, bg: '#eff6ff', color: '#1d4ed8' },
                  { label: 'Expiring soon', value: dashboard.compliance.expiringSoon, bg: '#fff7ed', color: '#c2410c' },
                  { label: 'Attention', value: dashboard.compliance.attentionRequired, bg: '#fef2f2', color: '#b91c1c' },
                ].map((item) => (
                  <div key={item.label} style={{ backgroundColor: item.bg, borderRadius: '8px', padding: '0.58rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.72rem', color: item.color }}>{item.label}</div>
                    <div style={{ fontSize: '1.02rem', fontWeight: '700', color: item.color, marginTop: '0.1rem' }}>{dashboardLoading ? '…' : item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.58rem' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: ENTERPRISE_THEME.colors.text, marginBottom: '0.44rem' }}>Operational alerts</div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  {operationalAlerts.map((alert) => (
                    <div key={alert.id} style={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '0.45rem 0.56rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: ENTERPRISE_THEME.colors.muted }}>{alert.title}</span>
                      <span style={{ fontSize: '0.72rem', color: alert.color, fontWeight: 700, textAlign: 'right' }}>{dashboardLoading ? '…' : alert.state}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.68rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Live activity feed</h3>
                  <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Recent operational activity across jobs, quotes, invoices and bids.</p>
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

            <section style={sectionCardStyle}>
              <div style={{ marginBottom: '0.68rem' }}>
                <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Exchange snapshot</h3>
                <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Operational pressure and commercial conversion view.</p>
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {[
                  { label: 'Incoming bids', value: dashboard.market.incomingBids, detail: 'New subcontractor responses', bg: '#eff6ff', color: '#1d4ed8' },
                  { label: 'Accepted quotes', value: dashboard.market.acceptedQuotes, detail: 'Won work ready for fulfilment', bg: '#ecfdf5', color: '#047857' },
                  { label: 'Recent invoice value', value: formatCurrency(dashboard.market.recentInvoiceValue), detail: 'Latest billing generated', bg: '#fefce8', color: '#a16207' },
                  { label: 'Delivery backlog', value: dashboard.market.deliveryBacklog, detail: 'Active jobs plus open quotes', bg: '#fff7ed', color: '#c2410c' },
                  { label: 'Quotes awaiting approval', value: dashboard.resources.pendingQuoteApprovals, detail: 'Sent quotes pending customer decision', bg: '#f5f3ff', color: '#7c3aed' },
                ].map((item) => (
                  <div key={item.label} style={{ backgroundColor: item.bg, borderRadius: '8px', padding: '0.58rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.76rem', color: item.color, fontWeight: '700' }}>{item.label}</div>
                        <div style={{ fontSize: '0.69rem', color: item.color, opacity: 0.82, marginTop: '0.1rem' }}>{item.detail}</div>
                      </div>
                      <div style={{ fontSize: '1.02rem', color: item.color, fontWeight: '700' }}>{dashboardLoading ? '…' : item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section style={sectionCardStyle}>
            <div style={{ marginBottom: '0.7rem' }}>
              <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: ENTERPRISE_THEME.colors.text, margin: 0 }}>Action hub</h3>
              <p style={{ color: ENTERPRISE_THEME.colors.muted, margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>Operational shortcuts for dispatch, bids, compliance and cash collection.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '0.55rem' }}>
              {quickActionTiles.map((tile) => (
                <button
                  className="panel-button"
                  key={tile.title}
                  onClick={() => router.push(tile.href)}
                  style={{
                    padding: '0.66rem',
                    borderRadius: '8px',
                    border: `1px solid ${tile.border}`,
                    backgroundColor: tile.background,
                    color: tile.color,
                    textAlign: 'left',
                    cursor: 'pointer',
                    minHeight: '115px',
                  }}
                >
                  <div style={{ fontSize: '1.05rem', marginBottom: '0.3rem' }}>{tile.icon}</div>
                  <div style={{ fontWeight: '700', marginBottom: '0.2rem', fontSize: '0.82rem' }}>{tile.title}</div>
                  <div style={{ fontSize: '0.73rem', lineHeight: 1.35, opacity: 0.92 }}>{tile.description}</div>
                </button>
              ))}
            </div>
          </section>
          <style jsx>{`
            .nav-item:hover {
              background-color: rgba(159, 180, 203, 0.18);
            }
            .panel-button:hover {
              filter: brightness(0.97);
            }
            .activity-row:hover {
              background-color: #f1f5f9 !important;
            }
            .link-button:hover {
              text-decoration: underline;
            }
          `}</style>
        </main>
      </div>
    </ProtectedRoute>
  );
}
