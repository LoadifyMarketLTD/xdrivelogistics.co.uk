import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/product-status',
  title: 'XDrive Early Access Product Status',
  description: 'See the current public launch scope of the XDrive courier and freight exchange platform and the boundaries of the present operating model.',
  kicker: 'Early Access Product Status',
});

export default function ProductStatusPage() {
  return <MarketingDetailPage
    activeNavHref="/platform"
    kicker="Early Access Product Status"
    title="What XDrive is offering in the current launch scope."
    intro="XDrive is in controlled early access. This page separates the current public launch model from capabilities that should not be assumed unless XDrive expressly publishes them as available."
    sections={[
      { title: 'Exchange workflow', copy: 'The current public platform scope covers transport posting, discovery, quoting and award into the operational workflow.', points: ['Posted courier and freight work', 'Quote submission and comparison', 'Award into the same job record'] },
      { title: 'Operations workflow', copy: 'Awarded work continues through operational handling rather than becoming a disconnected record.', points: ['Driver allocation', 'Job status progression', 'POD and completion records'] },
      { title: 'Commercial records', copy: 'Completion, POD, invoice readiness and payment records can remain linked to the transport job while the commercial payment obligation stays between the contracting parties.', points: ['POD evidence', 'Invoice-ready context', 'Payment status records'] },
      { title: 'Current model boundaries', copy: 'Do not assume a capability exists merely because it is common elsewhere in logistics software.', points: ['XDrive is not an escrow or banking service', 'No public biometric facial-verification claim', 'No public automatic insurer-database validation claim'] },
    ]}
    primaryLabel="Explore the Platform"
    primaryHref="/platform"
    secondaryLabel="Trust & Verification"
    secondaryHref="/trust"
    darkBand={{ title: 'Published capability is the source of truth.', copy: 'Planned or benchmarked features are not represented as available until XDrive expressly moves them into the public launch scope.' }}
  />;
}
