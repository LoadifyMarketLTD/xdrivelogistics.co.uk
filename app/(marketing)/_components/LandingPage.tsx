import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Gauge,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react';

import {
  earlyAccessPoints,
  faqs,
  platformModules,
  problemPoints,
  roleCards,
  trustBarItems,
  workflowSteps,
} from './content';
import { MarketingFooter } from './sections/MarketingFooter';
import { MarketingHeader } from './sections/MarketingHeader';

const moduleIcons = [BriefcaseBusiness, ClipboardList, UserRound, Truck, FileCheck2, Gauge, ShieldCheck] as const;

const roleHighlights = [
  'Request handling',
  'Quote visibility',
  'Carrier allocation',
  'Driver workflow',
  'POD records',
  'Invoice visibility',
] as const;

export function LandingPage() {
  return (
    <div className="bg-[#07111f] text-white">
      <MarketingHeader />

      <main>
        <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.26),transparent_32%),linear-gradient(180deg,#07111f_0%,#08172b_55%,#0b1f39_100%)]">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-16">
            <div>
              <span className="inline-flex rounded-full border border-[#60a5fa]/35 bg-[#1d4ed8]/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#93c5fd]">
                Functional Early Access — approved logistics users only.
              </span>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.98] text-white sm:text-5xl lg:text-6xl">
                Move Freight. Manage Operations. Grow Your Network.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                XDrive Logistics is a UK logistics platform for transport requests, quotes, carrier allocation, driver workflow, POD records, invoices and operational visibility.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">
                  Request Early Access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Sign In
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Need a transport enquiry route first?{' '}
                <Link href="/request-quote" className="font-semibold text-[#93c5fd] transition hover:text-white">
                  Request a quote
                </Link>
                .
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {roleHighlights.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 backdrop-blur-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0f172a] shadow-[0_32px_90px_-40px_rgba(37,99,235,0.55)]">
                <Image
                  src="/hero-dispatch-control.webp"
                  alt="XDrive Logistics marketing hero showing real logistics operations"
                  width={1440}
                  height={1080}
                  priority
                  className="h-[320px] w-full object-cover sm:h-[380px] lg:h-[480px]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,31,0.05)_0%,rgba(7,17,31,0.8)_100%)]" />
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                  <div className="inline-flex rounded-full border border-white/20 bg-[#07111f]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93c5fd] backdrop-blur-sm">
                    Public landing page — no fake live dashboard data
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#07111f]/78 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">Platform scope</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">
                        Request, quote, allocation, driver workflow, POD records, invoice visibility and operational oversight in one product story.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#07111f]/78 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">Rollout position</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">
                        Functional for approved users today, with broader network scale and additional modules continuing through controlled early access.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-[#0b1627]">
          <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-5 sm:px-6 md:grid-cols-2 xl:grid-cols-5">
            {trustBarItems.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="resources" className="border-b border-white/10 bg-white px-4 py-14 text-[#0f172a] sm:px-6 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <span className="inline-flex rounded-full border border-[#dbe7ff] bg-[#eff6ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">
                  Why XDrive exists
                </span>
                <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
                  Built for the real gaps between request, execution, proof and invoicing.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  XDrive is aimed at the parts of logistics work that are often fragmented across calls, inboxes, spreadsheets and separate systems. The goal is not to decorate operations with fake metrics. The goal is to keep the job record connected.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {problemPoints.map((point) => (
                  <article key={point.title} className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] sm:last:col-span-2 xl:last:col-span-1">
                    <p className="text-sm font-semibold text-[#1d4ed8]">Problem</p>
                    <h3 className="mt-2 text-lg font-semibold leading-6 text-[#0f172a]">{point.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{point.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="solutions" className="border-b border-white/10 bg-[#eff6ff] px-4 py-14 text-[#0f172a] sm:px-6 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">Roles</span>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">One platform story for the logistics roles around the same job.</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                The homepage presents one public narrative across desktop, tablet and mobile, while the platform itself supports different operational roles once access is approved.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roleCards.map((role) => (
                <article key={role.title} className="flex h-full flex-col overflow-hidden rounded-3xl border border-[#dbe7ff] bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
                  <div className="h-48 bg-slate-100">
                    <Image src={role.image} alt={role.imageAlt} width={960} height={720} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-xl font-semibold text-[#0f172a]">{role.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{role.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-white/10 bg-[#0b1627] px-4 py-14 sm:px-6 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">Workflow</span>
                <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">Request → Quote → Award → Assign → Collect → Deliver → POD → Invoice</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                XDrive is structured around a transport job moving forward through a connected workflow rather than being rebuilt from scratch in each tool or message thread.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <article key={step.title} className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563eb] text-sm font-black text-white">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <CheckCircle2 className="h-5 w-5 text-[#93c5fd]" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{step.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="modules" className="border-b border-white/10 bg-white px-4 py-14 text-[#0f172a] sm:px-6 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">Platform modules</span>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">Operational modules with clear scope, users and rollout status.</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Each module is positioned honestly: what it does, who uses it and whether it is functional today, in early access, or still planned.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {platformModules.map((module, index) => {
                const Icon = moduleIcons[index];
                return (
                  <article key={module.title} className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#1d4ed8]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        {module.status}
                      </span>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-[#0f172a]">{module.title}</h3>
                    <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                      <div>
                        <p className="font-semibold text-[#0f172a]">What it does</p>
                        <p className="mt-1">{module.whatItDoes}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[#0f172a]">Who uses it</p>
                        <p className="mt-1">{module.whoUsesIt}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="launch" className="border-b border-white/10 bg-[#0f172a] px-4 py-14 sm:px-6 lg:py-16">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <span className="inline-flex rounded-full border border-[#60a5fa]/30 bg-[#2563eb]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
                Early Access
              </span>
              <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Join a controlled rollout built for approved logistics users.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                XDrive is being rolled out carefully so the product can support real logistics operations without overstating marketplace scale or live public volume.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">
                  Request Early Access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {earlyAccessPoints.map((point) => (
                <article key={point} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-200 backdrop-blur-sm">
                  {point}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-b border-white/10 bg-[#eff6ff] px-4 py-14 text-[#0f172a] sm:px-6 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">FAQ</span>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">Honest answers about what XDrive is and where rollout stands.</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                The answers below are written to explain the current product position clearly without pretending the network is already at full public scale.
              </p>
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-2">
              {faqs.map((faq, index) => (
                <details key={faq.q} className="group rounded-3xl border border-[#dbe7ff] bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]" open={index === 0}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-semibold text-[#0f172a]">
                    <span>{faq.q}</span>
                    <span className="mt-0.5 text-[#1d4ed8] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,#07111f_0%,#08172b_100%)] px-4 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-5xl rounded-[32px] border border-white/10 bg-white/5 px-6 py-10 text-center shadow-[0_32px_90px_-40px_rgba(37,99,235,0.45)] backdrop-blur-sm sm:px-10 lg:px-14">
            <span className="inline-flex rounded-full border border-[#60a5fa]/30 bg-[#2563eb]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">
              Final CTA
            </span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Join the XDrive Early Access rollout</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Apply if your logistics workflow matches the current rollout, or sign in if you are already an approved XDrive user.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">
                Request Early Access <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
