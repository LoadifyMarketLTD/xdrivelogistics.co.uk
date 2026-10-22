import { notFound } from 'next/navigation';
import CompanyMarketplaceExchange from '../../components/workspace/CompanyMarketplaceExchange';
import TopWorkspaceShell from '../../components/workspace/TopWorkspaceShell';
import '../../components/workspace/workspace-light-guard.css';
import '../../components/workspace/top-workspace-shell.css';
import '../../components/workspace/workspace-measured-cx-baseline.css';
import '../../admin/carrier-workspace-canonical.css';
import { LOCAL_FIXTURE_COMPANY_ID, LOCAL_LOADS, LOCAL_QUOTE_VEHICLES } from '../cx-local-fixtures';

const ENABLED = process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

export default function LoadsVisualFixturePage() {
  if (!ENABLED) notFound();
  return (
    <div className="xdrive-workspace-visual xdrive-operational-top-workspace xdrive-workspace-measured xdrive-canonical-workspace xdrive-carrier-workspace">
      <TopWorkspaceShell forcedRole="company_admin" fixtureCompanyName="XDrive Carrier - Local Loads">
        <CompanyMarketplaceExchange fixtureData={{ companyId: LOCAL_FIXTURE_COMPANY_ID, loads: LOCAL_LOADS, vehicles: LOCAL_QUOTE_VEHICLES }} />
      </TopWorkspaceShell>
    </div>
  );
}
