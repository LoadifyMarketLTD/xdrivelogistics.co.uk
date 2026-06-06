import { CheckCircle2, Route } from 'lucide-react';
import Link from 'next/link';
import { HomepageVisualCard } from '../HomepageVisualCard';

const trustBadges = [
  'Built by logistics professionals',
  'Early access platform',
  'UK registered company',
] as const;

export function HeroSection() {
  return (
    <section className="relative border-b border-[#e5e7eb] px-4 py-12 sm:px-6 sm:py-20" id="industries">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-[#1d4ed8]/30 bg-[#eff6ff] px-4 py-1.5 text-xs font-semibold tracking-[0.1em] text-[#1d4ed8]">
            UK Logistics Technology Platform
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight text-[#0f172a] sm:text-5xl">
            Move Freight.
            <br />
            Manage Operations.
            <br />
            Grow Your Network.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            XDrive is an early-access UK logistics platform designed to connect transport customers, courier companies, owner operators and
            drivers in one operational workflow.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/request-quote" className="rounded-lg bg-[#1d4ed8] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1e40af]">
              Request Demo
            </Link>
            <Link href="/register" className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Join Early Access
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-4">
            {trustBadges.map((badge) => (
              <span key={badge} className="flex items-center gap-1.5 text-sm text-slate-600">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#1d4ed8]" />
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-5 text-xs text-slate-400">
            XDrive Logistics Ltd &bull; Company No. 13171804 &bull; Founded 1 February 2021
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-slate-50 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.35)]">
          <HomepageVisualCard
            imageSrc="/hero-dispatch-control.webp"
            imageAlt="XDrive Platform Command Centre — Marketplace, Operations and Driver Workspace"
            label="Platform overview"
            title="XDrive Platform Command Centre"
            icon={Route}
            tone="blue"
            className="h-[260px] w-full md:h-[340px] lg:h-[420px]"
            priority
          />
        </div>
      </div>
    </section>
  );
}
