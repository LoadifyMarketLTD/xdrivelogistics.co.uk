export const navLinks = [
  { label: 'Why XDrive', href: '#resources' },
  { label: 'Roles', href: '#solutions' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Modules', href: '#modules' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const trustBarItems = [
  'XDrive Logistics Ltd',
  'Company No. 13171804',
  'UK-focused rollout',
  'Functional Early Access',
  'Approved users only',
] as const;

export const problemPoints = [
  {
    title: 'Job details buried across calls, messages and emails',
    problem: 'Transport requests, changes and confirmations arrive through WhatsApp, email and phone calls — with no single place where everyone has the latest version.',
    consequence: 'Dispatchers spend the first part of every morning making repeated phone calls just to confirm what was agreed, before they can plan a single run.',
    solution: 'Every job lives in one record from the moment it is created. Dispatchers, drivers and customers all see the same information and the same updates — no chasing required.',
  },
  {
    title: 'Drivers leaving the depot without the full picture',
    problem: 'Drivers receive job details verbally or through a message thread. By the time they reach collection, the address has changed, the contact number is wrong or a note was missed.',
    consequence: 'Drivers make repeated phone calls back to the office mid-run, wasting time on both sides and pushing every collection later than planned.',
    solution: 'Drivers receive a complete job brief through XDrive before they leave — address, contact, instructions and any last-minute changes — all in one place.',
  },
  {
    title: 'Missing delivery proof when it matters most',
    problem: 'POD photos are taken on personal phones and sent through WhatsApp where they get buried. Paper signatures are left in the cab or lost between vehicles.',
    consequence: 'When a customer queries a delivery or an invoice is disputed, teams spend hours trying to find missing delivery proof that may no longer exist.',
    solution: 'Delivery proof is uploaded directly against the job record and stays permanently attached — accessible to dispatch, the customer and finance whenever it is needed.',
  },
  {
    title: 'Disconnected communication between drivers and the office',
    problem: 'Drivers update their status by phone or text. Dispatch has no live view of what has been collected, what is running late or what has already been delivered.',
    consequence: 'Transport managers cannot give customers accurate updates, leading to more incoming calls, more guesswork and a growing gap between the office and the road.',
    solution: 'Driver status updates flow back to the operations diary as the job progresses, giving dispatch a live picture without needing to call every driver individually.',
  },
  {
    title: 'Time lost chasing documents before an invoice can go out',
    problem: 'Finance needs the agreed rate, the job details and the signed delivery proof before raising an invoice. These are all in different places and often involve duplicated work to piece together.',
    consequence: 'Days pass between delivery and invoice because someone has to manually track down every piece of supporting evidence before the billing process can even begin.',
    solution: 'The rate, the job record and the delivery evidence are linked from the start. Finance can see what is ready to invoice without rebuilding the history from scratch.',
  },
  {
    title: 'Rate agreements separated from the job record',
    problem: 'Agreed rates are confirmed by email or message but are never formally attached to the job itself. By the time an invoice needs to go out, finance has to trace back through correspondence to confirm what was actually agreed.',
    consequence: 'Invoice queries arise when there is no clear audit trail linking the rate confirmation to the specific transport job that was awarded.',
    solution: 'The awarded rate is locked to the job record at the moment of agreement. Finance can access the commercial context directly from the job rather than searching backwards through correspondence.',
  },
] as const;

export const roleCards = [
  {
    title: 'Transport Customers',
    subtitle: 'Create transport requests, review responses, award work and keep delivery records easier to follow from request to completion.',
    image: '/customers-warehouse.webp',
    imageAlt: 'Transport customer planning shipments in a warehouse environment',
  },
  {
    title: 'Brokers / Load Posters',
    subtitle: 'Post loads with clearer job detail, compare quotes and keep awarded work linked to the operational record instead of scattered messages.',
    image: '/load-poster-office.webp',
    imageAlt: 'Load poster reviewing freight requests and quote activity at a desk',
  },
  {
    title: 'Courier Companies',
    subtitle: 'Coordinate jobs, vehicles, POD records and invoice visibility from one platform built around daily execution.',
    image: '/xdrive-courier-fleet-no-plates.webp',
    imageAlt: 'Courier company fleet parked in a depot yard',
  },
  {
    title: 'Owner Drivers',
    subtitle: 'Submit quotes, manage awarded work and keep delivery evidence tied to the job record without extra admin layers.',
    image: '/owner-operator-van.webp',
    imageAlt: 'Owner driver preparing a van for the next transport job',
  },
  {
    title: 'Drivers',
    subtitle: 'Receive assigned jobs, update progress, upload PODs and keep office communication closer to the live job workflow.',
    image: '/xdrive-driver-pod-real.webp',
    imageAlt: 'Driver using a mobile device to capture proof of delivery',
  },
  {
    title: 'Dispatch Teams',
    subtitle: 'Track collections, deliveries, exceptions and driver activity through a structured operations diary instead of disconnected updates.',
    image: '/operations-dispatch-office.webp',
    imageAlt: 'Dispatch team managing active transport operations in an office',
  },
] as const;

export const workflowSteps = [
  {
    title: 'Request',
    detail: 'Transport requirements are captured with collection, delivery, timing and vehicle context.',
  },
  {
    title: 'Quote',
    detail: 'Approved carriers or operators respond with rates and commercial terms.',
  },
  {
    title: 'Award',
    detail: 'The chosen quote becomes the agreed operational job record.',
  },
  {
    title: 'Assign',
    detail: 'The courier company assigns the right dispatcher, vehicle and driver.',
  },
  {
    title: 'Collect',
    detail: 'Pickup activity and key milestones are recorded against the live job.',
  },
  {
    title: 'Deliver',
    detail: 'Delivery progress, arrival and completion updates stay connected to the same workflow.',
  },
  {
    title: 'POD',
    detail: 'Proof of delivery is uploaded and retained with the completed transport record.',
  },
  {
    title: 'Invoice',
    detail: 'Invoice status and supporting records stay tied to the finished job history.',
  },
] as const;

export const platformModules = [
  {
    title: 'Marketplace',
    whatItDoes: 'Supports transport requests, quote responses and awarded work visibility in one structured workflow.',
    whoUsesIt: 'Transport customers, brokers / load posters, courier companies and owner drivers.',
    status: 'Early Access',
  },
  {
    title: 'Operations Diary',
    whatItDoes: 'Gives dispatch teams a central diary for collections, deliveries, active jobs, changes and exceptions.',
    whoUsesIt: 'Courier companies and dispatch teams.',
    status: 'Functional',
  },
  {
    title: 'Driver Workspace',
    whatItDoes: 'Provides assigned-job detail, status actions and driver workflow updates tied to the operational record.',
    whoUsesIt: 'Drivers, owner drivers and dispatch teams.',
    status: 'Functional',
  },
  {
    title: 'Fleet Management',
    whatItDoes: 'Keeps vehicles, readiness, availability and assignment planning easier to review in one place.',
    whoUsesIt: 'Courier companies, owner drivers and operations teams.',
    status: 'Early Access',
  },
  {
    title: 'POD & Records',
    whatItDoes: 'Stores proof of delivery, delivery notes and supporting documents with the relevant job history.',
    whoUsesIt: 'Drivers, dispatch teams, transport customers and finance users.',
    status: 'Functional',
  },
  {
    title: 'Finance',
    whatItDoes: 'Tracks invoice readiness, invoice status and finance visibility alongside the transport job record.',
    whoUsesIt: 'Courier companies, transport customers, owner drivers and finance admins.',
    status: 'Early Access',
  },
] as const;

export const earlyAccessPoints = [
  'Approved users only during the current rollout.',
  '3 months free access for accepted early-access users.',
  'Controlled onboarding so workflows can be supported properly.',
  'No payment handled by XDrive; settlement remains directly between trading parties.',
] as const;

export const faqs = [
  {
    q: 'What is XDrive Logistics?',
    a: 'XDrive Logistics is a UK logistics platform built around transport requests, quote handling, carrier allocation, driver workflow, POD records, invoice visibility and operational oversight. It is positioned as a functional early-access product rather than a fully scaled public marketplace.',
  },
  {
    q: 'Who can request early access?',
    a: 'Early access is intended for approved logistics users such as transport customers, brokers, load posters, courier companies, owner drivers, drivers and dispatch teams whose workflows fit the current rollout.',
  },
  {
    q: 'Is the platform available to everyone immediately?',
    a: 'No. Access is controlled and approval-based. XDrive is onboarding users gradually so the team can support real operational use cases and improve the product responsibly.',
  },
  {
    q: 'Is XDrive already functional?',
    a: 'Yes, core workflows are functional for approved users, but the broader network, module coverage and public scale are still developing through early access.',
  },
  {
    q: 'Does XDrive process or hold payments?',
    a: 'No. XDrive does not act as a payment intermediary. Commercial settlement remains directly between the trading parties while the platform focuses on records, invoice visibility and workflow history.',
  },
  {
    q: 'How long is early access free?',
    a: 'Approved users receive 3 months of free access during the current controlled rollout period.',
  },
  {
    q: 'Is this just a load board?',
    a: 'No. Marketplace activity is only one part of the platform. XDrive is also focused on operations, driver workflow, POD records, finance visibility and governance around the full transport job lifecycle.',
  },
  {
    q: 'Can courier companies manage drivers and vehicles?',
    a: 'Yes. The platform direction includes assignment, driver workflow, fleet readiness and operational visibility for courier companies and dispatch teams, with some areas still expanding in early access.',
  },
  {
    q: 'Can owner drivers use XDrive?',
    a: 'Yes. Owner drivers are part of the target user base and can participate where their workflow matches the current approved rollout.',
  },
  {
    q: 'How are POD records handled?',
    a: 'PODs and supporting delivery documents are intended to stay attached to the same job record so dispatch, customers and finance users can review delivery evidence in context.',
  },
  {
    q: 'What does the finance area cover?',
    a: 'It is designed for invoice visibility, invoice status and finance-related record keeping connected to the completed job. It is not a payment-processing service.',
  },
  {
    q: 'Is the marketplace already operating at national scale?',
    a: 'No public scale claim is being made. XDrive is UK-focused and functional for approved users, while wider network volume and marketplace depth are still growing.',
  },
  {
    q: 'Why is rollout controlled instead of open?',
    a: 'A controlled rollout helps the team support onboarding properly, validate workflows with real users and avoid overclaiming what is live today.',
  },
  {
    q: 'How do I request access?',
    a: 'Use the Request Early Access route to register interest. The XDrive team can then review fit, role type and rollout readiness before approving access.',
  },
] as const;
