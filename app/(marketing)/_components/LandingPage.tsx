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
    kicker: 'Marketplace',
    headline: 'Jobs posted. Quotes received. Work awarded.',
    copy: 'Transport requests move from submission to awarded carrier without leaving the platform.',
    image: '/marketplace-loading.webp',
    alt: 'XDrive marketplace showing job opportunities and quote workflow',
    reverse: true,
  },
  {
    id: 'driver',
    kicker: 'Driver Workspace',
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
    <div className="overflow-hidden border border-[#d7e3f6] bg-white shadow-[0_28px_80px_rgba(8,47,135,0.18)]">
      <div className="flex h-10 items-center justify-between border-b border-[#d7e3f6] bg-[#f7faff] px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f5b21b]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#0b3f9c]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#1f7a3d]" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[#0b3f9c]/70">{label}</span>
      </div>
      <div className="relative aspect-[16/9] bg-[#eaf1fb]">
        <Image src={image} alt={alt} fill className="object-cover" />
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f6f9fd] text-[#071f4f]">
      <header className="sticky top-0 z-50 border-b border-[#d8e3f4] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={218} height={58} priority className="h-[46px] w-auto" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-black text-[#0b3f9c]/70 md:flex">
            <a href="#platform" className="transition hover:text-[#0b3f9c]">Platform</a>
            <a href="#workflow" className="transition hover:text-[#0b3f9c]">Workflow</a>
            <a href="#access" className="transition hover:text-[#0b3f9c]">Access</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/register" className="hidden bg-[#0b3f9c] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#082f7e] sm:inline-flex">
              Request Access
            </Link>
            <button className="inline-flex h-10 w-10 items-center justify-center border border-[#d8e3f4] text-[#0b3f9c] md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="platform" className="relative overflow-hidden bg-white">
          <div className="absolute right-[-22vw] top-[-18vw] h-[58vw] w-[58vw] rounded-full border-[34px] border-[#0b3f9c]" aria-hidden="true" />
          <div className="absolute right-[-18vw] top-[-14vw] h-[50vw] w-[50vw] rounded-full border-[12px] border-[#f5b21b]" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 h-28 w-[48vw] bg-[#0b3f9c]" aria-hidden="true" />
          <div className="absolute bottom-28 left-[34vw] h-4 w-[38vw] -rotate-[28deg] bg-[#f5b21b]" aria-hidden="true" />

          <div className="relative mx-auto grid min-h-[calc(100svh-68px)] max-w-[1500px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-16">
            <div className="max-w-2xl">
              <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={410} height={110} priority className="h-auto w-[310px] max-w-full sm:w-[410px]" />
              <h1 className="mt-8 text-[3.15rem] font-black leading-[0.95] tracking-tight text-[#071f4f] sm:text-[4.7rem] lg:text-[5.7rem]">
                Move freight. Manage operations. Grow your network.
              </h1>
              <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-[#27416f]">
                Requests, quotes, dispatch, POD and invoice readiness connected inside one XDrive operating platform.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 bg-[#0b3f9c] px-6 py-3 text-sm font-black text-white transition hover:bg-[#082f7e]">
                  Request Early Access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 border border-[#0b3f9c]/20 bg-white px-6 py-3 text-sm font-black text-[#0b3f9c] transition hover:bg-[#f2f6ff]">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="relative z-10 grid gap-5">
              <div className="relative min-h-[280px] overflow-hidden border-[10px] border-white bg-[#dce8f7] shadow-[0_30px_90px_rgba(8,47,135,0.25)] sm:min-h-[420px] lg:min-h-[560px]">
                <Image src="/xdrive-courier-fleet-no-plates.webp" alt="XDrive logistics fleet operating across the UK" fill priority className="object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(11,63,156,0.08))]" />
              </div>
              <ProductFrame image="/operations-dispatch-office.webp" alt="XDrive operations diary showing active logistics work" label="Operations Diary" />
            </div>
          </div>
        </section>

        <section className="bg-[#0b3f9c] px-5 py-7 text-white sm:px-8">
          <div className="mx-auto grid max-w-[1500px] gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {brandProof.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex min-h-[74px] items-center gap-4 border-l border-white/20 pl-4">
                  <Icon className="h-8 w-8 shrink-0 text-[#f5b21b]" />
                  <p className="text-lg font-black leading-tight">{item.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="bg-[#f6f9fd] px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-[1500px]">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#f5b21b]">Connected workflow</p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-[#071f4f] sm:text-6xl">Request to POD. One job record.</h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#475b7d]">The same job moves through request, dispatch, delivery evidence and invoice readiness.</p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {workflowFrames.map((frame) => (
                <article key={frame.stage} className="border border-[#d7e3f6] bg-white">
                  <ProductFrame image={frame.image} alt={frame.alt} label={`XD-2048 / ${frame.stage}`} />
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0b3f9c]">{frame.stage}</p>
                    <h3 className="mt-2 text-2xl font-black text-[#071f4f]">{frame.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[#52627c]">{frame.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {productSections.map((section) => (
          <section key={section.id} id={section.id} className="border-t border-[#d7e3f6] bg-white px-5 py-20 sm:px-8 lg:py-24">
            <div className={`mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center ${section.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#f5b21b]">{section.kicker}</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-[#071f4f] sm:text-6xl">{section.headline}</h2>
                <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#475b7d]">{section.copy}</p>
              </div>
              <ProductFrame image={section.image} alt={section.alt} label={section.kicker} />
            </div>
          </section>
        ))}

        <section id="access" className="grid min-h-[86svh] place-items-center bg-[#06101c] px-5 py-20 text-center text-white sm:px-8">
          <div className="mx-auto max-w-4xl">
            <LockKeyhole className="mx-auto h-10 w-10 text-[#f5b21b]" />
            <h2 className="mt-8 text-5xl font-black leading-[0.98] sm:text-7xl">XDrive is in controlled early access.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-semibold leading-7 text-white/65">
              Access is reviewed, not automatic. If your operation fits the current rollout, apply and the team will contact you directly.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 bg-[#f5b21b] px-6 py-3 text-sm font-black text-[#06101c] transition hover:bg-[#ffc940]">
                Request Early Access <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10">
                Sign In
              </Link>
            </div>
            <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
              {['Approved users only', '3-month free access', 'UK-focused rollout'].map((item) => (
                <div key={item} className="flex items-center gap-3 border border-white/10 bg-white/5 p-4 text-sm font-bold text-white/80">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#f5b21b]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d7e3f6] bg-white px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-8 text-sm font-semibold text-[#52627c] md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <Image src="/xdrive-logo-horizontal.png" alt="XDrive Logistics" width={190} height={50} className="h-[42px] w-auto" />
            <p className="mt-2">Company No. 13171804 / UK-focused rollout</p>
          </div>
          <div className="flex flex-wrap gap-5 font-black text-[#0b3f9c]">
            <a href="#platform" className="transition hover:text-[#f5b21b]">Platform</a>
            <a href="#workflow" className="transition hover:text-[#f5b21b]">Workflow</a>
            <Link href="/privacy" className="transition hover:text-[#f5b21b]">Privacy</Link>
            <Link href="/terms" className="transition hover:text-[#f5b21b]">Terms</Link>
          </div>
          <p className="md:text-right">2026 XDrive Logistics Ltd. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
