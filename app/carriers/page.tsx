import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

const title = 'XDrive for Carriers';
const description = 'Find and win transport work, allocate drivers and vehicles, manage live operations and keep POD and finance readiness connected across your carrier operation.';

export const metadata = buildMarketingMetadata({ path: '/carriers', title, description, kicker: 'XDrive for Carriers', visual: 'carrier' });

export default function CarriersPage() {
  return <MarketingDetailPage
    kicker="XDrive for Carriers"
    title="Win work and run fleet operations from one connected job record."
    intro="Courier and transport companies can use XDrive to discover opportunities, quote, receive awarded work into operations, allocate drivers and vehicles, manage live execution and retain POD and finance context."
    sections={[
      { title: 'Discover capacity-matched work', copy: 'Review courier and freight opportunities with the information your operation needs before committing capacity.', points: ['Route and vehicle requirements', 'Timing context', 'Return and scheduled work'] },
      { title: 'Quote and win work', copy: 'Keep commercial offers and award decisions attached to the job instead of separating sales from operations.' },
      { title: 'Allocate and dispatch', copy: 'Assign the right driver and vehicle and carry the awarded job into day-to-day execution.', points: ['Driver allocation', 'Vehicle allocation', 'Operational diary'] },
      { title: 'Close with evidence', copy: 'Keep live status, POD, completion history and invoice-ready context attached to the original job record.' },
    ]}
    primaryLabel="View Carrier Pricing"
    primaryHref="/pricing"
    secondaryLabel="Explore Couriers & Carriers"
    secondaryHref="/couriers"
    darkBand={{ title: 'Commercial opportunity and fleet execution stay connected.', copy: 'XDrive is designed so winning a load is the beginning of the workflow, not the point where the operational record breaks apart.' }}
  />;
}
