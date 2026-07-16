import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  MapPin,
  Menu,
  Route,
  ShieldCheck,
  Users,
} from 'lucide-react';

const mainNav = [
  { label: 'Exchange', href: '#platform' },
  { label: 'How It Works', href: '#workflow' },
  { label: 'Customers', href: '#customers' },
  { label: 'Couriers', href: '#couriers' },
  { label: 'Access', href: 'rgba(29, 87, 216, 0.93)ss' },
] as const;

const brandProof = [
  { label: 'UK-Wide Coverage', icon: MapPin },
  { label: 'Secure Transport', icon: ShieldCheck },
  { label: 'Live Updates', icon: Route },
  { label: 'Proof of Delivery', icon: FileCheck2 },
  { label: 'Professional Network', icon: Users },
] as const;

const exchangeTypes = ['Courier jobs', 'Freight jobs', 'Van work', 'Return loads', 'Scheduled transport'] as const;

const workflowFrames = [
  {
    stage: 'Post',
    title: 'Job posted',
    detail: 'Route, vehicle and timing requirements enter the exchange.',
    image: '/load-poster-office.webp',
    alt: 'XDrive customer posting courier and freight work from the load poster workspace',
  },
  {
    stage: 'Quote',
    title: 'Quotes received',
    detail: 'Courier companies and operators respond to the same job record.',
    image: '/marketplace-loading.webp',
    alt: 'XDrive courier and freight exchange quote board with available work context',
  },
  {
    stage: 'Award',
    title: 'Work awarded',
    detail: 'The awarded job moves into dispatch, POD and invoice readiness.',
    image: '/operations-dispatch-office.webp',
    alt: 'XDrive operations diary showing awarded work moving into dispatch',
  },
] as const;

const audienceSections = [
  {
    id: 'customers',
    kicker: 'For Customers',
    headline: 'Post work. Compare quotes. Award with control.',
    copy: 'Transport customers can publish courier and freight requirements, receive operator quotes, and move the awarded job into one controlled record.',
    points: ['Route and vehicle context', 'Quote comparison', 'POD and invoice readiness'],
  },
  {
    id: 'couriers',
    kicker: 'For Couriers',
    headline: 'Find available work. Quote fast. Operate cleanly.',
    copy: 'Courier companies and owner drivers can view relevant work, respond with quotes, and manage awarded jobs through dispatch, status updates and proof of delivery.',
    points: ['Available exchange work', 'Awarded job workspace', 'Evidence returned to the record'],
  },
] as const;

const productSections = [
  {
    id: 'marketplace',
    kicker: 'Courier & Freight Exchange',
    headline: 'Jobs posted. Quotes received. Work awarded.',
    copy: 'Courier and freight requests move from submission to awarded carrier without leaving the platform.',
    image: '/customers-warehouse.webp',
    alt: 'XDrive courier and freight exchange connected to warehouse and collection activity',
    reverse: false,
  },
  {
    id: 'operations',
    kicker: 'Operations Diary',
    headline: 'Dispatch. Everything. Live.',
    copy: 'Awarded jobs become operational records with driver, route, status and exception visibility.',
    image: '/hero-dispatch-control.webp',
    alt: 'XDrive dispatch control room with live operations visibility',
    reverse: true,
  },
  {
    id: 'driver',
    kicker: 'Courier Workspace',
    headline: 'Dispatched here. Worked there. Same job record.',
    copy: 'Drivers receive assigned work, update status and return evidence inside the XDrive workflow.',
    image: '/xdrive-driver-workspace-real.webp',
    alt: 'XDrive mobile driver workspace showing an active assigned job',
    reverse: false,
  },
  {
    id: 'pod',
    kicker: 'POD & Records',
    headline: 'Delivery evidence. Attached to the job. Permanently.',
    copy: 'POD records remain connected to the job, driver, timestamp and completion history.',
    image: '/xdrive-driver-pod-real.webp',
    alt: 'XDrive proof of delivery workflow with mobile delivery evidence',
    reverse: true,
  },
  {
    id: 'finance',
    kicker: 'Finance',
    headline: 'Invoice readiness. Built into the workflow.',
    copy: 'When the job is done, the invoice context is already tied to the operational record.',
    image: '/xdrive-finance-records-real.webp',
    alt: 'XDrive finance workspace showing invoice readiness and linked job records',
    reverse: false,
  },
] as const;

const trustItems = [
  'Company No. 13171804',
  'UK-focused rollout',
  'Controlled access',
  'No client funds held by XDrive',
  'POD and invoice records',
] as const;

const accessProof = [
  'Courier & freight exchange',
  '3-month free access',
  'UK-focused rollout',
  'Reviewed applications',
] as const;

const footerGroups = [
  {
    title: 'Platform',
    links: [
      { label: 'Exchange', href: '#platform' },
      { label: 'How It Works', href: '#workflow' },
      { label: 'Customers', href: '#customers' },
      { label: 'Couriers', href: '#couriers' },
    ],
  },
  {
    title: 'Product',
    links: [
      { label: 'Operations Diary', href: '#operations' },
      { label: 'Courier Workspace', href: '#driver' },
      { label: 'POD & Records', href: '#pod' },
      { label: 'Finance', href: '#finance' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Request Access', href: '/register' },
      { label: 'Sign In', href: '/login' },
      { label: 'Access', href: 'rgba(29, 87, 216, 0.93)ss' },
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

function ProductFrame({ image, alt, label, priority = false }: { image: string; alt: string; label: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden border border-[#F4F6F8] bg-white shadow-[0_30px_90px_rgba(29, 87, 216, 0.14)]">
      <div className="flex h-11 items-center justify-between border-b border-[#F4F6F8] bg-[#F4F6F8] px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F5A300]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#1D57D8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#1D57D8]" />
        </div>
        <span className="text-[0.68rem] font-black uppercase leading-none tracking-[0.16em] text-[#1D57D8]/70">{label}</span>
      </div>
      <div className="relative aspect-[16/9] bg-[#F4F6F8]">
        <Image src={image} alt={alt} fill priority={priority} className="object-cover" />
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#1D57D8]">
      <header className="sticky top-0 z-50 border-b border-[#F4F6F8] bg-white/95 shadow-[0_8px_30px_rgba(29, 87, 216, 0.06)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={218} height={58} priority className="h-[46px] w-auto" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-black text-[#1D57D8]/70 xl:flex">
            {mainNav.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-[#1D57D8]">{item.label}</a>
            ))}
            <Link href="/login" className="transition hover:text-[#1D57D8]">Sign In</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/register" className="hidden bg-[#1D57D8] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(29, 87, 216, 0.18)] transition hover:bg-[#1D57D8] sm:inline-flex">
              Request Access
            </Link>
            <details className="group relative xl:hidden">
              <summary className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center border border-[#F4F6F8] bg-white text-[#1D57D8] [&::-webkit-details-marker]:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </summary>
              <div className="absolute right-0 top-12 w-[270px] border border-[#F4F6F8] bg-white p-3 text-sm font-black text-[#1D57D8] shadow-[0_24px_60px_rgba(29, 87, 216, 0.18)]">
                {mainNav.map((item) => (
                  <a key={item.href} href={item.href} className="block border-b border-[#F4F6F8] px-3 py-3 transition last:border-b-0 hover:bg-[#F4F6F8]">
                    {item.label}
                  </a>
                ))}
                <Link href="/login" className="block border-b border-[#F4F6F8] px-3 py-3 transition hover:bg-[#F4F6F8]">Sign In</Link>
                <Link href="/register" className="mt-3 flex items-center justify-between bg-[#1D57D8] px-3 py-3 text-white transition hover:bg-[#1D57D8]">
                  Request Access <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main>
        <section id="platform" className="relative overflow-hidden bg-white">
          <div className="absolute right-[-24vw] top-[-20vw] h-[58vw] w-[58vw] rounded-full border-[32px] border-[#1D57D8]" aria-hidden="true" />
          <div className="absolute right-[-19vw] top-[-15vw] h-[50vw] w-[50vw] rounded-full border-[12px] border-[#F5A300]" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 h-24 w-[46vw] bg-[#1D57D8]" aria-hidden="true" />
          <div className="absolute bottom-24 left-[34vw] h-4 w-[36vw] -rotate-[28deg] bg-[#F5A300]" aria-hidden="true" />

          <div className="relative mx-auto grid min-h-[calc(100svh-72px)] max-w-[1440px] gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-14">
            <div className="max-w-2xl">
              <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={410} height={110} priority className="h-auto w-[300px] max-w-full sm:w-[400px]" />
              <p className="mt-8 text-sm font-black uppercase tracking-[0.18em] text-[#F5A300]">Courier &amp; Freight Exchange Platform</p>
              <h1 className="mt-4 text-[3rem] font-black leading-[0.95] tracking-tight text-[#1D57D8] sm:text-[4.4rem] lg:text-[5.25rem]">
                Move freight. Manage operations. Grow your network.
              </h1>
              <p className="mt-7 max-w-xl text-lg font-semibold leading-8 text-[#1D57D8]">
                XDrive Logistics helps transport customers post work, receive courier and freight quotes, award jobs, and carry each job into dispatch, POD and invoice readiness.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 bg-[#1D57D8] px-6 py-3 text-sm font-black text-white shadow-[0_16px_34px_rgba(29, 87, 216, 0.2)] transition hover:bg-[#1D57D8]">
                  Request Early Access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 border border-[#1D57D8]/20 bg-white px-6 py-3 text-sm font-black text-[#1D57D8] transition hover:bg-[#F4F6F8]">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="relative z-10">
              <ProductFrame image="/courier-fleet-depot.webp" alt="XDrive courier and freight exchange platform with fleet and depot visibility" label="Courier & Freight Exchange" priority />
            </div>
          </div>
        </section>

        <section className="bg-[#1D57D8] px-5 py-7 text-white sm:px-8">
          <div className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {brandProof.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex min-h-[74px] items-center gap-4 border-l border-white/20 bg-white/[0.03] px-4">
                  <Icon className="h-8 w-8 shrink-0 text-[#F5A300]" />
                  <p className="text-lg font-black leading-tight">{item.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-b border-[#F4F6F8] bg-white px-5 py-10 sm:px-8">
          <div className="mx-auto grid max-w-[1440px] gap-7 lg:grid-cols-[0.42fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">What moves through XDrive</p>
              <h2 className="mt-2 text-2xl font-black text-[#1D57D8]">Real exchange work, one operational record.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {exchangeTypes.map((item) => (
                <div key={item} className="border border-[#F4F6F8] bg-[#F4F6F8] px-4 py-4 text-sm font-black text-[#1D57D8] shadow-[0_10px_24px_rgba(29, 87, 216, 0.04)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="bg-[#F4F6F8] px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-[1440px]">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#F5A300]">How It Works</p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-[#1D57D8] sm:text-6xl">Post to award. One job record.</h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#1D57D8]">The exchange record becomes the operational record, so work does not restart after the job is awarded.</p>
            </div>
            <div className="mt-10 overflow-hidden border border-[#F4F6F8] bg-white shadow-[0_24px_70px_rgba(29, 87, 216, 0.1)]">
              <div className="grid lg:grid-cols-3">
                {workflowFrames.map((frame, index) => (
                  <article key={frame.stage} className="border-[#F4F6F8] lg:border-r lg:last:border-r-0">
                    <div className="relative aspect-[16/9] bg-[#F4F6F8]">
                      <Image src={frame.image} alt={frame.alt} fill className="object-cover" />
                      <div className="absolute left-4 top-4 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#1D57D8] shadow-sm">XD-2048 / {frame.stage}</div>
                      {index < workflowFrames.length - 1 && (
                        <div className="absolute -right-5 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#F5A300] text-[#1A1F2B] shadow-lg lg:flex">
                          <ArrowRight className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#1D57D8]">{frame.stage}</p>
                      <h3 className="mt-2 text-2xl font-black text-[#1D57D8]">{frame.title}</h3>
                      <p className="mt-3 text-sm font-semibold leading-6 text-[#1D57D8]">{frame.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#F4F6F8] bg-white px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-2">
            {audienceSections.map((section) => (
              <article key={section.id} id={section.id} className="border border-[#F4F6F8] bg-[#F4F6F8] p-7 shadow-[0_18px_50px_rgba(29, 87, 216, 0.06)] sm:p-9 lg:p-10">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#F5A300]">{section.kicker}</p>
                <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight text-[#1D57D8] sm:text-5xl">{section.headline}</h2>
                <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#1D57D8]">{section.copy}</p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {section.points.map((point) => (
                    <div key={point} className="flex min-h-[76px] items-center gap-3 border border-[#F4F6F8] bg-white p-4 text-sm font-black text-[#1D57D8]">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F5A300]" />
                      {point}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {productSections.map((section) => (
          <section key={section.id} id={section.id} className="border-t border-[#F4F6F8] bg-white px-5 py-20 sm:px-8 lg:py-24">
            <div className={`mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center ${section.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#F5A300]">{section.kicker}</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-[#1D57D8] sm:text-6xl">{section.headline}</h2>
                <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#1D57D8]">{section.copy}</p>
              </div>
              <ProductFrame image={section.image} alt={section.alt} label={section.kicker} />
            </div>
          </section>
        ))}

        <section className="border-t border-[#F4F6F8] bg-[#F4F6F8] px-5 py-12 sm:px-8">
          <div className="mx-auto grid max-w-[1440px] gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {trustItems.map((item) => (
              <div key={item} className="flex min-h-[72px] items-center gap-3 border border-[#F4F6F8] bg-white px-4 text-sm font-black text-[#1D57D8] shadow-[0_12px_30px_rgba(29, 87, 216, 0.05)]">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#F5A300]" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="access" className="bg-[#1A1F2B] px-5 py-16 text-white sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[1fr_0.78fr] lg:items-center">
            <div className="max-w-3xl">
              <LockKeyhole className="h-10 w-10 text-[#F5A300]" />
              <p className="mt-7 text-sm font-black uppercase tracking-[0.16em] text-[#F5A300]">Controlled Early Access</p>
              <h2 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">XDrive Logistics is open by application.</h2>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/70">
                Access is reviewed, not automatic. Apply if your courier or freight operation fits the current UK rollout and the team will contact you directly.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 bg-[#F5A300] px-6 py-3 text-sm font-black text-[#1A1F2B] shadow-[0_16px_34px_rgba(245, 163, 0, 0.18)] transition hover:bg-[#F5A300]">
                  Request Early Access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_rgba(26, 31, 43, 0.2)] sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Access Includes</p>
              <div className="mt-5 grid gap-3">
                {accessProof.map((item) => (
                  <div key={item} className="flex min-h-[54px] items-center gap-3 border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white/85">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F5A300]" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-white/10 pt-5 text-sm font-semibold leading-6 text-white/65">
                <p>Courier & Freight Exchange Platform</p>
                <p>Company No. 13171804</p>
                <p>No client funds held by XDrive.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#F4F6F8] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-10 lg:grid-cols-[1.25fr_2fr]">
            <div className="max-w-md">
              <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={210} height={56} className="h-[46px] w-auto" />
              <p className="mt-4 text-base font-black text-[#1D57D8]">Courier & Freight Exchange Platform</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#1D57D8]">
                Posted work, courier quotes, awarded jobs, dispatch, POD and invoice readiness in one controlled workflow.
              </p>
              <div className="mt-5 grid gap-2 border-l border-[#F5A300] pl-4 text-sm font-bold text-[#1D57D8]">
                <span>XDrive Logistics Ltd.</span>
                <span>Company No. 13171804</span>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{group.title}</h2>
                  <div className="mt-4 grid gap-3 text-sm font-bold text-[#1D57D8]">
                    {group.links.map((item) => {
                      const isInternal = item.href.startsWith('#');
                      return isInternal ? (
                        <a key={item.href} href={item.href} className="transition hover:text-[#1D57D8]">{item.label}</a>
                      ) : (
                        <Link key={item.href} href={item.href} className="transition hover:text-[#1D57D8]">{item.label}</Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-[#F4F6F8] pt-6 text-xs font-bold text-[#1D57D8] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2021 XDrive Logistics Ltd. All Rights Reserved.</p>
            <p>Move Freight. Manage Operations. Grow Your Network.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
