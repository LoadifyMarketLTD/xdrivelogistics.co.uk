'use client';

/**
 * WorkspaceFixtureProvider
 *
 * Provides static mock data to the CompanyWorkspaceDataContext so that real
 * authenticated route components (CarrierDashboard, BrokerDashboard, etc.) can
 * render in visual fixture pages without live Supabase auth.
 *
 * Usage:
 *   <WorkspaceFixtureProvider data={FIXTURE_DATA}>
 *     <WorkspaceShell forcedRole="company_admin">
 *       <CarrierDashboard />
 *     </WorkspaceShell>
 *   </WorkspaceFixtureProvider>
 */

import type { ReactNode } from 'react';
import { CompanyWorkspaceDataContext, type WorkspaceDataState } from './useCompanyWorkspaceData';

export default function WorkspaceFixtureProvider({
  data,
  children,
}: {
  data: WorkspaceDataState;
  children: ReactNode;
}) {
  return (
    <CompanyWorkspaceDataContext.Provider value={data}>
      {children}
    </CompanyWorkspaceDataContext.Provider>
  );
}
