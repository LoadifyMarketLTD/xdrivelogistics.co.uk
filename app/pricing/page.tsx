import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const plans = [
  { id: 'owner-driver', role: 'owner_operator', name: 'Owner Driver', price: '£29.99', suffix: '/ month + VAT', detail: '1 self-employed courier / owner driver', features: ['3 months free', 'Exchange access', 'Quote workflow', 'Awarded jobs', 'Live status & POD'] },
  { id: 'customer-shipper', role: 'customer_shipper', name: 'Customer / Shipper', price: '£29.99', suffix: '/ month + VAT', detail: 'Businesses posting and managing transport work', features: ['3 months free', 'Post transport work', 'Compare quotes', 'Award jobs', 'Track through POD'] },
  { id: 'small-carrier', role: 'fleet_operator', name: 'Small Carrier', price: '£59.99', suffix: '/ month + VAT', detail: '2–5 vehicle operations', features: ['3 months free', 'Exchange access', 'Driver allocation', 'Operational records', 'POD & invoice readiness'] },
  { id: 'broker', role: 'transport_broker', name: 'Broker', price: '£79.99', suffix: '/ month + VAT', detail: 'Posting and managing transport work for customers', features: ['3 months free', 'Post jobs', 'Compare quotes', 'Award work', 'Track through POD'] },
  { id: 'growing-carrier', role: 'fleet_operator', name: 'Growing Carrier', price: '£129.99', suffix: '/ month + VAT', detail: '6–15 vehicle operations', features: ['3 months free', 'Exchange access', 'Multi-driver operations', 'Dispatch workflow', 'POD & finance readiness'] },
  { id: 'fleet', role: 'fleet_operator', name: 'Fleet', price: '£249.99', suffix: '/ month + VAT', detail: '16–50 vehicle operations', features: ['3 months free', 'Fleet operations', 'Exchange & dispatch', 'POD records', 'Operational visibility'] },
  { id: 'enterprise', role: 'fleet_operator', name: 'Enterprise', price: 'Custom', suffix: 'pricing', detail: '51+ vehicles or custom transport operations', features: ['Commercial review', 'Custom operational scope', 'Larger user/fleet needs', 'Advanced onboarding', 'Commercial terms agreed separately'] },
] as const;

const footerGroups = [
  { title: 'Platform', links: [['Platform','/platform'],['Exchange','/exchange'],['How It Works','/how-it-works'],['Customers','/customers'],['Brokers','/brokers'],['Couriers','/couriers']] },
  { title: 'Product', links: [['Operations Diary','/operations-diary'],['Courier Workspace','/courier-workspace'],['POD & Records','/pod-records'],['Finance','/finance']] },
  { title: 'Account', links: [['Pricing','/pricing'],['Request Access','/register'],['Sign In','/login'],['Access','/access'],['Help & FAQ','/help']] },
  { title: 'Company', links: [['Contact','/contact'],['Privacy','/privacy'],['Terms','/terms'],['Subscription Terms','/subscription-terms'],['Acceptable Use','/acceptable-use'],['Cookies','/cookies'],['Complaints','/complaints']] },
] as const;

function PlanCard({ plan }: { plan: typeof plans[number] }) {
  const enterprise = plan.id === 'enterprise';
  return <article className="relative flex min-h-[410px] flex-col overflow-hidden rounded-[24px] border border-[#F5A300] bg-gradient-to-br from-[#173B73] to-[#0E2D5A] p-6 text-white shadow-[0_18px_45px_rgba(7,27,60,0.12)] ring-1 ring-[#F5A300]/25 xl:p-7">
    <div className="absolute right-0 top-0 rounded-bl-xl bg-[#F5A300] px-3.5 py-2 text-[0.64rem] font-black uppercase tracking-[0.12em] text-[#071B3C]">{plan.name} plan</div>
    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#F5A300]">XDrive Membership</p>
    <h2 className="mt-3 text-[1.35rem] font-black tracking-tight text-white">{plan.name}</h2>
    <div className="mt-5 text-[2rem] font-black leading-none text-white">{plan.price}<span className="ml-2 text-[0.72rem] font-bold text-white/55">{plan.suffix}</span></div>
    <p className="mt-3 min-h-[42px] text-[0.78rem] font-semibold leading-5 text-white/70">{plan.detail}</p>
    <div className="mt-4 inline-flex w-fit rounded-full border border-[#F5A300]/30 bg-[#F5A300]/10 px-3 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.08em] text-[#F5A300]">{enterprise ? 'Commercial review' : 'First 3 months free'}</div>
    <div className="mt-6 grid gap-2.5 border-t border-white/10 pt-5">{plan.features.map(feature => <div key={feature} className="flex items-start gap-2.5 text-[0.76rem] font-bold leading-5 text-white/82"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F5A300]" />{feature}</div>)}</div>
    <Link href={enterprise ? '/contact' : `/register?role=${plan.role}&plan=${plan.id}`} className="mt-auto flex items-center justify-between rounded-xl bg-[#F5A300] px-4 py-3 text-[0.78rem] font-black text-[#071B3C]">{enterprise ? 'Contact XDrive' : 'Apply for free access'} <ArrowRight className="h-4 w-4" /></Link>
  </article>;
}

export default function PricingPage() {
  return <div className="min-h-screen bg-[#F4F6FA] text-[#102447]">
    <header className="sticky top-0 z-50 border-b border-[#DDE5EF] bg-white/95 text-[#163568] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3"><Link href="/"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link><span className="hidden rounded-full border border-[#F5A300]/35 bg-[#FFF7E5] px-3 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.1em] text-[#A56B00] md:inline-flex">3 Months Free</span></div>
        <nav className="hidden items-center gap-6 text-sm font-black text-[#163568] lg:flex"><Link href="/platform" className="transition hover:text-[#0E3FA9]">Platform</Link><Link href="/brokers" className="transition hover:text-[#0E3FA9]">Brokers</Link><Link href="/couriers" className="transition hover:text-[#0E3FA9]">Couriers</Link><Link href="/pricing" className="text-[#F5A300]">Pricing</Link><Link href="/access" className="transition hover:text-[#0E3FA9]">Access</Link><Link href="/login" className="transition hover:text-[#0E3FA9]">Sign In</Link></nav>
        <Link href="/register" className="rounded-lg bg-[#163568] px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(22,53,104,0.14)]">Start 3 Months Free</Link>
      </div>
    </header>

    <main>
      <section className="bg-gradient-to-br from-[#173B73] to-[#0E2D5A] px-5 py-16 text-white sm:px-8 lg:py-20"><div className="mx-auto max-w-[1240px]"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">XDrive Membership</p><h1 className="mt-5 max-w-5xl text-[3.2rem] font-black leading-[0.96] tracking-tight sm:text-[4.8rem]">Simple pricing. First 3 months free.</h1><p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-white/78">No XDrive commission on the value of your job. No XDrive booking fee. After your free period, continue on the plan that matches your operation.</p><div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-6 text-sm font-bold leading-6 text-white/70"><p>Standard launch plans are monthly rolling after the free period. Public prices shown are exclusive of VAT unless expressly stated otherwise; VAT is added where legally applicable. There is no minimum paid term under the standard monthly launch model.</p><p className="mt-2">Enterprise pricing and launch terms are intentionally not published yet and will be agreed separately for 51+ vehicle or custom operations. See the <Link href="/subscription-terms" className="font-black text-[#F5A300] underline">Membership & Subscription Terms</Link> for renewal, cancellation and refund rules applying to standard memberships.</p></div></div></section>

      <section className="border-t border-[#DDE5EF] bg-gradient-to-b from-[#F8FAFD] to-[#EEF3F8] px-5 py-14 sm:px-8 lg:py-16">
        <div className="mx-auto grid max-w-[1440px] gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
          <article className="relative flex min-h-[410px] flex-col overflow-hidden rounded-[24px] border border-[#F5A300] bg-gradient-to-br from-[#173B73] to-[#0E2D5A] p-6 text-white shadow-[0_18px_45px_rgba(7,27,60,0.12)] ring-1 ring-[#F5A300]/25 xl:p-7">
            <div className="absolute right-0 top-0 rounded-bl-xl bg-[#F5A300] px-3.5 py-2 text-[0.64rem] font-black uppercase tracking-[0.12em] text-[#071B3C]">Launch offer</div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#F5A300]">Launch Offer</p>
            <h2 className="mt-3 text-[1.35rem] font-black tracking-tight">Why launch with XDrive?</h2>
            <p className="mt-4 text-[0.78rem] font-semibold leading-5 text-white/70">Start with three months free on eligible standard plans, then continue monthly with no XDrive commission on job value and no XDrive booking fee.</p>
            <div className="mt-6 grid gap-2.5 border-t border-white/10 pt-5"><div className="flex gap-2.5 text-[0.76rem] font-bold text-white/82"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F5A300]" />3 months free</div><div className="flex gap-2.5 text-[0.76rem] font-bold text-white/82"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F5A300]" />No XDrive commission</div><div className="flex gap-2.5 text-[0.76rem] font-bold text-white/82"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F5A300]" />No booking fee</div><div className="flex gap-2.5 text-[0.76rem] font-bold text-white/82"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F5A300]" />Monthly rolling after trial</div></div>
            <Link href="/access" className="mt-auto flex items-center justify-between rounded-xl bg-[#F5A300] px-4 py-3 text-[0.78rem] font-black text-[#071B3C]">See access model <ArrowRight className="h-4 w-4" /></Link>
          </article>
        </div>

        <div className="mx-auto mt-6 grid max-w-[1440px] gap-5 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[24px] border border-[#F5A300] bg-gradient-to-br from-[#173B73] to-[#0E2D5A] p-7 text-white shadow-[0_18px_45px_rgba(7,27,60,0.10)] ring-1 ring-[#F5A300]/25"><div className="absolute right-0 top-0 rounded-bl-xl bg-[#F5A300] px-3.5 py-2 text-[0.64rem] font-black uppercase tracking-[0.12em] text-[#071B3C]">Membership terms</div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Membership Terms</p><h2 className="mt-3 text-2xl font-black">Cancellation and renewal</h2><p className="mt-4 font-semibold leading-7 text-white/70">Standard launch membership is monthly rolling after the free period. Cancel future renewal through the available account process or by contacting XDrive if self-service cancellation is unavailable.</p><Link href="/subscription-terms" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#F5A300] px-4 py-3 font-black text-[#071B3C]">Read membership terms <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="relative overflow-hidden rounded-[24px] border border-[#F5A300] bg-gradient-to-br from-[#173B73] to-[#0E2D5A] p-7 text-white shadow-[0_18px_45px_rgba(7,27,60,0.10)] ring-1 ring-[#F5A300]/25"><div className="absolute right-0 top-0 rounded-bl-xl bg-[#F5A300] px-3.5 py-2 text-[0.64rem] font-black uppercase tracking-[0.12em] text-[#071B3C]">Commercial clarity</div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Commercial Clarity</p><h2 className="mt-3 text-2xl font-black">Clear pricing. Clear operating model.</h2><p className="mt-4 font-semibold leading-7 text-white/70">Public standard-plan prices are exclusive of VAT unless stated otherwise. Enterprise pricing is agreed separately for 51+ vehicle or custom operations.</p><Link href="/contact" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#F5A300] px-4 py-3 font-black text-[#071B3C]">Contact XDrive <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>
    </main>

    <footer className="relative border-t border-[#DDE5EF] bg-white px-5 pt-12 sm:px-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#163568]" />
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-10 pb-10 xl:grid-cols-[1.15fr_2.85fr]">
          <div>
            <Link href="/" className="inline-flex"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} className="h-[46px] w-auto" /></Link>
            <p className="mt-4 text-base font-black text-[#163568]">Courier &amp; Freight Exchange Platform</p>
            <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-[#60758F]">Posted work, courier quotes, awarded jobs, dispatch, POD and invoice readiness in one controlled workflow.</p>
            <div className="mt-5 rounded-[24px] border border-[#1B3D6B] bg-gradient-to-br from-[#163568] to-[#102B55] p-5 text-sm font-bold leading-6 text-[#D8E4F3] shadow-[0_18px_45px_rgba(7,27,60,0.12)]">
              <p className="font-black text-white">XDrive Logistics Ltd.</p>
              <p>Company No. 13171804</p>
              <p>Registered in England and Wales</p>
              <p>Registered office: 101 Cornelian Street, Blackburn, England, BB1 9QL</p>
              <p>VAT No. GB 375949535</p>
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{footerGroups.map(group => <div key={group.title}><h2 className="text-[0.72rem] font-black uppercase tracking-[0.19em] text-[#F5A300]">{group.title}</h2><div className="mt-5 grid gap-3 text-sm font-black text-[#163568]">{group.links.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-[#0E3FA9]">{label}</Link>)}</div></div>)}</div>
        </div>
      </div>
      <div className="-mx-5 border-t border-white/10 bg-gradient-to-br from-[#163568] to-[#102B55] px-5 py-5 text-xs font-bold leading-5 text-white/[0.78] sm:-mx-8 sm:px-8">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-white/[0.78]">XDrive operates the platform as an intermediary unless it expressly contracts to provide a transport service itself. No client funds are held by XDrive under the current platform model.</p>
          <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-white/[0.78]">© 2021 XDrive Logistics Ltd. All Rights Reserved.</p>
            <p className="font-black text-white">Move Freight. Manage Operations. <span className="text-[#F5A300]">Grow Your Network.</span></p>
          </div>
        </div>
      </div>
    </footer>
  </div>;
}