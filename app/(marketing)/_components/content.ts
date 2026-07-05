import {
  BriefcaseBusiness,
  CircleDollarSign,
  FileCheck2,
  FileSpreadsheet,
  Route,
  ShieldCheck,
  Truck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export const navLinks = [
  { label: 'Product', href: '#product' },
  { label: 'Workspaces', href: '#workspaces' },
  { label: 'Flow', href: '#flow' },
  { label: 'Rollout', href: '#rollout' },
  { label: 'Contact', href: '#contact' },
] as const;

export const trustMetrics = [
  { label: 'Customer intake', value: 'Quote request + customer workspace' },
  { label: 'Marketplace', value: 'Posted jobs, bids and awards' },
  { label: 'Dispatch', value: 'Operations centre + diary execution' },
  { label: 'Driver proof', value: 'Mobile job updates and POD records' },
] as const;

export const statusHighlights = [
  {
    title: 'Functional workspaces live now',
    description:
      'The homepage is now aligned to the actual product surfaces already in the platform: customer intake, marketplace, operations, driver workflow and finance records.',
  },
  {
    title: 'Approval-based access',
    description:
      'XDrive remains a controlled rollout for approved users so onboarding, company setup and workflow quality can stay deliberate while the network grows.',
  },
  {
    title: 'Driver workflow included',
    description:
      'Assigned jobs, status events and POD upload are already part of the platform, including the dedicated driver workspace and mobile app direction.',
  },
  {
    title: 'Operations and finance stay linked',
    description:
      'Job history, delivery proof and invoice visibility stay attached to the same operational record, while commercial settlement remains between trading parties.',
  },
] as const;

export const workspaceCards: ReadonlyArray<{
  image: string;
  imageAlt: string;
  routeLabel: string;
  outcome: string;
  subtitle: string;
  title: string;
}> = [
  {
    title: 'Customer Desk',
    subtitle: 'Capture transport requirements, publish work, compare responses and follow the job from quote stage through delivery evidence.',
    image: '/customers-warehouse.webp',
    imageAlt: 'Customer workspace for transport requests, job progress and delivery records',
    routeLabel: 'Public quote form + /customer workspace',
    outcome: 'Request creation, quote review and delivery visibility',
  },
  {
    title: 'Marketplace',
    subtitle: 'See posted loads, return bids, track awards and connect won work back into operational execution instead of treating exchange activity as a dead end.',
    image: '/marketplace-loading.webp',
    imageAlt: 'Marketplace workspace showing available loads, quote activity and award flow',
    routeLabel: '/admin/marketplace and broker load views',
    outcome: 'Posted work, bid status and awarded jobs',
  },
  {
    title: 'Operations Centre',
    subtitle: 'Keep live work visible for dispatch, assign drivers, manage timings, monitor exceptions and react from one operational surface.',
    image: '/operations-dispatch-office.webp',
    imageAlt: 'Operations centre dashboard showing dispatch coordination and live logistics activity',
    routeLabel: '/admin/operations-centre and diary',
    outcome: 'Assignment, monitoring and exception handling',
  },
  {
    title: 'Driver Workspace',
    subtitle: 'Show the next assigned job first, record milestones on the road and return POD into the same job record without extra chasing.',
    image: '/xdrive-driver-workspace-real.webp',
    imageAlt: 'Driver workspace for assigned jobs, status updates and route execution',
    routeLabel: '/driver/jobs and mobile app',
    outcome: 'Roadside actions, milestones and POD upload',
  },
  {
    title: 'Finance Records',
    subtitle: 'Tie invoice visibility and payment status back to completed work so operations and finance can review the same job trail.',
    image: '/xdrive-finance-records-real.webp',
    imageAlt: 'Finance records area showing invoices, proof checks and payment status',
    routeLabel: '/admin/invoices and /driver/finance',
    outcome: 'Invoice status, POD check and payment trail',
  },
] as const;

export const platformModules = [
  {
    key: 'intake',
    title: 'Structured intake before dispatch starts',
    summary:
      'The public quote form and customer workspace collect route, cargo and timing details so transport work starts from a cleaner brief.',
    previewDescription:
      'A structured request surface for pickup, delivery, cargo and contact data before a job enters the wider workflow.',
    bullets: ['Pickup and delivery detail', 'Vehicle and cargo requirements', 'Customer references', 'Initial quote capture'],
    image: '/load-poster-office.webp',
    imageAlt: 'Transport request intake workspace with structured shipment details',
    audience: 'Transport customers, load posters and internal intake teams.',
    problem:
      'Reduces vague job briefs and missing job data before quoting or posting work into the network.',
    actions: [
      'Capture route, cargo and reference data from the start',
      'Push cleaner work into customer or exchange workflows',
      'Keep request history attached to the same job record',
    ],
    status: 'Live intake + customer workflow',
    previewItems: [
      {
        label: 'Request Detail',
        desc: 'Pickup, delivery, cargo type, contact notes, timing windows and booking references.',
      },
      {
        label: 'Quote Readiness',
        desc: 'The same job record can move into quoting without retyping the operational basics.',
      },
      {
        label: 'Customer Visibility',
        desc: 'Customers can review posted, quoted, awarded and delivered work in one place.',
      },
    ],
  },
  {
    key: 'operations',
    title: 'Marketplace and award path stay connected',
    summary:
      'Posted jobs, bids and awards feed into real operating records instead of living in a separate marketing concept or static load board.',
    previewDescription:
      'Exchange-style activity that becomes operational work when a bid is accepted or a carrier is awarded.',
    bullets: ['Posted loads', 'Bid lifecycle', 'Carrier awards', 'Marketplace history'],
    image: '/marketplace-loading.webp',
    imageAlt: 'Marketplace workspace with posted loads, bids and awards',
    audience: 'Customers, brokers, courier companies and owner operators.',
    problem:
      'Prevents the common split where quoting happens in one place but dispatch still relies on separate calls, chats or spreadsheets.',
    actions: [
      'Publish jobs with clearer route and load context',
      'Track who bid, who won and what moved forward',
      'Carry awarded work into the next operational stage',
    ],
    status: 'Live marketplace workflow',
    previewItems: [
      {
        label: 'Available Loads',
        desc: 'Posted work with route, vehicle, cargo and timing context.',
      },
      {
        label: 'Bid Lifecycle',
        desc: 'Submitted, accepted, rejected or awarded activity attached to the job.',
      },
      {
        label: 'Award Path',
        desc: 'Winning the work should create the next operational step, not restart it.',
      },
    ],
  },
  {
    key: 'driver',
    title: 'Dispatch surfaces for real operating control',
    summary:
      'The operations centre and diary focus on today’s jobs, assignments, delays, driver coverage and the status of active work.',
    previewDescription:
      'A dispatch-first surface for live monitoring, assignment and exception handling.',
    bullets: ['Live jobs', 'Assignment actions', 'Exceptions', 'Capacity visibility'],
    image: '/operations-dispatch-office.webp',
    imageAlt: 'Operations centre with dispatch KPIs and active jobs',
    audience: 'Dispatchers, courier companies, operators and owner-led teams.',
    problem:
      'Teams need one place to understand what is active, delayed, assigned or missing instead of piecing it together across multiple channels.',
    actions: [
      'Assign drivers and vehicles from the live job list',
      'Monitor active work, exceptions and backlog pressure',
      'Use operational data instead of memory or chat threads',
    ],
    status: 'Functional early-access workflow',
    previewItems: [
      {
        label: 'Live Snapshot',
        desc: 'Jobs today, delayed jobs, available vehicles, online drivers and pending POD or invoice tasks.',
      },
      {
        label: 'Dispatch Actions',
        desc: 'Assign driver, upload POD, create quote, create invoice and re-route work from the same area.',
      },
      {
        label: 'Job Trail',
        desc: 'Request, award, assign, collect, deliver and invoice states remain visible as one chain.',
      },
    ],
  },
  {
    key: 'fleet',
    title: 'Driver execution is part of the same record',
    summary:
      'Drivers see assigned work first, post milestone events and return POD into the same job history used by dispatch and finance.',
    previewDescription:
      'A mobile-first execution surface for assigned work, route milestones and proof of delivery.',
    bullets: ['Assigned jobs', 'Driver actions', 'Collection / delivery events', 'POD upload'],
    image: '/xdrive-driver-workspace-real.webp',
    imageAlt: 'Driver workspace with assigned jobs and route updates',
    audience: 'Drivers, owner drivers and dispatch teams supporting them.',
    problem:
      'Delivery execution often breaks away from the original job record; XDrive is designed to keep road events attached to it.',
    actions: [
      'Expose the next active job clearly to the driver',
      'Record on-route, arrived, collected and delivered events',
      'Attach proof of delivery back to the completed job',
    ],
    status: 'Live driver workflow',
    previewItems: [
      {
        label: 'Active Job View',
        desc: 'Pickup, delivery, contact notes, timing and vehicle context shown in one mobile-first surface.',
      },
      {
        label: 'Roadside Events',
        desc: 'Drivers can mark on route, arrived, loaded and delivered actions as the day moves.',
      },
      {
        label: 'POD Return',
        desc: 'Proof of delivery stays connected to the operational and finance trail.',
      },
    ],
  },
  {
    key: 'finance',
    title: 'POD, invoices and payment status remain visible',
    summary:
      'Finance records are treated as the closing part of the job lifecycle, with invoice visibility linked back to delivery evidence and operational history.',
    previewDescription:
      'A records surface for invoice generation, status tracking and payment follow-up tied to job completion.',
    bullets: ['Invoices', 'Payment status', 'History', 'Disputes'],
    image: '/xdrive-finance-records-real.webp',
    imageAlt: 'Finance dashboard showing invoice records, POD checks and payment-status visibility',
    audience: 'Courier companies, transport customers, finance admins and owner operators.',
    problem:
      'Teams need invoice and payment visibility without losing the operational proof that explains what was delivered.',
    actions: [
      'Review invoice status beside completed job context',
      'Use POD evidence when closing or chasing work',
      'Track payment status without the platform holding funds',
    ],
    status: 'Live finance visibility',
    previewItems: [
      {
        label: 'Invoice Records',
        desc: 'Invoice number, job reference, rate, VAT status and customer record.',
      },
      {
        label: 'POD Verification',
        desc: 'Confirm invoice readiness against completed delivery evidence.',
      },
      {
        label: 'Payment Status',
        desc: 'Track unpaid, pending, paid or disputed job records.',
      },
    ],
  },
] as const;

export type PlatformModule = (typeof platformModules)[number];

export const workflow: ReadonlyArray<{
  title: string;
  detail: string;
  proof: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Request',
    detail: 'A transport request starts with pickup, delivery, cargo, timing and contact detail.',
    proof: 'Public quote form + customer posting flow',
    icon: FileSpreadsheet,
  },
  {
    title: 'Post',
    detail: 'The work is prepared for internal handling or exchange visibility without losing the original brief.',
    proof: 'Customer and marketplace records stay aligned',
    icon: Route,
  },
  {
    title: 'Bid',
    detail: 'Carriers or operators return their price and message against the same job record.',
    proof: 'Marketplace + broker bid views',
    icon: CircleDollarSign,
  },
  {
    title: 'Award',
    detail: 'Accepted work moves forward as the chosen carrier path rather than creating a disconnected new record.',
    proof: 'Awarded carrier and won-work flow',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Allocate',
    detail: 'Dispatch assigns the job to a driver or vehicle and monitors today’s active workload.',
    proof: 'Diary + operations centre',
    icon: UsersRound,
  },
  {
    title: 'Track',
    detail: 'Drivers update collection and delivery milestones while the office keeps live visibility.',
    proof: 'Driver workspace + mobile workflow',
    icon: Truck,
  },
  {
    title: 'Close',
    detail: 'POD, invoice status and payment visibility remain attached to the completed operational trail.',
    proof: 'POD and finance records',
    icon: FileCheck2,
  },
  {
    title: 'Review',
    detail: 'Operations and finance can revisit the same record later for audit, disputes or cashflow follow-up.',
    proof: 'Invoice and history views',
    icon: ShieldCheck,
  }
] as const;

export const proofPoints = [
  {
    title: 'Request',
    text: 'Customer and public intake already capture the core data needed before the job is priced or posted.',
  },
  {
    title: 'Operate',
    text: 'Marketplace, operations centre and driver workspace are the real product surfaces shaping this homepage.',
  },
  {
    title: 'Close',
    text: 'POD, invoices and payment status stay tied to the job so the story does not end at delivery.',
  },
] as const;

export const productChecks = [
  'Homepage language follows the real request → bid → dispatch → driver → finance product flow',
  'Workspaces are presented as actual operating surfaces, not generic SaaS promises',
  'Early-access positioning stays transparent about approval-based rollout',
  'Operational records remain the centre of the product story',
];

export const faqs = [
  {
    q: 'What is different about the new homepage?',
    a: 'It is now based on the actual product surfaces already in XDrive: customer intake, marketplace, operations, driver workflow and finance records. The page is meant to describe how the platform works today instead of restoring older generic marketing copy.',
  },
  {
    q: 'Is XDrive just a load board?',
    a: 'No. Marketplace activity is only one part of the product. XDrive is being shaped around the wider operating chain: request, bid, award, dispatch, driver events, POD and invoice visibility.',
  },
  {
    q: 'Which workspaces are already part of the platform?',
    a: 'The current platform includes customer posting and tracking, marketplace-style bid flows, dispatch and operations views, driver job execution, and invoice or payment-status visibility linked back to jobs.',
  },
  {
    q: 'Who is the platform built for?',
    a: 'It is built around transport customers, courier companies, brokers, owner operators, dispatchers and drivers who need one cleaner operating flow instead of fragmented calls, messages and spreadsheets.',
  },
  {
    q: 'Is the rollout public?',
    a: 'Not fully. XDrive is still approval-based so the team can onboard suitable UK transport users, shape workflows from real feedback and keep the product honest about what is already live.',
  },
  {
    q: 'How does the driver workflow fit in?',
    a: 'Assigned jobs, status actions and POD upload are part of the product direction and current workflow. Driver execution is treated as part of the same job record, not as a separate afterthought.',
  },
  {
    q: 'Does XDrive hold customer funds?',
    a: 'No. XDrive focuses on operational records, delivery proof, invoice visibility and payment tracking. Commercial settlement remains directly between the trading parties.',
  },
] as const;
