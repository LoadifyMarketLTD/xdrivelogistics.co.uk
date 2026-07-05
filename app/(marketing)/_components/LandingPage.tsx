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
  operationalStory,
  platformModules,
  problemPoints,
  roleCards,
  workflowSteps,
} from './content';
import { MarketingFooter } from './sections/MarketingFooter';
import { SiteNav } from './sections/SiteNav';
import { HeroSection } from './sections/HeroSection';

const moduleIcons = [BriefcaseBusiness, ClipboardList, UserRound, Truck, FileCheck2, Gauge, ShieldCheck] as const;

export function LandingPage() {
  return (
    <div className="bg-[#07111f] text-white">
      <SiteNav />

      <main>
        <HeroSection />

        <section id="resources" className="border-b border-white/10 bg-[#f8fbff] px-4 py-16 text-[#0f172a] sm:px-6 lg:py-20">
          <div className="mx-auto max-w-7xl">

            {/* Section header */}
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex rounded-full border border-[#dbe7ff] bg-[#eff6ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">
                Why XDrive exists
              </span>
              <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                The morning before XDrive
              </h2>
            </div>

            {/* Operational story */}
            <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-[#dbe7ff] bg-white px-7 py-7 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.25)]">
              <p className="text-base leading-8 text-slate-600 sm:text-[1.05rem]">
                {operationalStory}
              </p>
            </div>

            {/* Problem cards */}
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {problemPoints.map((point) => (
                <article key={point.title} className="flex h-full flex-col rounded-3xl border border-[#dbe7ff] bg-white shadow-[0_24px_70px_-52px_rgba(15,23,42,0.25)]">
                  <div className="border-b border-[#dbe7ff] px-6 py-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#dc2626]">The problem</p>
                    <h3 className="mt-2 text-base font-semibold leading-snug text-[#0f172a]">{point.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{point.problem}</p>
                  </div>
                  <div className="border-b border-[#dbe7ff] px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#b45309]">The cost</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{point.consequence}</p>
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0f766e]">With XDrive</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{point.solution}</p>
                  </div>
                </article>
              ))}
            </div>

            {/* Transition sentence */}
            <div className="mx-auto mt-12 max-w-2xl text-center">
              <p className="text-base leading-7 text-slate-500">
                That is the day XDrive is built around.{' '}
                <span className="font-semibold text-[#0f172a]">The workflow below maps exactly how a job moves — from the first request to a completed delivery record — with every step connected.</span>
              </p>
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
