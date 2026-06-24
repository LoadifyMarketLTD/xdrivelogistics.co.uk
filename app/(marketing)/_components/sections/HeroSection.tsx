import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileCheck2, Route, ShieldCheck, Truck } from 'lucide-react';

const trustBadges = [
  'UK registered company',
  '3-month free Early Access',
  'Built around real courier workflows',
] as const;

const heroMetrics = [
  { label: 'Platform stage', value: 'Live' },
  { label: 'Supported roles', value: '6+' },
  { label: 'Free access', value: '3 months' },
] as const;

const liveWorkflow = [
  { label: 'Transport request', value: 'Structured job details', icon: Route },
  { label: 'Carrier workflow', value: 'Quote, award, assign', icon: Truck },
  { label: 'Delivery records', value: 'POD and invoice visibility', icon: FileCheck2 },
] as const;

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-900 bg-slate-950" id="industries">
      <Image
        src="/hero-dispatch-control.webp"
        alt="XDrive Logistics dispatch control workspace"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/88 to-slate-950/30" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.10)_0%,rgba(15,23,42,0.70)_100%)]" />

      <div className="relative mx-auto flex min-h-[calc(100svh-220px)] w-full max-w-7xl flex-col justify-center px-4 py-6 sm:min-h-[calc(100svh-190px)] sm:px-6 sm:py-8 lg:min-h-[calc(100svh-170px)] lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.72fr)] lg:items-center">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-blue-100 backdrop-blur">
              Functional Early-access UK logistics platform
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Move Freight.
              <span className="block text-blue-100">Manage Operations.</span>
              <span className="block text-blue-100">Grow Your Transport Network.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-100 sm:text-lg sm:leading-8">
              XDrive is an early-access UK logistics platform designed to help customers post transport jobs, carriers quote on loads,
              drivers manage deliveries, and businesses keep PODs, invoices and operations in one place.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-[#1d4ed8]"
              >
                Join Early Access
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/request-quote"
                className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Request Demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="#solutions"
                className="hidden items-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-blue-100 transition hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                View Platform Roles
              </Link>
            </div>

            <p className="mt-5 hidden max-w-2xl text-sm leading-6 text-slate-300 sm:block">
              Built from real courier and transport experience. XDrive is functional for approved early users, while the public marketplace
              network and wider broker/company volume are still being grown.
            </p>

            <div className="mt-5 hidden flex-wrap gap-x-5 gap-y-2 sm:flex">
              {trustBadges.map((badge) => (
                <span key={badge} className="flex items-center gap-1.5 text-sm text-slate-100">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-blue-300" aria-hidden="true" />
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <aside className="hidden rounded-lg border border-white/20 bg-slate-950/60 p-3 text-white shadow-2xl shadow-slate-950/40 backdrop-blur-md lg:block">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-200">Functional platform</p>
                <h2 className="mt-1 text-xl font-bold text-white">Early-access workflow live for approved users</h2>
              </div>
              <div className="rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-200">Early Access</div>
            </div>

            <div className="mt-3 grid gap-2">
              {liveWorkflow.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 p-2.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-400/15 text-blue-200">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{item.label}</span>
                      <span className="block text-sm font-semibold text-slate-50">{item.value}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {heroMetrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-white/10 bg-white/10 p-2.5">
                  <p className="text-base font-extrabold text-white">{metric.value}</p>
                  <p className="mt-1 text-xs leading-4 text-slate-300">{metric.label}</p>
                </div>
              ))}
            </div>

            <Link href="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
              Login for approved users
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
