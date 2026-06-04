import Image from 'next/image';
import Link from 'next/link';
import { Activity, FileCheck2, FileText, LayoutGrid, Map, ShieldCheck, Truck, Users } from 'lucide-react';

const roleCards = [
  {
    title: 'Owner Drivers',
    summary: 'Find available UK loads, quote quickly, and manage live delivery updates from one workflow.',
    benefit: 'Get more booked work with less admin.',
    cta: 'Join as Owner Driver',
    href: '/register',
  },
  {
    title: 'Courier Companies',
    summary: 'Coordinate teams, assign jobs, track progress, and close each movement with POD and invoicing.',
    benefit: 'Improve fleet utilisation and delivery control.',
    cta: 'Join as Carrier',
    href: '/register',
  },
  {
    title: 'Load Posters / Brokers',
    summary: 'Post transport requirements, compare quotes, award jobs, and monitor execution in real time.',
    benefit: 'Source reliable capacity faster.',
    cta: 'Post a Load',
    href: '/request-quote',
  },
  {
    title: 'Customers',
    summary: 'Request transport, get matched with trusted operators, and follow every milestone to completion.',
    benefit: 'Gain visibility from request to proof of delivery.',
    cta: 'Request Transport',
    href: '/request-quote',
  },
];

const previewCards = [
  { title: 'Marketplace', detail: 'Live load board with quote visibility and route intelligence.', icon: LayoutGrid },
  { title: 'Operations Diary', detail: 'Planning timeline for allocations, ETAs, and dispatch updates.', icon: Activity },
  { title: 'Driver Dashboard', detail: 'Mobile-first job flow with milestone updates and proof capture.', icon: Truck },
  { title: 'Fleet & Vehicles', detail: 'Vehicle availability, allocation status, and compliance tracking.', icon: Users },
  { title: 'POD / Invoices', detail: 'Proof of delivery, signed records, and invoice-ready completion.', icon: FileText },
];

const flowSteps = ['Post / Request', 'Quote', 'Award', 'Assign', 'Deliver', 'POD', 'Invoice'];

const referenceShots = [
  {
    src: '/reference/courier-exchange/Screenshot%202026-06-04%20063434.png',
    title: 'Exchange load board flow',
  },
  {
    src: '/reference/courier-exchange/Screenshot%202026-06-04%20063533.png',
    title: 'Live allocation workflow',
  },
  {
    src: '/reference/courier-exchange/Screenshot%202026-06-04%20063730.png',
    title: 'Route and dispatch snapshot',
  },
  {
    src: '/reference/courier-exchange/Screenshot%202026-06-04%20063844.png',
    title: 'Driver operations reference',
  },
];

const footerGroups = [
  { title: 'Platform', links: ['Marketplace', 'Operations Diary', 'Driver Dashboard', 'POD & Invoicing'] },
  { title: 'For', links: ['Owner Drivers', 'Courier Companies', 'Load Posters / Brokers', 'Transport Customers'] },
  { title: 'Company', links: ['About XDrive', 'Early Access Launch', 'Contact Team'] },
  { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies'] },
  { title: 'Contact', links: ['support@xdrivelogistics.co.uk', 'United Kingdom'] },
];

export function LandingPage() {
  return (
    <div className="bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-sm font-semibold tracking-wide text-slate-900">XDrive Logistics</div>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#platform">Platform</a>
            <a href="#roles">Roles</a>
            <a href="#how-it-works">How it Works</a>
            <a href="#launch">Launch</a>
            <a href="#contact">Contact</a>
          </nav>
          <Link
            href="/register"
            className="rounded-lg border border-emerald-400/50 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
          >
            Create Early Access Account
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-200 px-6 pb-20 pt-14 md:pb-28 md:pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.18),transparent_35%),radial-gradient(circle_at_85%_5%,rgba(16,185,129,0.2),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(249,115,22,0.16),transparent_35%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-sky-300/50 bg-sky-100 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-sky-700">
              UK LOGISTICS LAUNCH PLATFORM
            </p>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight text-slate-900 md:text-6xl">
              Find Loads. Manage Drivers. Deliver with Proof.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-700">
              XDrive is a UK logistics exchange and operations platform built for owner drivers, courier companies, load posters and
              transport customers.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/request-quote"
                className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                Post a Load / Request Transport
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Join as Carrier / Owner Driver
              </Link>
            </div>
          </div>

          <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="absolute inset-6 rounded-2xl border border-sky-200/60 bg-[linear-gradient(145deg,rgba(240,249,255,0.98),rgba(241,245,249,0.95))]" />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between text-xs font-semibold tracking-[0.14em] text-sky-700">
                <span className="inline-flex items-center gap-2">
                  <Map className="h-3.5 w-3.5" />
                  UK ROUTE GRID
                </span>
                <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-emerald-700">LIVE</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Available Loads', '142 Open'],
                  ['Active Jobs', '58 In Transit'],
                  ['POD Uploaded', '41 Today'],
                  ['Invoice Ready', '36 Complete'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-sky-300/40 bg-sky-50 p-3 text-xs text-slate-700">
                London → Birmingham → Manchester → Leeds route allocation synced with operations diary.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Built around each logistics role</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {roleCards.map((role) => (
            <article key={role.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{role.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{role.summary}</p>
              <p className="mt-4 text-sm font-medium text-emerald-700">{role.benefit}</p>
              <Link
                href={role.href}
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                {role.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="platform" className="border-y border-slate-200 bg-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Platform preview</h2>
          <p className="mt-4 max-w-2xl text-slate-600">A unified workspace for exchange activity and daily delivery operations.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {previewCards.map(({ title, detail, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="mb-4 inline-flex rounded-lg border border-sky-300/40 bg-sky-100 p-2 text-sky-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm text-slate-600">{detail}</p>
                <div className="mt-5 h-24 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-100 via-sky-50 to-slate-100 p-3">
                  <div className="mb-2 h-2 w-20 rounded bg-slate-400/60" />
                  <div className="mb-2 h-2 w-32 rounded bg-slate-400/40" />
                  <div className="h-2 w-24 rounded bg-emerald-500/40" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Reference workflow snapshots</h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          Benchmark visuals used in ongoing UX alignment for exchange and dispatch experiences.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {referenceShots.map((shot) => (
            <article key={shot.src} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Image src={shot.src} alt={shot.title} width={1200} height={675} className="h-52 w-full object-cover" />
              <p className="px-4 py-3 text-sm font-medium text-slate-700">{shot.title}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">How it works</h2>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {flowSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">{step}</div>
              {index < flowSteps.length - 1 && <span className="text-slate-400">→</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Why XDrive</h2>
            <p className="mt-5 max-w-2xl text-lg text-slate-600">
              Not just a load board. Not just dispatch software. XDrive connects exchange, dispatch, driver workflow, POD and invoicing.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="space-y-4 text-sm text-slate-700">
              <p className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Exchange plus operations in one delivery lifecycle
              </p>
              <p className="flex items-center gap-3">
                <FileCheck2 className="h-4 w-4 text-emerald-500" />
                Proof and finance steps integrated with dispatch activity
              </p>
              <p className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-emerald-500" />
                Built for UK owner drivers, carriers, brokers and customers
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white to-slate-100 p-8">
          <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Trust and credibility</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Legal Entity</p>
              <p className="mt-2 font-semibold text-slate-900">XDrive Logistics Ltd</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Founded</p>
              <p className="mt-2 font-semibold text-slate-900">1 February 2021</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Company No.</p>
              <p className="mt-2 font-semibold text-slate-900">13171804</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Positioning</p>
              <p className="mt-2 font-semibold text-slate-900">UK logistics technology platform</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-slate-600">Built from real transport experience across exchange workflows and operations delivery.</p>
        </div>
      </section>

      <section id="launch" className="border-y border-slate-200 bg-slate-100 px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-emerald-700">EARLY ACCESS LAUNCH</p>
          <h2 className="text-3xl font-bold text-slate-900 md:text-5xl">Be first on the XDrive commercial launch</h2>
          <p className="mx-auto mt-5 max-w-2xl text-slate-600">
            We are onboarding early users now across owner drivers, carriers, load posters and transport customers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400">
              Create Early Access Account
            </Link>
            <Link
              href="/request-quote"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Request a Demo
            </Link>
          </div>
        </div>
      </section>

      <footer id="contact" className="px-6 py-14">
        <div className="mx-auto grid max-w-7xl gap-8 border-t border-slate-200 pt-10 md:grid-cols-5">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold tracking-wide text-slate-900">{group.title}</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {group.links.map((link) => (
                  <p key={link}>{link}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-7xl text-xs text-slate-500">© 2021 - 2026 XDrive Logistics Ltd. All rights reserved.</p>
      </footer>
    </div>
  );
}
