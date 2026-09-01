import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';

const plans = [
  { name: 'Owner Driver', price: '£29.99', note: 'For self-employed couriers', featured: false },
  { name: 'Small Carrier', price: '£59.99', note: 'For 2–5 vehicle operations', featured: false },
  { name: 'Broker', price: '£79.99', note: 'For posting and managing work', featured: true },
  { name: 'Growing Carrier', price: '£89.99', note: 'For 6–15 vehicle operations', featured: false },
] as const;

const workflow = [
  { step: '01', title: 'Post or find work', copy: 'Customers and brokers publish transport requirements while couriers and carriers find relevant work.' },
  { step: '02', title: 'Quote and award', copy: 'Compare commercial offers, award the job and keep the agreed work tied to one operational record.' },
  { step: '03', title: 'Dispatch and deliver', copy: 'Move awarded work through driver allocation, live statuses and delivery execution.' },
  { step: '04', title: 'POD and records', copy: 'Return delivery evidence, timestamps and invoice-ready context to the same job record.' },
] as const;

export default function HomepagePricingPreview() {
  return (
    <main className="min-h-screen bg-[#F7FAFF] text-[#002B6C]">
      <header className="sticky top-0 z-50 border-b border-[#D7E6FA] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Link href="/homepage-pricing-preview" className="flex items-center">
            <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-black text-[#003B8F]/70 lg:flex">
            <a href="#platform">Platform</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#trust">Why XDrive</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-black text-[#003B8F] sm:inline">Sign In</Link>
            <Link href="/register" className="bg-[#003B8F] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(0,59,143,0.18)]">Start Free</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-white" id="platform">
        <div className="absolute right-[-17vw] top-[-18vw] h-[52vw] w-[52vw] rounded-full border-[30px] border-[#003B8F] opacity-[0.06]" />
        <div className="absolute right-[-11vw] top-[-12vw] h-[40vw] w-[40vw] rounded-full border-[12px] border-[#FDB913] opacity-20" />
        <div className="relative mx-auto grid min-h-[760px] max-w-[1440px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 border border-[#FDB913]/35 bg-[#FFF8E6] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#8A5B00]">
              <Sparkles className="h-4 w-4" /> Early access · 3 months free
            </div>
            <p className="mt-7 text-sm font-black uppercase tracking-[0.18em] text-[#FDB913]">Courier & Freight Exchange</p>
            <h1 className="mt-4 text-[3.1rem] font-black leading-[0.94] tracking-tight sm:text-[4.6rem] lg:text-[5.4rem]">
              Move freight. Manage operations. Keep more of every job.
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-[#24416F]">
              XDrive connects customers, brokers, couriers and carriers in one controlled workflow — from posted work and quotes to dispatch, POD and invoice readiness.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 bg-[#003B8F] px-6 py-3.5 text-sm font-black text-white shadow-[0_16px_34px_rgba(0,59,143,0.2)]">
                Start 3 Months Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#pricing" className="inline-flex items-center gap-2 border border-[#003B8F]/20 bg-white px-6 py-3.5 text-sm font-black text-[#003B8F]">
                See Pricing
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-black text-[#24416F]">
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1F7A3D]" /> No XDrive commission</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1F7A3D]" /> No booking fee</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1F7A3D]" /> Monthly rolling</span>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden border border-[#D7E6FA] bg-white shadow-[0_35px_100px_rgba(0,43,108,0.16)]">
              <div className="relative aspect-[16/10] bg-[#EEF6FF]">
                <Image src="/courier-fleet-depot.webp" alt="XDrive courier and freight operations" fill priority className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#002B6C]/90 to-transparent p-7 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FDB913]">One network. One job record.</p>
                  <p className="mt-2 text-2xl font-black">Exchange → Award → Dispatch → POD</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-7 -left-6 max-w-[260px] bg-[#FDB913] p-5 text-[#002B6C] shadow-[0_20px_50px_rgba(0,43,108,0.16)]">
              <p className="text-xs font-black uppercase tracking-[0.14em]">Launch membership</p>
              <p className="mt-1 text-3xl font-black">£0 for 3 months</p>
              <p className="mt-1 text-sm font-bold">Then from £29.99/month.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#003B8F] px-5 py-7 text-white sm:px-8">
        <div className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex items-center gap-4 border-l border-white/20 px-4 py-3"><MapPin className="h-7 w-7 text-[#FDB913]" /><span className="font-black">UK-wide network</span></div>
          <div className="flex items-center gap-4 border-l border-white/20 px-4 py-3"><Truck className="h-7 w-7 text-[#FDB913]" /><span className="font-black">Courier & freight work</span></div>
          <div className="flex items-center gap-4 border-l border-white/20 px-4 py-3"><Route className="h-7 w-7 text-[#FDB913]" /><span className="font-black">Live operations</span></div>
          <div className="flex items-center gap-4 border-l border-white/20 px-4 py-3"><FileCheck2 className="h-7 w-7 text-[#FDB913]" /><span className="font-black">POD & records</span></div>
          <div className="flex items-center gap-4 border-l border-white/20 px-4 py-3"><ShieldCheck className="h-7 w-7 text-[#FDB913]" /><span className="font-black">Controlled access</span></div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:py-28" id="how">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">How XDrive works</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">From available work to completed delivery.</h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-[#506889]">The value proposition comes first: users understand exactly what the platform does before they reach the membership plans.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((item) => (
              <article key={item.step} className="border border-[#D7E6FA] bg-white p-6 shadow-[0_15px_45px_rgba(0,43,108,0.06)]">
                <div className="text-sm font-black text-[#FDB913]">{item.step}</div>
                <h3 className="mt-4 text-xl font-black">{item.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#506889]">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">For couriers & carriers</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Find work. Quote quickly. Run the job cleanly.</h2>
            <p className="mt-5 text-lg font-semibold leading-8 text-[#506889]">Owner drivers and transport companies get a direct route from available work into awarded jobs, dispatch and delivery records.</p>
            <div className="mt-7 space-y-3">
              {['Relevant exchange work', 'Quote and award workflow', 'Driver allocation and live execution', 'POD and invoice-ready records'].map((x) => <div key={x} className="flex items-center gap-3 font-bold text-[#24416F]"><CheckCircle2 className="h-5 w-5 text-[#1F7A3D]" />{x}</div>)}
            </div>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden border border-[#D7E6FA] shadow-[0_25px_70px_rgba(0,43,108,0.12)]">
            <Image src="/xdrive-driver-workspace-real.webp" alt="XDrive courier workspace" fill className="object-cover" />
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:py-28" id="pricing">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">Membership</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Simple pricing. First 3 months free.</h2>
              <p className="mt-5 text-lg font-semibold leading-8 text-[#506889]">No percentage taken from the value of your job. After the free period, continue on the plan that matches your operation.</p>
            </div>
            <div className="bg-[#EAF7EE] px-5 py-3 text-sm font-black text-[#1F7A3D]">Launch offer: £0 for 3 months</div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.name} className={`relative flex min-h-[360px] flex-col border bg-white p-6 shadow-[0_18px_50px_rgba(0,43,108,0.08)] ${plan.featured ? 'border-[#003B8F] ring-2 ring-[#003B8F]/10' : 'border-[#D7E6FA]'}`}>
                {plan.featured && <div className="absolute right-0 top-0 bg-[#FDB913] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.13em]">Popular for brokers</div>}
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#003B8F]/60">{plan.name}</p>
                <div className="mt-5 flex items-end gap-1"><span className="text-4xl font-black">{plan.price}</span><span className="pb-1 text-sm font-bold text-[#587094]">/month</span></div>
                <p className="mt-3 text-sm font-semibold text-[#506889]">{plan.note}</p>
                <div className="mt-5 inline-flex w-fit bg-[#FFF8E6] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[#8A5B00]">First 3 months free</div>
                <div className="mt-auto pt-8">
                  <Link href="/register" className={`flex items-center justify-between px-4 py-3 text-sm font-black ${plan.featured ? 'bg-[#003B8F] text-white' : 'border border-[#003B8F]/20 text-[#003B8F]'}`}>Start free <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold text-[#587094]">Fleet 16–50 vehicles: £149.99/month · Enterprise: from £249.99/month · Full plan comparison would live on a dedicated pricing page.</p>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8" id="trust">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div className="flex h-20 w-20 items-center justify-center bg-[#EEF6FF] text-[#003B8F]"><Users className="h-9 w-9" /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">Why join early</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Use the platform before you pay for membership.</h2>
            <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-[#506889]">The three-month period gives drivers, carriers and brokers enough time to test real workflows before deciding whether XDrive deserves a permanent place in their operation.</p>
          </div>
        </div>
      </section>

      <section className="bg-[#002B6C] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FDB913]">Early access</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Join XDrive for 3 months free.</h2>
            <p className="mt-3 max-w-3xl font-semibold text-white/70">No XDrive commission on job value. No XDrive booking fee. One simple membership afterwards.</p>
          </div>
          <Link href="/register" className="inline-flex shrink-0 items-center gap-2 bg-[#FDB913] px-6 py-3.5 text-sm font-black text-[#002B6C]">Request Early Access <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </main>
  );
}
