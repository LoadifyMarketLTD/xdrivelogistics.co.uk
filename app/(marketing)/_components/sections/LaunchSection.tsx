import Image from 'next/image';
import Link from 'next/link';

import { earlyAccessBenefits } from '../content';

export function LaunchSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#e5e7eb]" id="launch">
      {/* Launch background photography */}
      <Image
        src="/operations-dispatch-office.webp"
        alt=""
        fill
        className="object-cover object-center"
        aria-hidden="true"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#0f172a]/70" />

      <div className="relative px-4 py-8 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-100">
              Early Access Benefits
            </span>
            <h2 className="mt-4 text-2xl font-bold text-white sm:text-4xl">Help Shape XDrive Before Wider Launch</h2>
            <p className="mt-4 max-w-2xl text-blue-100">
              Early Access is open to approved UK transport customers, courier companies, owner drivers, drivers, load posters and dispatch
              teams.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:mt-8 md:grid-cols-2 xl:grid-cols-3">
            {earlyAccessBenefits.map((benefit, index) => (
              <article key={benefit.title} className={`rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:p-5 ${index > 0 ? 'hidden sm:block' : ''}`}>
                <h3 className="text-base font-semibold text-white">{benefit.title}</h3>
                <p className="mt-3 text-sm leading-6 text-blue-100">{benefit.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-blue-100">
              Approved Early Access users receive 3 months of free access while XDrive continues its controlled rollout with real UK transport workflows.
            </p>
            <div className="flex flex-shrink-0 flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#1d4ed8] transition hover:bg-blue-50"
              >
                Join Early Access
              </Link>
              <Link
                href="/request-quote"
                className="rounded-lg border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Request Demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
