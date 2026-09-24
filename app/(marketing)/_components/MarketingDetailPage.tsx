import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SocialShareBar } from './SocialShareBar';

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

const modeLabel: Record<VisualMode, string> = {
  platform: 'PLATFORM FLOW',
  brokers: 'BROKER FLOW',
  couriers: 'COURIER FLOW',
  access: 'ACCESS STEP',
  default: 'XDRIVE FLOW',
};

function getVisualMode(kicker: string): VisualMode {
  const value = kicker.toLowerCase();
  if (value.includes('broker')) return 'brokers';
  if (value.includes('courier') || value.includes('carrier')) return 'couriers';
  if (value.includes('access')) return 'access';
  if (value.includes('exchange platform') || value.includes('platform')) return 'platform';
  return 'default';
}

function SectionGrid({ sections, mode }: { sections: DetailSection[]; mode: VisualMode }) {
  return (
    <div className="mx-auto grid max-w-[1440px] gap-5 md:grid-cols-2">
      {sections.map((section, index) => (
        <article
          key={section.title}
          className="relative flex min-h-[330px] flex-col overflow-hidden rounded-[24px] border border-[#DDE5EF] bg-white p-7 text-[#102447] shadow-[0_18px_45px_rgba(7,27,60,0.08)] lg:p-8"
        >
          <div className="absolute right-6 top-4 text-7xl font-black leading-none text-[#DCE5F0]">0{index + 1}</div>
          <p className="relative text-[0.7rem] font-black uppercase tracking-[0.17em] text-[#F5A300]">{modeLabel[mode]} · 0{index + 1}</p>
          <h2 className="relative mt-4 text-3xl font-black tracking-tight text-[#102447]">{section.title}</h2>
          <p className="relative mt-4 max-w-xl font-semibold leading-7 text-[#60758F]">{section.copy}</p>
          {section.points?.length ? (
            <div className="relative mt-7 grid gap-3 border-t border-[#E7EDF4] pt-5">
              {section.points.map(point => (
                <div key={point} className="flex items-start gap-3 text-sm font-bold text-[#405978]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A300]" />
                  {point}
                </div>
              ))}
            </div>
          ) : null}
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
  activeNavHref,
  darkBand,
  heroMap = true,
}: {
  kicker: string;
  title: string;
  intro: string;
  sections: DetailSection[];
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  activeNavHref?: string;
  darkBand?: { title: string; copy: string };
  heroMap?: boolean;
}) {
  const mode = getVisualMode(kicker);

  return (
    <div className="marketing-editorial min-h-screen bg-[#F4F6FA] text-[#102447]">
      <header className="sticky top-0 z-50 border-b border-[#DDE5EF] bg-white/95 text-[#163568] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} priority className="h-[44px] w-auto" /></Link>
          <nav className="hidden items-center gap-6 text-sm font-black text-[#163568] lg:flex">
            {nav.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className={href === activeNavHref ? 'text-[#F5A300]' : 'transition hover:text-[#0E3FA9]'}
              >
                {label}
              </Link>
            ))}
            <Link href="/login" className="transition hover:text-[#0E3FA9]">Sign In</Link>
          </nav>
          <Link href="/register" className="rounded-lg bg-[#163568] px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(22,53,104,0.14)]">Start 3 Months Free</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#DDE5EF] bg-white px-5 py-16 text-[#102447] sm:px-8 lg:py-20">
          {heroMap ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] overflow-hidden lg:block" aria-hidden="true">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/0/08/United_Kingdom_satellite_image.png')" }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,#FFFFFF_0%,rgba(255,255,255,0.96)_10%,rgba(255,255,255,0.62)_34%,rgba(255,255,255,0.16)_67%,rgba(255,255,255,0.02)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(10,35,79,0.08))]" />
              <svg viewBox="0 0 760 520" className="absolute inset-0 h-full w-full" role="presentation">
                <defs>
                  <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <g fill="none" stroke="#F5A300" strokeWidth="3.4" strokeLinecap="round" filter="url(#routeGlow)" opacity="0.92">
                  <path d="M454 86 C472 130 480 170 464 214 C450 250 458 286 486 322 C507 349 514 383 502 420" />
                  <path d="M464 214 C520 218 558 244 586 284" />
                  <path d="M486 322 C432 334 394 356 366 392" />
                  <path d="M486 322 C542 337 590 362 626 400" />
                </g>
                <g fill="#F5A300" stroke="#FFFFFF" strokeWidth="5">
                  <circle cx="454" cy="86" r="8" /><circle cx="464" cy="214" r="8" /><circle cx="486" cy="322" r="8" />
                  <circle cx="502" cy="420" r="8" /><circle cx="586" cy="284" r="8" /><circle cx="366" cy="392" r="8" /><circle cx="626" cy="400" r="8" />
                </g>
              </svg>
              <div className="absolute right-[16%] top-[15%] rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-[0_14px_36px_rgba(7,27,60,0.18)] backdrop-blur-md">
                <p className="text-xs font-black text-[#0A234F]">Glasgow</p><p className="mt-0.5 text-[0.68rem] font-bold text-[#60758F]">Network hub</p>
              </div>
              <div className="absolute right-[10%] top-[41%] rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-[0_14px_36px_rgba(7,27,60,0.18)] backdrop-blur-md">
                <p className="text-xs font-black text-[#0A234F]">Leeds</p><p className="mt-0.5 text-[0.68rem] font-bold text-[#60758F]">Transport network</p>
              </div>
              <div className="absolute right-[32%] top-[45%] rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-[0_14px_36px_rgba(7,27,60,0.18)] backdrop-blur-md">
                <p className="text-xs font-black text-[#0A234F]">Manchester</p><p className="mt-0.5 text-[0.68rem] font-bold text-[#60758F]">Network hub</p>
              </div>
              <div className="absolute right-[18%] bottom-[17%] rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-[0_14px_36px_rgba(7,27,60,0.18)] backdrop-blur-md">
                <p className="text-xs font-black text-[#0A234F]">London</p><p className="mt-0.5 text-[0.68rem] font-bold text-[#60758F]">Transport network</p>
              </div>
              <div className="absolute bottom-5 right-6 text-[0.6rem] font-bold text-white/80 drop-shadow">Satellite imagery: NASA/GSFC · public domain</div>
            </div>
          ) : null}
          <div className="relative mx-auto max-w-[1240px]">
            <div className="flex flex-col items-start gap-2">
              <p className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-[#F5A300]">Early Access · First 3 Months Free</p>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{kicker}</p>
            </div>
            <h1 className={`mt-5 max-w-[980px] text-[3.2rem] font-black leading-[0.96] tracking-tight text-[#102447] sm:text-[4.6rem] lg:text-[5.15rem] ${heroMap ? 'lg:max-w-[690px]' : ''}`}>{title}</h1>
            <p className={`mt-7 max-w-3xl text-lg font-semibold leading-8 text-[#60758F] ${heroMap ? 'lg:max-w-[650px]' : ''}`}>{intro}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-lg bg-[#F5A300] px-6 py-3.5 text-sm font-black text-[#102447]">{primaryLabel}<ArrowRight className="h-4 w-4" /></Link>
              <Link href={secondaryHref} className="rounded-lg border border-[#C9D5E4] bg-[#F7F9FC] px-6 py-3.5 text-sm font-black text-[#163568]">{secondaryLabel}</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-5 text-sm font-black text-[#405978]"><span>✓ No XDrive commission</span><span>✓ No booking fee</span><span>✓ Monthly rolling after trial</span></div>
            <SocialShareBar pageTitle={title} />
          </div>
        </section>

        <section className="border-t border-[#DDE5EF] bg-gradient-to-b from-[#F8FAFD] to-[#EEF3F8] px-5 py-14 sm:px-8 lg:py-16">
          <SectionGrid sections={sections} mode={mode} />

          {darkBand ? (
            <div className="mx-auto mt-6 max-w-[1440px] rounded-[24px] border border-[#1B3D6B] bg-gradient-to-br from-[#163568] to-[#102B55] p-7 text-white shadow-[0_18px_45px_rgba(7,27,60,0.10)] lg:p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5A300]">XDrive Logistics</p>
              <h2 className="mt-3 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">{darkBand.title}</h2>
              <p className="mt-4 max-w-3xl font-semibold leading-7 text-white/70">{darkBand.copy}</p>
            </div>
          ) : null}
        </section>
      </main>

      <footer className="relative border-t border-[#DDE5EF] bg-white px-5 pt-12 sm:px-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#163568]" />
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-10 pb-10 xl:grid-cols-[1.15fr_2.85fr]">
            <div>
              <Link href="/" className="inline-flex"><Image src="/xdrive-logo-primary.png" alt="XDrive Logistics" width={218} height={59} className="h-[46px] w-auto" /></Link>
              <p className="mt-4 text-base font-black text-[#163568]">Courier &amp; Freight Exchange Platform</p>
              <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-[#60758F]">Posted work, courier quotes, awarded jobs, dispatch, POD and invoice readiness in one controlled workflow.</p>
              <div className="mt-5 rounded-[24px] border border-[#1B3D6B] bg-gradient-to-br from-[#163568] to-[#102B55] p-5 text-sm font-bold leading-6 text-[#D8E4F3] shadow-[0_18px_45px_rgba(7,27,60,0.12)]">
                <p className="font-black text-white">XDrive Logistics Ltd.</p>
                <p>Company No. 13171804</p>
                <p>Registered in England and Wales</p>
                <p>Registered office: 101 Cornelian Street, Blackburn, England, BB1 9QL</p>
                <p>VAT No. GB 375949535</p>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {footerGroups.map(group => (
                <div key={group.title}>
                  <h2 className="text-[0.72rem] font-black uppercase tracking-[0.19em] text-[#F5A300]">{group.title}</h2>
                  <div className="mt-5 grid gap-3 text-sm font-black text-[#163568]">
                    {group.links.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-[#0E3FA9]">{label}</Link>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="-mx-5 border-t border-white/10 bg-gradient-to-br from-[#163568] to-[#102B55] px-5 py-5 text-xs font-bold leading-5 text-[#D8E4F3] sm:-mx-8 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <p className="text-[#D8E4F3]">XDrive operates the platform as an intermediary unless it expressly contracts to provide a transport service itself. No client funds are held by XDrive under the current platform model.</p>
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[#D8E4F3]">© 2021 XDrive Logistics Ltd. All Rights Reserved.</p>
              <p className="font-black text-white">Move Freight. Manage Operations. <span className="text-[#F5A300]">Grow Your Network.</span></p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
