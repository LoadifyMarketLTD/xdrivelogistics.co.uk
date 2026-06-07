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
    a: `XDrive is a UK-focused logistics management platform being built around marketplace, dispatch, proof-of-delivery and operational-record workflows. It is designed to connect transport customers, courier companies, owner operators and drivers in a structured digital environment.

The platform aims to cover the full job lifecycle — from initial transport request and quoting, through driver assignment and live operational status, to delivery confirmation, POD capture and invoice management. XDrive is currently positioned as MVP and early-access software. Selected users are being invited to test and validate workflows ahead of broader commercial release.`,
  },
  {
    q: 'Who is XDrive designed for?',
    a: `XDrive is being built for multiple user groups operating within the UK courier and transport sector. Those groups currently include transport customers who need to request and track deliveries, courier companies and carrier businesses managing drivers and fleets, owner operators running their own vehicle and job workflows, load posters and brokers publishing available work to the exchange, and drivers executing delivery assignments.

Each user type will have a dedicated workspace tailored to their operational needs, rather than a single generic interface shared across all roles.`,
  },
  {
    q: 'Is XDrive a load exchange?',
    a: `Marketplace and exchange functionality is a core part of the platform direction. The intended model includes load posting, quote submission, job awarding, driver assignment and job history — consistent with how a transport exchange operates.

However, the platform is currently in early-access and MVP development. Not all exchange features are fully active at this stage. The homepage describes the intended operating model and platform depth, not a claim that a fully public marketplace is already live and open to all users today. Rollout is happening in stages.`,
  },
  {
    q: 'Is XDrive live now?',
    a: `XDrive is currently in active MVP and early-access development. Core workflows are being built, tested and refined internally before being opened to selected external users. The platform is not yet available as a fully public open-access service.

Selected users and companies may be invited to participate in early access testing based on their role and suitability. A staged rollout approach is being followed to ensure quality and stability before broader commercial release.`,
  },
  {
    q: 'How does early access work?',
    a: `Early access allows selected users and companies to be invited into specific workflow testing before the platform is fully public. The process is not automatic open registration — it involves the XDrive team reviewing expressions of interest and matching users to the current MVP scope.

Users can submit a request or book a demo through the homepage. The team will then assess suitability and communicate next steps. Early access participants may be asked to provide feedback, test specific workflows or complete onboarding steps relevant to their role. This approach allows the platform to develop responsibly with real-world input.`,
  },
  {
    q: 'Can owner-drivers join?',
    a: `Yes. Owner-drivers and owner operators are part of the intended user base and a dedicated workspace is being built to serve their needs. This includes quoting for available loads, managing accepted jobs, recording delivery execution, capturing PODs and tracking invoice and payment status.

Owner operators who wish to participate in early access can express interest through the homepage. Suitability will be assessed against the current MVP stage and the workflows actively being tested. Access may be invited gradually rather than immediately granted to all applicants.`,
  },
  {
    q: 'Can courier companies manage multiple drivers and vehicles?',
    a: `Yes. Supporting multi-driver and multi-vehicle operations is one of the primary goals of the platform for courier companies. The company workspace is being built to allow administrators to manage driver accounts, assign vehicles, monitor job status, review delivery outcomes, track fleet activity and maintain compliance records from a central administrative view.

Companies joining through early access will be able to test and validate these operational workflows. The level of functionality available at any given point will depend on the current MVP stage, and the XDrive team will confirm which modules are active during onboarding.`,
  },
  {
    q: 'What operational modules are planned?',
    a: `The platform is being developed across several operational areas. These currently include a Marketplace for load posting and job quoting, an Operations Diary for job scheduling and status management, a Driver Workspace for assignment execution and POD capture, Fleet Management for vehicle and driver oversight, a Finance module for invoice and payment record tracking, a POD and Records area for delivery evidence and document retention, and a Super Admin layer for governance and platform-level administration.

These modules describe the intended scope and depth of the platform. MVP status applies differently to each area, and the XDrive team will confirm which modules are active at the point of onboarding for any given user or company.`,
  },
  {
    q: 'How are POD records handled?',
    a: `Proof-of-delivery workflows are being built to capture and store delivery confirmation evidence against completed jobs. This is expected to include upload support for documents, signatures or images, retention of those records within the job history, and linkage between POD evidence and the associated invoice or payment record.

The focus is on creating a traceable and auditable delivery record rather than a loose file-sharing system. POD records are intended to serve as the foundation for invoice verification, dispute resolution and compliance evidence where required by trading parties.`,
  },
  {
    q: 'Does XDrive hold customer funds?',
    a: `No. XDrive does not currently act as a payment intermediary and does not currently hold or process client funds. Commercial payments are arranged directly between the trading parties involved in each job.

The platform focuses on operational records, proof-of-delivery documentation, invoice generation and status tracking, payment history records, audit trails and dispute logging. These tools are designed to give both parties visibility and evidence around commercial transactions without the platform sitting between them financially. Any changes to this position would be communicated clearly before implementation.`,
  },
  {
    q: 'How are invoices and payment records managed?',
    a: `The finance module is being designed to allow companies and owner operators to raise invoices against completed jobs, attach supporting POD evidence, track the current payment status of each invoice, maintain a payment history log, and record any dispute notes or resolution activity.

XDrive does not currently act as a payment intermediary and does not hold or process client funds. Commercial payments are arranged directly between trading parties. The platform provides the record-keeping, visibility and audit infrastructure around those payments rather than processing them directly.`,
  },
  {
    q: 'Is XDrive available across the UK?',
    a: `XDrive is being positioned as a UK-focused courier and transport platform. The initial rollout is targeting UK-based companies, owner operators and drivers operating domestic routes.

Wider geographic expansion and any international capability would be considered at a later stage once the core platform is stable and the UK base has been established. The current homepage and onboarding process should be read as UK-focused in scope. If you are based outside the UK and wish to express interest, you are welcome to submit a request and the team will advise on availability.`,
  },
  {
    q: 'What documents may be required for onboarding?',
    a: `Document requirements will vary depending on the user role and the workflows being tested. For courier companies, onboarding may involve company registration details and compliance-related records. For owner operators and drivers, this could include vehicle documents, driving licence information or insurance evidence where relevant.

Exact requirements will be confirmed by the XDrive team as part of the early-access review process. The platform is being built to support document management and compliance record retention as part of the driver and fleet administration workflows. No documents will be requested before a formal onboarding conversation has taken place.`,
  },
  {
    q: 'Will there be a subscription or membership fee?',
    a: `Early access participation is currently intended to be available without a fee while workflows are being tested and refined. The priority at this stage is building a platform that works well for the people using it, rather than charging before that value has been demonstrated.

Any future subscription, membership or transaction-based pricing structure will be communicated clearly and in advance before broader commercial release. Users participating in early access will be informed of any planned changes to the commercial model before they take effect.`,
  },
  {
    q: 'How can I request access or a demo?',
    a: `You can express interest or request a demo through the early-access section on the homepage. Submitting a request allows the XDrive team to review your role, use case and suitability against the current MVP scope.

Following your submission, the team may contact you to discuss the platform in more detail, arrange a walkthrough of relevant workflows, or invite you into early-access testing if your use case is a match. There is no commitment required at the point of expressing interest. If you represent a company or have a specific operational requirement, you are encouraged to include that context in your request.`,
  },
] as const;
