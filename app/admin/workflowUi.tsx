'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { AppUserRole } from '../../lib/authRole';
import { getCapabilitiesForRole, type RoleCapabilities } from '../../lib/roleCapabilities';

export type WorkflowStageId =
  | 'find'
  | 'price'
  | 'win'
  | 'assign'
  | 'track'
  | 'complete'
  | 'invoice';

export type WorkflowStage = {
  id: WorkflowStageId;
  label: string;
  href: string;
};

export const WORKFLOW_STAGES: WorkflowStage[] = [
  { id: 'find', label: 'Marketplace / Loads', href: '/admin/marketplace' },
  { id: 'price', label: 'Quotes', href: '/admin/quotes' },
  { id: 'win', label: 'Bids', href: '/admin/bids' },
  { id: 'assign', label: 'Diary / Operations', href: '/admin/diary' },
  { id: 'track', label: 'Fleet', href: '/admin/fleet' },
  { id: 'complete', label: 'Jobs', href: '/admin/jobs' },
  { id: 'invoice', label: 'Finance / Invoices', href: '/admin/invoices' },
];

/**
 * Platform modules — each section maps to a distinct module with its own
 * objective, KPIs and primary actions.  `roles` controls which AppUserRole
 * values can see a section; omitting `roles` means visible to all admin roles.
 */
export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
};

export type NavSection = {
  id: string;
  label: string;
  roles?: ReadonlyArray<AppUserRole>;
  items: NavItem[];
};

export type NavVisibilityContext = {
  membershipRole?: string | null;
  financeAccess?: 'full' | 'limited' | 'hidden' | null;
  ownerDriverWorkspace?: boolean | null;
};

const SECTION_CAPABILITIES: Partial<Record<string, keyof RoleCapabilities>> = {
  marketplace: 'canViewExchangeLoads',
  quotes_bids: 'canReceiveQuotes',
  driver_work: 'canExecuteJobs',
  operations: 'canAllocateDrivers',
  fleet_module: 'canManageFleet',
  drivers_module: 'canManageFleet',
  vehicles_module: 'canManageFleet',
  compliance_module: 'canManageFleet',
  finance_module: 'canViewInvoices',
  platform_admin: 'canManageCompanyUsers',
};

export const PLATFORM_NAV_SECTIONS: NavSection[] = [
  {
    id: 'home',
    label: 'Platform Home',
    // visible to all admin-area roles
    items: [{ id: 'dashboard', label: 'Platform Home', icon: 'home', href: '/admin' }],
  },
  {
    id: 'marketplace',
    label: 'Marketplace / Loads',
    // Company staff can find work and convert won work; permissions stay policy-based.
    roles: ['owner', 'company_admin', 'company_staff', 'broker', 'driver'],
    items: [
      { id: 'marketplace', label: 'Load Board', icon: 'shop', href: '/admin/marketplace' },
    ],
  },
  {
    id: 'driver_work',
    label: 'Driver Work',
    roles: ['driver'],
    items: [
      { id: 'jobs', label: 'Jobs', icon: 'pkg', href: '/admin/jobs' },
    ],
  },
  {
    id: 'quotes_bids',
    label: 'Quotes & Bids',
    // Company staff can price and quote; decision actions remain API/RLS protected.
    roles: ['owner', 'company_admin', 'company_staff', 'broker'],
    items: [
      { id: 'quotes', label: 'Quotes', icon: 'msg', href: '/admin/quotes' },
      { id: 'bids', label: 'Bids', icon: 'bids', href: '/admin/bids' },
    ],
  },
  {
    id: 'operations',
    label: 'Diary / Operations',
    // Dispatchers and admins manage day-to-day operations; brokers do not
    roles: ['owner', 'company_admin', 'company_staff'],
    items: [
      { id: 'operationsCentre', label: 'Operations Centre', icon: 'ops', href: '/admin/operations-centre' },
      { id: 'diary', label: 'Diary', icon: 'cal', href: '/admin/diary' },
      { id: 'jobs', label: 'Jobs', icon: 'pkg', href: '/admin/jobs' },
      { id: 'disputes', label: 'Disputes', icon: 'jus', href: '/admin/disputes' },
    ],
  },
  {
    id: 'fleet_module',
    label: 'Fleet',
    // Fleet management: owner, admin, dispatcher
    roles: ['owner', 'company_admin', 'company_staff'],
    items: [
      { id: 'fleet', label: 'Fleet Workspace', icon: 'nav', href: '/admin/fleet' },
    ],
  },
  {
    id: 'drivers_module',
    label: 'Drivers',
    // Driver roster: owner, admin, dispatcher
    roles: ['owner', 'company_admin', 'company_staff'],
    items: [
      { id: 'drivers', label: 'Driver Roster', icon: 'usr', href: '/admin/drivers' },
    ],
  },
  {
    id: 'vehicles_module',
    label: 'Vehicles',
    // Vehicle registry: owner, admin, dispatcher
    roles: ['owner', 'company_admin', 'company_staff'],
    items: [
      { id: 'vehicles', label: 'Vehicle Registry', icon: 'trk', href: '/admin/vehicles' },
    ],
  },
  {
    id: 'compliance_module',
    label: 'Compliance / Documents',
    // Document compliance: owner, admin, dispatcher
    roles: ['owner', 'company_admin', 'company_staff'],
    items: [
      { id: 'documents', label: 'Documents', icon: 'doc', href: '/admin/documents' },
    ],
  },
  {
    id: 'finance_module',
    label: 'Finance / Invoices',
    // Finance visibility can be policy-gated for staff (limited mode).
    roles: ['owner', 'company_admin', 'company_staff'],
    items: [
      { id: 'invoices', label: 'Invoices', icon: 'inv', href: '/admin/invoices' },
    ],
  },
  {
    id: 'network_module',
    label: 'Network / Companies',
    // Company directory: owner, admin, broker (network participants)
    roles: ['owner', 'company_admin', 'broker'],
    items: [
      { id: 'companies', label: 'Companies', icon: 'co', href: '/admin/companies' },
    ],
  },
  {
    id: 'platform_admin',
    label: 'Administration',
    // Team management and settings: owner and admin only
    roles: ['owner', 'company_admin'],
    items: [
      { id: 'dispatchers', label: 'Memberships', icon: 'team', href: '/admin/dispatchers' },
      { id: 'settings', label: 'Settings', icon: 'set', href: '/admin/settings' },
    ],
  },
];

/**
 * Returns the nav sections visible for the given role.
 * Sections without a `roles` array are visible to all admin roles.
 */
const canShowFinanceSection = (
  role: AppUserRole,
  context: NavVisibilityContext
) => {
  if (role === 'owner' || role === 'company_admin') return true;
  if (role !== 'company_staff') return false;
  return context.financeAccess === 'full' || context.financeAccess === 'limited' || context.membershipRole === 'dispatcher';
};

export const getNavSectionsForRole = (role: AppUserRole | null, context: NavVisibilityContext = {}): NavSection[] => {
  if (!role) return PLATFORM_NAV_SECTIONS.filter((s) => !s.roles);

  if (
    role === 'driver' ||
    (
      context.ownerDriverWorkspace === true &&
      (role === 'company_admin' || role === 'company_staff')
    )
  ) {
    return [
      {
        id: 'driver_workspace',
        label: 'Driver Workspace',
        items: [
          { id: 'marketplace', label: 'Loads', icon: 'shop', href: '/admin/marketplace' },
          { id: 'quotes', label: 'Quotes', icon: 'msg', href: '/admin/quotes' },
          { id: 'bids', label: 'Bids', icon: 'bids', href: '/admin/bids' },
          { id: 'diary', label: 'Diary', icon: 'cal', href: '/admin/diary' },
          { id: 'jobs', label: 'Jobs', icon: 'pkg', href: '/admin/jobs' },
          { id: 'vehicles', label: 'My Vehicle', icon: 'van', href: '/admin/vehicles' },
          { id: 'returns', label: 'Return Journeys', icon: 'ret', href: '/admin/returns' },
          { id: 'documents', label: 'Documents', icon: 'doc', href: '/admin/documents' },
          { id: 'invoices', label: 'Invoices', icon: 'inv', href: '/admin/invoices' },
        ],
      },
    ];
  }

  const capabilities = getCapabilitiesForRole(role, context);

  return PLATFORM_NAV_SECTIONS.filter((section) => {
    if (section.roles && !section.roles.includes(role)) return false;
    const requiredCapability = SECTION_CAPABILITIES[section.id];
    if (requiredCapability && !capabilities[requiredCapability]) return false;
    if (section.id === 'finance_module') return canShowFinanceSection(role, context);
    return true;
  });
};

type WorkflowStripProps = {
  activeStage?: WorkflowStageId;
  counts?: Partial<Record<WorkflowStageId, number>>;
  marginBottom?: string;
};

export function WorkflowStageStrip({ activeStage, counts, marginBottom = '1rem' }: WorkflowStripProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '0.75rem',
        marginBottom,
      }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Business flow
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.5rem' }}>
        {WORKFLOW_STAGES.map((stage) => {
          const isActive = activeStage ? stage.id === activeStage : pathname === stage.href;
          const count = counts?.[stage.id];
          return (
            <button
              key={stage.id}
              onClick={() => router.push(stage.href)}
              style={{
                border: isActive ? '1px solid #2563eb' : '1px solid #dbe4ef',
                background: isActive ? '#eff6ff' : '#f8fafc',
                borderRadius: '10px',
                padding: '0.55rem 0.6rem',
                textAlign: 'left',
                cursor: 'pointer',
                minHeight: '64px',
              }}
            >
              <div style={{ fontSize: '0.73rem', color: isActive ? '#1d4ed8' : '#64748b', fontWeight: 700, marginBottom: '0.2rem' }}>
                {stage.label}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 700 }}>{typeof count === 'number' ? count : 'Open'}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
