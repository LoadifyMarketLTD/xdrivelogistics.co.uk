import {
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  Layers,
  Route,
  ShieldCheck,
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
      'Manage collections, deliveries, active jobs, status updates, POD exceptions and dispatch visibility from one operational diary.',
    previewDescription:
      'A dispatch-focused view for managing collections, deliveries, active jobs, exceptions and delivery progress.',
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
    status: 'Functional early-access workflow',
    previewItems: [
      {
        label: "Today's Jobs",
        desc: 'Collections, deliveries, time windows and current job status.',
      },
      {
        label: 'Exceptions',
        desc: 'Delays, missing PODs, failed delivery notes and operational issues.',
      },
      {
        label: 'Job Timeline',
        desc: 'Request, quote, award, assign, collect, deliver and invoice history.',
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
      'Track invoices, POD verification, payment status, job finance history and dispute records without XDrive holding client funds.',
    previewDescription:
      'A finance visibility area for invoices, POD verification, payment status and job-related records.',
    bullets: ['Invoices', 'Payment status', 'History', 'Disputes'],
    image: '/xdrive-finance-records-real.webp',
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
    status: 'Early-access finance records',
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
    q: 'How are POD records handled?',
    a: 'XDrive is being designed so that proof of delivery records stay linked to the relevant job. Drivers or operators should be able to upload POD evidence, and the completed delivery record should remain connected to job history, invoice readiness and operational review. The goal is to reduce lost PODs and disconnected delivery evidence.',
  },
  {
    q: 'Does XDrive hold customer funds?',
    a: 'No. XDrive does not currently act as a payment intermediary and does not currently hold or process client funds. Commercial payments remain arranged directly between the trading parties. The platform focuses on operational records, PODs, invoices, payment status/history, audit records and dispute visibility.',
  },
  {
    q: 'How are invoices and payment records managed?',
    a: 'XDrive is being designed to keep invoice records connected to the relevant completed job, POD evidence and payment status. The finance area is intended for visibility and record keeping, not for holding client funds. Users should be able to track whether work is unpaid, pending, paid or disputed.',
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
