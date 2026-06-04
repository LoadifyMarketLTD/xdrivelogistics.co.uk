'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { AppUserRole } from '../../lib/authRole';

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
  { id: 'find', label: 'Find Work', href: '/admin/marketplace' },
  { id: 'price', label: 'Price Work', href: '/admin/quotes' },
  { id: 'win', label: 'Win Work', href: '/admin/bids' },
  { id: 'assign', label: 'Assign Work', href: '/admin/diary' },
  { id: 'track', label: 'Track Work', href: '/admin/fleet' },
  { id: 'complete', label: 'Complete Work', href: '/admin/jobs' },
  { id: 'invoice', label: 'Invoice Work', href: '/admin/invoices' },
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

export const PLATFORM_NAV_SECTIONS: NavSection[] = [
  {
    id: 'home',
    label: 'Platform',
    items: [{ id: 'dashboard', label: 'Control Centre', icon: '🏠', href: '/admin' }],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    items: [
      { id: 'marketplace', label: 'Find Work', icon: '🏪', href: '/admin/marketplace' },
      { id: 'quotes', label: 'Quotes & Bids', icon: '💬', href: '/admin/quotes' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'diary', label: 'Allocation Diary', icon: '🗓️', href: '/admin/diary' },
      { id: 'jobs', label: 'Jobs Board', icon: '📦', href: '/admin/jobs' },
    ],
  },
  {
    id: 'fleet_module',
    label: 'Fleet',
    items: [
      { id: 'fleet', label: 'Availability', icon: '🧭', href: '/admin/fleet' },
      { id: 'vehicles', label: 'Vehicles', icon: '🚛', href: '/admin/vehicles' },
    ],
  },
  {
    id: 'drivers_module',
    label: 'Drivers',
    items: [
      { id: 'drivers', label: 'Driver Roster', icon: '👤', href: '/admin/drivers' },
      { id: 'dispatchers', label: 'Dispatchers', icon: '🎛️', href: '/admin/dispatchers' },
    ],
  },
  {
    id: 'compliance_module',
    label: 'Compliance',
    items: [
      { id: 'documents', label: 'Documents', icon: '📄', href: '/admin/documents' },
    ],
  },
  {
    id: 'finance_module',
    label: 'Finance',
    items: [
      { id: 'invoices', label: 'Invoices', icon: '💰', href: '/admin/invoices' },
    ],
  },
  {
    id: 'platform_admin',
    label: 'Platform Admin',
    roles: ['owner', 'company_admin'],
    items: [
      { id: 'companies', label: 'Companies', icon: '🏢', href: '/admin/companies' },
      { id: 'settings', label: 'Settings', icon: '⚙️', href: '/admin/settings' },
    ],
  },
];

/**
 * Returns the nav sections visible for the given role.
 * Sections without a `roles` array are visible to all admin roles.
 */
export const getNavSectionsForRole = (role: AppUserRole | null): NavSection[] => {
  if (!role) return PLATFORM_NAV_SECTIONS.filter((s) => !s.roles);
  return PLATFORM_NAV_SECTIONS.filter((s) => !s.roles || s.roles.includes(role));
};

/** @deprecated Use PLATFORM_NAV_SECTIONS; kept for compatibility. */
export const WORKFLOW_NAV_SECTIONS = PLATFORM_NAV_SECTIONS;

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
        Workflow
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
