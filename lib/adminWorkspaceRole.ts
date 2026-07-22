import type { WorkspaceRole } from './workspaceRole';

export type AdminDashboardKind = 'admin' | 'fleet' | 'finance' | 'compliance' | 'carrier';

export const resolveAdminDashboardKind = (
  role: WorkspaceRole,
  hasCompanyContext: boolean
): AdminDashboardKind => {
  if (role === 'fleet_manager') return 'fleet';
  if (role === 'finance') return 'finance';
  if (role === 'compliance') return 'compliance';
  if (role === 'platform_owner') return hasCompanyContext ? 'admin' : 'carrier';
  if (['company_owner', 'company_admin', 'carrier_admin', 'dispatcher'].includes(role)) return 'admin';
  return 'carrier';
};
