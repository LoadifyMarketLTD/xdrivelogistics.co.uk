import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const plans = [
  { id: 'owner-driver', role: 'owner_operator', name: 'Owner Driver', price: '£29.99', suffix: '/ month + VAT', detail: '1 self-employed courier / owner driver', features: ['3 months free', 'Exchange access', 'Quote workflow', 'Awarded jobs', 'Live status & POD'] },
  { id: 'customer-shipper', role: 'customer_shipper', name: 'Customer / Shipper', price: '£29.99', suffix: '/ month + VAT', detail: 'Businesses posting and managing transport work', features: ['3 months free', 'Post transport work', 'Compare quotes', 'Award jobs', 'Track through POD'] },
  { id: 'small-carrier', role: 'fleet_operator', name: 'Small Carrier', price: '£59.99', suffix: '/ month + VAT', detail: '2–5 vehicle operations', features: ['3 months free', 'Exchange access', 'Driver allocation', 'Operational records', 'POD & invoice readiness'] },
  { id: 'broker', role: 'transport_broker', name: 'Broker', price: '£79.99', suffix: '/ month + VAT', detail: 'Posting and managing transport work for customers', features: ['3 months free', 'Post jobs', 'Compare quotes', 'Award work', 'Track through POD'], featured: true },
  { id: 'growing-carrier', role: 'fleet_operator', name: 'Growing Carrier', price: '£129.99', suffix: '/ month + VAT', detail: '6–15 vehicle operations', features: ['3 months free', 'Exchange access', 'Multi-driver operations', 'Dispatch workflow', 'POD & finance readiness'] },
  { id: 'fleet', role: 'fleet_operator', name: 'Fleet', price: '£249.99', suffix: '/ month + VAT', detail: '16–50 vehicle operations', features: ['3 months free', 'Fleet operations', 'Exchange & dispatch', 'POD records', 'Operational visibility'] },
  { id: 'enterprise', role: 'fleet_operator', name: 'Enterprise', price: 'Custom', suffix: 'pricing', detail: '51+ vehicles or custom transport operations', features: ['Commercial review', 'Custom operational scope', 'Larger user/fleet needs', 'Advanced onboarding', 'Commercial terms agreed separately'] },
] as const;

export default function PricingPage() {
  return <div className="min-h-screen bg-[#F4F6FA] text-[#102447]">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071B3C]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Link href="/"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link>
          <span className="hidden rounded-full border border-[#F5A300]/35 bg-[#F5A300]/10 px-3 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.1em] text-[#F5A300] md:inline-flex">3 Months Free</span>
        </div>
        <nav className="hidden items-center gap-6 text-sm font-black text-white/70 lg:flex"><Link href="/platform">Platform</Link><Link href="/brokers">Brokers</Link><Link href="/couriers">Couriers</Link><Link href="/pricing" className="text-[#F5A300]">Pricing</Link><Link href="/access">Access</Link><Link href="/login">Sign In</Link></nav>
        <Link href="/register" className="rounded-lg bg-[#F5A300] px-5 py-2.5 text-sm font-black text-[#071B3C]">Start 3 Months Free</Link>
      </div>
    </header>
    <main>
      <section className="bg-[#071B3C] px-5 py-20 text-white sm:px-8 lg:py-28"><div className="mx-auto max-w-[1240px]"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">XDrive Membership</p><h1 className="mt-5 max-w-5xl text-[3.2rem] font-black leading-[0.96] tracking-tight text-white sm:text-[4.8rem]">Simple pricing. First 3 months free.</h1><p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-white/78">No XDrive commission on the value of your job. No XDrive booking fee. After your free period, continue on the plan that matches your operation.</p><div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-8 text-sm font-bold leading-6 text-white/70"><p>Standard launch plans are monthly rolling after the free period. Public prices shown are exclusive of VAT unless expressly stated otherwise; VAT is added where legally applicable. There is no minimum paid term under the standard monthly launch model.</p><p className="mt-2">Enterprise pricing and launch terms are intentionally not published yet and will be agreed separately for 51+ vehicle or custom operations. See the <Link href="/subscription-terms" className="font-black text-[#F5A300] underline">Membership & Subscription Terms</Link> for renewal, cancellation and refund rules applying to standard memberships.</p></div></div></section>
      <section className="border-t border-[#DDE5EF] bg-gradient-to-b from-[#F8FAFD] to-[#EEF3F8] px-5 py-20 sm:px-8"><div className="mx-auto grid max-w-[1240px] gap-5 md:grid-cols-2 xl:grid-cols-3">{plans.map(plan => {
        const enterprise = plan.id === 'enterprise';
        const featured = 'featured' in plan && plan.featured;
        return <article key={plan.id} className={`relative flex min-h-[430px] flex-col overflow-hidden rounded-[24px] border p-8 text-white shadow-[0_20px_55px_rgba(7,27,60,0.14)] lg:p-9 ${featured ? 'border-[#F5A300] bg-gradient-to-br from-[#163568] to-[#0D2A56] ring-1 ring-[#F5A300]/25' : 'border-[#1B3D6B] bg-gradient-to-br from-[#163568] to-[#102B55]'}`}>
          {featured ? <div className="absolute right-0 top-0 rounded-bl-xl bg-[#F5A300] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#071B3C]">Broker plan</div> : null}
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">XDrive Membership</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{plan.name}</h2>
          <div className="mt-5 text-4xl font-black text-white">{plan.price}<span className="ml-2 text-sm font-bold text-white/55">{plan.suffix}</span></div>
          <p className="mt-3 min-h-[42px] text-sm font-semibold leading-6 text-white/70">{plan.detail}</p>
          <div className="mt-4 inline-flex w-fit rounded-full border border-[#F5A300]/30 bg-[#F5A300]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#F5A300]">{enterprise ? 'Commercial review' : 'First 3 months free'}</div>
          <div className="mt-7 grid gap-3 border-t border-white/10 pt-6">{plan.features.map(feature => <div key={feature} className="flex items-start gap-3 text-sm font-bold text-white/82"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A300]" />{feature}</div>)}</div>
          <Link href={enterprise ? '/contact' : `/register?role=${plan.role}&plan=${plan.id}`} className={`mt-auto flex items-center justify-between rounded-xl px-4 py-3 text-sm font-black ${featured ? 'bg-[#F5A300] text-[#071B3C]' : 'border border-white/15 bg-white/[0.035] text-white'}`}>{enterprise ? 'Contact XDrive' : 'Apply for free access'} <ArrowRight className="h-4 w-4" /></Link>
        </article>;
      })}</div><div className="mx-auto mt-10 grid max-w-[1240px] gap-5 lg:grid-cols-2"><div className="rounded-[24px] border border-[#1B3D6B] bg-gradient-to-br from-[#163568] to-[#102B55] p-8 text-white shadow-[0_20px_55px_rgba(7,27,60,0.12)] lg:p-9"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Launch Offer</p><h2 className="mt-3 text-3xl font-black text-white">What makes the launch offer different?</h2><p className="mt-4 font-semibold leading-7 text-white/70">Eligible standard launch memberships include three months of access before paid membership begins. The platform does not take a percentage of your transport fee and does not add an XDrive booking fee to the job.</p></div><div className="rounded-[24px] border border-[#1B3D6B] bg-gradient-to-br from-[#163568] to-[#102B55] p-8 text-white shadow-[0_20px_55px_rgba(7,27,60,0.12)] lg:p-9"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Membership Terms</p><h2 className="mt-3 text-3xl font-black text-white">Cancellation and renewal</h2><p className="mt-4 font-semibold leading-7 text-white/70">Standard launch membership is monthly rolling after the free period. Cancel future renewal through the available account process or by contacting XDrive if self-service cancellation is unavailable. Any mandatory statutory rights continue to apply where relevant.</p><Link href="/subscription-terms" className="mt-5 inline-flex items-center gap-2 font-black text-[#F5A300]">Read membership terms <ArrowRight className="h-4 w-4" /></Link></div></div></section>
    </main>
  </div>;
}
