import Image from 'next/image';
import Link from 'next/link';

export function HeroSection() {
  return (
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
  );
}
