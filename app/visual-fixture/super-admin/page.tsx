import { notFound } from 'next/navigation';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import { OwnerConsole, PlatformStatsContext, type PlatformStats, type NotificationRow } from '../../super-admin/page';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

const FIXTURE_STATS: PlatformStats = {
  companiesTotal: 7,
  companiesActive: 5,
  companiesSuspended: 1,
  companiesPending: 1,
  driversTotal: 34,
  jobsTotal: 612,
  jobsOpen: 38,
  jobsDelivered: 214,
  invoicesTotal: 284,
  invoicesUnpaid: 12,
};

const FIXTURE_NOTIFICATIONS: NotificationRow[] = [
  { id: 'n-1', type: 'company.approval', title: 'Company pending approval', message: 'Southern Link Brokers submitted for approval', status: 'unread', created_at: '2026-08-03T08:00:00Z' },
  { id: 'n-2', type: 'job.exception', title: 'Job exception raised', message: 'Peak Haulage — Bradford to Halifax — breakdown reported', status: 'unread', created_at: '2026-08-03T08:52:00Z' },
  { id: 'n-3', type: 'user.registration', title: 'New user registered', message: 'J. Smith joined Midlands Retail Group', status: 'read', created_at: '2026-08-03T08:44:00Z' },
  { id: 'n-4', type: 'invoice.overdue', title: 'Invoice overdue', message: 'Yorkshire Freight INV-2198 is past due date', status: 'read', created_at: '2026-08-03T07:00:00Z' },
  { id: 'n-5', type: 'carrier.quote', title: 'Carrier quote posted', message: 'Yorkshire Freight quoted on Manchester to Leeds load', status: 'read', created_at: '2026-08-03T09:08:00Z' },
];

export default function SuperAdminDashboardFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  return (
    <PlatformStatsContext.Provider value={{ stats: FIXTURE_STATS, notifications: FIXTURE_NOTIFICATIONS }}>
      <WorkspaceShell
        forcedRole="platform_owner"
        fixtureOverrides={{
          companyName: 'XDrive Platform Admin',
          unreadCount: 3,
          tickerItems: [
            { id: 'sfx-1', label: 'Company pending approval — Southern Link Brokers', reference: 'CO-0015', created_at: '2026-08-03T08:00:00.000Z', href: '/super-admin/companies/approvals' },
            { id: 'sfx-2', label: 'Job exception raised — Peak Haulage', reference: 'J-7712', created_at: '2026-08-03T08:52:00.000Z', href: '/super-admin/operations' },
          ],
        }}
      >
        <OwnerConsole />
      </WorkspaceShell>
    </PlatformStatsContext.Provider>
  );
}
