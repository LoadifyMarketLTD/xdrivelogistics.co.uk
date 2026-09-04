import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/courier-workspace',
  title: 'XDrive Courier Workspace',
  description: 'Give owner drivers and company drivers one operational view for assigned work, live status, ETA, exceptions and delivery evidence in XDrive.',
  kicker: 'Courier Workspace',
});

export default function CourierWorkspacePage() {
  return <MarketingDetailPage
    kicker="Courier Workspace"
    title="Assigned work, live status and delivery evidence in one place."
    intro="The Courier Workspace gives owner drivers and company drivers a focused operational view of the work they have been assigned and the actions needed to complete it cleanly."
    sections={[
      { title: 'Assigned job context', copy: 'See route, timing, customer requirements and operational notes against the awarded job.' },
      { title: 'Operational status', copy: 'Progress the job through the execution flow so the wider operation can follow what is happening.' },
      { title: 'ETA and exceptions', copy: 'Return timing changes and issues without losing the connection to the original job record.' },
      { title: 'POD handoff', copy: 'Complete delivery evidence directly into the job so the record is ready for closure and finance.' }
    ]}
    primaryLabel="Explore XDrive for Couriers"
    primaryHref="/couriers"
    secondaryLabel="POD & Records"
    secondaryHref="/pod-records"
    darkBand={{ title: 'The driver works from the same operational truth.', copy: 'The courier workflow is designed to reduce duplicated information and keep the delivery record aligned with dispatch and customer visibility.' }}
  />;
}
