import {
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  Layers,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { HomepageVisualTone } from './HomepageVisualCard';

export const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Resources', href: '#resources' },
  { label: 'Contact', href: '#contact' },
] as const;

export const trustCards = [
  { label: 'Founded', value: '1 February 2021' },
  { label: 'Company', value: 'XDrive Logistics Ltd' },
  { label: 'Current Stage', value: 'MVP / Early Access' },
  { label: 'Access', value: 'Selected workflow testing' },
  { label: 'Coverage', value: 'UK-focused rollout' },
  { label: 'Focus', value: 'Marketplace + operations' },
] as const;

export const whyExistsPoints = [
  'Built from real UK courier and transport experience rather than a generic software concept.',
  'Designed to bring requests, quotes, assignments, PODs, invoices and records into one operating flow.',
  'Intended for transport customers, courier companies, owner operators, load posters and drivers.',
  'Focused on practical workflow visibility without pretending the platform is already a mature public exchange.',
] as const;

export const statusHighlights = [
  {
    title: 'MVP / early-access development',
    description:
      'Core workflows are being built and refined now, with the homepage presenting the intended operating model rather than a claim of full public rollout.',
  },
  {
    title: 'Internal and owner-led testing first',
    description:
      'Current use is centred on internal, owner and test-account validation so workflows can be tightened before selected external users are invited.',
  },
  {
    title: 'Selected user onboarding',
    description:
      'Early access is intended for staged workflow testing, feedback and controlled onboarding instead of immediate open access for everyone.',
  },
  {
    title: 'Operational records, not fund holding',
    description:
      'XDrive is designed to track jobs, PODs, invoices, payment status and audit history, while commercial payments remain directly between trading parties.',
  },
] as const;

export const earlyAccessBenefits = [
  {
    title: 'Free during early access',
    description: 'There is no charge during MVP testing while selected workflows are being refined.',
  },
  {
    title: 'Help shape the product',
    description: 'Feedback from early users can directly influence workflow structure, visibility and operational priorities.',
  },
  {
    title: 'Test selected workflows',
    description: 'Access is focused on practical journey testing such as quoting, dispatch, POD and record visibility.',
  },
  {
    title: 'Suitable for selected UK transport users',
    description: 'Early access is being positioned for transport customers, courier companies, owner operators and drivers involved in UK logistics workflows.',
  },
  {
    title: 'No long-term commitment during MVP',
    description: 'Testing is intended to be practical and low-friction without implying a locked commercial contract during the MVP phase.',
  },
  {
    title: 'Pricing confirmed later',
    description: 'Any subscription or membership model will be confirmed before wider commercial release, not assumed today.',
  },
] as const;

export const roleCards: ReadonlyArray<{
  icon: LucideIcon;
  image: string;
  imageAlt: string;
  subtitle: string;
  title: string;
  tone: HomepageVisualTone;
  visualLabel: string;
}> = [
  {
    icon: Layers,
    title: 'Transport Customers',
    subtitle: 'Request transport, compare courier responses, monitor job progress and keep delivery records organised.',
    image: '/customers-warehouse.webp',
    imageAlt: 'Transport customer reviewing shipment activity, courier responses and delivery records in a structured workspace',
    tone: 'blue',
    visualLabel: 'Transport requests',
  },
  {
    icon: Users,
    title: 'Courier Companies',
    subtitle: 'Manage incoming work, quotes, drivers, vehicles, PODs, invoices and operational history from one workspace.',
    image: '/operations-dispatch-office.webp',
    imageAlt: 'Dispatch coordination workspace with jobs, drivers, vehicles and operational status updates',
    tone: 'slate',
    visualLabel: 'Dispatch coordination',
  },
  {
    icon: Truck,
    title: 'Owner Operators',
    subtitle: 'Find suitable work, quote clearly, manage assigned jobs and keep proof of completed deliveries.',
    image: '/owner-operator-van.webp',
    imageAlt: 'Owner operator managing route readiness, assigned work and delivery records',
    tone: 'amber',
    visualLabel: 'Owner operator workflow',
  },
  {
    icon: ClipboardList,
    title: 'Load Posters',
    subtitle: 'Create transport requests, manage responses and track awarded work through a structured workflow.',
    image: '/load-poster-office.webp',
    imageAlt: 'Load poster preparing a transport request and reviewing awarded workflow history',
    tone: 'violet',
    visualLabel: 'Load posting',
  },
  {
    icon: UserRound,
    title: 'Drivers',
    subtitle: 'View assigned jobs, update delivery status, upload PODs and keep communication clear.',
    image: '/drivers-mobile-pod.webp',
    imageAlt: 'Driver using a mobile workflow to update status and upload proof of delivery',
    tone: 'emerald',
    visualLabel: 'Driver mobile workflow',
  },
] as const;

export const platformModules = [
  {
    key: 'marketplace',
    title: 'Marketplace',
    summary:
      'Intended for available loads, quote management, bid tracking, awarded jobs and marketplace history as early-access workflows expand.',
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
        label: 'Workflow View',
        desc: 'Illustrative load and quote screens designed for staged marketplace testing rather than a live public network.',
      },
      {
        label: 'Commercial Visibility',
        desc: 'Route, cargo and quote details intended to help users review opportunities before work is awarded.',
      },
      {
        label: 'History Records',
        desc: 'Marketplace history is designed to retain award and quote context for later operational reference.',
      },
    ],
  },
  {
    key: 'operations',
    title: 'Operations Diary',
    summary:
      'Collections, deliveries, active jobs, exceptions and status updates managed from one operational diary.',
    bullets: ['Collections', 'Deliveries', 'Active jobs', 'Exceptions'],
    image: '/operations-dispatch-office.webp',
    imageAlt: 'Operations diary workspace showing dispatch coordination, scheduled jobs and live status updates',
    icon: ClipboardCheck,
    audience: 'Courier companies, dispatchers, operators and owner-led teams.',
    problem:
      'Keeps daily execution visible so teams can manage collections, deliveries, changes and exception handling without losing track of job status.',
    actions: [
      'Track active jobs and time-sensitive collections or deliveries',
      'Record status changes, exceptions and operational notes',
      'Keep dispatch coordination visible across the working day',
    ],
    status: 'In MVP build',
    previewItems: [
      {
        label: 'Diary View',
        desc: 'Collections and deliveries are presented as structured diary entries with operational checkpoints.',
      },
      {
        label: 'Progress Status',
        desc: 'Job stages such as at collection, in transit and POD pending are designed to keep teams aligned.',
      },
      {
        label: 'Exception Records',
        desc: 'Operational notes and exceptions are intended to remain attached to the job record for audit visibility.',
      },
    ],
  },
  {
    key: 'driver',
    title: 'Driver Workspace',
    summary:
      'Assigned jobs, mobile workflow, route updates, POD upload and driver communication in one driver-facing area.',
    bullets: ['Assigned jobs', 'Mobile updates', 'Route actions', 'Driver communication'],
    image: '/driver-workspace-vehicle.webp',
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
    status: 'In MVP build',
    previewItems: [
      {
        label: 'Driver Queue',
        desc: 'Assigned jobs are intended to be visible in one mobile-oriented list with addresses and instructions.',
      },
      {
        label: 'Job Actions',
        desc: 'Status actions are designed for accepted, collected, en route and delivered checkpoints.',
      },
      {
        label: 'Communication Trail',
        desc: 'Driver notes and updates are planned to remain linked to the job record for clearer follow-up.',
      },
    ],
  },
  {
    key: 'fleet',
    title: 'Fleet Management',
    summary:
      'Vehicle records, availability, assignments, future positions and fleet visibility organised in one place.',
    bullets: ['Vehicles', 'Availability', 'Assignments', 'Future positions'],
    image: '/fleet-management-yard.webp',
    imageAlt: 'Fleet management view showing vehicles, readiness and assignment visibility',
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
        label: 'Availability View',
        desc: 'Vehicle availability and assignment state are intended to be visible without jumping between separate records.',
      },
      {
        label: 'Readiness Status',
        desc: 'Fleet indicators are designed to show active, available and unavailable states with clearer context.',
      },
      {
        label: 'Assignment History',
        desc: 'Driver and vehicle movements are planned to remain linked to operational history for later review.',
      },
    ],
  },
  {
    key: 'finance',
    title: 'Finance',
    summary:
      'Invoices, payment status, payment history, finance records and disputes tracked without XDrive holding client funds.',
    bullets: ['Invoices', 'Payment status', 'History', 'Disputes'],
    image: '/finance-admin-office.webp',
    imageAlt: 'Finance dashboard showing invoice records, POD checks and payment-status visibility',
    icon: CircleDollarSign,
    audience: 'Courier companies, transport customers, finance admins and owner operators.',
    problem:
      'Keeps financial records tied to operational evidence so completed work, invoice status and disputes can be reviewed more clearly.',
    actions: [
      'Record invoice status and linked job finance history',
      'Reference POD evidence before closing records',
      'Track payment status and disputes without acting as a payment intermediary',
    ],
    status: 'MVP finance records in progress',
    previewItems: [
      {
        label: 'Invoice Records',
        desc: 'Finance views are intended to show invoice lifecycle, reference data and linked job records in one place.',
      },
      {
        label: 'Payment Status',
        desc: 'Payment tracking is designed around visibility and audit history, not fund holding or payment processing by XDrive.',
      },
      {
        label: 'Dispute Support',
        desc: 'Dispute and follow-up records are planned to sit alongside invoice and POD evidence for review.',
      },
    ],
  },
  {
    key: 'pod-records',
    title: 'POD & Records',
    summary:
      'Proof of delivery uploads, completion evidence, document records and audit history designed for operational accountability.',
    bullets: ['POD uploads', 'Completion evidence', 'Document records', 'Audit trail'],
    image: '/drivers-mobile-pod.webp',
    imageAlt: 'Proof of delivery workflow showing document upload and delivery confirmation',
    icon: FileCheck2,
    audience: 'Drivers, dispatchers, operations teams, finance admins and transport customers.',
    problem:
      'Makes delivery evidence easier to capture and review so completed jobs, follow-up questions and commercial records all have clearer supporting documents.',
    actions: [
      'Upload POD and supporting delivery evidence',
      'Attach documents to job completion records',
      'Retain an audit trail for later operational or finance review',
    ],
    status: 'In MVP build',
    previewItems: [
      {
        label: 'POD Capture',
        desc: 'POD workflows are being built around mobile upload and structured delivery confirmation.',
      },
      {
        label: 'Document History',
        desc: 'Records are intended to stay attached to the job so operational and finance teams can review the same evidence.',
      },
      {
        label: 'Audit Support',
        desc: 'Upload timestamps and related notes are planned to support dispute review and job closure checks.',
      },
    ],
  },
  {
    key: 'governance',
    title: 'Super Admin Governance',
    summary:
      'Owner-level oversight, marketplace governance, audit logs and intervention tools for platform control and staged rollout.',
    bullets: ['Platform oversight', 'Marketplace governance', 'Audit logs', 'Intervention tools'],
    image: '/xdrive-login-banner.png',
    imageAlt: 'Administrative platform view representing owner-level governance and oversight controls',
    icon: ShieldCheck,
    audience: 'XDrive owner, internal administrators and future governance roles.',
    problem:
      'Provides visibility and control over onboarding, workflow integrity and operational auditing so the platform can be managed responsibly as it grows.',
    actions: [
      'Review governance and audit records',
      'Monitor marketplace and workflow health from an owner-level view',
      'Use intervention tools to support staged rollout and platform control',
    ],
    status: 'Owner/testing controls active',
    previewItems: [
      {
        label: 'Governance View',
        desc: 'Oversight screens are intended to give owner-level visibility into platform activity, rollout and intervention points.',
      },
      {
        label: 'Audit Coverage',
        desc: 'Audit-focused records are designed to support platform control, issue review and workflow accountability.',
      },
      {
        label: 'Rollout Control',
        desc: 'Governance tooling supports staged access decisions rather than pretending the marketplace is already open at scale.',
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
    detail: 'A transport request is created with route, timing and job requirements.',
    icon: Layers,
  },
  {
    title: 'Quote',
    detail: 'Courier companies or operators review the request and return a rate where that workflow is enabled.',
    icon: CircleDollarSign,
  },
  {
    title: 'Award',
    detail: 'The selected quote is awarded and the job record moves into operational handling.',
    icon: ClipboardCheck,
  },
  {
    title: 'Assign',
    detail: 'Vehicle and driver allocation are recorded so the delivery workflow has clear ownership.',
    icon: Users,
  },
  {
    title: 'Deliver',
    detail: 'Collection, transit and delivery progress are updated as the job moves forward.',
    icon: Truck,
  },
  {
    title: 'POD',
    detail: 'Proof of delivery and supporting records are uploaded against the completed job.',
    icon: FileCheck2,
  },
  {
    title: 'Invoice',
    detail: 'Invoice and payment-status records are linked back to the operational history for reference.',
    icon: ShieldCheck,
  },
] as const;

export const featureCards: ReadonlyArray<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Marketplace',
    description: 'Planned tools for load visibility, quote handling, awards and marketplace history.',
    icon: Route,
  },
  {
    title: 'Operations',
    description: 'Diary-led job execution covering collections, deliveries, status updates and exceptions.',
    icon: Layers,
  },
  {
    title: 'Dispatch',
    description: 'Assignment visibility for drivers, vehicles and workload coordination.',
    icon: ClipboardCheck,
  },
  {
    title: 'Driver Workflow',
    description: 'Mobile-oriented actions for assigned work, progress updates and POD return.',
    icon: Truck,
  },
  {
    title: 'POD & Records',
    description: 'Structured proof capture and document history linked to each completed job.',
    icon: FileCheck2,
  },
  {
    title: 'Finance',
    description: 'Invoice, payment-status and dispute records without XDrive holding client funds.',
    icon: CircleDollarSign,
  },
] as const;

export const faqs = [
  {
    q: 'What is XDrive?',
    a: 'XDrive is a UK logistics platform being built around marketplace, dispatch, POD and operational-record workflows. It is currently positioned as MVP / early-access software rather than a fully public live exchange.',
  },
  {
    q: 'Who is XDrive designed for?',
    a: 'XDrive is being designed for transport customers, courier companies, owner operators, load posters and drivers. The goal is to give each of those user groups a clearer place to manage requests, jobs, PODs, invoices and records.',
  },
  {
    q: 'Is XDrive a load exchange?',
    a: 'Marketplace functionality is part of the intended platform direction, including available loads, quotes, awarded work and history. The homepage should be understood as describing that operating model, not claiming a mature public marketplace is already active.',
  },
  {
    q: 'Is XDrive live now?',
    a: 'XDrive is currently in MVP / early-access development. Core workflows are being built and tested internally first, with selected users expected to be invited gradually as the staged rollout develops.',
  },
  {
    q: 'How does early access work?',
    a: 'Users can request access or a demo and may be invited into selected workflow testing depending on suitability and rollout stage. Early access is not presented as immediate open admission for everyone.',
  },
  {
    q: 'Can owner-drivers join?',
    a: 'Yes. Owner-drivers and owner operators are part of the intended audience and may be invited into selected workflow testing where their use case matches the current MVP scope.',
  },
  {
    q: 'Can courier companies manage multiple drivers and vehicles?',
    a: 'That is one of the core platform goals. XDrive is being built to support driver, vehicle, assignment, POD and operational visibility from a central workspace for courier companies.',
  },
  {
    q: 'What operational modules are planned?',
    a: 'Current homepage modules include Marketplace, Operations Diary, Driver Workspace, Fleet Management, Finance, POD & Records and Super Admin Governance. These modules describe the intended depth of the platform while remaining honest about MVP and planned status where appropriate.',
  },
  {
    q: 'How are POD records handled?',
    a: 'POD workflows are intended to support proof-of-delivery uploads, document retention and job-completion evidence tied to the operational record. The focus is on traceable records rather than loose file sharing.',
  },
  {
    q: 'Does XDrive hold customer funds?',
    a: 'No. XDrive does not currently act as a payment intermediary and does not currently hold or process client funds. Commercial payments are arranged directly between the trading parties while the platform focuses on records, invoice visibility, payment status and disputes.',
  },
  {
    q: 'How are invoices and payment records managed?',
    a: 'The finance area is being designed to track invoice status, related POD evidence, payment history and dispute notes against completed jobs. This is intended to improve commercial visibility without implying automated fund handling by the platform.',
  },
  {
    q: 'Is XDrive available across the UK?',
    a: 'The platform is being positioned around UK courier and transport workflows. Wider external rollout is expected to happen in stages, so the homepage should be read as UK-focused direction rather than confirmation of a fully open nationwide network today.',
  },
  {
    q: 'What documents may be required for onboarding?',
    a: 'That can depend on the role and workflow being tested, but onboarding may include company, vehicle, compliance or identity-related records where relevant. Exact requirements can be confirmed during the early-access review process.',
  },
  {
    q: 'Will there be a subscription or membership fee?',
    a: 'Early access is currently intended to be free while workflows are tested and refined. Any future subscription, membership or pricing structure will be confirmed before broader commercial release.',
  },
  {
    q: 'How can I request access or a demo?',
    a: 'Use the homepage request and early-access actions to share interest in the platform. The XDrive team can then decide whether to offer a demo, discuss suitability or invite the user into selected workflow testing.',
  },
] as const;
