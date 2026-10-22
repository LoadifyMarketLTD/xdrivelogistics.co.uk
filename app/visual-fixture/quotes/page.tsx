import { notFound } from 'next/navigation';
import CompanyMarketplaceExchange from '../../components/workspace/CompanyMarketplaceExchange';
import TopWorkspaceShell from '../../components/workspace/TopWorkspaceShell';
import '../../components/workspace/workspace-light-guard.css';
import '../../components/workspace/top-workspace-shell.css';
import '../../components/workspace/workspace-measured-cx-baseline.css';
import '../../admin/carrier-workspace-canonical.css';
import { LOCAL_BIDS, LOCAL_FIXTURE_COMPANY_ID } from '../cx-local-fixtures';

const ENABLED = process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

export default function QuotesVisualFixturePage() {
  if (!ENABLED) notFound();
  return (
    <div className="xdrive-workspace-visual xdrive-operational-top-workspace xdrive-workspace-measured xdrive-canonical-workspace xdrive-carrier-workspace">
      <TopWorkspaceShell forcedRole="company_admin" fixtureCompanyName="XDrive Carrier - Local Quotes">
        <CompanyMarketplaceExchange initialTab="bids" fixtureData={{ companyId: LOCAL_FIXTURE_COMPANY_ID, bids: LOCAL_BIDS }} />
      </TopWorkspaceShell>
    </div>
  );
}
