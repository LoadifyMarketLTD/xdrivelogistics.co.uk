import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  MapPin,
  Menu,
  PackageCheck,
  Radio,
  Route,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
  WalletCards,
} from 'lucide-react';

const mainNav = [
  { label: 'Platform', href: '#platform' },
  { label: 'How It Works', href: '#workflow' },
  { label: 'For Companies', href: '#roles' },
  { label: 'For Fleets', href: '#roles' },
  { label: 'For Drivers', href: '#driver' },
  { label: 'POD', href: '#pod' },
] as const;

const workflow = [
  {
    number: '01',
    title: 'Post a transport requirement',
    copy: 'Add collection, delivery, vehicle and timing requirements to one controlled record.',
    icon: FileText,
  },
  {
    number: '02',
    title: 'Receive & compare quotes',
    copy: 'Eligible transport operators can respond when relevant work is available to them.',
    icon: WalletCards,
  },
  {
    number: '03',
    title: 'Award the job',
    copy: 'Choose the preferred quote and move the same record into operational execution.',
    icon: ClipboardCheck,
  },
  {
    number: '04',
    title: 'Dispatch & follow progress',
    copy: 'Driver allocation, journey statuses and authorised tracking stay attached to the job.',
    icon: Route,
  },
  {
    number: '05',
    title: 'Deliver & capture POD',
    copy: 'Completion evidence can include delivery status, signature and supporting proof.',
    icon: PackageCheck,
  },
  {
    number: '06',
    title: 'Keep the record connected',
    copy: 'POD, operational history and invoice readiness remain linked after completion.',
    icon: FileCheck2,
  },
] as const;

const capabilities = [
  {
    title: 'Courier & Freight Exchange',
    copy: 'Post requirements, receive quotes and award work without breaking the job record.',
    icon: Truck,
  },
  {
    title: 'Operations Diary',
    copy: 'Keep awarded work, allocation, status progression and exceptions in one workspace.',
    icon: ClipboardCheck,
  },
  {
    title: 'Driver Workspace',
    copy: 'Assigned work, journey progression and delivery actions travel with the driver.',
    icon: Smartphone,
  },
  {
    title: 'Live Status & Tracking',
    copy: 'Authorised users can follow operational progress and location when tracking is active.',
    icon: Radio,
  },
  {
    title: 'Digital POD',
    copy: 'Return delivery evidence to the original job instead of splitting it across channels.',
    icon: FileCheck2,
  },
  {
    title: 'Finance Records',
    copy: 'Carry completed-job context into invoice readiness and historical records.',
    icon: WalletCards,
  },
] as const;

const roleCards = [
  {
    eyebrow: 'For Companies & Brokers',
    title: 'Post, compare and control transport work.',
    copy: 'Create transport requirements, review quotes, award work and follow the operational record through to proof of delivery.',
    icon: Building2,
    points: ['Transport requirements', 'Quote comparison', 'Awarded-job visibility'],
  },
  {
    eyebrow: 'For Fleets & Owner Drivers',
    title: 'Manage work and execution together.',
    copy: 'Respond to suitable opportunities, manage awarded jobs, allocate drivers and keep transport activity connected to compliance and records.',
    icon: Truck,
    points: ['Relevant work access', 'Fleet & driver allocation', 'Operational records'],
  },
  {
    eyebrow: 'For Drivers',
    title: 'One clear mobile journey from assignment to POD.',
    copy: 'Receive assigned work, progress through journey statuses and return delivery evidence from the XDrive Driver workflow.',
    icon: Smartphone,
    points: ['Assigned jobs', 'Journey status progression', 'POD capture'],
  },
] as const;

const trustItems = [
  { title: 'Controlled access', copy: 'Platform access is role-aware and reviewed.', icon: ShieldCheck },
  { title: 'UK-focused rollout', copy: 'The current rollout is focused on UK courier and freight operations.', icon: MapPin },
  { title: 'Connected records', copy: 'Operational evidence stays attached to the underlying job record.', icon: FileCheck2 },
  { title: 'No client funds held', copy: 'XDrive does not position itself as the holder of client transport funds.', icon: CheckCircle2 },
] as const;

function ProductCanvas() {
  return (
    <div className="relative mx-auto w-full max-w-[760px]">
      <div className="overflow-hidden rounded-[24px] border border-[#D8E4F5] bg-white shadow-[0_32px_90px_rgba(7,35,79,0.18)]">
        <div className="flex h-11 items-center justify-between border-b border-[#E4ECF7] bg-[#F8FBFF] px-4">
          <div className="flex gap-2" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F5A300]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#1D57D8]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#0B2F6B]" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5A6D88]">XDrive Platform</span>
        </div>
        <div className="grid min-h-[390px] grid-cols-[72px_1fr] bg-[#F7FAFF] sm:grid-cols-[92px_1fr]">
          <aside className="border-r border-[#E0E9F6] bg-[#0B2F6B] px-3 py-5 text-white">
            <div className="mb-7 h-7 rounded-md bg-white/15" />
            {['EX', 'OP', 'FL', 'PD', 'FI'].map((item, index) => (
              <div key={item} className={`mb-3 flex h-10 items-center justify-center rounded-lg text-[10px] font-black ${index === 0 ? 'bg-[#1D57D8]' : 'bg-white/5'}`}>
                {item}
              </div>
            ))}
          </aside>
          <div className="p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1D57D8]">Connected transport workflow</p>
                <h3 className="mt-1 text-xl font-black text-[#0B2F6B]">From requirement to delivery record</h3>
              </div>
              <div className="rounded-full bg-[#E9F2FF] px-4 py-2 text-xs font-black text-[#0B2F6B]">Early Access</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Exchange', 'Post • Quote • Award'],
                ['Operations', 'Allocate • Progress'],
                ['POD', 'Evidence • Records'],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-xl border border-[#DDE7F5] bg-white p-4 shadow-sm">
                  <p className="text-xs font-black text-[#0B2F6B]">{title}</p>
                  <p className="mt-2 text-[11px] font-semibold text-[#6A7A91]">{copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-2xl border border-[#DDE7F5] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-black text-[#0B2F6B]">Operational flow</p>
                  <Route className="h-4 w-4 text-[#1D57D8]" />
                </div>
                <div className="space-y-3">
                  {['Requirement posted', 'Quote awarded', 'Driver allocated', 'Journey in progress', 'POD returned'].map((label, index) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${index < 2 ? 'bg-[#1D57D8] text-white' : 'bg-[#EEF3F9] text-[#728096]'}`}>{index + 1}</span>
                      <div className="h-2 flex-1 rounded-full bg-[#E8EEF7]">
                        <div className={`h-2 rounded-full ${index < 2 ? 'w-full bg-[#1D57D8]' : 'w-1/3 bg-[#C9D6E8]'}`} />
                      </div>
                      <span className="hidden min-w-[112px] text-[10px] font-bold text-[#596B84] sm:block">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-[#DDE7F5] bg-[#EEF5FF] p-4">
                <div className="absolute inset-0 opacity-50" aria-hidden="true">
                  <div className="absolute left-[15%] top-[18%] h-px w-[70%] rotate-[16deg] bg-[#A8C2E8]" />
                  <div className="absolute left-[12%] top-[55%] h-px w-[72%] -rotate-[12deg] bg-[#A8C2E8]" />
                  <div className="absolute left-[36%] top-[6%] h-[88%] w-px rotate-[19deg] bg-[#A8C2E8]" />
                </div>
                <div className="relative z-10 flex h-full min-h-[180px] flex-col justify-between">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#0B2F6B] shadow-sm">
                    <Radio className="h-3.5 w-3.5 text-[#1D57D8]" /> Tracking when active
                  </div>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-8 border-white bg-[#F5A300] text-white shadow-lg">
                    <Truck className="h-5 w-5" />
                  </div>
                  <p className="rounded-xl bg-white/90 p-3 text-[10px] font-semibold leading-4 text-[#5B6C83]">Location and ETA visibility are shown only in the authorised operational context.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-10 right-2 hidden w-[178px] rounded-[30px] border-[7px] border-[#0A234F] bg-white p-2 shadow-[0_22px_55px_rgba(7,35,79,0.25)] sm:block lg:right-[-28px]">
        <div className="rounded-[20px] bg-[#F7FAFF] p-3">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#C5D1E2]" />
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#1D57D8]">XDrive Driver</p>
          <h4 className="mt-1 text-sm font-black text-[#0B2F6B]">Job progression</h4>
          <div className="mt-4 space-y-2.5">
            {['Accepted', 'On my way', 'On site', 'Loaded', 'Delivered'].map((label, index) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${index < 2 ? 'bg-[#1D57D8]' : 'bg-[#C8D4E5]'}`} />
                <span className="text-[9px] font-bold text-[#5D6D83]">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-[#F5A300] py-2 text-center text-[9px] font-black text-white">POD AT DELIVERY</div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B2F6B]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A2F63]/95 text-white shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={210} height={58} priority className="h-[44px] w-auto brightness-0 invert" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-bold text-white/80 xl:flex">
            {mainNav.map((item) => <a key={item.label} href={item.href} className="transition hover:text-white">{item.label}</a>)}
            <Link href="/login" className="transition hover:text-white">Sign In</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/register" className="hidden rounded-lg bg-[#F5A300] px-5 py-2.5 text-sm font-black text-white shadow-lg transition hover:bg-[#E67E00] sm:inline-flex">Request Early Access</Link>
            <details className="group relative xl:hidden">
              <summary className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-white/20 bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></summary>
              <div className="absolute right-0 top-12 w-[280px] rounded-xl border border-[#D9E4F3] bg-white p-3 text-sm font-black text-[#0B2F6B] shadow-2xl">
                {mainNav.map((item) => <a key={item.label} href={item.href} className="block rounded-lg px-3 py-3 hover:bg-[#F4F7FB]">{item.label}</a>)}
                <Link href="/login" className="block rounded-lg px-3 py-3 hover:bg-[#F4F7FB]">Sign In</Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main>
        <section id="platform" className="relative overflow-hidden bg-[linear-gradient(125deg,#ffffff_0%,#f4f8ff_55%,#eaf2ff_100%)]">
          <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full border-[70px] border-[#1D57D8]/7" aria-hidden="true" />
          <div className="mx-auto grid max-w-[1480px] gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:py-24">
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1D57D8]">Courier & Freight Operations Platform</p>
              <h1 className="mt-5 text-[3.1rem] font-black leading-[.98] tracking-[-0.04em] text-[#0B2F6B] sm:text-[4.6rem] lg:text-[5.2rem]">Move Freight.<br />Manage Operations.<br /><span className="text-[#F5A300]">Grow Your Network.</span></h1>
              <p className="mt-7 max-w-[630px] text-lg font-semibold leading-8 text-[#4B607E]">Post transport requirements, receive and compare quotes, award work and keep each awarded job connected through dispatch, driver progression, POD and invoice readiness.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#0B2F6B] px-6 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(11,47,107,.22)] transition hover:bg-[#082454]">Request Early Access <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-[#B9CAE1] bg-white px-6 py-3.5 text-sm font-black text-[#0B2F6B] transition hover:bg-[#F4F7FB]">Sign In</Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[#5C6F88]">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1D57D8]" /> UK-focused rollout</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1D57D8]" /> Reviewed access</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1D57D8]" /> 3-month early access</span>
              </div>
            </div>
            <ProductCanvas />
          </div>
        </section>

        <section id="workflow" className="border-y border-[#E2E9F3] bg-white px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-[1480px]">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1D57D8]">How XDrive Works</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#0B2F6B] sm:text-4xl">One transport record. Six connected stages.</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-[#63748A]">The homepage describes the workflow XDrive is built to support. It does not claim marketplace activity that does not exist.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {workflow.map((item) => {
                const Icon = item.icon;
                return <div key={item.number} className="relative rounded-2xl border border-[#DFE7F2] bg-[#FBFCFE] p-5 shadow-[0_10px_30px_rgba(11,47,107,.05)]">
                  <div className="flex items-center justify-between"><span className="text-xs font-black text-[#1D57D8]">{item.number}</span><Icon className="h-6 w-6 text-[#F5A300]" /></div>
                  <h3 className="mt-5 text-base font-black leading-5 text-[#0B2F6B]">{item.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-[#69798F]">{item.copy}</p>
                </div>;
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#F6F9FD] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-[1480px]">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5A300]">Everything connected</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">The operational building blocks in one platform.</h2>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => {
                const Icon = item.icon;
                return <div key={item.title} className="rounded-2xl border border-[#DEE7F3] bg-white p-6 shadow-[0_12px_35px_rgba(11,47,107,.06)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EDF4FF] text-[#1D57D8]"><Icon className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-xl font-black">{item.title}</h3>
                  <p className="mt-3 font-medium leading-7 text-[#66788F]">{item.copy}</p>
                </div>;
              })}
            </div>
          </div>
        </section>

        <section id="roles" className="bg-white px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-[1480px]">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#1D57D8]">Built around real roles</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Different workspaces. One connected transport record.</h2></div>
              <p className="max-w-xl font-semibold leading-7 text-[#66788F]">Companies, fleets and drivers see the tools relevant to their role without turning the platform into three disconnected systems.</p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {roleCards.map((item, index) => {
                const Icon = item.icon;
                return <article key={item.eyebrow} id={index === 2 ? 'driver' : undefined} className={`rounded-[24px] border p-7 ${index === 1 ? 'border-[#F1D7AA] bg-[#FFF8ED]' : index === 2 ? 'border-[#CCE7D5] bg-[#F3FBF5]' : 'border-[#D5E3F6] bg-[#F3F7FD]'}`}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm"><Icon className="h-6 w-6 text-[#0B2F6B]" /></div>
                  <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-[#1D57D8]">{item.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 font-medium leading-7 text-[#60728A]">{item.copy}</p>
                  <div className="mt-6 space-y-3">{item.points.map(point => <div key={point} className="flex items-center gap-3 text-sm font-bold text-[#445B78]"><CheckCircle2 className="h-4 w-4 text-[#1D57D8]" />{point}</div>)}</div>
                </article>;
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#082A5A] px-5 py-20 text-white sm:px-8">
          <div className="mx-auto grid max-w-[1480px] gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5A300]">Operational visibility</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Tracking belongs inside the job, not beside it.</h2>
              <p className="mt-5 max-w-xl font-medium leading-8 text-white/70">When tracking is active and the viewer is authorised, location and journey progress can be surfaced alongside the same operational record used for allocation, status and delivery.</p>
              <div className="mt-7 space-y-3 text-sm font-bold text-white/85">
                {['Driver journey progression', 'Authorised location visibility', 'Operational status history', 'POD connected to completion'].map(item => <div key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#F5A300]" />{item}</div>)}
              </div>
            </div>
            <div className="relative min-h-[360px] overflow-hidden rounded-[24px] border border-white/15 bg-[#0F3B75] p-6 shadow-2xl">
              <div className="absolute inset-0 opacity-30" aria-hidden="true"><div className="absolute left-[8%] top-[32%] h-px w-[82%] rotate-[12deg] bg-white" /><div className="absolute left-[8%] top-[58%] h-px w-[82%] -rotate-[10deg] bg-white" /><div className="absolute left-[48%] top-[8%] h-[84%] w-px rotate-[22deg] bg-white" /></div>
              <div className="relative z-10 grid h-full gap-5 md:grid-cols-[.65fr_1.35fr]">
                <div className="rounded-2xl bg-white p-5 text-[#0B2F6B]">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1D57D8]">Journey progression</p>
                  <div className="mt-5 space-y-4">{['Accepted', 'On my way', 'On site', 'Loaded', 'In transit', 'On site delivery', 'Delivered'].map((item, index) => <div key={item} className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${index < 2 ? 'bg-[#1D57D8]' : 'bg-[#D3DDEA]'}`} /><span className="text-xs font-bold">{item}</span></div>)}</div>
                </div>
                <div className="flex min-h-[250px] items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#0B2F6B]">
                  <div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F5A300] text-white shadow-xl"><Truck className="h-7 w-7" /></div><p className="mt-4 text-sm font-black">Authorised live position</p><p className="mt-1 text-xs font-semibold text-[#65758C]">Visible only when the tracking context allows it</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pod" className="bg-white px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-[1480px] gap-12 lg:grid-cols-2 lg:items-center">
            <div className="rounded-[24px] border border-[#DDE6F2] bg-[#F6F9FD] p-7 sm:p-10">
              <div className="grid gap-4 sm:grid-cols-2">
                {['Delivery status', 'Recipient evidence', 'Supporting photos', 'Completion record'].map((item, index) => <div key={item} className="rounded-2xl border border-[#DCE5F1] bg-white p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EDF4FF] text-[#1D57D8]">{index === 0 ? <CheckCircle2 className="h-5 w-5" /> : index === 1 ? <Users className="h-5 w-5" /> : index === 2 ? <PackageCheck className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}</div><p className="mt-4 text-sm font-black">{item}</p></div>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1D57D8]">Digital POD & Records</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Delivery evidence comes back to the job that created it.</h2>
              <p className="mt-5 font-medium leading-8 text-[#64758B]">XDrive is designed so the delivery action is not the end of the information chain. POD context, completion status and later financial records can remain attached to the same job history.</p>
            </div>
          </div>
        </section>

        <section className="border-y border-[#E2EAF4] bg-[#F7FAFD] px-5 py-16 sm:px-8">
          <div className="mx-auto max-w-[1480px]">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{trustItems.map(item => { const Icon = item.icon; return <div key={item.title} className="rounded-2xl border border-[#E0E8F2] bg-white p-6"><Icon className="h-7 w-7 text-[#1D57D8]" /><h3 className="mt-4 font-black">{item.title}</h3><p className="mt-2 text-sm font-medium leading-6 text-[#68798E]">{item.copy}</p></div>; })}</div>
          </div>
        </section>

        <section id="access" className="bg-white px-5 py-20 sm:px-8">
          <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-8 rounded-[28px] bg-[#0B2F6B] px-7 py-10 text-white shadow-[0_30px_75px_rgba(11,47,107,.2)] sm:px-10 lg:flex-row lg:items-center">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5A300]">XDrive Early Access</p><h2 className="mt-3 text-3xl font-black">See whether XDrive fits the way you move freight.</h2><p className="mt-3 max-w-2xl font-medium text-white/70">Request access to the UK-focused rollout. No marketplace activity is fabricated on this page.</p></div>
            <div className="flex shrink-0 flex-wrap gap-3"><Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#F5A300] px-6 py-3.5 text-sm font-black text-white">Request Early Access <ArrowRight className="h-4 w-4" /></Link><Link href="/login" className="rounded-lg border border-white/25 px-6 py-3.5 text-sm font-black text-white">Sign In</Link></div>
          </div>
        </section>
      </main>

      <footer className="bg-[#061D40] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto grid max-w-[1480px] gap-10 lg:grid-cols-[1.35fr_.65fr_.65fr_.65fr]">
          <div><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={210} height={58} className="h-[46px] w-auto brightness-0 invert" /><p className="mt-5 max-w-md text-sm font-medium leading-7 text-white/60">Courier and freight operations connected from requirement and quote through dispatch, driver progression, POD and records.</p></div>
          <div><p className="text-sm font-black">Platform</p><div className="mt-4 space-y-3 text-sm text-white/60"><a href="#workflow" className="block hover:text-white">How It Works</a><a href="#roles" className="block hover:text-white">Roles</a><a href="#pod" className="block hover:text-white">POD & Records</a></div></div>
          <div><p className="text-sm font-black">Account</p><div className="mt-4 space-y-3 text-sm text-white/60"><Link href="/register" className="block hover:text-white">Request Access</Link><Link href="/login" className="block hover:text-white">Sign In</Link><Link href="/contact" className="block hover:text-white">Contact</Link></div></div>
          <div><p className="text-sm font-black">Legal</p><div className="mt-4 space-y-3 text-sm text-white/60"><Link href="/terms" className="block hover:text-white">Terms</Link><Link href="/privacy" className="block hover:text-white">Privacy</Link><Link href="/cookies" className="block hover:text-white">Cookies</Link></div></div>
        </div>
        <div className="mx-auto mt-10 flex max-w-[1480px] flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs font-medium text-white/45 sm:flex-row"><span>© 2026 XDrive Logistics. All rights reserved.</span><span>UK-focused early access</span></div>
      </footer>
    </div>
  );
}
