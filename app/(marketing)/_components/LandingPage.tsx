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

const brandProof = [
  { label: 'UK-Wide Coverage', icon: MapPin },
  { label: 'Secure Transport', icon: ShieldCheck },
  { label: 'Live Updates', icon: Route },
  { label: 'Proof of Delivery', icon: FileCheck2 },
  { label: 'Professional Network', icon: Users },
] as const;

const workflowFrames = [
  {
    stage: 'Request',
    title: 'Job created',
    detail: 'Collection, delivery, vehicle and timing requirements captured against one job record.',
    image: '/marketplace-loading.webp',
    alt: 'XDrive marketplace workflow showing a transport request and quoting context',
  },
  {
    stage: 'Dispatch',
    title: 'Driver assigned',
    detail: 'The same job moves into dispatch with status, route and driver context visible.',
    image: '/operations-dispatch-office.webp',
    alt: 'XDrive operations diary showing dispatch activity and active job coordination',
  },
  {
    stage: 'Close',
    title: 'POD ready',
    detail: 'Delivery evidence and invoice context stay connected to the completed job.',
    image: '/xdrive-finance-records-real.webp',
    alt: 'XDrive finance records showing invoice and proof of delivery context',
  },
] as const;

const productSections = [
  {
    id: 'operations',
    kicker: 'Operations Diary',
    headline: 'Dispatch. Everything. Live.',
    copy: 'Active jobs, exceptions, driver locations and status changes in one operational view.',
    image: '/operations-dispatch-office.webp',
    alt: 'XDrive operations diary with live dispatch and job visibility',
    reverse: false,
  },
  {
    id: 'marketplace',
    kicker: 'Freight Exchange',
    headline: 'Jobs posted. Quotes received. Work awarded.',
    copy: 'Courier and freight requests move from submission to awarded carrier without leaving the platform.',
    image: '/marketplace-loading.webp',
    alt: 'XDrive marketplace showing job opportunities and quote workflow',
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

function ProductFrame({ image, alt, label }: { image: string; alt: string; label: string }) {
  return (
    <div className="overflow-hidden border border-[#D7E6FA] bg-white shadow-[0_28px_80px_rgba(0,59,143,0.18)]">
      <div className="flex h-10 items-center justify-between border-b border-[#D7E6FA] bg-[#F8FBFF] px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FDB913]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#003B8F]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#1F7A3D]" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[#003B8F]/70">{label}</span>
      </div>
      <div className="relative aspect-[16/9] bg-[#EEF6FF]">
        <Image src={image} alt={alt} fill className="object-cover" />
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7FAFF] text-[#002B6C]">
      <header className="sticky top-0 z-50 border-b border-[#D7E6FA] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={218} height={58} priority className="h-[46px] w-auto" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-black text-[#003B8F]/70 md:flex">
            <a href="#platform" className="transition hover:text-[#003B8F]">Platform</a>
            <a href="#workflow" className="transition hover:text-[#003B8F]">Workflow</a>
            <a href="#access" className="transition hover:text-[#003B8F]">Access</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/register" className="hidden bg-[#003B8F] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#002D73] sm:inline-flex">
              Request Access
            </Link>
            <button className="inline-flex h-10 w-10 items-center justify-center border border-[#D7E6FA] text-[#003B8F] md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="platform" className="relative overflow-hidden bg-white">
          <div className="absolute right-[-22vw] top-[-18vw] h-[58vw] w-[58vw] rounded-full border-[34px] border-[#003B8F]" aria-hidden="true" />
          <div className="absolute right-[-18vw] top-[-14vw] h-[50vw] w-[50vw] rounded-full border-[12px] border-[#FDB913]" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 h-28 w-[48vw] bg-[#003B8F]" aria-hidden="true" />
          <div className="absolute bottom-28 left-[34vw] h-4 w-[38vw] -rotate-[28deg] bg-[#FDB913]" aria-hidden="true" />

          <div className="relative mx-auto grid min-h-[calc(100svh-68px)] max-w-[1500px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-16">
            <div className="max-w-2xl">
              <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={410} height={110} priority className="h-auto w-[310px] max-w-full sm:w-[410px]" />
              <p className="mt-7 text-sm font-black uppercase tracking-[0.18em] text-[#FDB913]">Courier &amp; Freight Exchange Platform</p>
              <h1 className="mt-4 text-[3.15rem] font-black leading-[0.95] tracking-tight text-[#002B6C] sm:text-[4.7rem] lg:text-[5.7rem]">
                Move freight. Manage operations. Grow your network.
              </h1>
              <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-[#24416F]">
                XDrive Logistics connects courier, freight exchange, dispatch, POD and invoice-readiness workflows inside one operating platform.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 bg-[#003B8F] px-6 py-3 text-sm font-black text-white transition hover:bg-[#002D73]">
                  Request Early Access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 border border-[#003B8F]/20 bg-white px-6 py-3 text-sm font-black text-[#003B8F] transition hover:bg-[#F0F6FF]">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="relative z-10 grid gap-5">
              <div className="relative min-h-[280px] overflow-hidden border-[10px] border-white bg-[#E4F0FF] shadow-[0_30px_90px_rgba(0,59,143,0.25)] sm:min-h-[420px] lg:min-h-[560px]">
                <Image src="/xdrive-courier-fleet-no-plates.webp" alt="XDrive logistics fleet operating across the UK" fill priority className="object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(0,59,143,0.08))]" />
              </div>
              <ProductFrame image="/operations-dispatch-office.webp" alt="XDrive operations diary showing active logistics work" label="Courier & Freight Exchange Platform" />
            </div>
          </div>
        </section>

        <section className="bg-[#003B8F] px-5 py-7 text-white sm:px-8">
          <div className="mx-auto grid max-w-[1500px] gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {brandProof.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex min-h-[74px] items-center gap-4 border-l border-white/20 pl-4">
                  <Icon className="h-8 w-8 shrink-0 text-[#FDB913]" />
                  <p className="text-lg font-black leading-tight">{item.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="bg-[#F7FAFF] px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-[1500px]">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#FDB913]">Connected workflow</p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-[#002B6C] sm:text-6xl">Request to POD. One job record.</h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#49607F]">The same job moves through request, dispatch, delivery evidence and invoice readiness.</p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {workflowFrames.map((frame) => (
                <article key={frame.stage} className="border border-[#D7E6FA] bg-white">
                  <ProductFrame image={frame.image} alt={frame.alt} label={`XD-2048 / ${frame.stage}`} />
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#003B8F]">{frame.stage}</p>
                    <h3 className="mt-2 text-2xl font-black text-[#002B6C]">{frame.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[#49607F]">{frame.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {productSections.map((section) => (
          <section key={section.id} id={section.id} className="border-t border-[#D7E6FA] bg-white px-5 py-20 sm:px-8 lg:py-24">
            <div className={`mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center ${section.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#FDB913]">{section.kicker}</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-[#002B6C] sm:text-6xl">{section.headline}</h2>
                <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#49607F]">{section.copy}</p>
              </div>
              <ProductFrame image={section.image} alt={section.alt} label={section.kicker} />
            </div>
          </section>
        ))}

        <section id="access" className="grid min-h-[86svh] place-items-center bg-[#002B6C] px-5 py-20 text-center text-white sm:px-8">
          <div className="mx-auto max-w-4xl">
            <LockKeyhole className="mx-auto h-10 w-10 text-[#FDB913]" />
            <h2 className="mt-8 text-5xl font-black leading-[0.98] sm:text-7xl">XDrive Logistics is in controlled early access.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-semibold leading-7 text-white/70">
              Access is reviewed, not automatic. If your courier or freight operation fits the current rollout, apply and the team will contact you directly.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 bg-[#FDB913] px-6 py-3 text-sm font-black text-[#002B6C] transition hover:bg-[#FFD24A]">
                Request Early Access <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10">
                Sign In
              </Link>
            </div>
            <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
              {['Courier & freight exchange', '3-month free access', 'UK-focused rollout'].map((item) => (
                <div key={item} className="flex items-center gap-3 border border-white/10 bg-white/5 p-4 text-sm font-bold text-white/85">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FDB913]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#D7E6FA] bg-white px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-8 text-sm font-semibold text-[#49607F] md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={190} height={50} className="h-[42px] w-auto" />
            <p className="mt-2">Courier & Freight Exchange Platform / Company No. 13171804</p>
          </div>
          <div className="flex flex-wrap gap-5 font-black text-[#003B8F]">
            <a href="#platform" className="transition hover:text-[#FDB913]">Platform</a>
            <a href="#workflow" className="transition hover:text-[#FDB913]">Workflow</a>
            <Link href="/privacy" className="transition hover:text-[#FDB913]">Privacy</Link>
            <Link href="/terms" className="transition hover:text-[#FDB913]">Terms</Link>
          </div>
          <p className="md:text-right">2026 XDrive Logistics Ltd. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
