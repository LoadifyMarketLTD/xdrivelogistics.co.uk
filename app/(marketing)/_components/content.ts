import {
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  Layers,
  Network,
  Route,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

export const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Resources', href: '#resources' },
  { label: 'Contact', href: '#contact' },
] as const;

export const statusHighlights = [
  {
    title: 'Functional early-access rollout',
    description:
      'Core workflows are available for approved users now, with the homepage presenting the platform clearly without claiming full public network scale.',
  },
  {
    title: 'Approved-user access',
    description:
      'During Early Access, approved users can use current supported modules for an initial 3-month free access period.',
  },
  {
    title: '3-month free access',
    description:
      'Approved users can join the controlled rollout with 3 months of free access while XDrive continues to refine the wider platform experience.',
  },
  {
    title: 'Operational records, not fund holding',
    description:
      'XDrive is designed to track jobs, PODs, invoices, payment status and audit history, while commercial payments remain directly between trading parties.',
  },
] as const;

export const roleCards: ReadonlyArray<{
  image: string;
  imageAlt: string;
  subtitle: string;
  title: string;
}> = [
  {
    title: 'Transport Customers',
    subtitle: 'Request transport, compare courier responses, follow job progress and keep delivery records organised from request to completion.',
    image: '/customers-warehouse.webp',
    imageAlt: 'Transport customer reviewing shipment activity, courier responses and delivery records in a structured workspace',
  },
  {
    title: 'Courier Companies',
    subtitle: 'Manage incoming work, quotes, drivers, vehicles, PODs, invoices and operational history from one workspace.',
    image: '/xdrive-courier-fleet-no-plates.webp',
    imageAlt: 'Courier company fleet yard showing vehicle capacity and operational readiness without visible registration plates',
  },
  {
    title: 'Owner Operators',
    subtitle: 'Find suitable work, submit clear quotes, manage awarded jobs and keep delivery records connected to completed transport.',
    image: '/owner-operator-van.webp',
    imageAlt: 'Owner operator managing route readiness, assigned work and delivery records',
  },
  {
    title: 'Load Posters',
    subtitle: 'Create structured transport requests, receive responses and track awarded work without losing key job details.',
    image: '/load-poster-office.webp',
    imageAlt: 'Load poster preparing a transport request and reviewing awarded workflow history',
  },
  {
    title: 'Drivers',
    subtitle: 'View assigned jobs, update progress, confirm collection and delivery milestones, and upload PODs through a mobile-first workflow.',
    image: '/xdrive-driver-pod-real.webp',
    imageAlt: 'Driver using a mobile workflow to update status and upload proof of delivery',
  },
] as const;

export const platformModules = [
  {
    key: 'marketplace',
    title: 'Marketplace',
    summary:
      'Browse available loads, submit quotes, track bid status and keep awarded work linked to operational records.',
    previewDescription:
      'A workspace for available load opportunities, submitted quotes, bid status and awarded work records.',
    bullets: ['Available loads', 'Quotes and bids', 'Awarded jobs', 'Marketplace history'],
    image: '/marketplace-loading.webp',
    imageAlt: 'Marketplace-style workspace showing load opportunities, quote activity and route details',
    icon: Route,
    audience: 'Transport customers, load posters, courier companies and owner operators.',
    problem:
      'Brings requests, quote activity and awarded work into one structured workflow instead of fragmented emails, calls and spreadsheets.',
    actions: [
      'Review posted work and route information',
      'Manage quote and bid activity with clearer status visibility',
      'Track awarded jobs and marketplace history records',
    ],
    status: 'Planned for early-access rollout',
    previewItems: [
      {
        label: 'Available Loads',
        desc: 'Pickup, delivery, cargo type, vehicle requirement, timing window and posted rate.',
      },
      {
        label: 'Quote Lifecycle',
        desc: 'Submitted, awaiting decision, accepted, declined or awarded.',
      },
      {
        label: 'Awarded Work',
        desc: 'Carrier, route, accepted rate, delivery reference and operational history.',
      },
    ],
  },
  {
    key: 'operations',
    title: 'Operations Diary',
    summary:
      'Manage collections, deliveries and active jobs while surfacing overdue work, stale driver signals, POD gaps and other exceptions that need follow-up.',
    previewDescription:
      'A dispatch-focused view for live work, exception control, next actions and delivery progress.',
    bullets: ['Collections', 'Deliveries', 'Exception control', 'Closure tracking'],
    image: '/operations-dispatch-office.webp',
    imageAlt: 'Operations diary workspace showing dispatch coordination, scheduled jobs and live status updates',
    icon: ClipboardCheck,
    audience: 'Courier companies, dispatchers, operators and owner-led teams.',
    problem:
      'Keeps daily execution visible and turns time-sensitive exceptions into owned follow-up work instead of leaving them buried in status lists.',
    actions: [
      'Track active jobs and time-sensitive collections or deliveries',
      'Surface overdue collections or deliveries, stale driver updates, stale GPS and imminent unallocated work',
      'Follow next actions, SLA state, customer-update obligations and verified closure through the exception lifecycle',
    ],
    status: 'Functional early-access workflow',
    previewItems: [
      {
        label: "Today's Jobs",
        desc: 'Collections, deliveries, time windows and current job status.',
      },
      {
        label: 'Exception Control',
        desc: 'Overdue collections or deliveries, stale tracking, POD gaps, priority, owner, SLA and next action.',
      },
      {
        label: 'Closure Tracking',
        desc: 'Customer-update obligations, escalation state and verified closure evidence stay attached to the case history.',
      },
    ],
  },
  {
    key: 'driver',
    title: 'Driver Workspace',
    summary:
      'Give drivers a mobile-first workflow for assigned jobs, collection updates, delivery status, route notes and POD upload.',
    previewDescription:
      'A mobile-first workflow for drivers to receive job details, update status and upload proof of delivery.',
    bullets: ['Assigned jobs', 'Mobile updates', 'Route actions', 'Driver communication'],
    image: '/xdrive-driver-workspace-real.webp',
    imageAlt: 'Driver workspace showing assigned jobs, vehicle context and route progress updates',
    icon: UserRound,
    audience: 'Drivers, owner-drivers and dispatch teams supporting them.',
    problem:
      'Gives drivers a clearer workflow for accepting work, updating progress and returning delivery evidence instead of relying only on ad-hoc messages.',
    actions: [
      'View assigned jobs and route instructions',
      'Submit status actions during collection and delivery',
      'Upload POD and keep driver-to-office updates clearer',
    ],
    status: 'Functional early-access workflow',
    previewItems: [
      {
        label: 'Active Job',
        desc: 'Pickup address, delivery address, contact notes and required vehicle.',
      },
      {
        label: 'Driver Actions',
        desc: 'On route, arrived, collected, delivered and POD uploaded.',
      },
      {
        label: 'POD Upload',
        desc: 'Delivery evidence attached directly to the completed job record.',
      },
    ],
  },
  {
    key: 'fleet',
    title: 'Fleet Management',
    summary:
      'Manage vehicles, drivers, availability, compliance records and future positions from one structured fleet workspace.',
    previewDescription:
      'A workspace for vehicles, drivers, availability, compliance and future fleet planning.',
    bullets: ['Vehicles', 'Availability', 'Assignments', 'Future positions'],
    image: '/xdrive-fleet-yard-no-plates.webp',
    imageAlt: 'Fleet management view showing vehicle readiness and assignment visibility without visible registration plates',
    icon: Truck,
    audience: 'Courier companies, owner operators and operations teams managing vehicle capacity.',
    problem:
      'Helps teams understand what vehicles are available, assigned or becoming free next so work can be matched more deliberately.',
    actions: [
      'Maintain vehicle and driver assignment records',
      'Track availability, readiness and future positioning',
      'Keep compliance and operational reference details organised',
    ],
    status: 'Early-access workflow planning',
    previewItems: [
      {
        label: 'Vehicle Availability',
        desc: 'Available, assigned, off-road, maintenance or future-position status.',
      },
      {
        label: 'Driver Assignment',
        desc: 'Link drivers to jobs, vehicles and operational records.',
      },
      {
        label: 'Compliance Records',
        desc: 'MOT, insurance, vehicle documents and expiry reminders.',
      },
    ],
  },
  {
    key: 'finance',
    title: 'Finance',
    summary:
      'Track invoices, POD readiness, payment status and finance exceptions, including delivered work without an invoice and overdue or disputed receivables.',
    previewDescription:
      'A finance visibility area for invoice records, POD readiness, payment status and exception follow-up.',
    bullets: ['Invoices', 'POD readiness', 'Payment exceptions', 'Disputes'],
    image: '/xdrive-finance-records-real.webp',
    imageAlt: 'Finance dashboard showing invoice records, POD checks and payment-status visibility',
    icon: CircleDollarSign,
    audience: 'Courier companies, transport customers, finance admins and owner operators.',
    problem:
      'Keeps financial records tied to operational evidence and surfaces closure gaps so delivered work does not disappear between POD, invoice creation and payment follow-up.',
    actions: [
      'Keep invoice status and linked job finance history connected to the completed delivery record',
      'Surface delivered jobs without an invoice and persisted invoice-generation failures for follow-up',
      'Track overdue or disputed payment records without XDrive acting as a payment intermediary',
    ],
    status: 'Early-access finance records',
    previewItems: [
      {
        label: 'Invoice Records',
        desc: 'Invoice number, job reference, rate, VAT status and customer record.',
      },
      {
        label: 'Invoice Readiness',
        desc: 'Keep POD evidence and completed delivery records connected to invoice follow-up.',
      },
      {
        label: 'Finance Exceptions',
        desc: 'Surface delivered-without-invoice, invoice-generation failures and overdue or disputed payment records.',
      },
    ],
  },
] as const;

export type PlatformModule = (typeof platformModules)[number];

export const workflow: ReadonlyArray<{
  title: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Request',
    detail: 'Customer submits collection, delivery, vehicle and timing requirements.',
    icon: Layers,
  },
  {
    title: 'Quote',
    detail: 'Approved courier companies or operators return rates for the requested work.',
    icon: CircleDollarSign,
  },
  {
    title: 'Award',
    detail: 'The customer selects the preferred quote and the job becomes an operational record.',
    icon: ClipboardCheck,
  },
  {
    title: 'Assign',
    detail: 'The courier company assigns the vehicle, driver and collection instructions.',
    icon: Users,
  },
  {
    title: 'Deliver',
    detail: 'The driver completes collection, transit and delivery updates through the workflow.',
    icon: Truck,
  },
  {
    title: 'POD',
    detail: 'Proof of delivery is uploaded and kept linked to the completed job.',
    icon: FileCheck2,
  },
  {
    title: 'Invoice',
    detail: 'Invoice and payment status records remain connected to the job history.',
    icon: ShieldCheck,
  },
] as const;

export const faqs = [
  {
    q: 'What is XDrive?',
    a: 'XDrive is a functional early-access UK logistics technology platform built to connect transport customers, courier companies, owner operators and drivers in one operational workflow. The platform supports transport requests, quoting, job allocation, delivery progress, POD records, invoice visibility and operational history from one workspace, while wider public marketplace network scale is still being grown.',
  },
  {
    q: 'Who is XDrive designed for?',
    a: 'XDrive is designed for transport customers who need to request work, courier companies that manage jobs and drivers, owner operators looking for structured work opportunities, load posters who need clearer request management, and drivers who need a simple workflow for assigned jobs, status updates and POD upload. The platform is being shaped around practical UK logistics workflows rather than generic business software.',
  },
  {
    q: 'Is XDrive a load exchange?',
    a: 'XDrive includes marketplace-style workflows, but it is not intended to be only a load board. The wider goal is to connect marketplace activity with operations, driver updates, POD records, fleet visibility and finance tracking. This means the platform is being designed around the full lifecycle of a transport job, from request and quote through to delivery record and invoice visibility.',
  },
  {
    q: 'Is XDrive live now?',
    a: 'Yes. XDrive is functional for approved early-access users across supported logistics roles. Core workflows continue to be refined as the wider public marketplace and partner network grow.',
  },
  {
    q: 'How does early access work?',
    a: 'Approved users receive an initial 3-month free access period for the current supported platform features. Access remains approval-based so XDrive can keep the rollout controlled and useful for real transport workflows.',
  },
  {
    q: 'Can owner-drivers join?',
    a: 'Yes. Owner operators and owner-drivers are included in Early Access alongside transport customers, courier companies, drivers, load posters and dispatch teams.',
  },
  {
    q: 'Can courier companies manage multiple drivers and vehicles?',
    a: 'Yes, this is part of the XDrive workflow. Courier companies can manage drivers, vehicles, assignments, availability, operational records and PODs from one workspace, with some features continuing to improve during early-access rollout.',
  },
  {
    q: 'What operational modules are planned?',
    a: 'The core platform areas include Marketplace, Operations Diary, Driver Workspace, Fleet Management, Finance, POD & Records and Super Admin Governance. These modules are intended to support the full movement of a job from request and quote to assignment, delivery, proof of delivery, invoice visibility and operational audit history.',
  },
  {
    q: 'How does XDrive handle operational exceptions?',
    a: 'XDrive can surface conditions such as overdue collections or deliveries, stale driver or GPS updates, imminent unallocated work, POD gaps and finance-closure failures. Exception records can carry severity, owner, SLA state, next action, customer-update obligations, escalation state and verified closure evidence so follow-up remains auditable.',
  },
  {
    q: 'How are POD records handled?',
    a: 'Proof of delivery records stay linked to the relevant job and its operational history. Drivers or operators can upload POD evidence, while missing or rejected POD can be surfaced as an operational exception with a next action, due time and closure record.',
  },
  {
    q: 'Does XDrive hold customer funds?',
    a: 'No. XDrive does not currently act as a payment intermediary and does not currently hold or process client funds. Commercial payments remain arranged directly between the trading parties. The platform focuses on operational records, PODs, invoices, payment status/history, audit records and dispute visibility.',
  },
  {
    q: 'How are invoices and payment records managed?',
    a: 'Invoice records stay connected to the relevant completed job, POD evidence and payment status. XDrive can surface delivered work without an invoice, persisted invoice-generation failures, overdue receivables and disputed payment records for follow-up. The finance area remains a visibility and record-keeping layer and does not hold client funds.',
  },
  {
    q: 'Is XDrive available across the UK?',
    a: 'XDrive is being developed for UK logistics workflows and supports approved users across transport customers, courier companies, owner operators, drivers, load posters and dispatch teams.',
  },
  {
    q: 'What documents may be required for onboarding?',
    a: 'Depending on the type of account, users may be asked for business details, contact information, vehicle details, insurance evidence, compliance documents or identity-related information. Exact onboarding requirements may depend on the workflow being tested and the role of the user.',
  },
  {
    q: 'How long is Early Access free?',
    a: 'Approved Early Access users receive 3 months of free access while the platform continues its controlled rollout.',
  },
  {
    q: 'How can I request access or a demo?',
    a: 'Visitors can use "Join Early Access" to register interest or "Request Demo" to ask for a walkthrough. The XDrive team may follow up depending on the type of user, the workflows currently being tested and the stage of product readiness.',
  },
] as const;

export type RoadmapStatus = 'In Progress' | 'Coming Soon' | 'Planned';

export const roadmapItems: ReadonlyArray<{
  icon: LucideIcon;
  phase: string;
  title: string;
  description: string;
  status: RoadmapStatus;
}> = [
  {
    icon: Store,
    phase: 'Phase 1',
    title: 'Marketplace Public Access',
    description:
      'Open the marketplace to verified UK transport teams, moving from invite-only onboarding to structured public access with role-based workspace setup.',
    status: 'In Progress',
  },
  {
    icon: Truck,
    phase: 'Phase 2',
    title: 'Fleet Management Beta',
    description:
      'Vehicle and driver availability, assignment records and compliance documents live for early-access courier companies managing active transport operations.',
    status: 'Coming Soon',
  },
  {
    icon: CircleDollarSign,
    phase: 'Phase 2',
    title: 'Finance Module',
    description:
      'Full invoice lifecycle, POD-gated payment readiness and dispute tracking so financial records stay connected to completed job evidence.',
    status: 'Coming Soon',
  },
  {
    icon: Smartphone,
    phase: 'Phase 3',
    title: 'Mobile Driver App (GA)',
    description:
      'Android native app general availability with a full job lifecycle, real-time status updates and POD upload built around practical driver workflows.',
    status: 'Planned',
  },
  {
    icon: Network,
    phase: 'Phase 3',
    title: 'API & Partner Integrations',
    description:
      'Structured API access for TMS and ERP integrations and freight partner networks, allowing operational data to flow between XDrive and existing systems.',
    status: 'Planned',
  },
] as const;
