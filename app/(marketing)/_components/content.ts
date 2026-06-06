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
import type { HomepageVisualTone } from './HomepageVisualCard';

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
    subtitle: 'Submit transport requirements and follow job progress from request to completion.',
    image:
      'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Warehouse team loading pallets for outbound delivery',
    tone: 'blue',
    visualLabel: 'Customer workflow',
  },
  {
    icon: Users,
    title: 'Courier Companies',
    subtitle: 'Coordinate jobs, vehicles, drivers, PODs and operational records from one workspace.',
    image:
      'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Transport planning team coordinating dispatch operations',
    tone: 'slate',
    visualLabel: 'Operations workspace',
  },
  {
    icon: Truck,
    title: 'Owner Operators',
    subtitle: 'Access suitable loads, manage quotes and keep delivery records organised.',
    image:
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Owner operator preparing a courier vehicle for loading',
    tone: 'amber',
    visualLabel: 'Fleet readiness',
  },
  {
    icon: UserRound,
    title: 'Drivers',
    subtitle: 'Receive assigned jobs, update progress and upload POD from a mobile-first workflow.',
    image:
      'https://images.unsplash.com/photo-1556740762-16b083a5cc2d?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Driver using a mobile device to manage proof of delivery',
    tone: 'emerald',
    visualLabel: 'Driver mobile',
  },
] as const;

export const platformModules = [
  {
    key: 'marketplace',
    title: 'Marketplace',
    summary: 'Loads, quotes, bids and route visibility.',
    bullets: ['Loads', 'Quotes', 'Bids', 'Route visibility'],
    image:
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Forklift loading pallets into a trailer in a warehouse',
    icon: Route,
  },
  {
    key: 'operations',
    title: 'Operations Diary',
    summary: 'Collections, deliveries, status updates and exceptions.',
    bullets: ['Collections', 'Deliveries', 'Status updates', 'Exceptions'],
    image:
      'https://images.unsplash.com/photo-1517935706615-2717063c2225?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Logistics dispatch office team coordinating operations',
    icon: ClipboardCheck,
  },
  {
    key: 'driver',
    title: 'Driver Workspace',
    summary: 'Assigned jobs, mobile updates and POD workflow.',
    bullets: ['Assigned jobs', 'Mobile updates', 'POD workflow'],
    image:
      'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Driver inside van cab using navigation and mobile workflow',
    icon: UserRound,
  },
  {
    key: 'fleet',
    title: 'Fleet Management',
    summary: 'Vehicles, drivers, availability and compliance records.',
    bullets: ['Vehicles', 'Drivers', 'Availability', 'Compliance records'],
    image:
      'https://images.unsplash.com/photo-1465101178521-c1a9136a3a16?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Commercial delivery fleet parked in a depot yard',
    icon: Truck,
  },
  {
    key: 'finance',
    title: 'Finance',
    summary: 'Invoices, POD verification and payment status tracking.',
    bullets: ['Invoices', 'POD verification', 'Payment status'],
    image:
      'https://images.unsplash.com/photo-1515168833906-d2a3b82b3029?auto=format&fit=crop&w=1600&h=900&q=70&fm=webp',
    imageAlt: 'Transport administration and finance desk with operational records',
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
