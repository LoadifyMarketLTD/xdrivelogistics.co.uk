import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Compass,
  FileCheck2,
  Globe,
  Mail,
  MapPinned,
  Network,
  Phone,
  Receipt,
  ShieldCheck,
  Truck,
  Users2,
} from 'lucide-react';

const roleCards = [
  {
    title: 'Owner Operators',
    summary: 'Find loads, submit quotes and run your jobs from one operational view.',
    href: '/register',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063844.png',
  },
  {
    title: 'Courier Companies',
    summary: 'Manage fleets, drivers, POD and invoices in one connected workflow.',
    href: '/register',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063820.png',
  },
  {
    title: 'Load Posters',
    summary: 'Post transport work, compare quotes, award jobs and monitor progress.',
    href: '/request-quote',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063807.png',
  },
  {
    title: 'Customers',
    summary: 'Request transport and follow delivery, POD and invoicing milestones.',
    href: '/request-quote',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063730.png',
  },
  {
    title: 'Drivers',
    summary: 'View assignments, navigate routes and upload POD directly from mobile.',
    href: '/register',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063834.png',
  },
];

const previewCards = [
  {
    title: 'Marketplace',
    detail: 'Live load board with route intelligence and fast quoting.',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063434.png',
    href: '/request-quote',
  },
  {
    title: 'Operations Diary',
    detail: 'Plan collections, allocate drivers and keep dispatch synchronized.',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063533.png',
    href: '/register',
  },
  {
    title: 'Driver Dashboard',
    detail: 'Driver-first navigation with POD capture and milestone updates.',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063730.png',
    href: '/driver/jobs',
  },
  {
    title: 'Finance',
    detail: 'Invoice-ready completion flow with payable status visibility.',
    image: '/reference/courier-exchange/Screenshot%202026-06-04%20063617.png',
    href: '/register',
  },
];

const flowSteps = [
  { title: 'Request Transport', detail: 'Create your transport request in seconds.', icon: Compass },
  { title: 'Receive Quotes', detail: 'Carriers and owner operators submit offers.', icon: Briefcase },
  { title: 'Award Job', detail: 'Choose the carrier and lock the assignment.', icon: CircleCheck },
  { title: 'Assign Driver', detail: 'Dispatch to an available driver with full visibility.', icon: Users2 },
  { title: 'Deliver', detail: 'Driver completes delivery and status updates.', icon: Truck },
  { title: 'Upload POD', detail: 'Proof of delivery is uploaded in-app.', icon: FileCheck2 },
  { title: 'Create Invoice', detail: 'Invoice is generated and ready to send.', icon: Receipt },
];

const footerGroups = [
  { title: 'Platform', links: ['Marketplace', 'Operations Diary', 'Driver Dashboard', 'POD & Invoicing'] },
  { title: 'For', links: ['Owner Operators', 'Courier Companies', 'Load Posters', 'Customers', 'Drivers'] },
  { title: 'Company', links: ['About XDrive', 'Careers', 'News', 'Contact'] },
  { title: 'Contact', links: ['support@xdrivelogistics.co.uk', '+44 7584 123456', 'United Kingdom'] },
];

const trustPills = [
  { label: 'Company No.', value: '13171804' },
  { label: 'UK Based', value: 'Operations' },
  { label: 'Built by', value: 'Transport Professionals' },
  { label: 'Workflow', value: 'Exchange + Operations' },
];

const valueCards = [
  {
    title: 'Exchange Marketplace',
    detail: 'Access more loads and more carriers in one live network.',
    icon: Network,
  },
  {
    title: 'Operations Control',
    detail: 'Plan, assign and manage every job from one operational hub.',
    icon: MapPinned,
  },
  {
    title: 'Proof of Delivery',
    detail: 'Capture POD with photo, signature and location in one flow.',
    icon: ShieldCheck,
  },
];

export function LandingPage() {
  return (
    <div className="bg-[#030d22] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020919]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="text-lg font-bold tracking-wide">
            <span className="text-[#f5c247]">X</span>Drive
            <span className="ml-2 text-xs font-medium tracking-[0.24em] text-white/60">LOGISTICS</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-white/80 lg:flex">
            <a href="#platform" className="hover:text-white">
              Platform
            </a>
            <a href="#roles" className="hover:text-white">
              Roles
            </a>
            <a href="#how-it-works" className="hover:text-white">
              How it Works
            </a>
            <a href="#launch" className="hover:text-white">
              Launch
            </a>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/request-quote"
              className="rounded-xl bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#032115] transition hover:bg-[#16a34a]"
            >
              Request Transport
            </Link>
            <Link
              href="/register"
              className="hidden rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
            >
              Join XDrive
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          <Image
            src="/reference/courier-exchange/Screenshot%202026-06-04%20063451.png"
            alt="Logistics operations background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(245,194,71,0.22),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(34,197,94,0.14),transparent_30%),linear-gradient(120deg,rgba(2,7,21,0.88),rgba(2,7,21,0.7),rgba(2,7,21,0.92))]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20 lg:pt-20">
          <div>
            <p className="inline-flex rounded-full border border-[#f5c247]/45 bg-[#f5c247]/10 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[#f5c247]">
              FOUNDED FEBRUARY 2021
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              MOVE FREIGHT. <br />
              MANAGE OPERATIONS. <br />
              <span className="text-[#f5c247]">GROW YOUR NETWORK.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/80">
              XDrive connects transport customers, brokers, carriers, owner operators and drivers in one operational logistics platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/request-quote"
                className="rounded-xl bg-[#22c55e] px-6 py-3 text-sm font-semibold text-[#042012] transition hover:bg-[#16a34a]"
              >
                Request Transport
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-white/35 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Join XDrive
              </Link>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-white/80 sm:grid-cols-2 lg:grid-cols-4">
              {trustPills.map((pill) => (
                <div key={pill.label} className="rounded-xl border border-white/15 bg-[#03112f]/75 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">{pill.label}</p>
                  <p className="mt-1 font-semibold text-white">{pill.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative pt-2 lg:pt-8">
            <div className="rounded-3xl border border-white/15 bg-[#04122f]/85 p-5 shadow-2xl backdrop-blur">
              <p className="mb-4 text-sm font-semibold text-white/85">Marketplace</p>
              <div className="space-y-3 text-sm">
                {[
                  ['Blackburn', 'London', '£420'],
                  ['Manchester', 'Glasgow', '£580'],
                  ['Leeds', 'Bristol', '£350'],
                ].map(([from, to, value]) => (
                  <div key={`${from}-${to}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-white/85">
                      {from} <span className="text-white/45">→</span> {to}
                    </p>
                    <p className="font-semibold text-[#f5c247]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/15 bg-[#04122f]/88 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Operations Overview</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Active Jobs', '86'],
                    ['In Transit', '58'],
                    ['POD Uploaded', '41'],
                    ['Invoice Ready', '36'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-white/65">{label}</p>
                      <p className="text-xl font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#04122f]/88 backdrop-blur">
                <Image
                  src="/reference/courier-exchange/Screenshot%202026-06-04%20063730.png"
                  alt="Driver app mock"
                  width={460}
                  height={660}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#041128] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold">Built from real transport experience.</h2>
            <p className="mt-3 text-white/70">Created after years of operational work across UK logistics and exchange networks.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-white/12 bg-[#05142f] p-5">
              <CalendarDays className="h-5 w-5 text-[#f5c247]" />
              <p className="mt-4 text-sm text-white/65">Company Established</p>
              <p className="text-3xl font-bold">2021</p>
            </article>
            <article className="rounded-2xl border border-white/12 bg-[#05142f] p-5">
              <MapPinned className="h-5 w-5 text-[#f5c247]" />
              <p className="mt-4 text-sm text-white/65">Platform Focus</p>
              <p className="text-3xl font-bold">UK Logistics</p>
            </article>
            <article className="rounded-2xl border border-white/12 bg-[#05142f] p-5">
              <Network className="h-5 w-5 text-[#f5c247]" />
              <p className="mt-4 text-sm text-white/65">Core Workflows</p>
              <p className="text-3xl font-bold">Exchange + Operations</p>
            </article>
            <article className="rounded-2xl border border-white/12 bg-[#05142f] p-5">
              <Users2 className="h-5 w-5 text-[#f5c247]" />
              <p className="mt-4 text-sm text-white/65">User Types</p>
              <p className="text-3xl font-bold">5</p>
            </article>
          </div>
        </div>
      </section>

      <section id="roles" className="bg-[#f4f6fb] px-4 py-16 text-[#111827] sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-4xl font-bold">One platform. Five user types.</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            {roleCards.map((role) => (
              <article key={role.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Image src={role.image} alt={role.title} width={560} height={360} className="h-44 w-full object-cover" />
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-slate-900">{role.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{role.summary}</p>
                  <Link href={role.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1745a8]">
                    Learn more <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="bg-[#f4f6fb] px-4 pb-16 text-[#111827] sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-4xl font-bold">See the platform before launch.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {previewCards.map((card) => (
              <article key={card.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Image src={card.image} alt={card.title} width={720} height={450} className="h-44 w-full object-cover" />
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
                  <Link href={card.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1745a8]">
                    View {card.title.toLowerCase()} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#f4f6fb] px-4 pb-16 text-[#111827] sm:px-6">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white px-5 py-10 shadow-sm sm:px-8">
          <h2 className="text-center text-4xl font-bold">How XDrive works.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            {flowSteps.map(({ title, detail, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-slate-50 p-2 text-[#1745a8]">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-xs text-slate-600">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-white/10">
        <div className="absolute inset-0">
          <Image
            src="/reference/courier-exchange/Screenshot%202026-06-04%20063617.png"
            alt="Truck background"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#020919]/85" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-4xl font-bold">Why XDrive exists.</h2>
            <p className="mt-4 max-w-xl text-white/75">
              Most logistics tools solve only one part of the problem. XDrive connects exchange, operations, driver workflow, POD and
              invoicing in one connected platform.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {valueCards.map(({ title, detail, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-white/15 bg-[#03122f]/70 p-5 backdrop-blur">
                <Icon className="h-5 w-5 text-[#f5c247]" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-white/70">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="launch" className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          <Image
            src="/reference/courier-exchange/Screenshot%202026-06-04%20063807.png"
            alt="Commercial launch"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#020919]/80" />
        </div>
        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 py-14 sm:px-6">
          <h2 className="text-4xl font-bold">Be part of the commercial launch.</h2>
          <p className="max-w-2xl text-white/80">Early access registrations are open now for carriers, owner operators, load posters and customers.</p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/register"
              className="rounded-xl bg-[#22c55e] px-6 py-3 text-sm font-semibold text-[#042012] transition hover:bg-[#16a34a]"
            >
              Join Early Access
            </Link>
            <Link
              href="/request-quote"
              className="rounded-xl border border-white/35 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-[#010716] px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
          <div>
            <p className="text-2xl font-bold">
              <span className="text-[#f5c247]">X</span>Drive
            </p>
            <p className="mt-3 text-sm text-white/70">XDrive Logistics Ltd</p>
            <p className="text-sm text-white/70">Founded February 2021</p>
            <p className="text-sm text-white/70">Company No. 13171804</p>
            <p className="text-sm text-white/70">United Kingdom</p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/85">{group.title}</h3>
              <div className="mt-4 space-y-2 text-sm text-white/65">
                {group.links.map((link) => (
                  <p key={link}>{link}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2021 - 2026 XDrive Logistics Ltd. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> support@xdrivelogistics.co.uk
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> +44 7584 123456
            </span>
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> Independent logistics technology platform
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
