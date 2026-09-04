import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

const title = 'XDrive for Drivers';
const description = 'See assigned transport work, route context, live status, ETA and proof-of-delivery actions in one connected XDrive driver workflow.';

export const metadata = buildMarketingMetadata({ path: '/drivers', title, description, kicker: 'XDrive for Drivers', visual: 'driver' });

export default function DriversPage() {
  return <MarketingDetailPage
    kicker="XDrive for Drivers"
    title="Run assigned work with route context, live status and POD in one place."
    intro="XDrive gives company drivers and operational drivers a focused view of assigned transport work, collection and delivery context, status progression, ETA updates, exceptions and proof of delivery."
    sections={[
      { title: 'See the assigned job clearly', copy: 'Keep route, timing, vehicle, collection and delivery requirements together before the job starts.', points: ['Collection and delivery context', 'Operational notes', 'Assigned vehicle and job reference'] },
      { title: 'Progress the live job', copy: 'Update operational status through the delivery journey so dispatch and the wider operation retain visibility.', points: ['On my way', 'On site', 'Loaded and in transit'] },
      { title: 'Return ETA and exceptions', copy: 'Keep timing changes and operational issues attached to the correct job instead of losing them across calls and messages.' },
      { title: 'Complete with evidence', copy: 'Return POD and completion evidence against the same job record so the delivery can move cleanly into closure and finance readiness.', points: ['POD evidence', 'Delivery timestamps', 'Completion history'] },
    ]}
    primaryLabel="Explore Owner Driver Access"
    primaryHref="/owner-drivers"
    secondaryLabel="Courier Workspace"
    secondaryHref="/courier-workspace"
    darkBand={{ title: 'The driver works from the same operational truth as dispatch.', copy: 'XDrive keeps assigned work, live execution and delivery evidence connected rather than spread across disconnected tools.' }}
  />;
}
