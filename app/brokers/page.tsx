import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/brokers',
  title: 'XDrive for Brokers',
  description: 'Post courier and freight work, compare carrier capacity, award jobs and keep dispatch, POD and invoice readiness connected in one XDrive workflow.',
  kicker: 'XDrive for Brokers',
});

export default function BrokersPage() {
  return <MarketingDetailPage
    activeNavHref="/brokers"
    kicker="XDrive for Brokers"
    title="Post transport work. Compare capacity. Award with control."
    intro="XDrive gives brokers one commercial and operational workflow for posting courier and freight jobs, receiving carrier quotes, awarding work and keeping visibility through dispatch, POD and invoice readiness."
    sections={[
      { title: 'Post work once', copy: 'Create the transport requirement with the route, vehicle, timing and delivery context that carriers need to quote accurately.', points: ['Courier and freight jobs', 'Vehicle requirements', 'Collection and delivery timing'] },
      { title: 'Compare real offers', copy: 'Keep carrier responses attached to the job and compare commercial options before award.', points: ['Quote comparison', 'Clear job context', 'Controlled award decision'] },
      { title: 'Carry the award into operations', copy: 'Awarded work becomes a live operational job instead of being re-keyed into another workflow.', points: ['Driver and vehicle allocation', 'Live status visibility', 'Exception handling'] },
      { title: 'Close with evidence', copy: 'Keep POD and completion records connected to the job so the commercial record survives delivery.', points: ['POD evidence', 'Completion history', 'Invoice-ready context'] },
    ]}
    darkBand={{ title: 'A broker workflow built around the whole job, not just the booking.', copy: 'From the moment a load is posted until delivery evidence is returned, XDrive keeps the chain connected.' }}
  />;
}
