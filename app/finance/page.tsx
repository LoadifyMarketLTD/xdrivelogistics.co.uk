import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/finance',
  title: 'XDrive Finance & Invoice Readiness',
  description: 'Keep awarded value, POD, completion status and payment context connected so completed transport jobs move into invoicing with a clear audit trail.',
  kicker: 'Finance & Invoice Readiness',
});

export default function FinancePage() {
  return <MarketingDetailPage
    kicker="Finance & Invoice Readiness"
    title="Operational records that are ready for finance."
    intro="XDrive keeps commercial and delivery context connected so completed jobs can move into invoicing and payment follow-up with less manual reconstruction."
    sections={[
      { title: 'Invoice-ready context', copy: 'Carry job reference, parties, awarded value and completion status into the finance workflow.' },
      { title: 'POD connection', copy: 'Keep delivery evidence tied to the same job record so supporting documents are easier to retrieve.' },
      { title: 'Payment status history', copy: 'Track invoice and payment status against the operational record where the underlying work originated.' },
      { title: 'Commercial clarity', copy: 'Maintain a cleaner audit trail between quote, award, delivery and finance for internal review and customer queries.' }
    ]}
    primaryLabel="View Pricing"
    primaryHref="/pricing"
    secondaryLabel="POD & Records"
    secondaryHref="/pod-records"
    darkBand={{ title: 'The job should not need to be rebuilt when invoicing starts.', copy: 'XDrive connects operational completion with finance readiness so the commercial history remains visible after delivery.' }}
  />;
}
