import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';

export default function CouriersPage() {
  return <MarketingDetailPage
    kicker="XDrive for Couriers & Carriers"
    title="Find work. Quote fast. Keep every awarded job connected."
    intro="Owner drivers and courier companies can discover relevant work, submit quotes, receive awarded jobs into operations, update live status and return POD without leaving the XDrive workflow."
    sections={[
      { title: 'Find relevant work', copy: 'See courier and freight opportunities with the route, vehicle and timing information needed to decide quickly.', points: ['Available loads', 'Vehicle context', 'Return and scheduled work'] },
      { title: 'Quote directly', copy: 'Respond to jobs from the exchange and keep your commercial offer attached to the same job record.', points: ['Fast quote submission', 'Clear job requirements', 'Award visibility'] },
      { title: 'Run the awarded job', copy: 'Move awarded work into driver allocation and live execution without creating a second operational record.', points: ['Driver allocation', 'Status progression', 'Route and exception visibility'] },
      { title: 'Finish with POD', copy: 'Return delivery evidence and keep completion history attached to the original job.', points: ['POD capture', 'Delivery timestamps', 'Invoice-ready records'] },
    ]}
    darkBand={{ title: 'Use the exchange to win work — then use XDrive to run it properly.', copy: 'XDrive is designed for the whole journey from available work to completed delivery, not just finding the load.' }}
  />;
}
