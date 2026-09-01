import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export type DetailSection = { title: string; copy: string; points?: string[] };

type VisualMode = 'platform' | 'brokers' | 'couriers' | 'access' | 'default';

const nav = [
  ['Platform', '/platform'],
  ['Brokers', '/brokers'],
  ['Couriers', '/couriers'],
  ['Pricing', '/pricing'],
  ['Access', '/access'],
] as const;

const footerGroups = [
  {
    title: 'Platform',
    links: [
      ['Platform', '/platform'],
      ['Exchange', '/exchange'],
      ['How It Works', '/how-it-works'],
      ['Customers', '/customers'],
      ['Brokers', '/brokers'],
      ['Couriers', '/couriers'],
    ],
  },
  {
    title: 'Product',
    links: [
      ['Operations Diary', '/operations-diary'],
      ['Courier Workspace', '/courier-workspace'],
      ['POD & Records', '/pod-records'],
      ['Finance', '/finance'],
    ],
  },
  {
    title: 'Account',
    links: [
      ['Pricing', '/pricing'],
      ['Request Access', '/register'],
      ['Sign In', '/login'],
      ['Access', '/access'],
      ['Help & FAQ', '/help'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['Contact', '/contact'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Subscription Terms', '/subscription-terms'],
      ['Acceptable Use', '/acceptable-use'],
      ['Cookies', '/cookies'],
      ['Complaints', '/complaints'],
    ],
  },
] as const;

const signatureByMode: Record<VisualMode, { label: string; chips: string[] }> = {
  platform: { label: 'ONE CONNECTED CHAIN', chips: ['POST', 'QUOTE', 'AWARD', 'MOVE', 'POD'] },
  brokers: { label: 'BROKER CONTROL FLOW', chips: ['POST', 'COMPARE', 'AWARD', 'CONTROL'] },
  couriers: { label: 'COURIER OPERATING FLOW', chips: ['FIND', 'QUOTE', 'MOVE', 'PROVE'] },
  access: { label: 'CONTROLLED ENTRY', chips: ['APPLY', 'REVIEW', 'ACTIVATE'] },
  default: { label: 'XDRIVE WORKFLOW', chips: ['CONNECT', 'OPERATE', 'COMPLETE'] },
};

function getVisualMode(kicker: string): VisualMode {
  const value = kicker.toLowerCase();
  if (value.includes('broker')) return 'brokers';
  if (value.includes('courier') || value.includes('carrier')) return 'couriers';
  if (value.includes('access')) return 'access';
  if (value.includes('exchange platform') || value.includes('platform')) return 'platform';
  return 'default';
}

function HeroSignature({ mode }: { mode: VisualMode }) {
  const signature = signatureByMode[mode];
  return (
    <div className="pointer-events-none absolute right-[max(2rem,calc((100vw-1240px)/2))] top-1/2 hidden -translate-y-1/2 xl:block">
      <div className="relative h-[330px] w-[330px]">
        <div className="absolute inset-0 rounded-full border border-[#0E3FA9]/10" />
        <div className="absolute inset-[38px] rounded-full border border-[#0E3FA9]/10" />
        <div className="absolute inset-[76px] rounded-full border border-[#F5A300]/25" />
        <div className="absolute inset-[108px] rounded-full bg-[#071B3C] shadow-[0_24px_70px_rgba(7,27,60,0.16)]" />
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className="max-w-[130px]">
            <p className="text-[0.62rem] font-black tracking-[0.14em] text-[#F5A300]">{signature.label}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {signature.chips.map((chip, index) => (
                <span key={chip} className={`rounded-full px-2 py-1 text-[0.56rem] font-black tracking-[0.08em] ${index === 0 ? 'bg-[#F5A300] text-[#071B3C]' : 'bg-white/10 text-white'}`}>{chip}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionGrid({ sections, mode }: { sections: DetailSection[]; mode: VisualMode }) {
  if (mode === 'brokers') {
    return (
      <div className="mx-auto grid max-w-[1240px] gap-4 lg:grid-cols-12">
        {sections.map((section, index) => {
          const wide = index === 0 || index === 3;
          return (
            <article key={section.title} className={`relative overflow-hidden rounded-2xl border p-7 lg:p-9 ${wide ? 'lg:col-span-7' : 'lg:col-span-5'} ${index === 0 ? 'border-[#0B2F6B] bg-gradient-to-br from-[#071B3C] to-[#0B2F6B] text-white shadow-[0_24px_70px_rgba(7,27,60,0.16)]' : 'border-[#DDE5EF] bg-white'}`}>
              <div className="absolute right-5 top-4 text-7xl font-black leading-none text-[#F5A300]/10">0{index + 1}</div>
              <p className="relative text-xs font-black tracking-[0.16em] text-[#F5A300]">0{index + 1} · BROKER FLOW</p>
              <h2 className={`relative mt-4 text-3xl font-black tracking-tight ${index === 0 ? 'text-white' : 'text-[#0A234F]'}`}>{section.title}</h2>
              <p className={`relative mt-4 max-w-2xl font-semibold leading-7 ${index === 0 ? 'text-white/68' : 'text-[#60758F]'}`}>{section.copy}</p>
              {section.points?.length ? <div className="relative mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{section.points.map(point => <div key={point} className={`flex items-start gap-2 text-sm font-bold ${index === 0 ? 'text-white/82' : 'text-[#385475]'}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A300]" />{point}</div>)}</div> : null}
            </article>
          );
        })}
      </div>
    );
  }

  if (mode === 'couriers') {
    return (
      <div className="mx-auto max-w-[1240px] border-y border-[#DCE4EF]">
        {sections.map((section, index) => (
          <article key={section.title} className="grid gap-6 border-b border-[#DCE4EF] py-8 last:border-b-0 md:grid-cols-[110px_0.8fr_1.2fr] md:items-start lg:py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#F5A300]/40 bg-[#FFF8E8] text-lg font-black text-[#A56B00]">0{index + 1}</div>
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">Courier Stage</p><h2 className="mt-2 text-3xl font-black tracking-tight text-[#0A234F]">{section.title}</h2><p className="mt-3 font-semibold leading-7 text-[#60758F]">{section.copy}</p></div>
            {section.points?.length ? <div className="grid gap-2 rounded-2xl bg-[#071B3C] p-5 text-white shadow-[0_16px_44px_rgba(7,27,60,0.10)] sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">{section.points.map(point => <div key={point} className="flex items-start gap-2 text-sm font-bold text-white/82"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A300]" />{point}</div>)}</div> : null}
          </article>
        ))}
      </div>
    );
  }

  if (mode === 'access') {
    return (
      <div className="mx-auto grid max-w-[1240px] overflow-hidden rounded-[28px] border border-[#DDE5EF] bg-white shadow-[0_24px_70px_rgba(7,27,60,0.08)] md:grid-cols-2">
        {sections.map((section, index) => (
          <article key={section.title} className={`relative p-8 lg:p-10 ${index < 2 ? 'border-b border-[#DDE5EF]' : ''} ${index % 2 === 0 ? 'md:border-r md:border-[#DDE5EF]' : ''} ${index === 0 ? 'bg-[#071B3C] text-white' : ''}`}>
            <p className="text-xs font-black tracking-[0.16em] text-[#F5A300]">STEP 0{index + 1}</p>
            <h2 className={`mt-4 text-3xl font-black tracking-tight ${index === 0 ? 'text-white' : 'text-[#0A234F]'}`}>{section.title}</h2>
            <p className={`mt-4 font-semibold leading-7 ${index === 0 ? 'text-white/68' : 'text-[#60758F]'}`}>{section.copy}</p>
            {section.points?.length ? <div className="mt-6 grid gap-3">{section.points.map(point => <div key={point} className={`flex items-start gap-3 text-sm font-bold ${index === 0 ? 'text-white/82' : 'text-[#385475]'}`}><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A300]" />{point}</div>)}</div> : null}
          </article>
        ))}
      </div>
    );
  }

  if (mode === 'platform') {
    return (
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-px overflow-hidden rounded-[26px] border border-[#DDE5EF] bg-[#DDE5EF] md:grid-cols-2">
          {sections.map((section, index) => (
            <article key={section.title} className={`relative min-h-[300px] p-8 lg:p-10 ${index === 0 || index === 3 ? 'bg-[#071B3C] text-white' : 'bg-white'}`}>
              <div className="flex items-center justify-between"><p className="text-xs font-black tracking-[0.16em] text-[#F5A300]">0{index + 1}</p><span className={`h-2.5 w-2.5 rounded-full ${index === 0 || index === 3 ? 'bg-[#F5A300]' : 'bg-[#0E3FA9]'}`} /></div>
              <h2 className={`mt-8 text-3xl font-black tracking-tight ${index === 0 || index === 3 ? 'text-white' : 'text-[#0A234F]'}`}>{section.title}</h2>
              <p className={`mt-4 max-w-xl font-semibold leading-7 ${index === 0 || index === 3 ? 'text-white/68' : 'text-[#60758F]'}`}>{section.copy}</p>
              {section.points?.length ? <div className="mt-7 flex flex-wrap gap-2">{section.points.map(point => <span key={point} className={`rounded-full border px-3 py-1.5 text-xs font-black ${index === 0 || index === 3 ? 'border-white/15 bg-white/[0.06] text-white/80' : 'border-[#DDE5EF] bg-[#F7F9FC] text-[#385475]'}`}>{point}</span>)}</div> : null}
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1240px] gap-5 md:grid-cols-2">
      {sections.map((section, index) => (
        <article key={section.title} className="rounded-2xl border border-[#E2E8F1] bg-white p-7 shadow-[0_18px_50px_rgba(8,38,86,0.06)] lg:p-9">
          <p className="text-xs font-black tracking-[0.16em] text-[#F5A300]">0{index + 1}</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-[#0A234F]">{section.title}</h2>
          <p className="mt-4 font-semibold leading-7 text-[#60758F]">{section.copy}</p>
          {section.points?.length ? <div className="mt-6 grid gap-3">{section.points.map(point => <div key={point} className="flex items-start gap-3 text-sm font-bold text-[#385475]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1E7A43]" />{point}</div>)}</div> : null}
        </article>
      ))}
    </div>
  );
}

export function MarketingDetailPage({
  kicker,
  title,
  intro,
  sections,
  primaryLabel = 'Start 3 Months Free',
  primaryHref = '/register',
  secondaryLabel = 'Sign In',
  secondaryHref = '/login',
  darkBand,
}: {
  kicker: string;
  title: string;
  intro: string;
  sections: DetailSection[];
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  darkBand?: { title: string; copy: string };
}) {
  const mode = getVisualMode(kicker);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#102447]">
      <header className="sticky top-0 z-50 border-b border-[#E2E8F1] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link>
            <Link href="/pricing" className="hidden rounded-full border border-[#F1D89F] bg-[#FFF7E5] px-3 py-1.5 text-[0.64rem] font-black uppercase tracking-[0.1em] text-[#8A6100] md:inline-flex">3 Months Free</Link>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-black text-[#48607E] lg:flex">
            {nav.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-[#0E3FA9]">{label}</Link>)}
            <Link href="/login" className="transition hover:text-[#0E3FA9]">Sign In</Link>
          </nav>
          <Link href="/register" className="rounded-lg bg-[#0E3FA9] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(14,63,169,0.18)]">Start 3 Months Free</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-white px-5 py-20 sm:px-8 lg:py-28">
          <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-gradient-to-l from-[#F0F5FB] to-transparent xl:block" />
          <HeroSignature mode={mode} />
          <div className="relative mx-auto max-w-[1240px]">
            <div className="inline-flex rounded-full border border-[#F1D89F] bg-[#FFF7E5] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#8A6100]">Early Access · First 3 Months Free</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{kicker}</p>
            <h1 className="mt-5 max-w-[900px] text-[3.2rem] font-black leading-[0.96] tracking-tight text-[#0A234F] sm:text-[4.6rem] lg:text-[5.15rem]">{title}</h1>
            <p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-[#516987]">{intro}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-lg bg-[#0E3FA9] px-6 py-3.5 text-sm font-black text-white">{primaryLabel}<ArrowRight className="h-4 w-4" /></Link>
              <Link href={secondaryHref} className="rounded-lg border border-[#D8E1ED] bg-white px-6 py-3.5 text-sm font-black text-[#0E3FA9]">{secondaryLabel}</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-5 text-sm font-black text-[#385475]"><span>✓ No XDrive commission</span><span>✓ No booking fee</span><span>✓ Monthly rolling after trial</span></div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 lg:py-20">
          <SectionGrid sections={sections} mode={mode} />
        </section>

        {darkBand ? <section className="bg-gradient-to-br from-[#071B3C] to-[#0B2F6B] px-5 py-16 text-white sm:px-8"><div className="mx-auto max-w-[1240px]"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">XDrive Logistics</p><h2 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">{darkBand.title}</h2><p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-white/70">{darkBand.copy}</p></div></section> : null}
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
              {footerGroups.map(group => (
                <div key={group.title}>
                  <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{group.title}</h2>
                  <div className="mt-5 grid gap-3 text-sm font-black text-[#0E3FA9]">
                    {group.links.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-[#071B3C]">{label}</Link>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 border-t border-[#E2E8F1] pt-6 text-xs font-bold leading-5 text-[#60758F]">
            <p>XDrive operates the platform as an intermediary unless it expressly contracts to provide a transport service itself. No client funds are held by XDrive under the current platform model.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>© 2021 XDrive Logistics Ltd. All Rights Reserved.</p>
              <p className="font-black text-[#385475]">Move Freight. Manage Operations. Grow Your Network.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
