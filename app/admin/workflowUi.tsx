'use client';

import { usePathname, useRouter } from 'next/navigation';

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

export const WORKFLOW_NAV_SECTIONS = [
  {
    id: 'home',
    label: 'Home',
    items: [{ id: 'dashboard', label: 'Command Centre', icon: '🏠', href: '/admin' }],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'diary', label: 'Allocation Diary', icon: '🗓️', href: '/admin/diary' },
      { id: 'jobs', label: 'All Jobs', icon: '📦', href: '/admin/jobs' },
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    items: [
      { id: 'marketplace', label: 'Find Work', icon: '🏪', href: '/admin/marketplace' },
      { id: 'quotes', label: 'Quotes & Bids', icon: '💬', href: '/admin/quotes' },
      { id: 'invoices', label: 'Invoices', icon: '💰', href: '/admin/invoices' },
    ],
  },
  {
    id: 'fleet',
    label: 'Fleet',
    items: [
      { id: 'fleet', label: 'Availability', icon: '🧭', href: '/admin/fleet' },
      { id: 'drivers', label: 'Drivers', icon: '👤', href: '/admin/drivers' },
      { id: 'dispatchers', label: 'Dispatchers', icon: '🎛️', href: '/admin/dispatchers' },
      { id: 'vehicles', label: 'Vehicles', icon: '🚛', href: '/admin/vehicles' },
      { id: 'documents', label: 'Documents', icon: '📄', href: '/admin/documents' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { id: 'companies', label: 'Companies', icon: '🏢', href: '/admin/companies' },
      { id: 'settings', label: 'Settings', icon: '⚙️', href: '/admin/settings' },
    ],
  },
] as const;

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
