import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Layers3,
  ShieldCheck,
} from 'lucide-react';

import {
  faqs,
  platformModules,
  roleCards,
  statusHighlights,
  workflow,
} from './content';
import { MarketingFooter } from './sections/MarketingFooter';
import { MarketingHeader } from './sections/MarketingHeader';

const proofPoints = [
  'Functional early-access rollout',
  'Approved UK logistics users',
  'Marketplace, operations, POD and finance records',
  'No client funds held by XDrive',
] as const;

const operatingSignals = [
  { label: 'Stage', value: 'MVP / Early Access' },
  { label: 'Access', value: 'Approved users' },
  { label: 'Free period', value: '3 months' },
  { label: 'Focus', value: 'UK logistics workflows' },
] as const;

export function LandingPage() {
  return (
    <div className="bg-[#f4f6f8] text-[#101820]">
      <MarketingHeader />

      <main>
        <section id="platform" className="relative min-h-[calc(100svh-150px)] overflow-hidden bg-[#08111f] text-white">
          <Image
            src="/operations-dispatch-office.webp"
            alt="XDrive operations workspace coordinating logistics activity"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#07111f]/78" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(7,17,31,0)_0%,#f4f6f8_100%)]" />

          <div className="relative mx-auto grid min-h-[calc(100svh-150px)] w-full max-w-[1440px] content-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
            <div className="max-w-4xl">
              <p className="mb-5 inline-flex border border-[#f5c542]/45 bg-[#f5c542]/12 px-4 py-2 text-sm font-semibold text-[#f5c542]">
                XDrive Logistics operating platform
              </p>
              <h1 className="max-w-5xl text-[2.75rem] font-black leading-[0.98] sm:text-[4.6rem] lg:text-[5.8rem]">
                Run transport work from request to POD in one controlled workspace.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-100">
                XDrive brings customers, courier companies, owner operators and drivers into a structured workflow for quotes, dispatch, delivery updates, POD records and invoice visibility.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 bg-[#f5c542] px-6 py-3 text-sm font-black text-[#07111f] transition hover:bg-[#ffd45a]">
                  Join Early Access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/request-quote" className="inline-flex items-center gap-2 border border-white/35 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/18">
                  Request Demo <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="self-end border border-white/18 bg-[#07111f]/62 p-5 backdrop-blur-md lg:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {operatingSignals.map((item) => (
                  <div key={item.label} className="border border-white/14 bg-white/8 p-4">
                    <p className="text-xs font-bold text-slate-300">{item.label}</p>
                    <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3">
                {proofPoints.map((point) => (
                  <div key={point} className="flex items-start gap-3 text-sm font-semibold text-slate-100">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#f5c542]" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-12 pt-4 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-4">
            {statusHighlights.map((item) => (
              <article key={item.title} className="min-h-[190px] border border-[#d5dde8] bg-white p-5 shadow-[0_18px_42px_-34px_rgba(16,24,32,0.75)]">
                <p className="text-sm font-black text-[#1d4ed8]">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-[#485465]">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="solutions" className="border-y border-[#dbe2ea] bg-white px-5 py-14 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-black text-[#1d4ed8]">Who it serves</p>
                <h2 className="mt-3 text-4xl font-black leading-tight text-[#101820] sm:text-5xl">Built for the working sides of transport.</h2>
              </div>
              <p className="max-w-3xl text-base leading-7 text-[#485465] lg:justify-self-end">
                The homepage now presents XDrive as a serious operational product: clear roles, real workflow language, consistent image treatment and no inflated public network claims.
              </p>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {roleCards.map((role) => (
                <article key={role.title} className="grid min-h-[360px] grid-rows-[150px_1fr] overflow-hidden border border-[#dbe2ea] bg-[#f8fafc]">
                  <div className="relative bg-slate-200">
                    <Image src={role.image} alt={role.imageAlt} fill className="object-cover" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-black text-[#101820]">{role.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#485465]">{role.subtitle}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-[#101820] px-5 py-16 text-white sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="text-sm font-black text-[#f5c542]">Operating model</p>
                <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">One job record, seven operational stages.</h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                  The workflow is shown as a compact operations sequence, not a decorative story. Each step is tied to a real logistics action.
                </p>
              </div>

              <div className="grid gap-3">
                {workflow.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <article key={step.title} className="grid grid-cols-[54px_1fr] gap-4 border border-white/12 bg-white/6 p-4 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                      <div className="flex h-12 w-12 items-center justify-center bg-[#f5c542] text-lg font-black text-[#101820]">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white">{step.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{step.detail}</p>
                      </div>
                      <Icon className="hidden h-6 w-6 text-[#f5c542] sm:block" />
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="modules" className="bg-[#eef2f6] px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1440px]">
            <div className="max-w-3xl">
              <p className="text-sm font-black text-[#1d4ed8]">Platform modules</p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-[#101820] sm:text-5xl">The product surface is operational, not ornamental.</h2>
            </div>

            <div className="mt-9 grid gap-5">
              {platformModules.map((module, index) => {
                const Icon = module.icon;
                return (
                  <article key={module.key} className="grid overflow-hidden border border-[#d5dde8] bg-white lg:grid-cols-[360px_1fr]">
                    <div className="relative min-h-[230px] bg-slate-200 lg:min-h-full">
                      <Image src={module.image} alt={module.imageAlt} fill className="object-cover" />
                    </div>
                    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px] lg:p-8">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-[#1d4ed8]">{String(index + 1).padStart(2, '0')}</span>
                          <Icon className="h-5 w-5 text-[#1d4ed8]" />
                          <span className="text-sm font-bold text-[#667285]">{module.status}</span>
                        </div>
                        <h3 className="mt-4 text-3xl font-black text-[#101820]">{module.title}</h3>
                        <p className="mt-3 max-w-3xl text-base leading-7 text-[#485465]">{module.problem}</p>
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#667285]">{module.audience}</p>
                      </div>
                      <div className="border-t border-[#dbe2ea] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                        <p className="text-sm font-black text-[#101820]">Core actions</p>
                        <div className="mt-4 grid gap-3">
                          {module.actions.map((action) => (
                            <div key={action} className="flex gap-3 text-sm leading-6 text-[#485465]">
                              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#1d4ed8]" />
                              <span>{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="resources" className="bg-white px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-black text-[#1d4ed8]">Early access clarity</p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-[#101820] sm:text-5xl">Clear claims. Clear boundaries. Clear next step.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#485465]">
                XDrive is presented as a functional early-access logistics platform. The copy avoids claiming public marketplace scale before the network has grown.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 bg-[#101820] px-6 py-3 text-sm font-black text-white transition hover:bg-[#263241]">
                  Join Early Access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 border border-[#cbd5e1] bg-white px-6 py-3 text-sm font-bold text-[#101820] transition hover:bg-[#f8fafc]">
                  Log In <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article className="border border-[#dbe2ea] bg-[#f8fafc] p-5">
                <Clock3 className="h-7 w-7 text-[#1d4ed8]" />
                <h3 className="mt-5 text-xl font-black text-[#101820]">3-month free access</h3>
                <p className="mt-3 text-sm leading-6 text-[#485465]">Approved users can evaluate supported workflows during the controlled rollout.</p>
              </article>
              <article className="border border-[#dbe2ea] bg-[#f8fafc] p-5">
                <Layers3 className="h-7 w-7 text-[#1d4ed8]" />
                <h3 className="mt-5 text-xl font-black text-[#101820]">Joined-up records</h3>
                <p className="mt-3 text-sm leading-6 text-[#485465]">Requests, quotes, jobs, PODs and invoice visibility stay connected.</p>
              </article>
              <article className="border border-[#dbe2ea] bg-[#f8fafc] p-5">
                <FileCheck2 className="h-7 w-7 text-[#1d4ed8]" />
                <h3 className="mt-5 text-xl font-black text-[#101820]">Evidence-led workflow</h3>
                <p className="mt-3 text-sm leading-6 text-[#485465]">Delivery evidence and operational history remain tied to the job record.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-t border-[#dbe2ea] bg-[#f8fafc] px-5 py-14 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-3xl font-black text-[#101820] sm:text-4xl">Questions before joining?</h2>
            <div className="mt-7 grid gap-3">
              {faqs.slice(0, 6).map((item) => (
                <details key={item.q} className="border border-[#dbe2ea] bg-white p-5">
                  <summary className="cursor-pointer text-base font-black text-[#101820]">{item.q}</summary>
                  <p className="mt-3 text-sm leading-6 text-[#485465]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
