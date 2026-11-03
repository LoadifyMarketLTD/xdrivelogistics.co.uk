'use client';
import MasterWorkspace from '../try-xdrive-demo/components/MasterWorkspace';
import CustomerDashboardHome from './CustomerDashboardHome';

export default function CustomerWorkspaceHome() {
  return <MasterWorkspace role="Customer" authenticated dashboard={<CustomerDashboardHome />} />;
}
