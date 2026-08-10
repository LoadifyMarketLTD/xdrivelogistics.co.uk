import {
  getWorkspaceDefinition,
  hasWorkspaceCapability,
  type WorkspaceRole,
} from '../../../lib/workspaceRole';

export type AdminDashboardTarget =
  | 'carrier'
  | 'fleet'
  | 'dispatcher'
  | 'finance'
  | 'compliance'
  | 'viewer'
  | 'blocked';

export type AdminDashboardResolution = {
  target: AdminDashboardTarget;
  blocker: string | null;
  homeHref: string | null;
};

export function resolveAdminDashboard(
  role: WorkspaceRole | null | undefined,
): AdminDashboardResolution {
  if (!role) {
    return {
      target: 'blocked',
      blocker: 'Workspace role context is unavailable, so the /admin dashboard cannot be resolved safely.',
      homeHref: null,
    };
  }

  const definition = getWorkspaceDefinition(role);
  switch (role) {
    case 'company_owner':
    case 'company_admin':
    case 'carrier_admin':
      return hasWorkspaceCapability(role, 'jobs.view') && definition.homeHref === '/admin'
        ? { target: 'carrier', blocker: null, homeHref: definition.homeHref }
        : {
            target: 'blocked',
            blocker: `${role} is missing the approved /admin carrier dashboard contract.`,
            homeHref: definition.homeHref,
          };
    case 'fleet_manager':
      return hasWorkspaceCapability(role, 'fleet.positions.view')
        ? { target: 'fleet', blocker: null, homeHref: definition.homeHref }
        : {
            target: 'blocked',
            blocker: 'fleet_manager is missing the approved fleet dashboard capability contract.',
            homeHref: definition.homeHref,
          };
    case 'dispatcher':
      return hasWorkspaceCapability(role, 'jobs.dispatch')
        ? { target: 'dispatcher', blocker: null, homeHref: definition.homeHref }
        : {
            target: 'blocked',
            blocker: 'dispatcher is missing the approved operations dashboard capability contract.',
            homeHref: definition.homeHref,
          };
    case 'finance':
      return hasWorkspaceCapability(role, 'invoices.customer.manage') ||
        hasWorkspaceCapability(role, 'invoices.carrier.manage')
        ? { target: 'finance', blocker: null, homeHref: definition.homeHref }
        : {
            target: 'blocked',
            blocker: 'finance is missing the approved finance dashboard capability contract.',
            homeHref: definition.homeHref,
          };
    case 'compliance':
      return hasWorkspaceCapability(role, 'documents.company.manage') ||
        hasWorkspaceCapability(role, 'documents.verify')
        ? { target: 'compliance', blocker: null, homeHref: definition.homeHref }
        : {
            target: 'blocked',
            blocker: 'compliance is missing the approved compliance dashboard capability contract.',
            homeHref: definition.homeHref,
          };
    case 'viewer':
      return { target: 'viewer', blocker: null, homeHref: definition.homeHref };
    case 'platform_owner':
      return {
        target: 'blocked',
        blocker: `platform_owner resolves to ${definition.homeHref}, so it cannot silently receive the carrier /admin dashboard.`,
        homeHref: definition.homeHref,
      };
    case 'broker':
    case 'customer':
    case 'driver':
    case 'owner_driver':
      return {
        target: 'blocked',
        blocker: `${role} resolves to ${definition.homeHref}; entering /admin does not convert it into carrier/company operations.`,
        homeHref: definition.homeHref,
      };
  }
}
