import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const plans = [
  { name: 'Owner Driver', price: '£29.99', detail: '1 self-employed courier / owner driver', features: ['3 months free', 'Exchange access', 'Quote workflow', 'Awarded jobs', 'Live status & POD'] },
  { name: 'Small Carrier', price: '£59.99', detail: '2–5 vehicle operations', features: ['3 months free', 'Exchange access', 'Driver allocation', 'Operational records', 'POD & invoice readiness'] },
  { name: 'Broker', price: '£79.99', detail: 'Posting and managing transport work', features: ['3 months free', 'Post jobs', 'Compare quotes', 'Award work', 'Track through POD'], featured: true },
  { name: 'Growing Carrier', price: '£89.99', detail: '6–15 vehicle operations', features: ['3 months free', 'Exchange access', 'Multi-driver operations', 'Dispatch workflow', 'POD & finance readiness'] },
  { name: 'Fleet', price: '£149.99', detail: '16–50 vehicle operations', features: ['3 months free', 'Fleet operations', 'Exchange & dispatch', 'POD records', 'Operational visibility'] },
  { name: 'Enterprise', price: 'From £249.99', detail: 'Larger or custom transport operations', features: ['3 months free', 'Custom operational scope', 'Larger user/fleet needs', 'Advanced onboarding', 'Commercial review'] },
] as const;

export default function PricingPage() {
  return <div className="min-h-screen bg-[#F7F9FC] text-[#102447]">
    <header className="sticky top-0 z-50 border-b border-[#E2E8F1] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link href="/"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link>
        <nav className="hidden items-center gap-6 text-sm font-black text-[#48607E] lg:flex"><Link href="/platform">Platform</Link><Link href="/brokers">Brokers</Link><Link href="/couriers">Couriers</Link><Link href="/pricing">Pricing</Link><Link href="/access">Access</Link><Link href="/login">Sign In</Link></nav>
        <Link href="/register" className="bg-[#0E3FA9] px-5 py-2.5 text-sm font-black text-white">Start Free</Link>
      </div>
    </header>
    <main>
      <section className="bg-white px-5 py-20 sm:px-8 lg:py-28"><div className="mx-auto max-w-[1240px]"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">XDrive Membership</p><h1 className="mt-5 max-w-5xl text-[3.2rem] font-black leading-[0.96] tracking-tight text-[#0A234F] sm:text-[4.8rem]">Simple pricing. First 3 months free.</h1><p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-[#516987]">No XDrive commission on the value of your job. No XDrive booking fee. After your free period, continue on the plan that matches your operation.</p></div></section>
      <section className="px-5 py-20 sm:px-8"><div className="mx-auto grid max-w-[1240px] gap-5 md:grid-cols-2 xl:grid-cols-3">{plans.map(plan => <article key={plan.name} className={`relative flex min-h-[430px] flex-col rounded-2xl border bg-white p-7 shadow-[0_18px_50px_rgba(8,38,86,0.06)] ${'featured' in plan && plan.featured ? 'border-[#0E3FA9] ring-2 ring-[#0E3FA9]/10' : 'border-[#E2E8F1]'}`}>{'featured' in plan && plan.featured ? <div className="absolute right-0 top-0 rounded-bl-xl bg-[#F5A300] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#0A234F]">Broker plan</div> : null}<p className="text-xs font-black uppercase tracking-[0.14em] text-[#5D7594]">{plan.name}</p><div className="mt-5 text-4xl font-black text-[#0A234F]">{plan.price}<span className="text-sm font-bold text-[#6A7C95]"> / month</span></div><p className="mt-3 text-sm font-semibold text-[#60758F]">{plan.detail}</p><div className="mt-4 inline-flex w-fit rounded-full bg-[#FFF5DB] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#8A6100]">First 3 months free</div><div className="mt-6 grid gap-3">{plan.features.map(feature => <div key={feature} className="flex items-start gap-3 text-sm font-bold text-[#385475]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1E7A43]" />{feature}</div>)}</div><Link href="/register" className={`mt-auto flex items-center justify-between rounded-lg px-4 py-3 text-sm font-black ${'featured' in plan && plan.featured ? 'bg-[#0E3FA9] text-white' : 'border border-[#D8E1ED] text-[#0E3FA9]'}`}>Start free <ArrowRight className="h-4 w-4" /></Link></article>)}</div><div className="mx-auto mt-10 max-w-[1240px] rounded-2xl bg-gradient-to-br from-[#071B3C] to-[#0B2F6B] p-7 text-white sm:p-9"><h2 className="text-3xl font-black">What makes the launch offer different?</h2><p className="mt-4 max-w-3xl font-semibold leading-7 text-white/70">You get three months to use XDrive before paid membership begins. The platform does not take a percentage of your transport fee and does not add an XDrive booking fee to the job.</p></div></section>
    </main>
  </div>;
}
