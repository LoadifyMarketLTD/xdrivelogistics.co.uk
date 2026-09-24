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
  heroMap = false,
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
    <div className="min-h-screen bg-[#F4F6FA] text-[#102447]">
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
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block" aria-hidden="true">
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-white/5" />
              <svg viewBox="0 0 760 520" className="h-full w-full opacity-[0.42]" role="presentation">
                <defs>
                  <linearGradient id="mapSea" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#EAF5FB" />
                    <stop offset="100%" stopColor="#D9ECF7" />
                  </linearGradient>
                  <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" />
                  </filter>
                </defs>
                <rect width="760" height="520" fill="url(#mapSea)" />
                <g fill="none" stroke="#B9D0DF" strokeWidth="1.2" opacity="0.8">
                  <path d="M40 84 C170 40 250 72 350 52 S570 30 730 72" />
                  <path d="M10 150 C160 120 270 130 420 112 S620 95 760 130" />
                  <path d="M0 235 C170 210 280 222 430 198 S640 190 760 210" />
                  <path d="M20 322 C150 290 300 310 440 288 S620 270 760 300" />
                  <path d="M30 412 C180 372 300 392 430 370 S620 350 750 385" />
                </g>
                <g fill="#F7FAFC" stroke="#C7D8E4" strokeWidth="1.2">
                  <path d="M345 58 C325 82 318 112 333 136 C347 160 346 188 328 213 C310 238 315 262 339 278 C365 296 363 326 345 350 C326 377 337 405 363 424 C391 444 421 431 432 405 C444 380 439 353 453 329 C470 300 465 270 446 247 C427 225 425 202 441 178 C458 153 455 124 438 101 C421 77 386 53 345 58 Z" />
                  <path d="M305 171 C287 190 282 216 295 233 C309 250 306 271 292 287 C278 304 284 328 301 337 C315 344 327 337 332 324 C338 309 328 291 337 278 C346 264 340 244 330 232 C319 219 321 201 329 188 C337 176 322 160 305 171 Z" />
                  <path d="M391 30 C405 25 417 34 415 47 C413 59 399 63 390 54 C382 47 382 34 391 30 Z" />
                </g>
                <g fill="none" stroke="#F5A300" strokeWidth="3.2" strokeLinecap="round">
                  <path d="M378 106 C396 140 395 176 379 212 C365 242 370 278 392 305 C413 331 414 367 393 398" />
                  <path d="M379 212 C420 220 451 245 468 279" />
                  <path d="M392 305 C355 315 330 337 316 365" />
                  <path d="M392 305 C430 324 456 349 472 384" />
                </g>
                <g fill="#F5A300" stroke="white" strokeWidth="5">
                  <circle cx="378" cy="106" r="8" />
                  <circle cx="379" cy="212" r="8" />
                  <circle cx="392" cy="305" r="8" />
                  <circle cx="393" cy="398" r="8" />
                  <circle cx="468" cy="279" r="8" />
                  <circle cx="316" cy="365" r="8" />
                  <circle cx="472" cy="384" r="8" />
                </g>
                <g fill="#0A234F" fontSize="14" fontWeight="700">
                  <text x="396" y="110">Glasgow</text>
                  <text x="398" y="216">Manchester</text>
                  <text x="410" y="309">Birmingham</text>
                  <text x="410" y="404">London</text>
                  <text x="486" y="283">Leeds</text>
                  <text x="245" y="370">Bristol</text>
                  <text x="490" y="390">Felixstowe</text>
                </g>
              </svg>
              <div className="absolute bottom-8 right-10 rounded-xl border border-[#DDE5EF] bg-white/90 px-4 py-3 shadow-[0_12px_34px_rgba(8,38,86,0.10)] backdrop-blur">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#F5A300]">UK transport network</p>
                <p className="mt-1 text-xs font-bold text-[#405978]">Illustrative route view</p>
              </div>
            </div>
          ) : null}
          <div className="relative mx-auto max-w-[1240px]">
            <div className="flex flex-col items-start gap-2">
              <p className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-[#F5A300]">Early Access · First 3 Months Free</p>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5A300]">{kicker}</p>
            </div>
            <h1 className="mt-5 max-w-[980px] text-[3.2rem] font-black leading-[0.96] tracking-tight text-[#102447] sm:text-[4.6rem] lg:text-[5.15rem]">{title}</h1>
            <p className="mt-7 max-w-3xl text-lg font-semibold leading-8 text-[#60758F]">{intro}</p>
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
