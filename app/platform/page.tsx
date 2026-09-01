import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';

export default function PlatformPage() {
  return <MarketingDetailPage
    kicker="The XDrive Platform"
    title="From transport opportunity to completed job, in one connected platform."
    intro="XDrive combines courier and freight exchange activity with quoting, award, dispatch, live execution, POD and invoice readiness. The same job record moves through the entire lifecycle."
    sections={[
      { title: 'Exchange', copy: 'Customers and brokers publish work while couriers and carriers discover relevant opportunities.', points: ['Courier and freight work', 'Vehicle and route context', 'Return loads and scheduled transport'] },
      { title: 'Commercial workflow', copy: 'Quotes stay attached to the job so the commercial decision is clear and auditable.', points: ['Quote submission', 'Offer comparison', 'Award into operations'] },
      { title: 'Operations', copy: 'Awarded work becomes an operational record rather than disappearing into another system.', points: ['Driver allocation', 'Live status progression', 'Exception visibility'] },
      { title: 'POD & finance readiness', copy: 'Delivery evidence and commercial context remain connected after the job is completed.', points: ['POD evidence', 'Completion history', 'Invoice-ready context'] },
    ]}
    darkBand={{ title: 'One job record. One operational chain.', copy: 'XDrive is designed so posting work, winning it, moving it and proving delivery are not separate disconnected processes.' }}
  />;
}
