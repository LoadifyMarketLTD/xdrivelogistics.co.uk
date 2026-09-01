import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export type DetailSection = { title: string; copy: string; points?: string[] };

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

export function MarketingDetailPage({
  kicker,
  title,
  intro,
  sections,
  primaryLabel = 'Request Early Access',
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
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#102447]">
      <header className="sticky top-0 z-50 border-b border-[#E2E8F1] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link>
          <nav className="hidden items-center gap-6 text-sm font-black text-[#48607E] lg:flex">
            {nav.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-[#0E3FA9]">{label}</Link>)}
            <Link href="/login" className="transition hover:text-[#0E3FA9]">Sign In</Link>
          </nav>
          <Link href="/register" className="bg-[#0E3FA9] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(14,63,169,0.18)]">Start Free</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-white px-5 py-20 sm:px-8 lg:py-28">
          <div className="absolute -right-40 top-10 h-[420px] w-[420px] rounded-full border border-[#0E3FA9]/10 shadow-[0_0_0_70px_rgba(14,63,169,0.025),0_0_0_140px_rgba(14,63,169,0.018)]" />
          <div className="relative mx-auto max-w-[1240px]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{kicker}</p>
            <h1 className="mt-5 max-w-5xl text-[3.2rem] font-black leading-[0.96] tracking-tight text-[#0A234F] sm:text-[4.6rem] lg:text-[5.4rem]">{title}</h1>
            <p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-[#516987]">{intro}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-lg bg-[#0E3FA9] px-6 py-3.5 text-sm font-black text-white">{primaryLabel}<ArrowRight className="h-4 w-4" /></Link>
              <Link href={secondaryHref} className="rounded-lg border border-[#D8E1ED] bg-white px-6 py-3.5 text-sm font-black text-[#0E3FA9]">{secondaryLabel}</Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:py-24">
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
