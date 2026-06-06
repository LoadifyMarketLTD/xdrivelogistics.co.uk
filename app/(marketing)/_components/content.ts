import {
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  Layers,
  Route,
  ShieldCheck,
  Truck,
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
    title: 'Owner Operators',
    subtitle:
      'Independent operators with complete load and operations visibility.',
    image: '/homepage/role-owner-operators.svg',
  },
  {
    title: 'Courier Companies',
    subtitle:
      'Modern dispatch coordination for teams, vehicles and delivery workflows.',
    image: '/homepage/role-courier-companies.svg',
  },
  {
    title: 'Load Posters',
    subtitle:
      'Transport managers posting lanes and awarding trusted partners.',
    image: '/homepage/role-load-posters.svg',
  },
  {
    title: 'Customers',
    subtitle:
      'Business teams managing requests, tracking milestones and financial closure.',
    image: '/homepage/role-customers.svg',
  },
  {
    title: 'Drivers',
    subtitle: 'Driver-first mobile workspace for assignments, updates and POD.',
    image: '/homepage/role-drivers.svg',
  },
] as const;

export const platformModules = [
  {
    key: 'marketplace',
    title: 'Marketplace',
    summary: 'Available loads, quotes, bids and routes.',
    bullets: ['Available loads', 'Quotes', 'Bids', 'Routes'],
    image: '/homepage/module-marketplace.svg',
  },
  {
    key: 'operations',
    title: 'Operations Diary',
    summary: 'Dispatch board, collections, deliveries and timeline.',
    bullets: ['Dispatch board', 'Collections', 'Deliveries', 'Timeline'],
    image: '/homepage/module-operations.svg',
  },
  {
    key: 'driver',
    title: 'Driver Workspace',
    summary: 'Assigned jobs, status updates and POD workflow.',
    bullets: ['Assigned jobs', 'Status updates', 'POD workflow'],
    image: '/homepage/module-driver.svg',
  },
  {
    key: 'fleet',
    title: 'Fleet Management',
    summary: 'Vehicles, drivers, availability and compliance.',
    bullets: ['Vehicles', 'Drivers', 'Availability', 'Compliance'],
    image: '/homepage/module-fleet.svg',
  },
  {
    key: 'finance',
    title: 'Finance',
    summary: 'Invoices, payments and POD verification.',
    bullets: ['Invoices', 'Payments', 'POD verification'],
    image: '/homepage/module-finance.svg',
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
    detail: 'A shipper submits a transport requirement in minutes.',
    icon: Layers,
  },
  {
    title: 'Quote',
    detail: 'Qualified partners provide route-aware commercial quotes.',
    icon: CircleDollarSign,
  },
  {
    title: 'Award',
    detail: 'Work is awarded to the best operational fit.',
    icon: ClipboardCheck,
  },
  {
    title: 'Assign',
    detail: 'Dispatch allocates vehicle and driver in one workflow.',
    icon: Users,
  },
  {
    title: 'Deliver',
    detail: 'Delivery progress is tracked with live status updates.',
    icon: Truck,
  },
  {
    title: 'POD',
    detail: 'Proof of delivery is captured and verified digitally.',
    icon: FileCheck2,
  },
  {
    title: 'Invoice',
    detail: 'Finance closes the job with validated billing records.',
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
    a: 'XDrive is a UK logistics technology platform connecting marketplace, operations, driver workflow and finance in one ecosystem.',
  },
  {
    q: 'Who can use XDrive?',
    a: 'Owner operators, courier companies, load posters, customers and drivers can all operate inside the same platform.',
  },
  {
    q: 'When is launch planned?',
    a: 'XDrive is currently in commercial early-access onboarding for launch participants in the United Kingdom.',
  },
  {
    q: 'Can owner-drivers join?',
    a: 'Yes. Owner operators can join early access and use marketplace and operations workflows directly.',
  },
  {
    q: 'How do I request early access?',
    a: 'Use the Join Early Access call-to-action to register your interest and onboarding details.',
  },
] as const;
