import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, LockKeyhole, Menu, ShieldCheck } from 'lucide-react';
import { WhatsNextSection } from './sections/WhatsNextSection';

const mainNav = [
  { label: 'Platform', href: '#platform' },
  { label: 'Brokers', href: '#brokers' },
  { label: 'Couriers', href: '#couriers' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Access', href: '#access' },
] as const;

const footerGroups = [
  {
    title: 'Platform',
    links: [
      { label: 'Exchange', href: '#platform' },
      { label: 'Brokers & Customers', href: '#brokers' },
      { label: 'Couriers & Carriers', href: '#couriers' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Request Access', href: '/register' },
      { label: 'Sign In', href: '/login' },
      { label: 'Access', href: '#access' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
] as const;

const capabilities = [
  { no: '01', label: 'Exchange', title: 'Find and post work', copy: 'Match transport demand with real courier and freight capacity across the network.' },
  { no: '02', label: 'Commercial', title: 'Quote and award', copy: 'Receive offers, compare options and award work with a clear job-level audit trail.' },
  { no: '03', label: 'Operations', title: 'Dispatch and track', copy: 'Carry awarded work into driver allocation, live status, ETA and exception handling.' },
  { no: '04', label: 'Completion', title: 'POD and finance', copy: 'Keep delivery evidence and invoice-ready context connected to the same job record.' },
] as const;

const pricing = [
  'Owner Driver £29.99/mo',
  'Small Carrier £59.99/mo',
  'Broker £79.99/mo',
  'Growing Carrier £89.99/mo',
] as const;

function ProductWindow() {
  return (
    <div className="relative min-h-[560px]">
      <div className="absolute inset-x-0 bottom-5 top-8 overflow-hidden rounded-[28px] border border-[#D8E1ED] bg-white shadow-[0_46px_120px_rgba(7,27,60,0.17)]">
        <div className="flex h-12 items-center justify-between border-b border-[#E4EAF2] bg-[#F4F7FB] px-4">
          <div className="flex gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#C2CCDA]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#C2CCDA]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#C2CCDA]" />
          </div>
          <span className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#6B7F99]">XDrive Control Network</span>
        </div>
        <div className="grid min-h-[500px] grid-cols-[150px_1fr]">
          <aside className="bg-gradient-to-b from-[#0B2F6B] to-[#071B3C] p-4 text-white">
            <p className="mb-6 text-sm font-black">XD · XDrive</p>
            {['Overview', 'Exchange', 'Quotes', 'Awarded', 'Dispatch', 'Tracking', 'POD', 'Finance'].map((item, index) => (
              <div key={item} className={`mb-1 rounded-lg px-3 py-2.5 text-xs font-bold ${index === 0 ? 'bg-[#1D57D8] text-white shadow-[0_8px_24px_rgba(29,87,216,0.25)]' : 'text-white/75'}`}>
                {item}
              </div>
            ))}
          </aside>
          <div className="bg-[#F8FAFD] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[#071B3C]">Live Operations</h3>
              <span className="rounded-full bg-[#EAF7EF] px-3 py-1.5 text-[0.65rem] font-black text-[#1E7A43]">● NETWORK LIVE</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
              {[['Available loads', '124'], ['Quotes', '87'], ['Awarded', '63'], ['POD ready', '41']].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#E4EAF2] bg-white p-3">
                  <p className="text-[0.65rem] font-bold text-[#6A7C95]">{label}</p>
                  <p className="mt-1 text-2xl font-black text-[#11264A]">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-xl border border-[#E4EAF2] bg-white p-3">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#607695]">Available work</p>
                {[
                  ['Manchester → Birmingham', 'Today · LWB · 1 pallet', '£315'],
                  ['Leeds → London', 'Today · Luton · Dedicated', '£650'],
                  ['Glasgow → Milton Keynes', 'Tomorrow · MWB', '£420'],
                ].map(([route, detail, value]) => (
                  <div key={route} className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#EEF2F6] py-3 last:border-b-0">
                    <div><p className="text-xs font-black text-[#11264A]">{route}</p><p className="mt-1 text-[0.65rem] font-semibold text-[#6A7C95]">{detail}</p></div>
                    <span className="text-xs font-black text-[#11264A]">{value}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[#E4EAF2] bg-white p-3">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#607695]">Live network</p>
                <div className="relative mt-3 h-[210px] overflow-hidden rounded-lg bg-gradient-to-br from-[#EDF4FC] to-[#DCE9F8]">
                  <span className="absolute left-[16%] top-[55%] h-3 w-3 rounded-full border-[3px] border-white bg-[#F5A300] shadow-[0_0_0_2px_#F4C457]" />
                  <span className="absolute left-[54%] top-[28%] h-3 w-3 rounded-full border-[3px] border-white bg-[#F5A300] shadow-[0_0_0_2px_#F4C457]" />
                  <span className="absolute left-[78%] top-[58%] h-3 w-3 rounded-full border-[3px] border-white bg-[#F5A300] shadow-[0_0_0_2px_#F4C457]" />
                  <span className="absolute left-[19%] top-[54%] h-[3px] w-[42%] origin-left -rotate-[25deg] rounded bg-[#1D57D8]" />
                  <span className="absolute left-[56%] top-[31%] h-[3px] w-[30%] origin-left rotate-[28deg] rounded bg-[#1D57D8]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-4 bottom-7 w-[190px] rounded-[30px] bg-[#0C0D10] p-2 shadow-[0_28px_60px_rgba(0,0,0,0.28)]">
        <div className="overflow-hidden rounded-[22px] bg-white">
          <div className="bg-[#071B3C] p-3 text-[0.7rem] font-black text-white">Active Job · #78452</div>
          <div className="p-3">
            <p className="text-sm font-black text-[#11264A]">Leeds → London</p>
            <div className="mt-3 grid gap-2 text-[0.65rem] font-semibold text-[#48617D]">
              {['Collected', 'In transit', 'On site', 'Delivered', 'POD ready'].map((item) => <span key={item}>● <span className="ml-1">{item}</span></span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-3 top-3 w-[230px] rounded-2xl border border-[#DCE4EE] bg-white/95 p-4 shadow-[0_24px_55px_rgba(7,27,60,0.14)] backdrop-blur">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#6A7C95]">Quote comparison</p>
        <p className="mt-1 text-lg font-black text-[#11264A]">Job #78452</p>
        {[['Northline Transport', '£640'], ['Fast Haulage UK', '£655'], ['Express Relay', '£695']].map(([name, value]) => (
          <div key={name} className="flex justify-between border-b border-[#EEF2F6] py-2 text-[0.7rem] last:border-b-0"><span>{name}</span><b>{value}</b></div>
        ))}
      </div>

      <div className="absolute bottom-0 right-0 rounded-2xl bg-gradient-to-br from-[#F5A300] to-[#FFB824] px-5 py-4 text-white shadow-[0_22px_50px_rgba(245,163,0,0.24)]">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.08em]">Launch offer</p>
        <p className="mt-1 text-3xl font-black">£0 for 3 months</p>
        <p className="mt-1 text-xs font-bold">Then from £29.99/month</p>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#11264A]">
      <header className="sticky top-0 z-50 border-b border-[#E4EAF2] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-[#516783] xl:flex">
            {mainNav.map((item) => <a key={item.href} href={item.href} className="transition hover:text-[#0B2F6B]">{item.label}</a>)}
            <Link href="/login" className="transition hover:text-[#0B2F6B]">Sign In</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/register" className="hidden rounded-lg bg-[#1D57D8] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(29,87,216,0.18)] transition hover:bg-[#1649BE] sm:inline-flex">Request Access</Link>
            <details className="group relative xl:hidden">
              <summary className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[#E4EAF2] bg-white text-[#0B2F6B] [&::-webkit-details-marker]:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></summary>
              <div className="absolute right-0 top-12 w-[270px] rounded-xl border border-[#E4EAF2] bg-white p-3 text-sm font-black text-[#0B2F6B] shadow-[0_24px_60px_rgba(7,27,60,0.18)]">
                {mainNav.map((item) => <a key={item.href} href={item.href} className="block border-b border-[#E4EAF2] px-3 py-3 last:border-b-0">{item.label}</a>)}
                <Link href="/login" className="block border-b border-[#E4EAF2] px-3 py-3">Sign In</Link>
                <Link href="/register" className="mt-3 flex items-center justify-between rounded-lg bg-[#1D57D8] px-3 py-3 text-white">Request Access <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main>
        <section id="platform" className="relative overflow-hidden bg-gradient-to-b from-white to-[#F6F9FE] px-5 py-20 sm:px-8 lg:py-24">
          <div className="absolute right-[-12rem] top-20 h-[34rem] w-[34rem] rounded-full border border-[#1D57D8]/10 shadow-[0_0_0_80px_rgba(29,87,216,0.02),0_0_0_160px_rgba(29,87,216,0.015)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-[#F3D79D] bg-[#FFF7E5] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.13em] text-[#8A6100]">Early Access · 3 Months Free</div>
              <p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Courier & Freight Exchange Platform</p>
              <h1 className="mt-3 max-w-2xl text-[3rem] font-black leading-[0.94] tracking-[-0.045em] text-[#071B3C] sm:text-[4.5rem] lg:text-[4.9rem]">Transport operations, connected from quote to POD.</h1>
              <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-[#425B7B]">XDrive brings brokers, customers, carriers and owner drivers into one live operational network — where work is posted, quoted, awarded, dispatched, tracked and completed without breaking the chain.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#1D57D8] px-6 py-3.5 text-sm font-black text-white shadow-[0_14px_30px_rgba(29,87,216,0.18)]">Start 3 Months Free <ArrowRight className="h-4 w-4" /></Link>
                <a href="#platform-details" className="inline-flex items-center rounded-lg border border-[#E4EAF2] bg-white px-6 py-3.5 text-sm font-black text-[#0B2F6B]">Explore XDrive</a>
              </div>
              <div className="mt-7 flex flex-wrap gap-5 text-sm font-black text-[#395574]">
                {['No XDrive commission', 'No booking fee', 'Monthly rolling'].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1E7A43]" />{item}</span>)}
              </div>
            </div>
            <ProductWindow />
          </div>
        </section>

        <section id="platform-details" className="px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">One network. Four layers.</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-[#071B3C] sm:text-5xl">More than a load board.</h2>
              <p className="mt-5 text-lg font-semibold leading-8 text-[#6A7C95]">XDrive connects the commercial side of transport with the operational side, so a job stays in one controlled flow from opportunity to completion.</p>
            </div>
            <div className="mt-10 grid border-y border-[#E4EAF2] md:grid-cols-2 xl:grid-cols-4">
              {capabilities.map((item, index) => (
                <article key={item.no} className={`px-6 py-7 ${index < capabilities.length - 1 ? 'xl:border-r xl:border-[#E4EAF2]' : ''}`}>
                  <p className="text-[0.7rem] font-black uppercase tracking-[0.12em] text-[#F5A300]">{item.no} · {item.label}</p>
                  <h3 className="mt-3 text-xl font-black text-[#11264A]">{item.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#6A7C95]">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="brokers" className="relative overflow-hidden bg-gradient-to-br from-[#071B3C] via-[#0A2B65] to-[#0B2F6B] px-5 py-20 text-white sm:px-8 lg:py-24">
          <div className="relative mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">For brokers & customers</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Post. Compare. Award. Stay in control.</h2>
              <p className="mt-5 text-lg font-semibold leading-8 text-white/75">The job does not disappear after award. XDrive carries it forward into dispatch, live tracking and POD.</p>
              <div className="mt-7 grid gap-3 text-sm font-black text-white/85">
                {['Post with exact requirements', 'Compare carrier offers in one place', 'Award directly into operations', 'Track through completion'].map((item) => <span key={item} className="inline-flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-[#30B167]" />{item}</span>)}
              </div>
            </div>
            <div className="rounded-[22px] border border-white/20 bg-white p-5 shadow-[0_36px_90px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between text-[#11264A]"><strong>Quote Comparison · Job #78452</strong><span className="rounded-full bg-[#EAF7EF] px-3 py-1.5 text-[0.65rem] font-black text-[#1E7A43]">3 OFFERS</span></div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-xl border border-[#E4EAF2] p-3 text-[#11264A]">{[['Route', 'Leeds → London'], ['Vehicle', 'Luton'], ['Collection', '09:30'], ['POD required', 'Yes']].map(([a,b]) => <div key={a} className="flex justify-between border-b border-[#EEF2F6] py-2.5 text-xs last:border-b-0"><span>{a}</span><b>{b}</b></div>)}</div>
                <div className="rounded-xl border border-[#E4EAF2] p-3 text-[#11264A]">{[['Northline Transport', '£640'], ['Fast Haulage UK', '£655'], ['Express Relay', '£695']].map(([a,b]) => <div key={a} className="flex justify-between border-b border-[#EEF2F6] py-2.5 text-xs last:border-b-0"><span>{a}</span><b>{b}</b></div>)}<div className="mt-3 rounded-lg bg-[#1E8A49] p-2.5 text-center text-xs font-black text-white">Award £640 quote</div></div>
              </div>
            </div>
          </div>
        </section>

        <section id="couriers" className="bg-white px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="rounded-[22px] border border-[#E4EAF2] bg-[#F8FAFD] p-5 shadow-[0_24px_70px_rgba(7,27,60,0.08)]">
              <div className="flex items-center justify-between"><strong>Live Job · Leeds → London</strong><span className="rounded-full bg-[#EAF7EF] px-3 py-1.5 text-[0.65rem] font-black text-[#1E7A43]">IN TRANSIT</span></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[['STEP 1','Awarded','done'],['STEP 2','Driver allocated','done'],['STEP 3','In transit','active'],['STEP 4','Delivered / POD','']].map(([step,label,state]) => <div key={step} className={`min-h-[105px] rounded-xl border p-4 ${state === 'done' ? 'border-[#CDE8D6] bg-[#F7FCF8]' : state === 'active' ? 'border-2 border-[#1D57D8] bg-white' : 'border-[#E4EAF2] bg-white'}`}><p className="text-[0.65rem] font-black text-[#6A7C95]">{step}</p><p className="mt-2 text-sm font-black">{label}</p></div>)}
              </div>
              <div className="mt-3 rounded-xl border border-[#E4EAF2] bg-white p-3 text-xs">{[['Driver','James Carter'],['Vehicle','Luton'],['ETA','14:35']].map(([a,b]) => <div key={a} className="flex justify-between border-b border-[#EEF2F6] py-2 last:border-b-0"><span>{a}</span><b>{b}</b></div>)}</div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">For owner drivers & carriers</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-[#071B3C] sm:text-5xl">Find work. Quote quickly. Execute professionally.</h2>
              <p className="mt-5 text-lg font-semibold leading-8 text-[#6A7C95]">Owner drivers and carriers can move from available work to awarded jobs and live execution without leaving the XDrive workflow.</p>
              <div className="mt-7 grid gap-3 text-sm font-black text-[#395574]">{['See jobs that fit your vehicle capability', 'Quote directly from the exchange', 'Receive awarded work into the job workspace', 'Return live status and POD'].map((item) => <span key={item} className="inline-flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-[#1E7A43]" />{item}</span>)}</div>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-gradient-to-b from-[#F7F9FC] to-[#EEF4FB] px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[1240px] gap-8 rounded-[24px] border border-[#E4EAF2] bg-white p-8 shadow-[0_24px_70px_rgba(7,27,60,0.08)] lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Early access membership</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-[#071B3C] sm:text-5xl">Three months to prove the value.</h2>
              <p className="mt-5 max-w-3xl text-base font-semibold leading-7 text-[#6A7C95]">Use XDrive before paid membership begins. No XDrive commission on job value, no booking fee, and a simple monthly plan afterwards.</p>
              <div className="mt-6 flex flex-wrap gap-2">{pricing.map((item) => <span key={item} className="rounded-lg border border-[#E4EAF2] bg-[#F6F9FD] px-3 py-2.5 text-xs font-black text-[#36516F]">{item}</span>)}</div>
            </div>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F5A300] px-6 py-3.5 text-sm font-black text-white">Start 3 Months Free <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        <WhatsNextSection />

        <section id="access" className="bg-[#071B3C] px-5 py-16 text-white sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <LockKeyhole className="h-10 w-10 text-[#F5A300]" />
              <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Controlled Early Access</p>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl">XDrive Logistics is open by application.</h2>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/70">Access is reviewed, not automatic. Apply if your courier or freight operation fits the current UK rollout and the team will contact you directly.</p>
              <div className="mt-7 flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#F5A300] px-6 py-3 text-sm font-black text-white">Request Early Access <ArrowRight className="h-4 w-4" /></Link><Link href="/login" className="inline-flex items-center rounded-lg border border-white/20 px-6 py-3 text-sm font-black text-white">Sign In</Link></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              {['Courier & freight exchange', '3-month free access', 'UK-focused rollout', 'Reviewed applications'].map((item) => <div key={item} className="flex items-center gap-3 border-b border-white/10 py-3 text-sm font-black last:border-b-0"><ShieldCheck className="h-5 w-5 text-[#F5A300]" />{item}</div>)}
              <div className="mt-6 border-t border-white/10 pt-5 text-sm font-semibold leading-6 text-white/65"><p>Courier & Freight Exchange Platform</p><p>Company No. 13171804</p><p>No client funds held by XDrive.</p></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E4EAF2] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1.9fr]">
            <div className="max-w-md">
              <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={210} height={57} className="h-[46px] w-auto" />
              <p className="mt-4 text-base font-black text-[#071B3C]">Courier & Freight Exchange Platform</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#6A7C95]">Posted work, courier quotes, awarded jobs, dispatch, POD and invoice readiness in one controlled workflow.</p>
              <div className="mt-5 grid gap-2 border-l border-[#F5A300] pl-4 text-sm font-bold text-[#6A7C95]"><span>XDrive Logistics Ltd.</span><span>Company No. 13171804</span></div>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {footerGroups.map((group) => <div key={group.title}><h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{group.title}</h2><div className="mt-4 grid gap-3 text-sm font-bold text-[#0B2F6B]">{group.links.map((item) => item.href.startsWith('#') ? <a key={item.href} href={item.href}>{item.label}</a> : <Link key={item.href} href={item.href}>{item.label}</Link>)}</div></div>)}
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-[#E4EAF2] pt-6 text-xs font-bold text-[#6A7C95] sm:flex-row sm:items-center sm:justify-between"><p>© 2021 XDrive Logistics Ltd. All Rights Reserved.</p><p>Move Freight. Manage Operations. Grow Your Network.</p></div>
        </div>
      </footer>
    </div>
  );
}
