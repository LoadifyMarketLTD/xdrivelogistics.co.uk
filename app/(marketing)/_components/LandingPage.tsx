import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, LockKeyhole, Menu, ShieldCheck } from 'lucide-react';
import { WhatsNextSection } from './sections/WhatsNextSection';

const mainNav = [
  { label: 'Platform', href: '/platform' },
  { label: 'Brokers', href: '/brokers' },
  { label: 'Couriers', href: '/couriers' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Access', href: '/access' },
] as const;

const footerGroups = [
  {
    title: 'Platform',
    links: [
      { label: 'Platform', href: '/platform' },
      { label: 'Exchange', href: '/exchange' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Customers', href: '/customers' },
      { label: 'Brokers', href: '/brokers' },
      { label: 'Couriers', href: '/couriers' },
    ],
  },
  {
    title: 'Product',
    links: [
      { label: 'Operations Diary', href: '/operations-diary' },
      { label: 'Courier Workspace', href: '/courier-workspace' },
      { label: 'POD & Records', href: '/pod-records' },
      { label: 'Finance', href: '/finance' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'Request Access', href: '/register' },
      { label: 'Sign In', href: '/login' },
      { label: 'Access', href: '/access' },
      { label: 'Help & FAQ', href: '/help' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Subscription Terms', href: '/subscription-terms' },
      { label: 'Acceptable Use', href: '/acceptable-use' },
      { label: 'Cookies', href: '/cookies' },
      { label: 'Complaints', href: '/complaints' },
    ],
  },
] as const;

const plans = [
  { name: 'Owner Driver', price: '£29.99', suffix: '/ month', note: 'Self-employed courier', featured: false },
  { name: 'Customer / Shipper', price: '£29.99', suffix: '/ month', note: 'Businesses posting transport work', featured: false },
  { name: 'Small Carrier', price: '£59.99', suffix: '/ month', note: '2–5 vehicle operations', featured: false },
  { name: 'Broker', price: '£79.99', suffix: '/ month', note: 'Post and manage customer work', featured: true },
  { name: 'Growing Carrier', price: '£129.99', suffix: '/ month', note: '6–15 vehicle operations', featured: false },
  { name: 'Fleet', price: '£249.99', suffix: '/ month', note: '16–50 vehicle operations', featured: false },
  { name: 'Enterprise', price: 'Custom', suffix: 'pricing', note: '51+ vehicles / custom operations', featured: false },
] as const;

const operations = [
  { label: 'Posted work', value: 'POST' },
  { label: 'Carrier offers', value: 'QUOTE' },
  { label: 'Award decision', value: 'AWARD' },
  { label: 'Delivery proof', value: 'POD' },
] as const;

const featureLayers = [
  { index: '01', kicker: 'Exchange', title: 'Find and post work', copy: 'Match courier and freight demand with real transport capacity.' },
  { index: '02', kicker: 'Commercial', title: 'Quote and award', copy: 'Keep offers, decisions and the awarded job in one traceable record.' },
  { index: '03', kicker: 'Operations', title: 'Dispatch and track', copy: 'Allocate drivers, progress live status and manage exceptions.' },
  { index: '04', kicker: 'Completion', title: 'POD and finance', copy: 'Return evidence and retain invoice-ready context after delivery.' },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#102447]">
      <header className="sticky top-0 z-50 border-b border-[#E2E8F1] bg-white/95 shadow-[0_8px_30px_rgba(7,27,60,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link>
            <Link href="/pricing" className="hidden rounded-full border border-[#F1D89F] bg-[#FFF7E5] px-3 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.1em] text-[#8A6100] md:inline-flex">3 Months Free</Link>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-black text-[#48607E] xl:flex">
            {mainNav.map(item => <Link key={item.href} href={item.href} className="transition hover:text-[#0E3FA9]">{item.label}</Link>)}
            <Link href="/login" className="transition hover:text-[#0E3FA9]">Sign In</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/register" className="hidden rounded-lg bg-[#0E3FA9] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(14,63,169,0.18)] sm:inline-flex">Start Free</Link>
            <details className="group relative xl:hidden"><summary className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[#E2E8F1] bg-white text-[#0E3FA9] [&::-webkit-details-marker]:hidden"><Menu className="h-5 w-5" /></summary><div className="absolute right-0 top-12 w-[285px] rounded-xl border border-[#E2E8F1] bg-white p-3 text-sm font-black text-[#0E3FA9] shadow-[0_24px_60px_rgba(7,27,60,0.18)]"><div className="mb-2 rounded-lg bg-[#FFF7E5] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#8A6100]">Early Access · 3 Months Free</div>{mainNav.map(item => <Link key={item.href} href={item.href} className="block border-b border-[#E2E8F1] px-3 py-3 last:border-b-0">{item.label}</Link>)}<Link href="/login" className="block border-b border-[#E2E8F1] px-3 py-3">Sign In</Link><Link href="/register" className="mt-3 flex items-center justify-between rounded-lg bg-[#0E3FA9] px-3 py-3 text-white">Start 3 Months Free <ArrowRight className="h-4 w-4" /></Link></div></details>
          </div>
        </div>
      </header>

      <main>
        <section id="platform" className="relative overflow-hidden bg-gradient-to-b from-white to-[#F6F9FE] px-5 py-20 sm:px-8 lg:py-28">
          <div className="absolute -right-44 top-14 h-[430px] w-[430px] rounded-full border border-[#0E3FA9]/10 shadow-[0_0_0_70px_rgba(14,63,169,0.025),0_0_0_140px_rgba(14,63,169,0.018)]" />
          <div className="relative mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-[#F1D89F] bg-[#FFF7E5] px-4 py-2 text-xs font-black uppercase tracking-[0.13em] text-[#8A6100]">Early Access · 3 Months Free</div>
              <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Courier & Freight Exchange Platform</p>
              <h1 className="mt-4 text-[3.2rem] font-black leading-[0.94] tracking-tight text-[#071B3C] sm:text-[4.6rem] lg:text-[5.2rem]">Transport operations, connected from quote to POD.</h1>
              <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-[#48617D]">XDrive brings brokers, customers, carriers and owner drivers into one connected transport workflow — where work can be posted, quoted, awarded, dispatched, tracked and completed without breaking the chain.</p>
              <div className="mt-9 flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#0E3FA9] px-6 py-3.5 text-sm font-black text-white">Start 3 Months Free <ArrowRight className="h-4 w-4" /></Link><Link href="/platform" className="rounded-lg border border-[#D8E1ED] bg-white px-6 py-3.5 text-sm font-black text-[#0E3FA9]">Explore XDrive</Link></div>
              <div className="mt-7 flex flex-wrap gap-5 text-sm font-black text-[#385475]"><span>✓ No XDrive commission</span><span>✓ No booking fee</span><span>✓ Monthly rolling</span></div>
            </div>

            <div className="relative pb-10">
              <div className="overflow-hidden rounded-[24px] border border-[#D8E1ED] bg-white shadow-[0_40px_100px_rgba(7,27,60,0.17)]">
                <div className="flex h-11 items-center justify-between border-b border-[#E2E8F1] bg-[#F6F8FC] px-4"><div className="flex gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#C2CCDA]" /><span className="h-2.5 w-2.5 rounded-full bg-[#C2CCDA]" /><span className="h-2.5 w-2.5 rounded-full bg-[#C2CCDA]" /></div><span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#6A7C95]">XDrive Product Preview</span></div>
                <div className="grid min-h-[430px] grid-cols-[150px_1fr]">
                  <aside className="bg-gradient-to-b from-[#0B2F6B] to-[#071B3C] p-4 text-white"><p className="mb-6 font-black">XD · XDrive</p>{['Overview','Exchange','Quotes','Awarded','Dispatch','Tracking','POD','Finance'].map((item,i)=><div key={item} className={`mb-1 rounded-lg px-3 py-2 text-xs font-bold ${i===0?'bg-[#1D57D8] text-white':'text-white/70'}`}>{item}</div>)}</aside>
                  <div className="bg-[#F8FAFD] p-4"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-[#071B3C]">Workflow Preview</h2><span className="rounded-full bg-[#EEF3FA] px-3 py-1.5 text-[0.65rem] font-black text-[#516987]">ILLUSTRATIVE</span></div><p className="mt-2 text-[0.62rem] font-bold text-[#7A8DA4]">Example data shown to illustrate the intended XDrive workflow.</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{operations.map(item=><div key={item.label} className="rounded-xl border border-[#E2E8F1] bg-white p-3"><p className="text-[0.62rem] font-black text-[#6A7C95]">{item.label}</p><p className="mt-1 text-base font-black text-[#071B3C]">{item.value}</p></div>)}</div><div className="mt-3 grid gap-3 md:grid-cols-[1.05fr_0.95fr]"><div className="rounded-xl border border-[#E2E8F1] bg-white p-3"><p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#607695]">Example work</p>{[['Manchester → Birmingham','Example · LWB','£315'],['Leeds → London','Example · Luton','£650'],['Glasgow → Milton Keynes','Example · MWB','£420']].map(row=><div key={row[0]} className="flex items-center justify-between border-b border-[#EEF2F6] py-3 last:border-b-0"><div><p className="text-xs font-black">{row[0]}</p><p className="mt-1 text-[0.62rem] font-bold text-[#6A7C95]">{row[1]}</p></div><span className="text-xs font-black">{row[2]}</span></div>)}</div><div className="rounded-xl border border-[#E2E8F1] bg-gradient-to-br from-[#EDF4FC] to-[#DCE9F8] p-3"><p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#607695]">Network preview</p><div className="mt-3 h-[190px] rounded-lg bg-[radial-gradient(circle_at_25%_35%,rgba(29,87,216,.14),transparent_18%),radial-gradient(circle_at_70%_62%,rgba(245,163,0,.14),transparent_16%)]" /></div></div></div>
                </div>
              </div>
              <div className="absolute -bottom-2 right-0 rounded-xl bg-gradient-to-br from-[#F5A300] to-[#FFB824] px-5 py-4 text-white shadow-[0_20px_45px_rgba(245,163,0,0.24)]"><p className="text-xs font-black">Launch offer</p><p className="mt-1 text-2xl font-black">£0 for 3 months</p><p className="text-xs font-bold">Then from £29.99/month + VAT</p></div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:py-24"><div className="mx-auto max-w-[1240px]"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">One network. Four layers.</p><h2 className="mt-3 text-4xl font-black tracking-tight text-[#071B3C] sm:text-5xl">More than a load board.</h2><p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-[#60758F]">XDrive connects the commercial side of transport with the operational side, so the job stays in one controlled flow from opportunity to completion.</p><div className="mt-10 grid border-y border-[#E2E8F1] md:grid-cols-2 xl:grid-cols-4">{featureLayers.map((item,i)=><article key={item.index} className={`p-6 ${i<3?'xl:border-r xl:border-[#E2E8F1]':''}`}><p className="text-xs font-black tracking-[0.12em] text-[#F5A300]">{item.index} · {item.kicker.toUpperCase()}</p><h3 className="mt-3 text-xl font-black text-[#071B3C]">{item.title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-[#60758F]">{item.copy}</p></article>)}</div></div></section>

        <section id="brokers" className="bg-gradient-to-br from-[#071B3C] to-[#0B2F6B] px-5 py-20 text-white sm:px-8 lg:py-24"><div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">For Brokers & Customers</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Post. Compare. Award. Stay in control.</h2><p className="mt-5 text-lg font-semibold leading-8 text-white/70">The job does not disappear after award. XDrive carries it forward into dispatch, tracking and POD.</p><div className="mt-7 grid gap-3 text-sm font-bold text-white/80">{['Post with exact requirements','Compare carrier offers in one place','Award directly into operations','Track through completion'].map(x=><div key={x} className="flex gap-3"><CheckCircle2 className="h-4 w-4 text-[#30B167]" />{x}</div>)}</div><Link href="/brokers" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-black text-[#0B2F6B]">Explore XDrive for Brokers <ArrowRight className="h-4 w-4" /></Link></div><div className="rounded-2xl bg-white p-5 text-[#102447] shadow-[0_30px_80px_rgba(0,0,0,0.18)]"><div className="flex items-center justify-between"><h3 className="font-black">Quote Comparison · Example</h3><span className="rounded-full bg-[#EEF3FA] px-3 py-1.5 text-[0.65rem] font-black text-[#516987]">ILLUSTRATIVE</span></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-[#E2E8F1] p-4">{[['Route','Leeds → London'],['Vehicle','Luton'],['Collection','09:30'],['POD required','Yes']].map(row=><div key={row[0]} className="flex justify-between border-b border-[#EEF2F6] py-3 text-xs last:border-b-0"><span>{row[0]}</span><b>{row[1]}</b></div>)}</div><div className="rounded-xl border border-[#E2E8F1] p-4">{[['Carrier A','£640'],['Carrier B','£655'],['Carrier C','£695']].map(row=><div key={row[0]} className="flex justify-between border-b border-[#EEF2F6] py-3 text-xs"><span>{row[0]}</span><b>{row[1]}</b></div>)}<div className="mt-3 rounded-lg bg-[#1E7A43] py-2.5 text-center text-xs font-black text-white">Example award £640</div></div></div></div></div></section>

        <section id="couriers" className="bg-white px-5 py-20 sm:px-8 lg:py-24"><div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center"><div className="rounded-2xl border border-[#E2E8F1] bg-[#F8FAFD] p-5 shadow-[0_20px_60px_rgba(8,38,86,0.08)]"><div className="flex items-center justify-between"><h3 className="font-black">Example Job · Leeds → London</h3><span className="rounded-full bg-[#EEF3FA] px-3 py-1.5 text-[0.65rem] font-black text-[#516987]">WORKFLOW EXAMPLE</span></div><div className="mt-4 grid gap-2 sm:grid-cols-4">{[['STEP 1','Awarded','done'],['STEP 2','Driver allocated','done'],['STEP 3','In transit','active'],['STEP 4','Delivered / POD','']].map(row=><div key={row[0]} className={`rounded-xl border bg-white p-4 ${row[2]==='done'?'border-[#CDE8D6] bg-[#F7FCF8]':row[2]==='active'?'border-2 border-[#0E3FA9]':'border-[#E2E8F1]'}`}><p className="text-[0.62rem] font-black text-[#6A7C95]">{row[0]}</p><p className="mt-2 text-sm font-black">{row[1]}</p></div>)}</div></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">For Owner Drivers & Carriers</p><h2 className="mt-4 text-4xl font-black tracking-tight text-[#071B3C] sm:text-5xl">Find work. Quote quickly. Execute professionally.</h2><p className="mt-5 text-lg font-semibold leading-8 text-[#60758F]">Move from suitable work to awarded jobs and operational execution without leaving the XDrive workflow.</p><div className="mt-7 grid gap-3 text-sm font-bold text-[#385475]">{['See jobs that fit your vehicle capability','Quote directly from the exchange','Receive awarded work into operations','Return status and POD'].map(x=><div key={x} className="flex gap-3"><CheckCircle2 className="h-4 w-4 text-[#1E7A43]" />{x}</div>)}</div><Link href="/couriers" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0E3FA9] px-5 py-3 text-sm font-black text-white">Explore XDrive for Couriers <ArrowRight className="h-4 w-4" /></Link></div></div></section>

        <section id="pricing" className="bg-gradient-to-b from-[#F7F9FC] to-[#EEF4FB] px-5 py-20 sm:px-8 lg:py-24"><div className="mx-auto max-w-[1240px]"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Early Access Membership</p><h2 className="mt-3 text-4xl font-black tracking-tight text-[#071B3C] sm:text-5xl">Three months to prove the value.</h2><p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-[#60758F]">No XDrive commission on job value. No booking fee. Monthly rolling membership after the free period.</p></div><Link href="/pricing" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#0E3FA9] px-5 py-3 text-sm font-black text-white">View all plans <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{plans.map(plan=><article key={plan.name} className={`relative flex min-h-[230px] flex-col rounded-2xl border bg-white p-6 shadow-[0_16px_40px_rgba(8,38,86,0.05)] ${plan.featured?'border-[#0E3FA9] ring-2 ring-[#0E3FA9]/10':'border-[#E2E8F1]'}`}>{plan.featured?<span className="absolute right-0 top-0 rounded-bl-xl bg-[#F5A300] px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.1em]">Broker</span>:null}<p className="text-xs font-black uppercase tracking-[0.12em] text-[#5D7594]">{plan.name}</p><p className="mt-4 text-3xl font-black text-[#071B3C]">{plan.price}<span className="text-xs font-bold text-[#6A7C95]"> {plan.suffix}</span></p><p className="mt-2 text-sm font-semibold text-[#60758F]">{plan.note}</p><div className="mt-4 w-fit rounded-full bg-[#FFF5DB] px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#8A6100]">First 3 months free</div></article>)}</div><p className="mt-5 text-sm font-bold text-[#60758F]">Public monthly prices are exclusive of VAT; VAT is added where legally applicable. Enterprise pricing is agreed separately after commercial review.</p></div></section>

        <WhatsNextSection />

        <section id="access" className="bg-gradient-to-br from-[#071B3C] to-[#0B2F6B] px-5 py-16 text-white sm:px-8 lg:py-20"><div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[1fr_0.75fr] lg:items-center"><div><LockKeyhole className="h-9 w-9 text-[#F5A300]" /><p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">Controlled Early Access</p><h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Apply to join XDrive.</h2><p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/70">Applications are reviewed so the network grows around real courier, carrier, broker and transport-customer operations.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#F5A300] px-6 py-3 text-sm font-black text-[#071B3C]">Request Early Access <ArrowRight className="h-4 w-4" /></Link><Link href="/access" className="rounded-lg border border-white/20 px-6 py-3 text-sm font-black text-white">How Access Works</Link></div></div><div className="rounded-2xl border border-white/15 bg-white/5 p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#F5A300]">Launch model</p><div className="mt-5 grid gap-3">{['3 months free','Reviewed applications','No XDrive commission','No booking fee'].map(x=><div key={x} className="flex items-center gap-3 border-b border-white/10 pb-3 text-sm font-black last:border-b-0"><ShieldCheck className="h-4 w-4 text-[#F5A300]" />{x}</div>)}</div></div></div></section>
      </main>

      <footer className="border-t border-[#E2E8F1] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-12 xl:grid-cols-[1.15fr_2.85fr]">
            <div>
              <Link href="/" className="inline-flex"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} className="h-[46px] w-auto" /></Link>
              <p className="mt-4 text-base font-black text-[#0A234F]">Courier &amp; Freight Exchange Platform</p>
              <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-[#60758F]">Posted work, courier quotes, awarded jobs, dispatch, POD and invoice readiness in one controlled workflow.</p>
              <div className="mt-5 border-l-2 border-[#F5A300] pl-4 text-sm font-bold leading-6 text-[#516987]">
                <p className="font-black text-[#0A234F]">XDrive Logistics Ltd.</p>
                <p>Company No. 13171804</p>
                <p>Registered in England and Wales</p>
                <p>Registered office: 101 Cornelian Street, Blackburn, England, BB1 9QL</p>
                <p>VAT No. GB 375949535</p>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {footerGroups.map(group=><div key={group.title}><h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{group.title}</h2><div className="mt-5 grid gap-3 text-sm font-black text-[#0E3FA9]">{group.links.map(item=><Link key={item.href} href={item.href} className="transition hover:text-[#071B3C]">{item.label}</Link>)}</div></div>)}
            </div>
          </div>

          <div className="mt-10 border-t border-[#E2E8F1] pt-6 text-xs font-bold leading-5 text-[#60758F]">
            <p>XDrive operates the platform as an intermediary unless it expressly contracts to provide a transport service itself. No client funds are held by XDrive under the current platform model.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>© 2021–2026 XDrive Logistics Ltd. All Rights Reserved.</p>
              <p className="font-black text-[#385475]">Move Freight. Manage Operations. Grow Your Network.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
