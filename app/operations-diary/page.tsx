import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';
import { buildMarketingMetadata } from '../../lib/marketingMetadata';

export const metadata = buildMarketingMetadata({
  path: '/operations-diary',
  title: 'XDrive Operations Diary',
  description: 'Move awarded transport work into driver and vehicle allocation, live job status, ETA, exception handling, POD and completion readiness in XDrive.',
  kicker: 'Operations Diary',
});

export default function OperationsDiaryPage() {
  return <MarketingDetailPage
    kicker="Operations Diary"
    title="Awarded work becomes live operations."
    intro="The XDrive Operations Diary is where awarded jobs move into day-to-day execution: allocation, route context, status, ETA, exceptions and completion."
    sections={[
      { title: 'Operational handover', copy: 'Awarded jobs enter operations without recreating the commercial record.' },
      { title: 'Driver and vehicle allocation', copy: 'Keep the assigned driver and vehicle tied to the job record and operational responsibility.' },
      { title: 'Live job status', copy: 'Progress jobs through the execution chain and keep timing and exception context visible.' },
      { title: 'Completion readiness', copy: 'Delivered work flows naturally into POD and finance records rather than stopping at a generic completed state.' }
    ]}
    primaryLabel="Explore the Platform"
    primaryHref="/platform"
    secondaryLabel="Courier Workspace"
    secondaryHref="/courier-workspace"
    darkBand={{ title: 'The exchange is only the beginning.', copy: 'XDrive is designed to carry awarded work through the real operational lifecycle, not stop once a carrier has been selected.' }}
  />;
}
