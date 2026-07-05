import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileCheck2, LockKeyhole, Menu, ShieldCheck } from 'lucide-react';

const proofStrip = [
  { label: 'Access', value: 'Controlled early access' },
  { label: 'Workflow', value: 'Request to invoice readiness' },
  { label: 'Evidence', value: 'POD attached to job records' },
  { label: 'Payments', value: 'Records only, no funds held' },
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
    id: 'pod',
    kicker: 'POD & Records',
    headline: 'Delivery evidence. Attached to the job. Permanently.',
    copy: 'POD records remain connected to the job, driver, timestamp and completion history.',
    image: '/xdrive-driver-pod-real.webp',
    alt: 'XDrive proof of delivery workflow with mobile delivery evidence',
    reverse: false,
  },
  {
    id: 'finance',
    kicker: 'Finance',
    headline: 'Invoice readiness. Built into the workflow.',
    copy: 'When the job is done, the invoice context is already tied to the operational record.',
    image: '/xdrive-finance-records-real.webp',
    alt: 'XDrive finance workspace showing invoice readiness and linked job records',
    reverse: true,
  },
] as const;

function ProductFrame({ image, alt, label }: { image: string; alt: string; label: string }) {
  return (
    <div className="overflow-hidden border border-white/10 bg-[#0d1b2e] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
      <div className="flex h-9 items-center gap-2 border-b border-white/10 bg-[#111f33] px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
        <span className="ml-3 text-xs font-semibold text-white/45">{label}</span>
      </div>
      <div className="relative aspect-[16/9] bg-[#07111f]">
        <Image src={image} alt={alt} fill className="object-cover" />
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#06101c] text-[#f8fafc]">
      <header className="sticky top-0 z-50 border-b border-white/7 bg-[#06101c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-[1500px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="leading-none">
            <span className="block text-lg font-black tracking-tight text-white">XDrive</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">Logistics</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-white/55 md:flex">
            <a href="#platform" className="transition hover:text-white">Platform</a>
            <a href="#workflow" className="transition hover:text-white">Workflow</a>
            <a href="#access" className="transition hover:text-white">Access</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/register" className="hidden bg-[#2563eb] px-4 py-2 text-sm font-black text-white transition hover:bg-[#1d4ed8] sm:inline-flex">
              Request Access
            </Link>
            <button className="inline-flex h-10 w-10 items-center justify-center border border-white/10 text-white md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="platform" className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 lg:min-h-[calc(100svh-60px)] lg:pb-20 lg:pt-16">
          <div className="mx-auto max-w-[1500px] text-center">
            <h1 className="mx-auto max-w-5xl text-[4rem] font-black leading-[0.9] tracking-tight text-white sm:text-[6rem] lg:text-[8rem]">
              XDrive
              <span className="mt-3 block text-[2.35rem] leading-[0.98] text-white/92 sm:text-[4rem] lg:text-[5.4rem]">Transport operations. Built to run.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
              Requests, quotes, dispatch, POD and invoice readiness connected inside one operational platform.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/register" className="inline-flex items-center gap-2 bg-[#2563eb] px-6 py-3 text-sm font-black text-white transition hover:bg-[#1d4ed8]">
                Request Early Access <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mx-auto mt-12 max-w-[1320px] lg:mt-16">
              <ProductFrame
                image="/operations-dispatch-office.webp"
                alt="XDrive operations diary showing active logistics work"
                label="Operations Diary"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-white/7 bg-[#0d1b2e] px-5 py-6 sm:px-8">
          <div className="mx-auto grid max-w-[1500px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {proofStrip.map((item) => (
              <div key={item.label} className="border-l border-white/10 pl-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{item.label}</p>
                <p className="mt-2 text-lg font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="workflow" className="px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-[1500px]">
            <div className="max-w-3xl">
              <h2 className="text-4xl font-black leading-tight text-white sm:text-6xl">Request to POD. One job record.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/55">The same job moves through request, dispatch, delivery evidence and invoice readiness.</p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {workflowFrames.map((frame) => (
                <article key={frame.stage} className="border border-white/7 bg-[#0d1b2e]">
                  <ProductFrame image={frame.image} alt={frame.alt} label={`XD-2048 / ${frame.stage}`} />
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#60a5fa]">{frame.stage}</p>
                    <h3 className="mt-2 text-2xl font-black text-white">{frame.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/55">{frame.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {productSections.map((section) => (
          <section key={section.id} id={section.id} className="border-t border-white/7 px-5 py-20 sm:px-8 lg:py-24">
            <div className={`mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center ${section.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#60a5fa]">{section.kicker}</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">{section.headline}</h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/55">{section.copy}</p>
              </div>
              <ProductFrame image={section.image} alt={section.alt} label={section.kicker} />
            </div>
          </section>
        ))}

        <section className="border-t border-white/7 px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-[1500px]">
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#60a5fa]">Driver Workspace</p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-white sm:text-6xl">Dispatched here. Worked there. Same job record.</h2>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-center">
              <ProductFrame
                image="/operations-dispatch-office.webp"
                alt="Dispatcher job assignment panel inside XDrive"
                label="Dispatcher assignment"
              />
              <div className="mx-auto w-full max-w-[360px] rounded-[34px] border border-white/12 bg-[#0d1b2e] p-3 shadow-[0_30px_110px_rgba(0,0,0,0.42)]">
                <div className="relative aspect-[9/18] overflow-hidden rounded-[26px] bg-[#07111f]">
                  <Image src="/xdrive-driver-workspace-real.webp" alt="XDrive mobile driver workspace showing an active job" fill className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="access" className="grid min-h-[92svh] place-items-center border-t border-white/7 px-5 py-20 text-center sm:px-8">
          <div className="mx-auto max-w-4xl">
            <LockKeyhole className="mx-auto h-9 w-9 text-[#60a5fa]" />
            <h2 className="mt-8 text-5xl font-black leading-[0.98] text-white sm:text-7xl">XDrive is in controlled early access.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55">
              Access is reviewed, not automatic. If your operation fits the current rollout, apply and the team will contact you directly.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 bg-[#2563eb] px-6 py-3 text-sm font-black text-white transition hover:bg-[#1d4ed8]">
                Request Early Access <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 border border-white/15 px-6 py-3 text-sm font-black text-white transition hover:bg-white/8">
                Sign In
              </Link>
            </div>
            <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
              {['Approved users only', '3-month free access', 'UK-focused rollout'].map((item) => (
                <div key={item} className="flex items-center gap-3 border border-white/7 bg-white/5 p-4 text-sm font-bold text-white/75">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#60a5fa]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/7 px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-[1500px] gap-8 text-sm text-white/45 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-lg font-black text-white">XDrive</p>
            <p className="mt-2">Company No. 13171804 / UK-focused rollout</p>
          </div>
          <div className="flex flex-wrap gap-5 font-semibold">
            <a href="#platform" className="transition hover:text-white">Platform</a>
            <a href="#workflow" className="transition hover:text-white">Workflow</a>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
          </div>
          <p className="md:text-right">2026 XDrive Logistics Ltd. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
