import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

const title = 'XDrive for Owner Drivers';
const description = 'Discover transport work, quote directly and carry awarded jobs through live execution, POD and invoice readiness as an independent owner driver.';

export const metadata = buildMarketingMetadata({ path: '/owner-drivers', title, description, kicker: 'XDrive for Owner Drivers', visual: 'owner-driver' });

export default function OwnerDriversPage() {
  return <MarketingDetailPage
    kicker="XDrive for Owner Drivers"
    title="Find work. Quote directly. Run every awarded job through delivery."
    intro="Independent owner drivers can use XDrive to discover suitable courier and freight opportunities, quote against clear job requirements and keep awarded work connected through live status, POD and invoice readiness."
    sections={[
      { title: 'Find suitable opportunities', copy: 'Review available work with the route, timing and vehicle context needed to decide whether the job fits your operation.', points: ['Courier and freight work', 'Route and timing context', 'Vehicle requirements'] },
      { title: 'Quote with control', copy: 'Submit your commercial offer against the same job record and keep the award decision connected to the work.' },
      { title: 'Run the awarded job', copy: 'Move from award into live execution with status, ETA and exception visibility instead of rebuilding the job elsewhere.', points: ['Live status', 'ETA updates', 'Operational exceptions'] },
      { title: 'Finish with POD', copy: 'Return delivery evidence and preserve the completion history required for operational closure and finance readiness.' },
    ]}
    primaryLabel="Apply as an Owner Driver"
    primaryHref="/register?role=owner_operator&plan=owner-driver"
    secondaryLabel="View Owner Driver Pricing"
    secondaryHref="/pricing"
    darkBand={{ title: 'Independent operator access — not an employment offer.', copy: 'XDrive is a membership and transport-platform service. Owner drivers remain independent operators responsible for their own business, vehicles, insurance and legal obligations.' }}
  />;
}
