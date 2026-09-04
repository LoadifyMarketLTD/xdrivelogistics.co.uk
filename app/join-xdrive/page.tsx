import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

const title = 'Join the XDrive Network';
const description = 'Apply to join XDrive as an owner driver, carrier, broker or transport customer and enter a connected UK courier and freight workflow.';

export const metadata = buildMarketingMetadata({ path: '/join-xdrive', title, description, kicker: 'Join the XDrive Network', visual: 'network' });

export default function JoinXDrivePage() {
  return <MarketingDetailPage
    kicker="Join the XDrive Network"
    title="Join XDrive as an owner driver, carrier, broker or transport customer."
    intro="XDrive is growing a transport network around real operators and real transport activity. Choose the route that matches your operation, apply for access and use the same platform from commercial opportunity through delivery evidence."
    sections={[
      { title: 'Owner Drivers', copy: 'Independent owner drivers can apply for membership to discover work, quote and run awarded jobs through live execution and POD.', points: ['Independent operator access', 'Exchange and quoting', 'Live job and POD workflow'] },
      { title: 'Carriers', copy: 'Courier and transport companies can connect commercial opportunities with driver allocation, dispatch, live operations and delivery evidence.', points: ['Fleet operations', 'Driver and vehicle allocation', 'POD and finance readiness'] },
      { title: 'Brokers', copy: 'Transport brokers can post work, compare carrier capacity, award jobs and keep visibility after the booking is made.' },
      { title: 'Transport Customers', copy: 'Shippers and transport customers can post requirements, compare responses and retain one record through award and proof of delivery.' },
    ]}
    primaryLabel="Request XDrive Access"
    primaryHref="/register"
    secondaryLabel="View Membership Pricing"
    secondaryHref="/pricing"
    darkBand={{ title: 'One network. Different operating roles. One connected transport record.', copy: 'Applications are reviewed as platform access requests. XDrive membership or network participation does not by itself create an employment relationship.' }}
  />;
}
