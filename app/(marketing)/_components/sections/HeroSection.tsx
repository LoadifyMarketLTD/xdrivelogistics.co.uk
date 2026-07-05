import Link from 'next/link';
import { ArrowRight, ClipboardList, FileCheck2, Route, Truck } from 'lucide-react';

const heroPanels = [
  {
    title: 'Customer intake',
    detail: 'Quote request, route detail and job brief captured first.',
    icon: ClipboardList,
  },
  {
    title: 'Marketplace and award',
    detail: 'Posted work, bid activity and awarded carrier path.',
    icon: Route,
  },
  {
    title: 'Dispatch and driver',
    detail: 'Assignment, milestones, live updates and roadside actions.',
    icon: Truck,
  },
  {
    title: 'POD and finance',
    detail: 'Delivery proof and invoice visibility stay attached to the job.',
    icon: FileCheck2,
  },
] as const;

export function HeroSection() {
  return (
    <section className="overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(245,197,66,0.22),_transparent_32%),linear-gradient(180deg,#07111f_0%,#0b1524_54%,#0f172a_100%)]" id="product">
      <div className="mx-auto grid min-h-[calc(100svh-150px)] w-full max-w-7xl gap-10 px-4 py-12 sm:min-h-[calc(100svh-140px)] sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-[#f5c542]/40 bg-[#f5c542]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#f5c542]">
            Phase 2 homepage • product-led
          </span>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] text-white sm:mt-6 sm:text-5xl lg:text-6xl">
            A homepage rebuilt from the actual XDrive product flow.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:mt-6 sm:text-lg sm:leading-8">
            Request intake, marketplace bids, dispatch control, driver actions, POD and invoice visibility are already shaping the platform.
            The homepage now follows that operating chain instead of generic restore copy.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Request → bid → award → allocate → deliver → invoice</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Customer, marketplace, dispatch, driver and finance workspaces</div>
          </div>
          <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
            <Link href="/register" className="rounded-lg bg-[#f5c542] px-6 py-3 text-sm font-semibold text-[#07111f] transition hover:bg-[#ffd45a]">
              Join Early Access
            </Link>
            <Link href="/request-quote" className="rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
              Request a Quote
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-slate-300">
            Explore the product surfaces below
            <ArrowRight className="h-4 w-4 text-[#f5c542]" />
          </div>
        </div>

        <div className="grid gap-4 lg:pl-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_28px_80px_-46px_rgba(0,0,0,0.75)] backdrop-blur-sm">
            <div className="rounded-[24px] border border-white/10 bg-[#091321] p-5">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f5c542]">Product surfaces</p>
                  <h2 className="mt-1 text-xl font-black text-white">What the platform is actually made of</h2>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                  Early access
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {heroPanels.map(({ title, detail, icon: Icon }) => (
                  <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5c542]/12 text-[#f5c542]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{detail}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
