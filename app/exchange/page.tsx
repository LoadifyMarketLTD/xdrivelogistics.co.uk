import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/exchange',
  title: 'XDrive Courier & Freight Exchange',
  description: 'Post transport work, discover suitable courier and freight opportunities, compare quotes and award jobs into operations on the XDrive Exchange.',
  kicker: 'XDrive Exchange',
});

export default function ExchangePage() {
  return <MarketingDetailPage
    kicker="XDrive Exchange"
    title="Post work. Find capacity. Quote with context."
    intro="The XDrive Exchange is the commercial entry point for courier and freight work. Jobs are posted with route, vehicle, timing and delivery requirements so the right operators can respond with clear quotes."
    sections={[
      { title: 'Post transport work', copy: 'Customers and brokers can publish work with the operational detail carriers need before quoting.', points: ['Collection and delivery context', 'Vehicle and capacity requirements', 'Timing, notes and delivery requirements'] },
      { title: 'Discover suitable work', copy: 'Owner drivers and carriers can review available jobs that match their operating profile and capacity.', points: ['Courier and freight opportunities', 'Relevant route and vehicle context', 'Clear job record before quoting'] },
      { title: 'Quote in one record', copy: 'Quotes stay attached to the job so comparisons and commercial decisions remain traceable.', points: ['Quote value and operator identity', 'Comparable offers', 'Award history retained'] },
      { title: 'Award into operations', copy: 'Once work is awarded, the same job moves into dispatch, live status, POD and finance readiness instead of being recreated elsewhere.' }
    ]}
    primaryLabel="Request Early Access"
    primaryHref="/register"
    secondaryLabel="See How It Works"
    secondaryHref="/how-it-works"
    darkBand={{ title: 'Exchange activity becomes operational work.', copy: 'XDrive is designed so the commercial exchange and the operational workflow remain connected from the first posting through delivery completion.' }}
  />;
}
