'use client';

// Compatibility exports only. The active dashboard implementations live in
// the role-specific *DashboardHome modules. Keep this file lightweight so
// historical imports cannot resurrect a second dashboard implementation.
export {
  resolveAdminDashboard,
  type AdminDashboardResolution,
  type AdminDashboardTarget,
} from './AdminDashboardResolver';

export { default as CarrierDashboard } from './CarrierOperationsDashboardHome';
export { default as FleetDashboard } from './FleetControlDashboardHome';
export { default as DispatcherDashboard } from './DispatcherControlDashboardHome';
export { default as FinanceDashboard } from './FinanceControlDashboardHome';
export { default as ComplianceDashboard } from './ComplianceControlDashboardHome';
export { default as ViewerDashboard } from './ViewerDashboardHome';
