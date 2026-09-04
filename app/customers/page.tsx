import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/customers',
  title: 'XDrive for Transport Customers',
  description: 'Post courier and freight requirements, compare operator quotes, award work and follow delivery evidence in one controlled XDrive workflow.',
  kicker: 'For Transport Customers',
});

export default function CustomersPage() {
  return <MarketingDetailPage
    kicker="For Transport Customers"
    title="Post transport work and keep control after award."
    intro="XDrive gives shippers and transport customers a structured way to post courier and freight requirements, receive quotes, award work and follow the same job through delivery evidence."
    sections={[
      { title: 'Create a clear requirement', copy: 'Post route, vehicle, timing and delivery needs so operators can quote against the same information.', points: ['Collection and delivery details', 'Vehicle and capacity requirements', 'Delivery notes and POD needs'] },
      { title: 'Compare operator offers', copy: 'Review quotes in one place instead of managing disconnected messages and spreadsheets.' },
      { title: 'Award with a record', copy: 'The successful quote remains attached to the job and becomes the basis for the operational workflow.' },
      { title: 'Follow the delivery', copy: 'Track execution through live status and receive POD and completion records against the same job.' }
    ]}
    primaryLabel="Request Customer Access"
    primaryHref="/register"
    secondaryLabel="Explore Brokers"
    secondaryHref="/brokers"
    darkBand={{ title: 'A transport request should not disappear after it is awarded.', copy: 'XDrive is designed to preserve the commercial and operational history so customers can see how the job progressed from request to proof of delivery.' }}
  />;
}
