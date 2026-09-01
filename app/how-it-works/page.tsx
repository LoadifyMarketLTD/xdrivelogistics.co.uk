import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';

export default function HowItWorksPage() {
  return <MarketingDetailPage
    kicker="How XDrive Works"
    title="One transport job. One connected operational chain."
    intro="XDrive keeps the job record intact from posting through quoting, award, driver allocation, live execution, POD and finance readiness."
    sections={[
      { title: '1. Post', copy: 'Create the transport requirement with route, timing, vehicle and delivery information.' },
      { title: '2. Quote', copy: 'Relevant carriers and owner drivers respond to the same job record with their commercial offer.' },
      { title: '3. Award', copy: 'Choose the right offer and move the successful quote directly into the operational workflow.' },
      { title: '4. Dispatch', copy: 'Allocate the work, driver and vehicle, then progress through operational statuses without rebuilding the job.' },
      { title: '5. Track', copy: 'Keep live status, ETA and exceptions connected to the awarded job so all parties retain context.' },
      { title: '6. POD & finance', copy: 'Return delivery evidence and preserve invoice-ready records after the job is complete.' }
    ]}
    primaryLabel="Explore the Platform"
    primaryHref="/platform"
    secondaryLabel="View Pricing"
    secondaryHref="/pricing"
    darkBand={{ title: 'Commercial decisions and operations stay connected.', copy: 'The aim is simple: less duplication, fewer disconnected tools and a clearer record of what happened at every stage of the job.' }}
  />;
}
