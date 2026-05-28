'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
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
      const dashboardModules = [
        {
          label: 'jobs counts',
          run: countQuery(
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .in('status', ['posted', 'allocated', 'in_transit'])
          ),
        },
        {
          label: 'completed jobs today',
          run: countQuery(
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .eq('status', 'delivered')
            .gte('updated_at', todayUtc)
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
          label: 'quotes count',
          run: countQuery(
          supabase
            .from('quotes')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .in('status', ['draft', 'sent'])
          ),
        },
        {
          label: 'posted jobs count',
          run: countQuery(
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .eq('status', 'posted')
          ),
        },
        {
          label: 'allocated jobs count',
          run: countQuery(
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .eq('status', 'allocated')
          ),
        },
        {
          label: 'in transit jobs count',
          run: countQuery(
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .eq('status', 'in_transit')
          ),
        },
        {
          label: 'delivered jobs count',
          run: countQuery(
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .eq('status', 'delivered')
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
      const recentJobs = getValue<JobRow[]>(8, []);
      const quotes = getValue<QuoteRow[]>(9, []);
      const invoices = getValue<InvoiceRow[]>(10, []);
      const bids = getValue<BidRow[]>(11, []);
      const driverDocs = getValue<DocRow[]>(12, []);
      const vehicleDocs = getValue<DocRow[]>(13, []);
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
          activeJobs: getValue<number>(0, 0),
          completedToday: getValue<number>(1, 0),
          activeDrivers: getValue<number>(2, 0),
          pendingQuotes: getValue<number>(3, 0),
        },
        jobsByStatus: {
          posted: getValue<number>(4, 0),
          allocated: getValue<number>(5, 0),
          inTransit: getValue<number>(6, 0),
          delivered: getValue<number>(7, 0),
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
          deliveryBacklog: getValue<number>(0, 0) + getValue<number>(3, 0),
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
      color: '#1F7A3D',
      subtitle: 'Posted, allocated and in transit',
    },
    {
      label: 'Pending Quotes',
      value: dashboard.overview.pendingQuotes,
      icon: '💬',
      color: '#f59e0b',
      subtitle: 'Draft or sent pricing still open',
    },
    {
      label: 'Active Drivers',
      value: dashboard.overview.activeDrivers,
      icon: '👤',
      color: '#0A2239',
      subtitle: 'Drivers ready for current work',
    },
    {
      label: 'Completed Today',
      value: dashboard.overview.completedToday,
      icon: '✅',
      color: '#5C9FD8',
      subtitle: 'Jobs marked delivered today',
    },
  ];

  const sectionCardStyle: CSSProperties = {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  };

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.5)', zIndex: 30 }}
          />
        )}
        <aside
          style={{
            width: isMobile ? '280px' : '250px',
            backgroundColor: '#0A2239',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
            position: isMobile ? 'fixed' : 'relative',
            inset: isMobile ? '0 auto 0 0' : undefined,
            zIndex: isMobile ? 40 : undefined,
            transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
            transition: 'transform 0.2s ease',
          }}
        >
          <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0, color: 'white' }}>{COMPANY_CONFIG.legalName}</h1>
            <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0 0', opacity: 0.7 }}>Company Portal</p>
          </div>

          <nav style={{ flex: 1, padding: '1rem 0' }}>
            {menuItems.map((item) => {
              const isActive = item.id === 'dashboard';
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    router.push(item.href);
                    if (isMobile) setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1.5rem',
                    backgroundColor: isActive ? 'rgba(31, 122, 61, 0.5)' : 'transparent',
                    color: 'white',
                    border: 'none',
                    borderLeft: isActive ? '4px solid #1F7A3D' : '4px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.75rem', wordBreak: 'break-word' }}>
              {user?.email}
            </div>
            <button
              onClick={logout}
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, padding: isMobile ? '1rem' : '2rem', marginLeft: isMobile ? 0 : undefined }}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: 'white',
                color: '#0A2239',
                fontWeight: '700',
                marginBottom: '1rem',
                cursor: 'pointer',
              }}
            >
              ☰ Menu
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: '0 0 0.5rem 0' }}>Dashboard</h2>
              <p style={{ color: '#6b7280', margin: 0, maxWidth: '760px' }}>
                Courier Exchange-style control centre for operations, finance, compliance and exchange activity.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/admin/jobs')}
                style={{
                  padding: '0.85rem 1.25rem',
                  backgroundColor: '#1F7A3D',
                  border: '1px solid #1F7A3D',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: 'white',
                }}
              >
                📦 Manage Jobs
              </button>
              <button
                onClick={generateReport}
                style={{
                  padding: '0.85rem 1.25rem',
                  backgroundColor: '#e0f2fe',
                  border: '1px solid #7dd3fc',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: '#075985',
                }}
              >
                📊 Export Report
              </button>
            </div>
          </div>

          {dashboardError && (
            <div
              style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '1rem 1.5rem',
                marginBottom: '1.5rem',
                color: '#92400e',
                fontWeight: '600',
              }}
            >
              {dashboardError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {overviewCards.map((stat) => (
              <div
                key={stat.label}
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  borderLeft: `4px solid ${stat.color}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>{stat.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>{stat.subtitle}</div>
                  </div>
                  <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>{dashboardLoading ? '…' : stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>Operations board</h3>
                  <p style={{ color: '#6b7280', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>Track work in the live delivery pipeline.</p>
                </div>
                <button onClick={() => router.push('/admin/jobs')} style={{ background: 'none', border: 'none', color: '#1F7A3D', fontWeight: '600', cursor: 'pointer' }}>View jobs</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                {[
                  { label: 'Posted', value: dashboard.jobsByStatus.posted, color: '#1d4ed8' },
                  { label: 'Allocated', value: dashboard.jobsByStatus.allocated, color: '#7c3aed' },
                  { label: 'In transit', value: dashboard.jobsByStatus.inTransit, color: '#ea580c' },
                  { label: 'Delivered', value: dashboard.jobsByStatus.delivered, color: '#15803d' },
                ].map((item) => (
                  <div key={item.label} style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.35rem' }}>{item.label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: item.color }}>{dashboardLoading ? '…' : item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>Finance overview</h3>
                  <p style={{ color: '#6b7280', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>Surface revenue at risk and payment pressure.</p>
                </div>
                <button onClick={() => router.push('/admin/invoices')} style={{ background: 'none', border: 'none', color: '#1F7A3D', fontWeight: '600', cursor: 'pointer' }}>View invoices</button>
              </div>
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <div style={{ backgroundColor: '#ecfdf5', borderRadius: '10px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#047857' }}>Outstanding revenue</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#065f46', marginTop: '0.25rem' }}>{dashboardLoading ? '…' : formatCurrency(dashboard.finance.outstandingRevenue)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
                  <div style={{ backgroundColor: '#fff7ed', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#c2410c' }}>Outstanding invoices</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#9a3412', marginTop: '0.25rem' }}>{dashboardLoading ? '…' : dashboard.finance.outstandingInvoices}</div>
                  </div>
                  <div style={{ backgroundColor: '#fef2f2', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>Overdue invoices</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#991b1b', marginTop: '0.25rem' }}>{dashboardLoading ? '…' : dashboard.finance.overdueInvoices}</div>
                  </div>
                </div>
              </div>
            </section>

            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>Compliance watchlist</h3>
                  <p style={{ color: '#6b7280', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>Keep driver and vehicle documents audit-ready.</p>
                </div>
                <button onClick={() => router.push('/admin/documents')} style={{ background: 'none', border: 'none', color: '#1F7A3D', fontWeight: '600', cursor: 'pointer' }}>View documents</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.85rem' }}>
                {[
                  { label: 'Pending', value: dashboard.compliance.pendingDocs, bg: '#eff6ff', color: '#1d4ed8' },
                  { label: 'Expiring soon', value: dashboard.compliance.expiringSoon, bg: '#fff7ed', color: '#c2410c' },
                  { label: 'Attention', value: dashboard.compliance.attentionRequired, bg: '#fef2f2', color: '#b91c1c' },
                ].map((item) => (
                  <div key={item.label} style={{ backgroundColor: item.bg, borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: item.color }}>{item.label}</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: '700', color: item.color, marginTop: '0.25rem' }}>{dashboardLoading ? '…' : item.value}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
            <section style={sectionCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>Live activity feed</h3>
                  <p style={{ color: '#6b7280', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>Recent jobs, quotes, invoices and bids in one stream.</p>
                </div>
              </div>
              {dashboard.activity.length === 0 ? (
                <div style={{ padding: '1rem 0', color: '#6b7280' }}>No recent activity yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.85rem' }}>
                  {dashboard.activity.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.85rem',
                        width: '100%',
                        padding: '1rem',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '1.35rem' }}>{item.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.2rem' }}>{item.title}</div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{item.meta}</div>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatTimestamp(item.date)}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section style={sectionCardStyle}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>Exchange snapshot</h3>
                <p style={{ color: '#6b7280', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>Operational pressure points inspired by Courier Exchange.</p>
              </div>
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                {[
                  { label: 'Incoming bids', value: dashboard.market.incomingBids, detail: 'New subcontractor responses', bg: '#eff6ff', color: '#1d4ed8' },
                  { label: 'Accepted quotes', value: dashboard.market.acceptedQuotes, detail: 'Won work ready for fulfilment', bg: '#ecfdf5', color: '#047857' },
                  { label: 'Recent invoice value', value: formatCurrency(dashboard.market.recentInvoiceValue), detail: 'Latest billing generated', bg: '#fefce8', color: '#a16207' },
                  { label: 'Delivery backlog', value: dashboard.market.deliveryBacklog, detail: 'Active jobs plus open quotes', bg: '#fff7ed', color: '#c2410c' },
                ].map((item) => (
                  <div key={item.label} style={{ backgroundColor: item.bg, borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', color: item.color, fontWeight: '600' }}>{item.label}</div>
                        <div style={{ fontSize: '0.8rem', color: item.color, opacity: 0.8, marginTop: '0.3rem' }}>{item.detail}</div>
                      </div>
                      <div style={{ fontSize: '1.25rem', color: item.color, fontWeight: '700' }}>{dashboardLoading ? '…' : item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section style={sectionCardStyle}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>Action hub</h3>
              <p style={{ color: '#6b7280', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>Quick access to the core company workflows used most often.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {quickActionTiles.map((tile) => (
                <button
                  key={tile.title}
                  onClick={() => router.push(tile.href)}
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    border: `1px solid ${tile.border}`,
                    backgroundColor: tile.background,
                    color: tile.color,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.65rem' }}>{tile.icon}</div>
                  <div style={{ fontWeight: '700', marginBottom: '0.35rem' }}>{tile.title}</div>
                  <div style={{ fontSize: '0.88rem', lineHeight: 1.5, opacity: 0.9 }}>{tile.description}</div>
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
