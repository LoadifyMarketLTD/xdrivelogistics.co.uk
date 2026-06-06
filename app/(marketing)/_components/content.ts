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
  { label: 'Industries', href: '#industries' },
  { label: 'Resources', href: '#resources' },
  { label: 'Contact', href: '#contact' },
] as const;

export const trustCards = [
  { label: 'Founded', value: '1 February 2021' },
  { label: 'Company', value: 'XDrive Logistics Ltd' },
  { label: 'Registration', value: '13171804' },
  { label: 'Platform Type', value: 'Logistics Technology' },
  { label: 'Coverage', value: 'United Kingdom' },
  { label: 'Focus', value: 'Exchange + Operations' },
] as const;

export const roleCards = [
  {
    title: 'Transport Customers',
    subtitle: 'Submit transport requirements and follow job progress from request to completion.',
    // TODO: Replace with licensed real UK/EU logistics image.
    image: '/images/homepage/warehouse-loading-pallets.jpg',
  },
  {
    title: 'Courier Companies',
    subtitle: 'Coordinate jobs, vehicles, drivers, PODs and operational records from one workspace.',
    // TODO: Replace with licensed real UK/EU logistics image.
    image: '/images/homepage/transport-planner-office.jpg',
  },
  {
    title: 'Owner Operators',
    subtitle: 'Access suitable loads, manage quotes and keep delivery records organised.',
    // TODO: Replace with licensed real UK/EU logistics image.
    image: '/images/homepage/courier-van-loading.jpg',
  },
  {
    title: 'Drivers',
    subtitle: 'Receive assigned jobs, update progress and upload POD from a mobile-first workflow.',
    // TODO: Replace with licensed real UK/EU logistics image.
    image: '/images/homepage/driver-pod-mobile.jpg',
  },
] as const;

export const platformModules = [
  {
    key: 'marketplace',
    title: 'Marketplace',
    summary: 'Loads, quotes, bids and route visibility.',
    bullets: ['Loads', 'Quotes', 'Bids', 'Route visibility'],
    icon: Route,
  },
  {
    key: 'operations',
    title: 'Operations Diary',
    summary: 'Collections, deliveries, status updates and exceptions.',
    bullets: ['Collections', 'Deliveries', 'Status updates', 'Exceptions'],
    icon: ClipboardCheck,
  },
  {
    key: 'driver',
    title: 'Driver Workspace',
    summary: 'Assigned jobs, mobile updates and POD workflow.',
    bullets: ['Assigned jobs', 'Mobile updates', 'POD workflow'],
    icon: UserRound,
  },
  {
    key: 'fleet',
    title: 'Fleet Management',
    summary: 'Vehicles, drivers, availability and compliance records.',
    bullets: ['Vehicles', 'Drivers', 'Availability', 'Compliance records'],
    icon: Truck,
  },
  {
    key: 'finance',
    title: 'Finance',
    summary: 'Invoices, POD verification and payment status tracking.',
    bullets: ['Invoices', 'POD verification', 'Payment status'],
    icon: CircleDollarSign,
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
    detail: 'Customer submits a transport request.',
    icon: Layers,
  },
  {
    title: 'Quote',
    detail: 'Approved companies return rates.',
    icon: CircleDollarSign,
  },
  {
    title: 'Award',
    detail: 'Customer awards the selected quote.',
    icon: ClipboardCheck,
  },
  {
    title: 'Assign',
    detail: 'Dispatcher assigns vehicle and driver.',
    icon: Users,
  },
  {
    title: 'Deliver',
    detail: 'Driver completes collection and delivery.',
    icon: Truck,
  },
  {
    title: 'POD',
    detail: 'Proof of delivery is uploaded and checked.',
    icon: FileCheck2,
  },
  {
    title: 'Invoice',
    detail: 'Invoice is issued with linked delivery record.',
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
    description: 'Connected load matching, bidding and routing intelligence.',
    icon: Route,
  },
  {
    title: 'Operations',
    description: 'End-to-end diary, dispatch and execution control.',
    icon: Layers,
  },
  {
    title: 'Dispatch',
    description: 'Awarding, assignment and workload balancing tools.',
    icon: ClipboardCheck,
  },
  {
    title: 'Driver Workflow',
    description:
      'Mobile job execution with status and exception handling.',
    icon: Truck,
  },
  {
    title: 'POD',
    description: 'Structured proof capture with verification controls.',
    icon: FileCheck2,
  },
  {
    title: 'Finance',
    description:
      'Integrated invoicing, payment visibility and closure tracking.',
    icon: CircleDollarSign,
  },
] as const;

export const faqs = [
  {
    q: 'What is XDrive?',
    a: 'XDrive is an early-access UK logistics platform being built to connect transport customers, courier companies, owner operators and drivers in one workflow.',
  },
  {
    q: 'Who can use XDrive?',
    a: 'Transport customers, courier companies, owner operators and drivers can request access based on the workflows being tested.',
  },
  {
    q: 'Is XDrive live now?',
    a: 'XDrive is currently in early-access/MVP development. Selected users may be invited to test workflows before wider launch.',
  },
  {
    q: 'Can owner-drivers join?',
    a: 'Yes. Owner operators and owner-drivers can request early access for selected workflow testing.',
  },
  {
    q: 'How do I request early access?',
    a: 'Use Join Early Access to submit your details, or request a demo and our team will follow up.',
  },
] as const;
