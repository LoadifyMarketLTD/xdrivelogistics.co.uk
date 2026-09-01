import { MarketingDetailPage } from '../(marketing)/_components/MarketingDetailPage';

export default function PodRecordsPage() {
  return <MarketingDetailPage
    kicker="POD & Records"
    title="Delivery evidence stays attached to the job."
    intro="XDrive keeps proof of delivery and completion evidence connected to the job, driver, timing and operational history instead of leaving records scattered across messages and devices."
    sections={[
      { title: 'Capture delivery evidence', copy: 'Return POD information against the correct awarded job and delivery record.' },
      { title: 'Keep the audit trail', copy: 'Preserve the relationship between the job, driver, timestamps and completion history.' },
      { title: 'Support disputes and queries', copy: 'A clearer evidence trail helps operators and customers understand what happened when a delivery is questioned.' },
      { title: 'Prepare for finance', copy: 'Completed evidence can feed the invoice-ready record so operational closure and finance stay connected.' }
    ]}
    primaryLabel="Explore Courier Workspace"
    primaryHref="/courier-workspace"
    secondaryLabel="Finance"
    secondaryHref="/finance"
    darkBand={{ title: 'POD is part of the operational record, not an afterthought.', copy: 'XDrive is designed to make delivery evidence easier to locate, verify and use when closing the job or preparing invoicing.' }}
  />;
}
