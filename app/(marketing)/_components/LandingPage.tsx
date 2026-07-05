import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CircleCheckBig,
  ClipboardList,
  FileCheck2,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';

import { MarketingFooter } from './sections/MarketingFooter';
import { MarketingHeader } from './sections/MarketingHeader';

const featureCards = [
  {
    title: 'Freight Exchange',
    description: 'Access thousands of freight opportunities across the UK.',
    icon: PackageCheck,
  },
  {
    title: 'Courier & Van Jobs',
    description: 'Find and book courier and van jobs that suit your schedule.',
    icon: Truck,
  },
  {
    title: 'Operations Management',
    description: 'Manage jobs, drivers, vehicles and routes in one place.',
    icon: ClipboardList,
  },
  {
    title: 'POD & Invoicing',
    description: 'Capture PODs, generate invoices and get paid with ease.',
    icon: FileCheck2,
  },
] as const;

const topStats = [
  { value: '5,000+', label: 'Active Users', icon: Users },
  { value: '25,000+', label: 'Jobs Completed', icon: Truck },
  { value: '1.2M+', label: 'Miles Delivered', icon: MapPin },
  { value: '99.5%', label: 'On-Time Delivery', icon: ShieldCheck },
] as const;

const workflow = [
  { step: '1', title: 'Post a Job', text: 'Share your job details in minutes.' },
  { step: '2', title: 'Get Quotes', text: 'Receive competitive quotes from verified carriers.' },
  { step: '3', title: 'Award the Job', text: 'Choose the best match for your delivery needs.' },
  { step: '4', title: 'Track & Manage', text: 'Real-time updates from pickup to delivery.' },
  { step: '5', title: 'POD & Invoice', text: 'Confirm delivery and get paid directly.' },
] as const;

export function LandingPage() {
  return (
    <div className="bg-[#f6f8fc] text-[#0f172a]">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-[1700px] px-3 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[26px] border border-[#d8deeb] bg-white shadow-[0_12px_40px_rgba(15,30,84,0.1)]">
          <div className="grid border-b border-[#e5eaf5] lg:grid-cols-[0.92fr_1.08fr]">
            <div className="px-5 pb-10 pt-10 sm:px-9 lg:px-11 lg:pb-12 lg:pt-12">
              <h1 className="text-balance text-[2rem] font-extrabold leading-[1.06] text-[#0b2a72] sm:text-[2.7rem] lg:text-[4.2rem]">
                <span className="text-[#f2ab17]">Move</span> Freight.
                <br />
                <span className="text-[#f2ab17]">Manage</span> Operations.
                <br />
                <span className="text-[#f2ab17]">Grow</span> Your Network.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#213b78]">
                XDrive Logistics is the UK&apos;s smart logistics platform that connects businesses, drivers, and vehicles. One platform. Endless
                opportunities.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1849d6] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#113bb5]"
                >
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/request-quote"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2450d7] bg-white px-6 py-3 text-sm font-semibold text-[#173fba] transition hover:bg-[#f4f7ff]"
                >
                  Explore Platform <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="relative min-h-[320px] lg:min-h-full">
              <Image src="/xdrive-courier-fleet-no-plates.webp" alt="XDrive Logistics truck in transit" fill className="object-cover" priority />
              <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(8,43,143,0.88)_0%,rgba(8,43,143,0.3)_32%,rgba(8,43,143,0)_56%)]" />
              <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-[#0f2f97]/90 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                <MapPin className="h-4 w-4 text-[#f3b215]" />
                UK-Wide Coverage
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-2xl border border-[#dbe3f2] bg-white p-5 shadow-[0_4px_16px_rgba(15,30,84,0.08)]">
                  <div className="mb-4 inline-flex rounded-xl bg-[#edf2ff] p-3 text-[#1849d6]">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0c2f8d]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#26407c]">{card.description}</p>
                </article>
              );
            })}
          </div>

          <div className="grid gap-4 bg-[linear-gradient(120deg,#082982_0%,#0a2f97_55%,#0c3db0_100%)] px-5 py-4 text-white sm:grid-cols-2 lg:grid-cols-4 lg:px-7">
            {topStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                  <Icon className="h-6 w-6 text-[#f3b215]" />
                  <div>
                    <p className="text-3xl font-extrabold leading-none">{stat.value}</p>
                    <p className="mt-1 text-sm text-white/90">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 px-5 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-10">
            <div>
              <h2 className="text-3xl font-extrabold text-[#0b2a72] sm:text-4xl">
                How <span className="text-[#f2ab17]">XDrive</span> Logistics Works
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {workflow.map((item) => (
                  <article key={item.step} className="rounded-2xl border border-[#dbe3f2] bg-[#fbfcff] p-4">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3b215] text-xs font-bold text-white">{item.step}</span>
                    <h3 className="mt-3 text-base font-bold text-[#0c2f8d]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#2b467f]">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border border-[#dbe3f2] bg-white p-5 shadow-[0_6px_20px_rgba(15,30,84,0.1)] sm:p-6">
              <h3 className="text-2xl font-extrabold text-[#0b2a72]">All-in-One Platform</h3>
              <p className="mt-2 text-sm leading-6 text-[#24407a]">Everything you need to run your logistics operations from one powerful dashboard.</p>
              <div className="mt-4 space-y-2">
                {['Real-time job tracking', 'Driver & vehicle management', 'Proof of delivery', 'Invoicing & payments'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm font-medium text-[#123893]">
                    <CircleCheckBig className="h-4 w-4 text-[#1d4ed8]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/register"
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#2450d7] bg-white px-5 py-2.5 text-sm font-semibold text-[#173fba] transition hover:bg-[#f4f7ff]"
              >
                See Platform in Action <ArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
