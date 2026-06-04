'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CircleDollarSign, ClipboardCheck, FileCheck2, Layers, Route, ShieldCheck, Truck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Industries', href: '#industries' },
  { label: 'Resources', href: '#resources' },
  { label: 'Contact', href: '#contact' },
];

const trustCards = [
  { label: 'Founded', value: '1 February 2021' },
  { label: 'Company', value: 'XDrive Logistics Ltd' },
  { label: 'Registration', value: '13171804' },
  { label: 'Platform Type', value: 'Logistics Technology' },
  { label: 'Coverage', value: 'United Kingdom' },
  { label: 'Focus', value: 'Exchange + Operations' },
];

const roleCards = [
  { title: 'Owner Operators', subtitle: 'Independent operators with complete load and operations visibility.', image: '/homepage/role-owner-operators.svg' },
  { title: 'Courier Companies', subtitle: 'Modern dispatch coordination for teams, vehicles and delivery workflows.', image: '/homepage/role-courier-companies.svg' },
  { title: 'Load Posters', subtitle: 'Transport managers posting lanes and awarding trusted partners.', image: '/homepage/role-load-posters.svg' },
  { title: 'Customers', subtitle: 'Business teams managing requests, tracking milestones and financial closure.', image: '/homepage/role-customers.svg' },
  { title: 'Drivers', subtitle: 'Driver-first mobile workspace for assignments, updates and POD.', image: '/homepage/role-drivers.svg' },
];

const platformModules = [
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

const workflow = [
  { title: 'Request', detail: 'A shipper submits a transport requirement in minutes.', icon: Layers },
  { title: 'Quote', detail: 'Qualified partners provide route-aware commercial quotes.', icon: CircleDollarSign },
  { title: 'Award', detail: 'Work is awarded to the best operational fit.', icon: ClipboardCheck },
  { title: 'Assign', detail: 'Dispatch allocates vehicle and driver in one workflow.', icon: Users },
  { title: 'Deliver', detail: 'Delivery progress is tracked with live status updates.', icon: Truck },
  { title: 'POD', detail: 'Proof of delivery is captured and verified digitally.', icon: FileCheck2 },
  { title: 'Invoice', detail: 'Finance closes the job with validated billing records.', icon: ShieldCheck },
];

const featureCards = [
  { title: 'Marketplace', description: 'Connected load matching, bidding and routing intelligence.', icon: Route },
  { title: 'Operations', description: 'End-to-end diary, dispatch and execution control.', icon: Layers },
  { title: 'Dispatch', description: 'Awarding, assignment and workload balancing tools.', icon: ClipboardCheck },
  { title: 'Driver Workflow', description: 'Mobile job execution with status and exception handling.', icon: Truck },
  { title: 'POD', description: 'Structured proof capture with verification controls.', icon: FileCheck2 },
  { title: 'Finance', description: 'Integrated invoicing, payment visibility and closure tracking.', icon: CircleDollarSign },
];

const faqs = [
  { q: 'What is XDrive?', a: 'XDrive is a UK logistics technology platform connecting marketplace, operations, driver workflow and finance in one ecosystem.' },
  { q: 'Who can use XDrive?', a: 'Owner operators, courier companies, load posters, customers and drivers can all operate inside the same platform.' },
  { q: 'When is launch planned?', a: 'XDrive is currently in commercial early-access onboarding for launch participants in the United Kingdom.' },
  { q: 'Can owner-drivers join?', a: 'Yes. Owner operators can join early access and use marketplace and operations workflows directly.' },
  { q: 'How do I request early access?', a: 'Use the Join Early Access call-to-action to register your interest and onboarding details.' },
];

export function LandingPage() {
  const [activePreview, setActivePreview] = useState<(typeof platformModules)[number]['key']>('marketplace');

  const selectedPreview = useMemo(
    () => platformModules.find((module) => module.key === activePreview) ?? platformModules[0],
    [activePreview],
  );

  return (
    <div className="bg-white text-[#0f172a]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 h-[72px] border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-[#0f172a]">
            <span className="text-[#1d4ed8]">X</span>Drive Logistics
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="transition hover:text-[#1d4ed8]">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-100">
              Log In
            </Link>
            <Link href="/register" className="rounded-lg bg-[#1d4ed8] px-4 py-2.5 font-semibold text-white transition hover:bg-[#1e40af]">
              Join Early Access
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative border-b border-slate-200 px-4 py-20 sm:px-6 lg:py-28" id="industries">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-[#1d4ed8]/30 bg-[#eff6ff] px-4 py-1.5 text-xs font-semibold tracking-[0.1em] text-[#1d4ed8]">
              UK LOGISTICS TECHNOLOGY PLATFORM
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-[#0f172a] sm:text-5xl lg:text-6xl">
              Move Freight.
              <br />
              Manage Operations.
              <br />
              Grow Your Network.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600">
              One platform connecting transport customers, brokers, courier companies, owner operators and drivers.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/request-quote" className="rounded-lg bg-[#1d4ed8] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1e40af]">
                Request Transport
              </Link>
              <Link href="/register" className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Join Early Access
              </Link>
            </div>

            <div className="mt-8 space-y-1 text-sm text-slate-500">
              <p>Founded 1 February 2021</p>
              <p>Company No. 13171804</p>
              <p>United Kingdom</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-lg">
              <Image src="/homepage/hero-composition.svg" alt="XDrive logistics technology ecosystem" width={1600} height={900} className="h-auto w-full" priority />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Operations Dashboard</p>
                <p className="mt-2 text-sm text-slate-600">Dispatch board • Collections • Deliveries • Timeline</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Marketplace + Driver App</p>
                <p className="mt-2 text-sm text-slate-600">Loads • Quotes • Bids • Live route overlays</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3 xl:grid-cols-6">
          {trustCards.map((card) => (
            <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{card.label}</p>
              <p className="mt-2 text-sm font-semibold text-[#0f172a]">{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Roles ── */}
      <section id="solutions" className="border-b border-slate-200 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Built Around Every Logistics Role</h2>
            <p className="mt-3 text-slate-500">One ecosystem supporting every participant in the logistics chain.</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {roleCards.map((role) => (
              <article key={role.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <Image src={role.image} alt={role.title} width={1600} height={900} className="h-48 w-full object-cover" />
                <div className="p-4">
                  <h3 className="text-base font-semibold text-[#0f172a]">{role.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{role.subtitle}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform modules ── */}
      <section id="platform" className="border-b border-slate-200 bg-slate-50 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">One Platform. Multiple Workspaces.</h2>
            <p className="mt-3 text-slate-500">Five integrated modules built for real logistics execution.</p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2 xl:grid-cols-5">
            {platformModules.map((module) => (
              <article key={module.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Image src={module.image} alt={`${module.title} workspace`} width={1600} height={900} className="h-40 w-full object-cover" />
                <div className="p-4">
                  <h3 className="text-base font-semibold text-[#0f172a]">{module.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{module.summary}</p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-400">
                    {module.bullets.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="border-b border-slate-200 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">How XDrive Works</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            {workflow.map(({ title, detail, icon: Icon }, index) => (
              <article key={title} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-2 text-[#1d4ed8]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#0f172a]">{title}</h3>
                <p className="mt-2 text-xs text-slate-500">{detail}</p>
                {index < workflow.length - 1 && <ArrowRight className="mt-3 h-4 w-4 text-slate-300" />}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why XDrive exists ── */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-20 sm:px-6" id="resources">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Why XDrive Exists</h2>
            <div className="mt-6 space-y-3 text-slate-600">
              <p>Most logistics software solves only part of the workflow.</p>
              <p>Load boards find work.</p>
              <p>Dispatch systems manage operations.</p>
              <p>POD systems store delivery proof.</p>
              <p>Finance systems create invoices.</p>
              <p className="font-semibold text-[#0f172a]">XDrive connects the entire logistics journey into one operational platform.</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <Image
              src="/homepage/why-exists-scene.svg"
              alt="UK logistics environment, warehouse and vehicle activity"
              width={1600}
              height={900}
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* ── Core features ── */}
      <section className="border-b border-slate-200 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">Core Features</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#1d4ed8]/40 hover:shadow-md">
                <div className="inline-flex rounded-lg border border-slate-200 bg-[#eff6ff] p-2 text-[#1d4ed8]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#0f172a]">{title}</h3>
                <p className="mt-2 text-sm text-slate-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform preview ── */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">Platform Preview</h2>
          <p className="mt-3 text-center text-slate-500">Explore each workspace view across the XDrive platform.</p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {platformModules.map((module) => (
              <button
                key={module.key}
                type="button"
                onClick={() => setActivePreview(module.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activePreview === module.key
                    ? 'bg-[#1d4ed8] text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {module.title}
              </button>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Image src={selectedPreview.image} alt={`${selectedPreview.title} screenshot`} width={1600} height={900} className="h-auto w-full" />
            <div className="border-t border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-[#0f172a]">{selectedPreview.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{selectedPreview.summary}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-b border-slate-200 bg-[#1d4ed8] px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-4xl font-bold text-white sm:text-5xl">Be Part of the XDrive Launch</h2>
          <p className="mt-4 max-w-2xl text-blue-100">
            Join the first wave of transport professionals helping shape the future of UK logistics.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#1d4ed8] transition hover:bg-blue-50">
              Join Early Access
            </Link>
            <Link href="/request-quote" className="rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Request Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-b border-slate-200 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-[#0f172a] sm:text-4xl">FAQ</h2>
          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer list-none text-left text-base font-semibold text-[#0f172a]">
                  {faq.q}
                  <span className="float-right text-slate-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-slate-500">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="bg-slate-900 px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Platform</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Marketplace</li>
              <li>Operations</li>
              <li>Fleet</li>
              <li>Drivers</li>
              <li>Finance</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Solutions</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Owner Operators</li>
              <li>Courier Companies</li>
              <li>Load Posters</li>
              <li>Customers</li>
              <li>Drivers</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Company</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>About</li>
              <li>Launch</li>
              <li>Contact</li>
              <li>Careers</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-300">Legal</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Privacy</li>
              <li>Terms</li>
              <li>Cookies</li>
              <li>GDPR</li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-2 border-t border-slate-700 pt-6 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span>XDrive Logistics Ltd</span>
          <span>Company No. 13171804</span>
          <span>Founded 1 February 2021</span>
          <span>© 2026 XDrive Logistics Ltd</span>
          <span>All Rights Reserved</span>
        </div>
      </footer>
    </div>
  );
}


const featureCards = [
  { title: 'Marketplace', description: 'Connected load matching, bidding and routing intelligence.', icon: Route },
  { title: 'Operations', description: 'End-to-end diary, dispatch and execution control.', icon: Layers },
  { title: 'Dispatch', description: 'Awarding, assignment and workload balancing tools.', icon: ClipboardCheck },
  { title: 'Driver Workflow', description: 'Mobile job execution with status and exception handling.', icon: Truck },
  { title: 'POD', description: 'Structured proof capture with verification controls.', icon: FileCheck2 },
  { title: 'Finance', description: 'Integrated invoicing, payment visibility and closure tracking.', icon: CircleDollarSign },
];

const faqs = [
  { q: 'What is XDrive?', a: 'XDrive is a UK logistics technology platform connecting marketplace, operations, driver workflow and finance in one ecosystem.' },
  { q: 'Who can use XDrive?', a: 'Owner operators, courier companies, load posters, customers and drivers can all operate inside the same platform.' },
  { q: 'When is launch planned?', a: 'XDrive is currently in commercial early-access onboarding for launch participants in the United Kingdom.' },
  { q: 'Can owner-drivers join?', a: 'Yes. Owner operators can join early access and use marketplace and operations workflows directly.' },
  { q: 'How do I request early access?', a: 'Use the Join Early Access call-to-action to register your interest and onboarding details.' },
];

